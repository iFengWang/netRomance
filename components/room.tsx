'use client';

import Link from 'next/link';
import {useEffect,useRef,useState,type FormEvent,type RefObject} from 'react';
import {
 ArrowLeft,ArrowRight,Check,ChevronDown,ChevronRight,Copy,Flag,Heart,HeartHandshake,
 LoaderCircle,LogOut,MapPin,Maximize2,Menu,MessageCircle,Mic,MicOff,Minimize2,QrCode,
 Send,ShieldCheck,UserRound,Users,Video,VideoOff,VolumeX,X,
} from 'lucide-react';
import {api,post} from '@/lib/client';
import {RoomRTC} from '@/lib/rtc';
import {STAGES,type Participant,type Profile,type Room,type RoomState} from '@/lib/types';
import {useApp} from './app-provider';
import {ProfileModal} from './matches';
import {Avatar,Empty,Modal,Rules} from './ui';

function MaleSilhouetteIcon({size=18}:{size?:number}){
 return <svg className="silhouette-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M8.1 8.1c.15 2.3 1.73 4.2 3.9 4.2s3.76-1.9 3.9-4.2l.08-1.5c.1-2.3-1.55-4.1-3.98-4.1S7.92 4.3 8.02 6.6l.08 1.5Z"/>
  <path fill="currentColor" d="m7.9 7.25.4-3.15 2.1-1.45 3.15-.2 2.25 1.6.45 2.25-2.2-1.05-1.45.7-1.25-.7-1.3 1.15-2.1.85ZM9.25 12.25 12 14.1l2.75-1.85 1.15 2.1-1.55 1.2-1.05-1.05-.55 1.12.82 4.88h-3.14l.82-4.88-.55-1.12-1.05 1.05-1.55-1.2 1.15-2.1Z"/>
  <path fill="currentColor" d="M9.15 12.55 4.2 15.1c-1.15.6-1.85 1.78-1.85 3.08V21h8.22l-1.42-8.45Zm5.7 0L19.8 15.1c1.15.6 1.85 1.78 1.85 3.08V21h-8.22l1.42-8.45Z"/>
 </svg>;
}

function FemaleSilhouetteIcon({size=18}:{size?:number}){
 return <svg className="silhouette-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M11.85 2.1c-3.2 0-5.15 2.22-5.15 5.55 0 2.6-1.02 4.18-2.2 5.4 1.08.23 2.07.08 2.95-.45-.12 1.88-1.08 3.27-2.28 4.38 2.2.28 4-.45 5.08-2.15-.63-1.2-1.02-2.68-1.02-4.05 0-.9.15-1.55.37-2.03.45.65 1.2 1.05 2.03 1.05 1.43 0 2.57-1.2 2.57-2.68 0-.53-.15-1.03-.42-1.43 1.2.43 2.02 1.53 2.02 2.93 0 2.85-1.15 5.02-2.2 6.35 1.2 1.73 3.08 2.45 5.23 2-1.3-1-2.18-2.35-2.28-4.15.85.45 1.78.55 2.8.28-1.27-1.33-2.03-3-2.03-5.33 0-3.35-2.15-5.67-5.47-5.67Z"/>
  <path fill="currentColor" d="M9.45 14.3 4.2 17c-1.15.6-1.85 1.78-1.85 3.08V21h19.3v-.92c0-1.3-.7-2.48-1.85-3.08l-5.25-2.7c-.3 1.05-1.27 1.82-2.55 1.82s-2.25-.77-2.55-1.82Z"/>
 </svg>;
}

function KickGuestIcon({size=17}:{size?:number}){
 return <svg className="kick-guest-icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
  <path fill="currentColor" d="M15.8 2.15a2.55 2.55 0 1 1-3.6 3.6 2.55 2.55 0 0 1 3.6-3.6Z"/>
  <path fill="currentColor" d="m10.25 6.35 3.05 2.1 2.72-.45a1.05 1.05 0 0 1 .35 2.07l-3.55.6-1.82-1.2-1.08 2.38 2.35 1.33 2.4 4.25a1.2 1.2 0 0 1-2.08 1.2l-2.12-3.73-2.28-1.27-1.42 3.2-2.47 3.2a1.2 1.2 0 0 1-1.9-1.47l2.25-2.93 2.33-6.08-1.6.78-1.1 2.52a1.05 1.05 0 0 1-1.92-.85l1.25-2.88 3.85-1.9a1.1 1.1 0 0 1 1.1.08Z"/>
  <path fill="currentColor" d="m18.9 12.2 2.72.48-.4 2.22-2.7-.48.38-2.22Zm-.75 4.05 2.12 1.77-1.43 1.7-2.12-1.77 1.43-1.7Z"/>
 </svg>;
}

