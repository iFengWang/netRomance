import {api,post} from './client';
import type {Participant,Signal} from './types';
type Peer={pc:RTCPeerConnection;joined:string;pending:RTCIceCandidateInit[];restarts:number;};
/** Small-room mesh, following df.im's per-peer connections and queued ICE approach. */
export class RoomRTC{
 private peers=new Map<string,Peer>();private config:RTCConfiguration={iceServers:[]};private closed=false;private stream:MediaStream|null=null;
 constructor(private roomId:string,private userId:string,private onStream:(id:string,stream:MediaStream|null)=>void,private onStatus:(id:string,state:string)=>void,private onError:(message:string)=>void){}
 async init(){const d=await api<{iceServers:RTCIceServer[]}>('ice');this.config={iceServers:d.iceServers};}
 private async send(to:string,payload:Signal['payload']){if(!this.closed)await post('rooms/'+this.roomId+'/signal',{to,payload});}
 private create(person:Participant){
  const pc=new RTCPeerConnection(this.config);const peer:Peer={pc,joined:person.joined_at,pending:[],restarts:0};this.peers.set(person.id,peer);
  for(const kind of ['audio','video'] as const){const track=this.stream?.getTracks().find(t=>t.kind===kind);pc.addTransceiver(track??kind,{direction:'sendrecv',...(track&&this.stream?{streams:[this.stream]}:{})});}
  pc.onicecandidate=e=>{if(e.candidate)this.send(person.id,{candidate:e.candidate.toJSON()}).catch(()=>{});};
  const incoming=new MediaStream();pc.ontrack=e=>{const stream=e.streams[0]??incoming;if(!e.streams[0])incoming.addTrack(e.track);this.onStream(person.id,stream);e.track.onunmute=()=>this.onStream(person.id,stream);};
  pc.onconnectionstatechange=()=>{
   this.onStatus(person.id,pc.connectionState);
   if(pc.connectionState==='connected'){for(const sender of pc.getSenders()){if(sender.track?.kind==='video'){const p=sender.getParameters();if(p.encodings.length)p.encodings[0].maxBitrate=800000;sender.setParameters(p).catch(()=>{});}}}
   if(pc.connectionState==='failed'&&this.userId<person.id&&peer.restarts<2){peer.restarts++;this.offer(person.id,true).catch(()=>this.onError('音视频连接中断，请离开后重新加入'));}
  };
  return peer;
 }
 private async offer(id:string,restart=false){const peer=this.peers.get(id);if(!peer||peer.pc.signalingState!=='stable'||this.closed)return;const offer=await peer.pc.createOffer({iceRestart:restart});await peer.pc.setLocalDescription(offer);await this.send(id,{description:peer.pc.localDescription!.toJSON()});}
 async sync(people:Participant[],signals:Signal[]){
  if(this.closed)return;const others=people.filter(p=>p.id!==this.userId);const ids=new Set(others.map(p=>p.id));
  for(const [id,p] of this.peers){const person=others.find(v=>v.id===id);if(!ids.has(id)||person?.joined_at!==p.joined){p.pc.close();this.peers.delete(id);this.onStream(id,null);}}
  for(const person of others){if(!this.peers.has(person.id)){this.create(person);if(this.userId<person.id)await this.offer(person.id);}}
  for(const signal of signals){const peer=this.peers.get(signal.sender_id);if(!peer||this.closed)continue;const {pc}=peer;
   try{
    if(signal.payload.description){const desc=signal.payload.description;
     if(desc.type==='answer'&&pc.signalingState!=='have-local-offer')continue;
     await pc.setRemoteDescription(desc);
     for(const candidate of peer.pending)await pc.addIceCandidate(candidate);peer.pending=[];
     if(desc.type==='offer'){await pc.setLocalDescription(await pc.createAnswer());await this.send(signal.sender_id,{description:pc.localDescription!.toJSON()});}
    }else if(signal.payload.candidate){if(pc.remoteDescription)await pc.addIceCandidate(signal.payload.candidate);else peer.pending.push(signal.payload.candidate);}
   }catch{this.onStatus(signal.sender_id,'failed');this.onError('音视频连接暂时失败，可退出房间后重试。');}
  }
 }
 async setStream(stream:MediaStream|null){if(this.closed){stream?.getTracks().forEach(t=>t.stop());return;}this.stream=stream;for(const {pc} of this.peers.values()){for(const t of pc.getTransceivers()){const kind=t.receiver.track.kind;const track=stream?.getTracks().find(t=>t.kind===kind)??null;await t.sender.replaceTrack(track);}}}
 stop(){this.closed=true;this.stream?.getTracks().forEach(t=>t.stop());for(const {pc} of this.peers.values())pc.close();this.peers.clear();}
}
