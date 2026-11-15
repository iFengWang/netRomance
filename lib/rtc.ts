import {api,post} from './client';
import type {Participant,Signal} from './types';

const FALLBACK_ICE:RTCIceServer[]=[
 {urls:'stun:stun.l.google.com:19302'},
 {urls:'stun:stun1.l.google.com:19302'},
 {urls:'stun:stun2.l.google.com:19302'},
];
const OFFER_TIMEOUT_MS=12_000;
const DISCONNECT_GRACE_MS=2_000;
const MAX_RESTARTS=3;

type Peer={
 pc:RTCPeerConnection;
 joined:string;
 pending:RTCIceCandidateInit[];
 restarts:number;
 recovering:boolean;
 makingOffer:boolean;
 ignoreOffer:boolean;
 offerTimer?:ReturnType<typeof setTimeout>;
 disconnectTimer?:ReturnType<typeof setTimeout>;
};

/**
 * Small-room mesh WebRTC manager. It deliberately follows df.im's resilient
 * conference pattern: per-peer queued ICE, deterministic offer ownership,
 * answer timeouts and ICE restart/rebuild recovery.
 */
export class RoomRTC{
 private peers=new Map<string,Peer>();
 private config:RTCConfiguration={iceServers:FALLBACK_ICE,iceCandidatePoolSize:10,bundlePolicy:'max-bundle',rtcpMuxPolicy:'require'};
 private closed=false;
 private stream:MediaStream|null=null;
 constructor(private roomId:string,private userId:string,private onStream:(id:string,stream:MediaStream|null)=>void,private onStatus:(id:string,state:string)=>void,private onError:(message:string)=>void){}

 async init(){
  // TURN is optional. A short timeout makes device startup independent from a
  // temporarily unavailable signaling endpoint, while retaining STUN fallback.
  try{
   const d=await api<{iceServers?:RTCIceServer[]}>('ice',{signal:AbortSignal.timeout(5_000)});
   const servers=d.iceServers?.length?d.iceServers:FALLBACK_ICE;
   this.config={...this.config,iceServers:servers};
  }catch{/* STUN-only fallback is intentional. */}
 }

 private async send(to:string,payload:Signal['payload']){
  if(!this.closed)await post('rooms/'+this.roomId+'/signal',{to,payload});
 }

 private clearTimers(peer:Peer){
  if(peer.offerTimer)clearTimeout(peer.offerTimer);
  if(peer.disconnectTimer)clearTimeout(peer.disconnectTimer);
  peer.offerTimer=undefined;peer.disconnectTimer=undefined;
 }

 private remove(id:string,stream=true){
  const peer=this.peers.get(id);if(!peer)return;
  this.clearTimers(peer);peer.pc.close();this.peers.delete(id);
  if(stream)this.onStream(id,null);
 }

 private create(person:Participant){
  const pc=new RTCPeerConnection(this.config);
  const peer:Peer={pc,joined:person.joined_at,pending:[],restarts:0,recovering:false,makingOffer:false,ignoreOffer:false};
  this.peers.set(person.id,peer);

  for(const kind of ['audio','video'] as const){
   const track=this.stream?.getTracks().find(item=>item.kind===kind);
   pc.addTransceiver(track??kind,{direction:'sendrecv',...(track&&this.stream?{streams:[this.stream]}:{})});
  }

  pc.onicecandidate=event=>{
   // A replaced PeerConnection may still emit its final candidate. Never mix
   // that candidate into the active negotiation generation.
   if(event.candidate&&this.peers.get(person.id)?.pc===pc)this.send(person.id,{candidate:event.candidate.toJSON()}).catch(()=>{});
  };

  const incoming=new MediaStream();
  pc.ontrack=event=>{
   if(this.peers.get(person.id)?.pc!==pc)return;
   const remote=event.streams[0]??incoming;
   if(!event.streams[0])incoming.addTrack(event.track);
   this.onStream(person.id,remote);
   event.track.onunmute=()=>{if(this.peers.get(person.id)?.pc===pc)this.onStream(person.id,remote);};
  };

  pc.onconnectionstatechange=()=>{
   if(this.peers.get(person.id)?.pc!==pc||this.closed)return;
   this.onStatus(person.id,pc.connectionState);
   if(pc.connectionState==='connected'){
    peer.restarts=0;this.clearTimers(peer);this.applyVideoEncoding(pc);
   }else if(pc.connectionState==='disconnected'){
    if(!peer.disconnectTimer)peer.disconnectTimer=setTimeout(()=>{
     peer.disconnectTimer=undefined;
     if(this.peers.get(person.id)?.pc===pc&&pc.connectionState==='disconnected')this.recover(person,'网络连接短暂中断').catch(()=>{});
    },DISCONNECT_GRACE_MS);
   }else if(pc.connectionState==='failed'){
    this.recover(person,'连接失败').catch(()=>{});
   }
  };
  pc.oniceconnectionstatechange=()=>{
   if(this.peers.get(person.id)?.pc!==pc||this.closed)return;
   if(pc.iceConnectionState==='failed')this.recover(person,'ICE 连接失败').catch(()=>{});
  };
  return peer;
 }

 private async applyVideoEncoding(pc:RTCPeerConnection){
  for(const sender of pc.getSenders()){
   if(sender.track?.kind!=='video')continue;
   try{
    const parameters=sender.getParameters();
    if(!parameters.encodings.length)parameters.encodings=[{}];
    parameters.encodings[0].maxBitrate=800000;
    parameters.degradationPreference='maintain-framerate';
    await sender.setParameters(parameters);
   }catch{/* Older browsers can continue without sender parameter tuning. */}
  }
 }

