import { NextRequest,NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { db } from '@/lib/db';
import type {DbClient} from '@/lib/db-types';
import { createSession,currentUser,hashToken,passwordHash,publicFields,verifyPassword } from './auth';
import type {User} from './types';
class ApiError extends Error {constructor(public status:number,message:string){super(message);}}
const fail=(status:number,message:string):never=>{throw new ApiError(status,message);};
const uuid=z.string().uuid();
const text=(max:number)=>z.string().trim().min(1).max(max);
const profileSchema=z.object({name:text(20),age:z.number().int().min(18).max(100),gender:z.enum(['male','female']),city:text(20),occupation:z.string().trim().max(40).default(''),bio:z.string().trim().max(500).default(''),interests:z.array(text(20)).max(8).default([]),photos:z.array(z.string().max(700000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/)).max(3).default([])});
const roomSchema=z.object({title:text(40),description:text(200),city:text(20),category:z.enum(['同城相遇','兴趣同频','轻熟之约']),mode:z.enum(['男生专场','女生专场']),cover:z.enum(['cafe','sea','library']),capacity:z.union([z.literal(4),z.literal(6)]).default(6)});
const roomSelect=`SELECT r.*,u.name AS host_name,(SELECT count(*)::int FROM participants p WHERE p.room_id=r.id AND p.role='guest' AND p.last_seen>now()-interval '45 seconds') AS occupancy FROM rooms r LEFT JOIN users u ON u.id=r.host_id`;
const fields=publicFields.split(',').map(x=>'u.'+x).join(',');
async function body(req:NextRequest){if(Number(req.headers.get('content-length')||0)>2300000)fail(413,'图片或内容过大');const raw=await req.text();if(raw.length>2300000)fail(413,'图片或内容过大');try{return JSON.parse(raw);}catch{fail(400,'请求格式不正确');}}
async function limited(key:string,max:number,seconds:number){const now=new Date().toISOString();const resetAt=new Date(Date.now()+seconds*1000).toISOString();const r=await db.query<{hits:number}>(`INSERT INTO rate_limits(key,hits,reset_at) VALUES($1,1,$2) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<$3 THEN 1 ELSE rate_limits.hits+1 END,reset_at=CASE WHEN rate_limits.reset_at<$3 THEN $2 ELSE rate_limits.reset_at END RETURNING hits`,[key,resetAt,now]);if(r.rows[0].hits>max)fail(429,'操作太频繁，请稍后再试');}
async function transaction<T>(fn:(c:DbClient)=>Promise<T>){const c=await db.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release?.();}}
async function member(c:DbClient,roomId:string,userId:string){const r=await c.query(`SELECT * FROM participants WHERE room_id=$1 AND user_id=$2 AND last_seen>now()-interval '45 seconds'`,[roomId,userId]);return r.rows[0]??fail(403,'你已离开房间，请重新加入');}
const partnerFields=publicFields.split(',');
async function matches(userId:string,roomId?:string){const {rows}=await db.query<Record<string,unknown>>(`SELECT m.id,m.created_at,r.title AS room_title,${partnerFields.map(x=>`u.${x} AS partner_${x}`).join(',')} FROM matches m JOIN rooms r ON r.id=m.room_id JOIN users u ON u.id=CASE WHEN m.user_a=$1 THEN m.user_b ELSE m.user_a END WHERE (m.user_a=$1 OR m.user_b=$1) ${roomId?'AND m.room_id=$2':''} ORDER BY m.created_at DESC LIMIT 100`,roomId?[userId,roomId]:[userId]);return rows.map(row=>({id:row.id,created_at:row.created_at,room_title:row.room_title,partner:Object.fromEntries(partnerFields.map(field=>[field,row[`partner_${field}`]]))}));}
async function handle(req:NextRequest){
 const path=req.nextUrl.pathname.replace(/^\/api\//,'').split('/');const method=req.method;
 if(method!=='GET'){
  const origin=req.headers.get('origin');const host=req.headers.get('x-forwarded-host')||req.headers.get('host');
  if(origin && new URL(origin).host!==host)fail(403,'请求来源不被允许');
  if(req.headers.get('sec-fetch-site')==='cross-site')fail(403,'请求来源不被允许');
 }
 if(path[0]==='health'){await db.query('SELECT 1');return {ok:true,database:'connected'};}
 if(path[0]==='invite-url'&&method==='GET')return {baseUrl:(process.env.INVITE_BASE_URL||req.nextUrl.origin).replace(/\/$/,'')};
 if(path[0]==='auth'){
  if(path[1]==='me'&&method==='GET')return {user:await currentUser()};
  if(path[1]==='logout'&&method==='POST'){const token=(await cookies()).get('xinyu_session')?.value;if(token)await db.query('DELETE FROM sessions WHERE token_hash=$1',[hashToken(token)]);(await cookies()).delete('xinyu_session');return {ok:true};}
  if(['register','login'].includes(path[1])&&method==='POST'){
   const data=await body(req);const credentials=z.object({email:z.string().email().max(254).transform(s=>s.toLowerCase()),password:z.string().min(8).max(128)}).parse(data);
   await limited('auth:'+hashToken(credentials.email),10,600);
   if(path[1]==='register'){
    const p=profileSchema.parse(data);if(data.adult!==true)fail(400,'请确认已满18岁并同意社区约定');
    const id=randomUUID();const hash=await passwordHash(credentials.password);
    try{await db.query('INSERT INTO users(id,email,password_hash,name,age,gender,city,occupation,bio,interests,photos) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',[id,credentials.email,hash,p.name,p.age,p.gender,p.city,p.occupation,p.bio,JSON.stringify(p.interests),JSON.stringify(p.photos)]);}catch(e){if((e as {code:string}).code==='23505')fail(409,'这个邮箱已经注册，请直接登录');throw e;}
    await createSession(id);return {user:await currentUser()};
   }
   const found=await db.query('SELECT id,password_hash FROM users WHERE email=$1',[credentials.email]);
   const valid=found.rows[0] ? await verifyPassword(credentials.password,found.rows[0].password_hash) : (await passwordHash(credentials.password),false);
   if(!valid)fail(401,'邮箱或密码不正确');await createSession(found.rows[0].id);return {user:await currentUser()};
  }
 }
 if(path[0]==='rooms'&&path.length===1&&method==='GET'){const {rows}=await db.query(roomSelect+' ORDER BY r.created_at,r.id LIMIT 200');return {rooms:rows};}
 if(path[0]==='rooms'&&path.length===2&&method==='GET'){const id=uuid.parse(path[1]);const r=await db.query(roomSelect+' WHERE r.id=$1',[id]);return {room:r.rows[0]??fail(404,'房间不存在')};}
 const user:User=await currentUser()??fail(401,'请先登录，再开启相遇');
 if(path[0]==='profile'&&method==='PATCH'){const p=profileSchema.parse(await body(req));await db.query('UPDATE users SET name=$2,age=$3,gender=$4,city=$5,occupation=$6,bio=$7,interests=$8,photos=$9 WHERE id=$1',[user.id,p.name,p.age,p.gender,p.city,p.occupation,p.bio,JSON.stringify(p.interests),JSON.stringify(p.photos)]);return {user:await currentUser()};}
 if(path[0]==='matches'&&method==='GET')return {matches:await matches(user.id)};
 if(path[0]==='ice'&&method==='GET'){
  const iceServers:Record<string,unknown>[]=[{urls:'stun:stun.l.google.com:19302'}];
  if(process.env.TURN_URL&&process.env.TURN_USERNAME&&process.env.TURN_CREDENTIAL)iceServers.push({urls:process.env.TURN_URL.split(','),username:process.env.TURN_USERNAME,credential:process.env.TURN_CREDENTIAL});
  return {iceServers};
 }
 if(path[0]==='rooms'&&path.length===1&&method==='POST'){
  await limited('create:'+user.id,10,3600);const p=roomSchema.parse(await body(req));const id=randomUUID();
  await db.query('INSERT INTO rooms(id,title,description,city,category,mode,cover,capacity,host_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,p.title,p.description,p.city,p.category,p.mode,p.cover,p.capacity,user.id]);return {id};
 }
 if(path[0]!=='rooms'||path.length!==3)fail(404,'接口不存在');
 const roomId=uuid.parse(path[1]);const action=path[2];
 if(action==='state'&&method==='GET'){
  const since=z.string().regex(/^\d{1,18}$/).parse(req.nextUrl.searchParams.get('since')||'0');
  const room=await transaction(async c=>{
   const r=await c.query('SELECT * FROM rooms WHERE id=$1',[roomId]);if(!r.rows[0])fail(404,'房间不存在');
   await member(c,roomId,user.id);await c.query('UPDATE participants SET last_seen=now() WHERE room_id=$1 AND user_id=$2',[roomId,user.id]);return r.rows[0];
  });
  const [people,msgs,sigs,choice,matchRows,reports]=await Promise.all([
   db.query(`SELECT ${fields},p.role,p.muted,p.lamp,p.audio_enabled,p.video_enabled,p.joined_at FROM participants p JOIN users u ON p.user_id=u.id WHERE p.room_id=$1 AND p.last_seen>now()-interval '45 seconds' ORDER BY p.role DESC,p.joined_at`,[roomId]),
   db.query('SELECT * FROM (SELECT m.id,m.user_id,u.name,m.body,m.created_at FROM messages m JOIN users u ON u.id=m.user_id WHERE m.room_id=$1 ORDER BY m.id DESC LIMIT 100) t ORDER BY id',[roomId]),
   db.query("SELECT id,sender_id,payload FROM signals WHERE room_id=$1 AND receiver_id=$2 AND id>$3 AND created_at>now()-interval '2 minutes' ORDER BY id LIMIT 200",[roomId,user.id,since]),
   db.query('SELECT target_id FROM choices WHERE room_id=$1 AND round=$2 AND user_id=$3',[roomId,room.round,user.id]),matches(user.id,roomId),
   room.host_id===user.id?db.query('SELECT r.id,r.reason,r.created_at,u.name FROM reports r LEFT JOIN users u ON u.id=r.target_id WHERE r.room_id=$1 ORDER BY r.created_at DESC LIMIT 20',[roomId]):Promise.resolve({rows:[]})
  ]);
  return {room,participants:people.rows,messages:msgs.rows,signals:sigs.rows,signalCursor:sigs.rows.at(-1)?.id??since,choice:choice.rows[0]?.target_id??null,matches:matchRows,reports:reports.rows};
 }
 if(method!=='POST')fail(405,'不支持此操作');
 const data=await body(req);
 return transaction(async c=>{
  const result=await c.query('SELECT * FROM rooms WHERE id=$1 FOR UPDATE',[roomId]);const room=result.rows[0]??fail(404,'房间不存在');
  if(action==='join'){
   await c.query("DELETE FROM participants WHERE room_id=$1 AND last_seen<now()-interval '45 seconds'",[roomId]);
   if((await c.query('SELECT 1 FROM bans WHERE room_id=$1 AND user_id=$2',[roomId,user.id])).rowCount)fail(403,'主持人已将你移出此房间');
   const existing=(await c.query('SELECT * FROM participants WHERE room_id=$1 AND user_id=$2',[roomId,user.id])).rows[0];
   if(!existing){
    const people=await c.query('SELECT p.user_id,p.role,p.joined_at,u.gender FROM participants p JOIN users u ON u.id=p.user_id WHERE p.room_id=$1 ORDER BY p.joined_at',[roomId]);
    if(room.stage===4)fail(409,'本场已结束，请等待主持人开启下一场');
    const activeHost=room.host_id
     ? await c.query('SELECT 1 FROM participants WHERE room_id=$1 AND user_id=$2',[roomId,room.host_id])
     : null;
    if(!room.host_id||!activeHost?.rowCount){
     room.host_id=user.id;
     await c.query("UPDATE participants SET role='guest' WHERE room_id=$1",[roomId]);
     await c.query('UPDATE rooms SET host_id=$2,stage=0 WHERE id=$1',[roomId,user.id]);
    }
    const role=room.host_id===user.id?'host':'guest';
    const guests=people.rows.filter(p=>p.role==='guest');
    if(role==='guest'&&guests.length>=room.capacity)fail(409,'本场嘉宾席位已满，请选择其他房间');
    const featuredGender=room.mode==='男生专场'?'male':'female';
    const featuredLabel=featuredGender==='male'?'男嘉宾':'女嘉宾';
    if(role==='guest'&&user.gender===featuredGender&&guests.some(p=>p.gender===featuredGender))fail(409,`${room.mode}的${featuredLabel}席位已满`);
    await c.query('INSERT INTO participants(room_id,user_id,role) VALUES($1,$2,$3)',[roomId,user.id,role]);
    await c.query('DELETE FROM signals WHERE room_id=$1 AND (receiver_id=$2 OR sender_id=$2)',[roomId,user.id]);
   }else await c.query('UPDATE participants SET last_seen=now() WHERE room_id=$1 AND user_id=$2',[roomId,user.id]);
   return {ok:true};
  }
  if(action==='leave'){
   await c.query('DELETE FROM participants WHERE room_id=$1 AND user_id=$2',[roomId,user.id]);
   await c.query('DELETE FROM signals WHERE room_id=$1 AND (sender_id=$2 OR receiver_id=$2)',[roomId,user.id]);
   if(room.host_id===user.id){
    const next=await c.query("SELECT user_id FROM participants WHERE room_id=$1 AND last_seen>now()-interval '45 seconds' ORDER BY joined_at LIMIT 1",[roomId]);
    if(next.rows[0]){
     await c.query("UPDATE participants SET role=CASE WHEN user_id=$2 THEN 'host' ELSE 'guest' END WHERE room_id=$1",[roomId,next.rows[0].user_id]);
     await c.query('UPDATE rooms SET host_id=$2 WHERE id=$1',[roomId,next.rows[0].user_id]);
    }else{
     await c.query('UPDATE rooms SET host_id=NULL,stage=0 WHERE id=$1',[roomId]);
    }
   }
   return {ok:true};
  }
  const me=await member(c,roomId,user.id);
  if(action==='chat'){
   if(me.muted)fail(403,'主持人已将你禁言');await limited('chat:'+user.id,30,60);const message=text(500).parse(data.body);
   await c.query('INSERT INTO messages(room_id,user_id,body) VALUES($1,$2,$3)',[roomId,user.id,message]);return {ok:true};
  }
  if(action==='signal'){
   await limited('signal:'+user.id,600,60);
   const input=z.object({to:uuid,payload:z.object({description:z.object({type:z.enum(['offer','answer']),sdp:z.string().max(100000)}).optional(),candidate:z.object({candidate:z.string().max(4000),sdpMid:z.string().nullable().optional(),sdpMLineIndex:z.number().nullable().optional(),usernameFragment:z.string().nullable().optional()}).optional()}).refine(p=>!!p.description!==!!p.candidate)}).parse(data);
   if(input.to===user.id)fail(400,'不能连接自己');await member(c,roomId,input.to);
   await c.query("DELETE FROM signals WHERE created_at<now()-interval '2 minutes'");
   await c.query('INSERT INTO signals(room_id,sender_id,receiver_id,payload) VALUES($1,$2,$3,$4)',[roomId,user.id,input.to,JSON.stringify(input.payload)]);return {ok:true};
  }
  if(action==='lamp'){
   if(me.role==='host')fail(409,'主持人不参与心动灯选择');
   const input=z.object({on:z.boolean(),target:uuid.optional()}).parse(data);const targetId=input.target??user.id;
   const target=await member(c,roomId,targetId);if(target.role==='host')fail(409,'主持人没有心动灯');
   const targetUser=(await c.query('SELECT gender FROM users WHERE id=$1',[targetId])).rows[0];
   const featuredGender=room.mode==='男生专场'?'male':'female';
   if(targetUser.gender===featuredGender)fail(409,`${room.mode}的主嘉宾没有心动灯`);
   if(targetId!==user.id&&targetUser.gender===user.gender)fail(403,'只能操作自己的心动灯或异性的心动灯');
   await c.query('UPDATE participants SET lamp=$3 WHERE room_id=$1 AND user_id=$2',[roomId,targetId,input.on]);return {ok:true};
  }
  if(action==='media'){
   const input=z.object({target:uuid.optional(),kind:z.enum(['audio','video']),enabled:z.boolean()}).parse(data);const targetId=input.target??user.id;
   const target=await member(c,roomId,targetId);
   if(targetId!==user.id&&room.host_id!==user.id)fail(403,'只有本人或主持人可以控制音视频');
   if(target.role==='host'&&targetId!==user.id)fail(403,'主持人的设备只能由主持人控制');
   const column=input.kind==='audio'?'audio_enabled':'video_enabled';
   await c.query(`UPDATE participants SET ${column}=$3 WHERE room_id=$1 AND user_id=$2`,[roomId,targetId,input.enabled]);return {ok:true};
  }
  if(action==='media-all'){
   if(room.host_id!==user.id)fail(403,'只有主持人可以控制全场音视频');
   const input=z.object({kind:z.enum(['audio','video']),enabled:z.boolean()}).parse(data);
   const column=input.kind==='audio'?'audio_enabled':'video_enabled';
   await c.query(`UPDATE participants SET ${column}=$2 WHERE room_id=$1 AND role='guest'`,[roomId,input.enabled]);return {ok:true};
  }
  if(action==='choose'){
   if(room.stage!==3||me.role==='host')fail(409,'请在双向奔赴环节选择心动嘉宾');
   const target=uuid.parse(data.target);if(target===user.id)fail(400,'请选择其他嘉宾');const p=await member(c,roomId,target);if(p.role==='host')fail(400,'主持人不参与配对');
   await c.query('INSERT INTO choices(room_id,round,user_id,target_id) VALUES($1,$2,$3,$4) ON CONFLICT(room_id,round,user_id) DO UPDATE SET target_id=EXCLUDED.target_id',[roomId,room.round,user.id,target]);return {ok:true};
  }
  if(action==='stage'){
   if(room.host_id!==user.id)fail(403,'只有主持人可以推进环节');const expected=z.number().int().min(0).max(4).parse(data.expected);if(expected!==room.stage)fail(409,'环节已更新，请刷新后重试');
   if(room.stage===0){const n=await c.query<{count:number}>("SELECT CAST(count(*) AS INTEGER) AS count FROM participants WHERE room_id=$1 AND role='guest' AND last_seen>now()-interval '45 seconds'",[roomId]);if(n.rows[0].count<2)fail(409,'至少需要两位在线嘉宾才能开始');}
   if(room.stage===3){
    const pairs=await c.query(`SELECT a.user_id AS a,a.target_id AS b FROM choices a JOIN choices b ON a.user_id=b.target_id AND a.target_id=b.user_id AND a.room_id=b.room_id AND a.round=b.round JOIN participants pa ON pa.room_id=a.room_id AND pa.user_id=a.user_id JOIN participants pb ON pb.room_id=a.room_id AND pb.user_id=a.target_id WHERE a.room_id=$1 AND a.round=$2 AND a.user_id<a.target_id AND pa.last_seen>now()-interval '45 seconds' AND pb.last_seen>now()-interval '45 seconds'`,[roomId,room.round]);
    for(const pair of pairs.rows)await c.query('INSERT INTO matches(id,room_id,round,user_a,user_b) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING',[randomUUID(),roomId,room.round,pair.a,pair.b]);
   }
   const next=room.stage===4?0:room.stage+1;
   await c.query('UPDATE rooms SET stage=$2,round=round+$3 WHERE id=$1',[roomId,next,room.stage===4?1:0]);
   if(next===0)await c.query('UPDATE participants SET lamp=true WHERE room_id=$1',[roomId]);return {ok:true,stage:next};
  }
  if(action==='moderate'){
   if(room.host_id!==user.id)fail(403,'只有主持人可以管理房间');const p=z.object({target:uuid,action:z.enum(['mute','unmute','remove'])}).parse(data);if(p.target===user.id)fail(400,'不能对自己执行此操作');await member(c,roomId,p.target);
   if(p.action==='remove'){await c.query('INSERT INTO bans(room_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[roomId,p.target]);await c.query('DELETE FROM participants WHERE room_id=$1 AND user_id=$2',[roomId,p.target]);await c.query('DELETE FROM signals WHERE room_id=$1 AND (sender_id=$2 OR receiver_id=$2)',[roomId,p.target]);}
   else if(p.action==='mute')await c.query('UPDATE participants SET muted=true,audio_enabled=false,video_enabled=false WHERE room_id=$1 AND user_id=$2',[roomId,p.target]);
   else await c.query('UPDATE participants SET muted=false WHERE room_id=$1 AND user_id=$2',[roomId,p.target]);return {ok:true};
  }
  if(action==='report'){
   await limited('report:'+user.id,5,600);const p=z.object({target:uuid,reason:text(300)}).parse(data);await member(c,roomId,p.target);await c.query('INSERT INTO reports(id,room_id,user_id,target_id,reason) VALUES($1,$2,$3,$4,$5)',[randomUUID(),roomId,user.id,p.target,p.reason]);return {ok:true};
  }
  fail(404,'操作不存在');
 });
}
export async function dispatch(req:NextRequest){try{return NextResponse.json(await handle(req),{headers:{'Cache-Control':'no-store'}});}catch(e){
 if(e instanceof ApiError)return NextResponse.json({error:e.message},{status:e.status});
 if(e instanceof z.ZodError)return NextResponse.json({error:'请检查输入：姓名、城市不能为空，年龄须为18–100岁，密码至少8位，内容请勿超长。'},{status:400});
 console.error('API error',e instanceof Error?e.message:'unknown');return NextResponse.json({error:'服务暂时不可用，请稍后再试'},{status:503});
}}