export function RoomPage({id}:{id:string}){
 const {user,loading,login}=useApp();
 const [room,setRoom]=useState<Room|null>(null);
 const [error,setError]=useState('');
 const [joined,setJoined]=useState(false);
 const [busy,setBusy]=useState(false);
 const [rules,setRules]=useState(false);

 useEffect(()=>{
  api<{room:Room}>('rooms/'+id).then(d=>setRoom(d.room)).catch(e=>setError(e.message));
 },[id]);

 async function join(){
  if(!user){login();return;}
  setBusy(true);setError('');
  try{await post('rooms/'+id+'/join');setJoined(true);}
  catch(e){setError((e as Error).message);}
  finally{setBusy(false);}
 }

 if(joined&&user)return <LiveRoom id={id} onLeave={()=>setJoined(false)}/>;

 return <div className="page room-entry">
  <Link className="back-link" href="/"><ArrowLeft size={16}/>返回相遇大厅</Link>
  {room?<section className="entry-card">
   <div className="entry-image"><img src={'/images/'+room.cover+'.webp'} alt="房间氛围"/><span>{room.category}</span></div>
   <div className="entry-content">
    <div className="entry-meta"><MapPin size={15}/>{room.city}<span>{room.mode} · {room.capacity}人</span></div>
    <h1>{room.title}</h1><p className="entry-description">{room.description}</p>
    <div className="entry-stats"><span><Users size={18}/>{room.occupancy} / {room.capacity} 嘉宾</span><span><Heart size={17}/>{STAGES[room.stage]}</span></div>
    <div className="entry-rules"><h3>赴约之前，一点小约定</h3><p><Check size={15}/>主持人默认只开启语音，嘉宾自主开启音视频</p><p><Check size={15}/>保持真诚，尊重每一位嘉宾的选择</p><p><Check size={15}/>三轮交流后，双方互选即牵手成功</p></div>
    {!room.host_id&&<div className="notice">这是一间等待开启的房间。第一位加入的人将成为主持人。</div>}
    {error&&<p className="error" role="alert">{error}</p>}
    <button className="button primary full" disabled={busy||loading} onClick={join}>{busy?<LoaderCircle size={18} className="spin"/>:<Video size={18}/>} {user?'准备好了，进入房间':'登录后，开启这场相遇'}</button>
    <button className="text-button" onClick={()=>setRules(true)}>查看完整相亲规则<ChevronRight size={14}/></button>
    <p className="fine-print"><ShieldCheck size={13}/>音视频不会被应用录制</p>
   </div>
  </section>:error?<Empty title="暂时无法进入房间" description={error}><Link className="button outline" href="/">返回大厅</Link></Empty>:<div className="skeleton"/>}
  {rules&&<Rules onClose={()=>setRules(false)}/>}
 </div>;
}