 private startOfferTimeout(person:Participant,peer:Peer){
  if(peer.offerTimer)clearTimeout(peer.offerTimer);
  peer.offerTimer=setTimeout(()=>{
   peer.offerTimer=undefined;
   if(this.peers.get(person.id)===peer&&peer.pc.signalingState==='have-local-offer')this.recover(person,'应答超时').catch(()=>{});
  },OFFER_TIMEOUT_MS);
 }

 private async offer(person:Participant,restart=false){
  const peer=this.peers.get(person.id);
  if(!peer||peer.pc.signalingState!=='stable'||this.closed)return;
  try{
   peer.makingOffer=true;
   const offer=await peer.pc.createOffer({iceRestart:restart});
   if(this.peers.get(person.id)!==peer||this.closed)return;
   await peer.pc.setLocalDescription(offer);
   await this.send(person.id,{description:peer.pc.localDescription!.toJSON()});
   this.startOfferTimeout(person,peer);
  }finally{peer.makingOffer=false;}
 }

 private async recover(person:Participant,reason:string){
  // Deterministic ownership avoids both peers rebuilding/renegotiating at once.
  if(this.closed||this.userId>=person.id)return;
  const peer=this.peers.get(person.id);if(!peer||peer.recovering||peer.restarts>=MAX_RESTARTS)return;
  peer.recovering=true;peer.restarts++;this.clearTimers(peer);this.onStatus(person.id,'reconnecting');
  try{
   if(peer.pc.signalingState==='stable'){
    await this.offer(person,true);
    return;
   }
   // A lost answer leaves the PC non-stable; start a clean negotiation instead
   // of repeatedly creating offers that browsers correctly reject.
   const restarts=peer.restarts;
   this.remove(person.id,false);
   this.create(person).restarts=restarts;
   await this.offer(person);
  }catch{
   if(peer.restarts>=MAX_RESTARTS)this.onError(`与一位嘉宾的${reason}未能恢复；可尝试切换网络后重新进入。`);
  }finally{peer.recovering=false;}
 }

 private async handleDescription(person:Participant,peer:Peer,description:RTCSessionDescriptionInit){
  const {pc}=peer;
  if(description.type==='answer'){
   if(pc.signalingState!=='have-local-offer')return;
   await pc.setRemoteDescription(description);
   if(peer.offerTimer)clearTimeout(peer.offerTimer);peer.offerTimer=undefined;
  }else{
   // Perfect negotiation fallback protects against stale retries and devices
   // that briefly overlap their initial offer with a reconnect offer.
   const collision=peer.makingOffer||pc.signalingState!=='stable';
   const polite=this.userId>person.id;
   peer.ignoreOffer=!polite&&collision;
   if(peer.ignoreOffer)return;
   if(collision){
    try{await pc.setLocalDescription({type:'rollback'});}
    catch{
     this.remove(person.id,false);
     peer=this.create(person); // fresh PC is safer than a permanently wedged one
    }
   }
   await peer.pc.setRemoteDescription(description);
   await peer.pc.setLocalDescription(await peer.pc.createAnswer());
   await this.send(person.id,{description:peer.pc.localDescription!.toJSON()});
  }
  const queued=peer.pending.splice(0);
  for(const candidate of queued)await peer.pc.addIceCandidate(candidate);
 }

 async sync(people:Participant[],signals:Signal[]){
  if(this.closed)return;
  const others=people.filter(person=>person.id!==this.userId);
  const byId=new Map(others.map(person=>[person.id,person]));
  for(const [id,peer] of this.peers){
   const person=byId.get(id);
   if(!person||person.joined_at!==peer.joined)this.remove(id);
  }
  for(const person of others){
   if(!this.peers.has(person.id)){
    this.create(person);
    if(this.userId<person.id)await this.offer(person);
   }
  }
  for(const signal of signals){
   const person=byId.get(signal.sender_id);const peer=this.peers.get(signal.sender_id);
   if(!person||!peer||this.closed)continue;
   try{
    if(signal.payload.description){
     await this.handleDescription(person,peer,signal.payload.description);
    }else if(signal.payload.candidate){
     // Ignore candidates belonging to an offer deliberately ignored during a
     // collision; they would otherwise poison the surviving negotiation.
     if(peer.ignoreOffer)continue;
     if(peer.pc.remoteDescription)await peer.pc.addIceCandidate(signal.payload.candidate);
     else if(peer.pending.length<128)peer.pending.push(signal.payload.candidate);
    }
   }catch{
    // A stale ICE candidate is normal after a rebuild. SDP failures use the
    // same deterministic recovery path as a network failure.
    if(signal.payload.description)this.recover(person,'协商失败').catch(()=>{});
   }
  }
 }

 async setStream(stream:MediaStream|null){
  if(this.closed){stream?.getTracks().forEach(track=>track.stop());return;}
  this.stream=stream;
  await Promise.all([...this.peers.values()].map(async({pc})=>{
   await Promise.all(pc.getTransceivers().map(async transceiver=>{
    const kind=transceiver.receiver.track.kind;
    const track=stream?.getTracks().find(item=>item.kind===kind)??null;
    await transceiver.sender.replaceTrack(track);
   }));
  }));
 }

 stop(){
  this.closed=true;this.stream?.getTracks().forEach(track=>track.stop());
  for(const id of [...this.peers.keys()])this.remove(id,false);
 }
}
