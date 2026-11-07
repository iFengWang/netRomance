'use client';
import { createContext,useContext,useState,useEffect,type ReactNode,type FormEvent } from 'react';
import { Check,Heart,LoaderCircle } from 'lucide-react';
import { api,post } from '@/lib/client';
import type {User} from '@/lib/types';
import { Modal } from './ui';
type AppContext={user:User|null;loading:boolean;refresh:()=>Promise<void>;login:()=>void;logout:()=>Promise<void>;toast:(message:string)=>void;};
const Context=createContext<AppContext>(null!);
export const useApp=()=>useContext(Context);
export function AppProvider({children}:{children:ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const [auth,setAuth]=useState(false);const [message,setMessage]=useState('');
 const refresh=async()=>{try{const d=await api<{user:User|null}>('auth/me');setUser(d.user);}finally{setLoading(false);}};
 useEffect(()=>{refresh().catch(()=>{});},[]);
 useEffect(()=>{if(!message)return;const t=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(t);},[message]);
 return <Context.Provider value={{user,loading,refresh,login:()=>setAuth(true),logout:async()=>{await post('auth/logout');setUser(null);},toast:setMessage}}>{children}{auth&&<AuthModal onClose={()=>setAuth(false)} onSuccess={u=>{setUser(u);setAuth(false);setMessage('欢迎来到心遇，愿你遇见心动。');}}/>}{message&&<div className="toast" role="status"><Check size={18}/>{message}</div>}</Context.Provider>;
}
function AuthModal({onClose,onSuccess}:{onClose:()=>void;onSuccess:(u:User)=>void}){
 const [register,setRegister]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');const f=new FormData(e.currentTarget);try{const d=await post<{user:User}>('auth/'+(register?'register':'login'),{email:f.get('email'),password:f.get('password'),name:f.get('name'),age:Number(f.get('age')),gender:f.get('gender'),city:f.get('city'),adult:f.get('adult')==='on'});onSuccess(d.user);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title={register?'新的故事，从这里开始':'欢迎回到心遇'} onClose={onClose}><div className="auth-mark"><Heart size={30}/></div><p className="modal-intro">{register?'完善一点资料，让相遇多一点可能。':'登录后，继续寻找与你同频的人。'}</p><div className="segmented"><button className={!register?'selected':''} onClick={()=>{setRegister(false);setError('');}}>登录</button><button className={register?'selected':''} onClick={()=>{setRegister(true);setError('');}}>注册</button></div><form onSubmit={submit} className="form"><label>邮箱<input name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label><label>密码<input name="password" type="password" autoComplete={register?'new-password':'current-password'} placeholder="至少 8 位密码" minLength={8} maxLength={128} required/></label>{register&&<><div className="form-row"><label>昵称<input name="name" placeholder="希望大家如何称呼你" maxLength={20} required/></label><label>年龄<input name="age" type="number" min={18} max={100} placeholder="18 岁及以上" required/></label></div><div className="form-row"><label>性别<select name="gender"><option value="female">女</option><option value="male">男</option></select></label><label>城市<input name="city" placeholder="如：杭州" maxLength={20} required/></label></div><label className="check-label"><input name="adult" type="checkbox" required/>我已满18岁，同意真诚交流、尊重隐私的社区约定。</label></>}{error&&<p className="error" role="alert">{error}</p>}<button className="button primary full" disabled={busy}>{busy?<LoaderCircle className="spin" size={18}/>:null}{register?'注册，开启心动':'登录心遇'}</button></form><p className="fine-print">你的邮箱不会向其他嘉宾展示。</p></Modal>;
}