function LiveRoom({id,onLeave}:{id:string;onLeave:()=>void}){
 const {user,toast}=useApp();
 const [state,setState]=useState<RoomState|null>(null);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const [local,setLocal]=useState<MediaStream|null>(null);
 const [streams,setStreams]=useState<Record<string,MediaStream>>({});
 const [connections,setConnections]=useState<Record<string,string>>({});
 const [mic,setMic]=useState(false);
 const [camera,setCamera]=useState(false);
 const [mediaBusy,setMediaBusy]=useState(false);
 const [profile,setProfile]=useState<Profile|null>(null);
 const [report,setReport]=useState<Participant|null>(null);
 const [confirm,setConfirm]=useState<Participant|null>(null);
 const [chat,setChat]=useState('');
 const [chatOpen,setChatOpen]=useState(false);
 const [chatBusy,setChatBusy]=useState(false);
 const [mediaError,setMediaError]=useState('');
 const [fullscreen,setFullscreen]=useState(false);
 const [hostMenuOpen,setHostMenuOpen]=useState(false);
 const [inviteOpen,setInviteOpen]=useState(false);
 const [inviteUrl,setInviteUrl]=useState('');
 const [qrCode,setQrCode]=useState('');
 const [expandedSlot,setExpandedSlot]=useState<string|null>(null);
 const rtc=useRef<RoomRTC|null>(null);
 const localRef=useRef<MediaStream|null>(null);
 const alive=useRef(true);
 const bottom=useRef<HTMLDivElement>(null);
 const theaterRef=useRef<HTMLDivElement>(null);
 const hostMenuRef=useRef<HTMLDivElement>(null);
 const hostAudioRequested=useRef(false);
 const mediaStateSeen=useRef<string|null>(null);

 useEffect(()=>{window.dispatchEvent(new CustomEvent('xinyu:set-sidebar',{detail:false}));},[]);
 useEffect(()=>{
  if(!expandedSlot)return;
  const previous=document.body.style.overflow;
  const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setExpandedSlot(null);};
  document.body.style.overflow='hidden';window.addEventListener('keydown',close);
  return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close);};
 },[expandedSlot]);

 useEffect(()=>{
  if(!user)return;
  let disposed=false;let timer:ReturnType<typeof setTimeout>;let cursor='0';alive.current=true;
  const manager=new RoomRTC(
   id,user.id,
   (uid,stream)=>{if(disposed)return;setStreams(prev=>{const next={...prev};if(stream)next[uid]=stream;else delete next[uid];return next;});},
   (uid,status)=>{if(!disposed)setConnections(prev=>({...prev,[uid]:status}));},
   message=>{if(!disposed)setMediaError(message);},
  );
  rtc.current=manager;
  async function poll(){
   if(disposed)return;
   try{
    const data=await api<RoomState>('rooms/'+id+'/state?since='+cursor);
    if(disposed)return;
    setState(data);setError('');
    await manager.sync(data.participants,data.signals);
    cursor=data.signalCursor;
   }catch(e){
    if(!disposed){
     const message=(e as Error).message;setError(message);
     if(message.includes('重新加入')||message.includes('先登录')){toast(message);onLeave();return;}
    }
   }
   if(!disposed)timer=setTimeout(poll,1100);
  }
  manager.init().then(()=>poll()).catch(()=>{if(!disposed){setMediaError('音视频初始化失败，文字聊天仍可使用');poll();}});
  const leave=()=>{fetch('/api/rooms/'+id+'/leave',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});};
  const pagehide=()=>{manager.stop();leave();};
  window.addEventListener('pagehide',pagehide);
  return()=>{
   disposed=true;alive.current=false;clearTimeout(timer);manager.stop();
   localRef.current?.getTracks().forEach(track=>track.stop());
   window.removeEventListener('pagehide',pagehide);leave();
  };
 },[id,user?.id]);

 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth',block:'nearest'});},[state?.messages.length]);
 useEffect(()=>{const sync=()=>setFullscreen(document.fullscreenElement===theaterRef.current);document.addEventListener('fullscreenchange',sync);return()=>document.removeEventListener('fullscreenchange',sync);},[]);
 useEffect(()=>{if(!hostMenuOpen)return;const close=(event:PointerEvent)=>{if(!hostMenuRef.current?.contains(event.target as Node))setHostMenuOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[hostMenuOpen]);

 const me=state?.participants.find(person=>person.id===user?.id);
 const host=state?.room.host_id===user?.id;
 const moderator=state?.participants.find(person=>person.role==='host');

 useEffect(()=>{
  if(me?.muted)void applyMedia(false,false,false);
 },[me?.muted]);
 useEffect(()=>{
  if(host&&me&&!hostAudioRequested.current){hostAudioRequested.current=true;void applyMedia(true,false,true);}
 },[host,me?.id]);
 useEffect(()=>{
  if(!me)return;const key=`${me.audio_enabled}:${me.video_enabled}`;
  if(mediaStateSeen.current===null){mediaStateSeen.current=key;return;}
  if(mediaStateSeen.current===key)return;mediaStateSeen.current=key;
  void applyMedia(me.audio_enabled,me.video_enabled,false);
 },[me?.audio_enabled,me?.video_enabled]);

 async function publishMedia(audio:boolean,video:boolean){
  await Promise.all([
   post('rooms/'+id+'/media',{kind:'audio',enabled:audio}),
   post('rooms/'+id+'/media',{kind:'video',enabled:video}),
  ]);
 }

 async function applyMedia(wantAudio:boolean,wantVideo:boolean,publish:boolean){
  if(mediaBusy||(me?.muted&&(wantAudio||wantVideo)))return;
  setMediaBusy(true);setMediaError('');
  try{
   let stream=localRef.current;const hasAudio=!!stream?.getAudioTracks().length;const hasVideo=!!stream?.getVideoTracks().length;
   if((wantAudio&&!hasAudio)||(wantVideo&&!hasVideo)){
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('请通过 HTTPS 或 localhost 访问，才能开启音视频');
    const next=await navigator.mediaDevices.getUserMedia({
     audio:wantAudio?{echoCancellation:true,noiseSuppression:true}:false,
     video:wantVideo?{width:{ideal:640,max:1280},height:{ideal:480,max:720},frameRate:{ideal:24,max:30},facingMode:'user'}:false,
    });
    if(!alive.current){next.getTracks().forEach(track=>track.stop());return;}
    stream?.getTracks().forEach(track=>track.stop());stream=next;localRef.current=next;setLocal(next);await rtc.current?.setStream(next);
   }
   stream?.getAudioTracks().forEach(track=>{track.enabled=wantAudio;});stream?.getVideoTracks().forEach(track=>{track.enabled=wantVideo;});
   if(!wantAudio&&!wantVideo&&stream){stream.getTracks().forEach(track=>track.stop());localRef.current=null;setLocal(null);await rtc.current?.setStream(null);}
   setMic(wantAudio);setCamera(wantVideo);if(publish)await publishMedia(wantAudio,wantVideo);
  }catch(e){
   const name=(e as Error).name;
   setMediaError(name==='NotAllowedError'?'设备权限未开启。请在浏览器设置中允许麦克风或摄像头。':name==='NotFoundError'?'未检测到可用的摄像头或麦克风。':(e as Error).message);
   const actualAudio=!!localRef.current?.getAudioTracks().some(track=>track.readyState==='live'&&track.enabled);const actualVideo=!!localRef.current?.getVideoTracks().some(track=>track.readyState==='live'&&track.enabled);
   setMic(actualAudio);setCamera(actualVideo);await publishMedia(actualAudio,actualVideo).catch(()=>{});
  }finally{if(alive.current)setMediaBusy(false);}
 }

 function toggle(kind:'audio'|'video'){
  if(me?.muted){toast('主持人已暂停你的发言权限');return;}
  void applyMedia(kind==='audio'?!mic:mic,kind==='video'?!camera:camera,true);
 }

 async function act(action:string,data:unknown={}){
  setBusy(true);
  try{await post('rooms/'+id+'/'+action,data);return true;}
  catch(e){toast((e as Error).message);return false;}
  finally{setBusy(false);}
 }

 async function send(e:FormEvent){
  e.preventDefault();if(!chat.trim()||chatBusy)return;setChatBusy(true);
  try{await post('rooms/'+id+'/chat',{body:chat.trim()});setChat('');}
  catch(e){toast((e as Error).message);}
  finally{setChatBusy(false);}
 }

 async function openInvite(){
  setInviteOpen(true);setQrCode('');
  try{
   const {baseUrl}=await api<{baseUrl:string}>('invite-url');
   const url=baseUrl.replace(/\/$/,'')+location.pathname;setInviteUrl(url);
   const {toDataURL}=await import('qrcode');
   setQrCode(await toDataURL(url,{width:260,margin:1,errorCorrectionLevel:'M',color:{dark:'#633448',light:'#ffffffff'}}));
  }catch(e){setInviteUrl(location.href);toast((e as Error).message||'二维码生成失败，请复制房间链接');}
 }

 async function copy(){
  try{await navigator.clipboard.writeText(inviteUrl||location.href);toast('房间链接已复制，邀请朋友来相遇吧。');}
  catch{toast('复制失败，请直接复制浏览器地址栏中的房间链接。');}
 }

 async function toggleFullscreen(){
  try{
   if(document.fullscreenElement)await document.exitFullscreen();
   else if(theaterRef.current?.requestFullscreen)await theaterRef.current.requestFullscreen();
   else toast('当前浏览器不支持网页全屏');
  }catch{toast('无法切换全屏，请检查浏览器权限');}
 }

 if(!state)return <div className="page"><div className="skeleton"/>{error&&<p className="error">{error}</p>}<button className="text-button" onClick={onLeave}>返回房间入口</button></div>;

 const guests=state.participants.filter(person=>person.role==='guest');
 const featuredGender:'male'|'female'=state.room.mode==='男生专场'?'male':'female';
 const supportingGender:'male'|'female'=featuredGender==='male'?'female':'male';
 const featured=guests.find(person=>person.gender===featuredGender);
 const supporting=guests.filter(person=>person.gender===supportingGender);
 const anyGuestAudioOn=guests.some(person=>person.audio_enabled&&!person.muted);
 const anyGuestVideoOn=guests.some(person=>person.video_enabled&&!person.muted);
 const wallSlots=Array.from({length:state.room.capacity},(_,index)=>({
  gender:index===0?featuredGender:supportingGender,
  person:index===0?featured:supporting[index-1],
 }));
 const stageAction=state.room.stage===0?'开始相亲':state.room.stage===3?'公布牵手结果':state.room.stage===4?'开启下一场':'进入'+STAGES[state.room.stage+1];
 const displayStage=Math.min(Math.max(state.room.stage,1),3);

 return <div className="page live-page">
  <div className={'live-layout '+(chatOpen?'chat-open':'')}>
   <div className="stage-area">
    <div className="theater-shell" ref={theaterRef}>
     <header className="theater-header">
      <div className="theater-primary">
       <button className="room-menu-toggle" onClick={()=>window.dispatchEvent(new Event('xinyu:toggle-sidebar'))} aria-label="切换左侧菜单" title="MENU"><Menu size={18}/></button>
       <div className="room-summary"><strong>{state.room.title}</strong><small><MapPin size={11}/>{state.room.city} · {state.room.mode} · {guests.length}/{state.room.capacity} 嘉宾 · 第 {state.room.round} 场</small></div>
       <div className="moderator-menu-wrap" ref={hostMenuRef}>
        {host?<button className="moderator-identity" onClick={()=>setHostMenuOpen(value=>!value)} aria-expanded={hostMenuOpen} aria-haspopup="menu" aria-label="打开主持人控制菜单"><Avatar name={moderator?.name??state.room.host_name??'主持人'} photo={moderator?.photos[0]}/><span><small>本场主持人</small><strong>{moderator?.name??state.room.host_name??'等待主持人'}</strong></span><i className={moderator?'online':''}/><ChevronDown size={13}/></button>:<div className="moderator-identity"><Avatar name={moderator?.name??state.room.host_name??'主持人'} photo={moderator?.photos[0]}/><span><small>本场主持人</small><strong>{moderator?.name??state.room.host_name??'等待主持人'}</strong></span><i className={moderator?'online':''}/></div>}
        {host&&hostMenuOpen&&<div className="host-control-menu" role="menu">
         <button role="menuitem" onClick={()=>{toggle('audio');setHostMenuOpen(false);}}>{mic?<MicOff size={16}/>:<Mic size={16}/>}<span>{mic?'关闭主持人麦克风':'开启主持人麦克风'}</span></button>
         <button role="menuitem" disabled={busy} onClick={()=>{void act('stage',{expected:state.room.stage});setHostMenuOpen(false);}}><HeartHandshake size={16}/><span>{stageAction}</span></button>
         <hr/>
         {anyGuestAudioOn?<button role="menuitem" disabled={!guests.length} onClick={()=>{void act('media-all',{kind:'audio',enabled:false});setHostMenuOpen(false);}}><MicOff size={16}/><span>全部关麦</span><small>主持人除外</small></button>:<button role="menuitem" disabled={!guests.length} onClick={()=>{void act('media-all',{kind:'audio',enabled:true});setHostMenuOpen(false);}}><Mic size={16}/><span>全部开启麦克风</span></button>}
         {anyGuestVideoOn?<button role="menuitem" disabled={!guests.length} onClick={()=>{void act('media-all',{kind:'video',enabled:false});setHostMenuOpen(false);}}><VideoOff size={16}/><span>全部关闭视频</span></button>:<button role="menuitem" disabled={!guests.length} onClick={()=>{void act('media-all',{kind:'video',enabled:true});setHostMenuOpen(false);}}><Video size={16}/><span>全部开启视频</span></button>}
        </div>}
       </div>
       <div className="header-stage-progress">{[1,2,3].map(n=><div key={n} className={(state.room.stage>n?'complete ':'')+(displayStage===n?'current':'')}><span>{state.room.stage>n?<Check size={11}/>:n}</span><section><strong>{STAGES[n]}</strong><small>{['爱之初体验','爱之再判断','爱之终抉择'][n-1]}</small></section></div>)}</div>
       {(mediaBusy||mediaError||error)&&<div className={'header-feedback '+(mediaError||error?'error-text':'')} title={mediaError||error||'正在等待设备授权'}>{mediaBusy?<LoaderCircle size={13} className="spin"/>:<ShieldCheck size={13}/>}<span>{mediaError||error||'设备授权中'}</span></div>}
       <div className="theater-actions">
        <button onClick={()=>void openInvite()} aria-label="邀请朋友并生成二维码" title="邀请朋友"><QrCode size={18}/></button>
        <button onClick={()=>setChatOpen(value=>!value)} aria-pressed={chatOpen} aria-label={chatOpen?'隐藏聊天室':'显示聊天室'} title={chatOpen?'隐藏聊天室':'显示聊天室'}><MessageCircle size={18}/>{state.messages.length>0&&<b>{state.messages.length}</b>}</button>
        <button onClick={toggleFullscreen} aria-label={fullscreen?'退出全屏':'全屏显示'} title={fullscreen?'退出全屏':'全屏显示'}>{fullscreen?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>
        <button onClick={onLeave} aria-label="退出房间" title="退出房间" className="leave-action"><LogOut size={20} strokeWidth={2.25}/></button>
       </div>
      </div>
     </header>
     <div className={'video-grid wall-'+state.room.capacity}>
      {wallSlots.map((slot,index)=>{const canControlLamp=slot.gender===supportingGender&&me?.role==='guest'&&(slot.person?.id===user?.id||me.gender!==slot.gender);const slotClass='slot-'+index;const expanded=expandedSlot===slotClass;const onExpand=()=>setExpandedSlot(current=>current===slotClass?null:slotClass);return slot.person?<VideoTile
       key={slot.person.id} slotClass={slotClass} expanded={expanded} onExpand={onExpand} person={slot.person} self={slot.person.id===user?.id}
       stream={slot.person.id===user?.id?local:streams[slot.person.id]} camera={slot.person.id===user?.id?camera:undefined}
       mic={slot.person.id===user?.id?mic:undefined} status={connections[slot.person.id]}
       onProfile={()=>setProfile(slot.person!)} showLamp={slot.gender===supportingGender} onLamp={canControlLamp?()=>act('lamp',{target:slot.person!.id,on:!slot.person!.lamp}):undefined}
       onAudio={(host||slot.person.id===user?.id)?()=>{if(slot.person!.id===user?.id)toggle('audio');else void act('media',{target:slot.person!.id,kind:'audio',enabled:!slot.person!.audio_enabled});}:undefined}
       onVideo={(host||slot.person.id===user?.id)?()=>{if(slot.person!.id===user?.id)toggle('video');else void act('media',{target:slot.person!.id,kind:'video',enabled:!slot.person!.video_enabled});}:undefined}
       lampBusy={busy} canChoose={!host&&state.room.stage===3&&slot.person.id!==user?.id}
       chosen={state.choice===slot.person.id} onChoose={()=>act('choose',{target:slot.person!.id}).then(ok=>{if(ok)toast('心意已悄悄送出，等待主持人公布结果。');})}
       onReport={()=>setReport(slot.person!)} onKick={host?()=>setConfirm(slot.person!):undefined}
      />:<VideoPlaceholder key={'empty-'+index} slotClass={slotClass} expanded={expanded} onExpand={onExpand} gender={slot.gender} showLamp={slot.gender===supportingGender}/>;}) }
     </div>
     {state.room.stage===4&&state.matches.length>0&&<div className="theater-overlay match-result"><Heart size={25} fill="currentColor"/><div><h3>恭喜，你遇见了双向的心动！</h3><Link href="/matches">去看看你们的牵手记录<ArrowRight size={14}/></Link></div></div>}
     {host&&state.reports.length>0&&<div className="theater-overlay report-panel"><h3><Flag size={16}/>待关注的举报</h3>{state.reports.map(item=><p key={item.id}><strong>{item.name}</strong>：{item.reason}</p>)}</div>}
    </div>
   </div>
   {chatOpen&&<ChatPanel state={state} userId={user!.id} muted={!!me?.muted} value={chat} busy={chatBusy} bottom={bottom} onChange={setChat} onSubmit={send}/>}
  </div>
  {profile&&<ProfileModal profile={profile} onClose={()=>setProfile(null)}/>}
  {inviteOpen&&<InviteModal url={inviteUrl} qrCode={qrCode} onCopy={copy} onClose={()=>setInviteOpen(false)}/>}
  {report&&<ReportModal person={report} onClose={()=>setReport(null)} onSubmit={async reason=>{const ok=await act('report',{target:report.id,reason});if(ok){setReport(null);toast('举报已记录，主持人可在控制台查看。');}}}/>}
  {confirm&&<Modal title={'管理嘉宾 · '+confirm.name} onClose={()=>setConfirm(null)}><p className="muted">暂停发言会同时关闭嘉宾的音视频，并禁止发送文字。移出后，该账号无法再次进入此房间。</p><div className="moderation-actions"><button className="button outline" onClick={()=>act('moderate',{target:confirm.id,action:confirm.muted?'unmute':'mute'}).then(ok=>{if(ok)setConfirm(null);})}><VolumeX size={17}/>{confirm.muted?'恢复发言权限':'暂停发言与音视频'}</button><button className="button danger" onClick={()=>act('moderate',{target:confirm.id,action:'remove'}).then(ok=>{if(ok)setConfirm(null);})}><X size={17}/>移出并禁止再次加入</button></div></Modal>}
 </div>;
}

function VideoTile({person,self,stream,camera,mic,status,slotClass,expanded,onExpand,onProfile,showLamp,onLamp,onAudio,onVideo,lampBusy,canChoose,chosen,onChoose,onReport,onKick}:{person:Participant;self:boolean;stream?:MediaStream|null;camera?:boolean;mic?:boolean;status?:string;slotClass:string;expanded:boolean;onExpand:()=>void;onProfile:()=>void;showLamp:boolean;onLamp?:()=>void;onAudio?:()=>void;onVideo?:()=>void;lampBusy:boolean;canChoose:boolean;chosen:boolean;onChoose:()=>void;onReport:()=>void;onKick?:()=>void}){
 const video=useRef<HTMLVideoElement>(null);const [playError,setPlayError]=useState(false);
 const audioOn=!person.muted&&(self?!!mic:person.audio_enabled);const videoOn=!person.muted&&(self?!!camera:person.video_enabled);
 useEffect(()=>{if(video.current){video.current.srcObject=stream??null;if(stream)video.current.play().catch(()=>setPlayError(true));}},[stream]);
 return <article className={'video-tile '+slotClass+(chosen?' chosen':'')+(expanded?' tile-viewport-expanded':'')} onDoubleClick={event=>{if(!(event.target as Element).closest('button'))onExpand();}} title={expanded?'双击恢复窗格':'双击全屏显示'}>
  <video ref={video} autoPlay playsInline muted={self||person.muted} className={(self&&!camera||person.muted?'video-hidden':'')+(self?' mirrored':'')}/>
  {(!stream||(self&&!camera)||person.muted)&&<div className="video-identity"><Avatar name={person.name} photo={person.photos[0]} size="large"/><p>{person.muted?'发言已暂停':self?'准备好时，开启摄像头':status==='failed'?'连接未成功':status==='connected'?'已连接 · 等待对方开启视频':'等待音视频连接'}</p></div>}
  {showLamp&&<button className={'tile-lamp '+(person.lamp?'lamp-on':'lamp-off')} onClick={onLamp} disabled={!onLamp||lampBusy} aria-label={onLamp?(person.lamp?'关闭'+person.name+'的心动灯':'点亮'+person.name+'的心动灯'):(person.lamp?'心动灯已亮':'心动灯已熄')} title={person.lamp?'心动灯已亮':'心动灯已熄'}><img src="/images/lamp-3d.png" alt=""/></button>}
  <div className="tile-top"><div>{!self&&<button className="tile-icon" onClick={onReport} aria-label={'举报'+person.name} title="举报"><Flag size={13}/></button>}</div></div>
  <div className="tile-bottom"><button className="tile-person-button" onClick={onProfile} aria-label={'查看'+person.name+'的个人信息'} title="查看个人信息"><span className={'gender-icon '+person.gender}>{person.gender==='male'?<MaleSilhouetteIcon/>:<FemaleSilhouetteIcon/>}</span><span><strong>{person.name}{self?' · 我':''}</strong><small>{person.age}岁 · {person.city}</small></span></button><div className="tile-actions"><button className={audioOn?'media-on':''} onClick={onAudio} disabled={!onAudio||lampBusy} aria-label={(audioOn?'关闭':'开启')+person.name+'的麦克风'} title={audioOn?'麦克风已开':'麦克风已关'}>{audioOn?<Mic size={15}/>:<MicOff size={15}/>}</button><button className={videoOn?'media-on':''} onClick={onVideo} disabled={!onVideo||lampBusy} aria-label={(videoOn?'关闭':'开启')+person.name+'的视频'} title={videoOn?'视频已开':'视频已关'}>{videoOn?<Video size={15}/>:<VideoOff size={15}/>}</button>{onKick&&<button className="kick-action" onClick={onKick} aria-label={'踢出'+person.name} title="踢出房间"><KickGuestIcon/></button>}</div></div>
  {canChoose&&<button className={'choose-button '+(chosen?'chosen':'')} onClick={onChoose} aria-label={chosen?'取消选择'+person.name:'选择'+person.name} title={chosen?'已选择 TA':'选择 TA'}><Heart size={15} fill={chosen?'currentColor':'none'}/></button>}
  {playError&&<button className="play-audio" onClick={()=>video.current?.play().then(()=>setPlayError(false)).catch(()=>{})}>点击播放音视频</button>}
 </article>;
}

function VideoPlaceholder({gender,slotClass,showLamp,expanded,onExpand}:{gender:'male'|'female';slotClass:string;showLamp:boolean;expanded:boolean;onExpand:()=>void}){
 return <div className={'video-placeholder '+slotClass+(expanded?' tile-viewport-expanded':'')} onDoubleClick={event=>{if(!(event.target as Element).closest('button'))onExpand();}} title={expanded?'双击恢复窗格':'双击全屏显示'}>{showLamp&&<button className="tile-lamp lamp-off" disabled aria-label="暂无心动灯状态"><img src="/images/lamp-3d.png" alt=""/></button>}<span><UserRound size={24}/></span><p>等待{gender==='male'?'男':'女'}嘉宾入座</p><small>把下一次心动，留给未知</small><div className="placeholder-actions"><button disabled aria-label="暂无麦克风状态"><MicOff size={14}/></button><button disabled aria-label="暂无视频状态"><VideoOff size={14}/></button></div></div>;
}

function InviteModal({url,qrCode,onCopy,onClose}:{url:string;qrCode:string;onCopy:()=>void;onClose:()=>void}){
 return <Modal title="邀请朋友加入" onClose={onClose}><div className="invite-panel"><div className="invite-qr">{qrCode?<img src={qrCode} alt="房间邀请二维码"/>:<LoaderCircle size={28} className="spin"/>}</div><p>使用手机扫码，直接进入这场相遇</p><code>{url||'正在生成局域网邀请地址…'}</code><button className="button primary full" disabled={!url} onClick={onCopy}><Copy size={16}/>复制房间链接</button></div></Modal>;
}

function ChatPanel({state,userId,muted,value,busy,bottom,onChange,onSubmit}:{state:RoomState;userId:string;muted:boolean;value:string;busy:boolean;bottom:RefObject<HTMLDivElement|null>;onChange:(value:string)=>void;onSubmit:(e:FormEvent)=>void}){
 return <aside className="chat-panel"><div className="chat-header"><h2>相遇聊天室</h2><span>{state.participants.length} 人在线</span></div><div className="chat-messages"><div className="chat-welcome"><Heart size={21}/><p>欢迎来到这场相遇</p><small>一句友好的问候，<br/>就是故事最好的开场。</small></div>{state.messages.map(message=><div className={'chat-message '+(message.user_id===userId?'own':'')} key={message.id}><span>{message.name}<small>{new Date(message.created_at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</small></span><p>{message.body}</p></div>)}<div ref={bottom}/></div><form className="chat-form" onSubmit={onSubmit}><input aria-label="聊天消息" placeholder={muted?'你已被主持人禁言':'说点什么，让彼此更近一点…'} maxLength={500} value={value} disabled={muted} onChange={e=>onChange(e.target.value)}/><button aria-label="发送消息" disabled={!value.trim()||busy||muted}><Send size={18}/></button></form><p className="chat-tip"><ShieldCheck size={12}/>文明交流，请勿分享敏感信息</p></aside>;
}

function ReportModal({person,onClose,onSubmit}:{person:Participant;onClose:()=>void;onSubmit:(reason:string)=>Promise<void>}){
 const [reason,setReason]=useState('');const [busy,setBusy]=useState(false);
 return <Modal title={'举报 · '+person.name} onClose={onClose}><form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);await onSubmit(reason);setBusy(false);}}><label>发生了什么？<textarea placeholder="请描述不当言论、骚扰或其他问题" value={reason} onChange={e=>setReason(e.target.value)} required maxLength={300} rows={4}/></label><p className="fine-print">举报内容将保存在房间管理记录中，供主持人查看。</p><button className="button primary" disabled={busy}>提交举报</button></form></Modal>;
}
