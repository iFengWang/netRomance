'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowUpRight,BookOpen,Heart,LogOut,Menu,ShieldCheck,UserRound,Video} from 'lucide-react';
import {useEffect,useState,type ReactNode} from 'react';
import {useApp} from './app-provider';
import {LanguageMenu,useI18n} from './i18n';
import {Avatar,Rules} from './ui';

export function Shell({children}:{children:ReactNode}){
 const path=usePathname();
 const {user,login,logout,toast}=useApp();
 const {t}=useI18n();
 const [rules,setRules]=useState(false);
 const [sidebarOpen,setSidebarOpen]=useState(()=>!path.startsWith('/rooms/'));
 const items=[
  {href:'/',label:t('lobby'),Icon:Video},
  {href:'/matches',label:t('matches'),Icon:Heart},
  {href:'/profile',label:t('profile'),Icon:UserRound},
 ];
 const title=path.startsWith('/rooms/')?t('room'):items.find(item=>item.href===path)?.label??t('lobby');

 useEffect(()=>setSidebarOpen(!path.startsWith('/rooms/')),[path]);
 useEffect(()=>{
  const toggle=()=>setSidebarOpen(value=>!value);
  const setSidebar=(event:Event)=>setSidebarOpen((event as CustomEvent<boolean>).detail);
  window.addEventListener('xinyu:toggle-sidebar',toggle);
  window.addEventListener('xinyu:set-sidebar',setSidebar);
  return()=>{window.removeEventListener('xinyu:toggle-sidebar',toggle);window.removeEventListener('xinyu:set-sidebar',setSidebar);};
 },[]);

 return <div className={'app-shell '+(sidebarOpen?'sidebar-open':'sidebar-closed')}>
  <aside id="primary-navigation" className="sidebar" aria-hidden={!sidebarOpen} inert={!sidebarOpen?true:undefined}>
   <Link href="/" className="brand" aria-label={t('lobby')}><span className="brand-symbol"><Heart fill="currentColor" strokeWidth={0}/></span><span>心遇<small>X I N Y U</small></span></Link>
   <div className="sidebar-tagline">{t('tagline')}</div>
   <nav>{items.map(({href,label,Icon})=><Link key={href} href={href} className={(path===href||href==='/'&&path.startsWith('/rooms/')?'active':'')}><Icon size={21}/><span>{label}</span>{path===href&&<span className="nav-dot"/>}</Link>)}</nav>
   <div className="sidebar-bottom">
    <button className="guide-button" onClick={()=>setRules(true)}><BookOpen size={18}/>{t('guide')}<ArrowUpRight size={15}/></button>
    <div className="privacy-note"><ShieldCheck size={19}/><span>{t('safe')}<small>{t('privacy')}</small></span></div>
   </div>
  </aside>
  <div className="main-shell">
   <header className="topbar">
    <div className="topbar-leading">
     <button className="menu-toggle" onClick={()=>setSidebarOpen(value=>!value)} aria-expanded={sidebarOpen} aria-controls="primary-navigation" aria-label="MENU" title="MENU"><Menu size={18}/><span>MENU</span></button>
     <div className="breadcrumb">{t('discover')}<span>/</span><strong>{title}</strong></div>
    </div>
    <div className="topbar-right"><LanguageMenu/><span className="topbar-note">{t('chance')}</span>{user?<><Link className="profile-link" href="/profile"><Avatar name={user.name} photo={user.photos[0]}/><span>{user.name}</span></Link><button className="icon-button" aria-label={t('logout')} onClick={()=>logout().catch(error=>toast(error.message))}><LogOut size={17}/></button></>:<button className="login-button" onClick={login}><UserRound size={19}/>{t('login')}</button>}</div>
   </header>
   <main>{children}</main>
   <footer className="footer"><span/>{t('adults')}<span/></footer>
  </div>
  {rules&&<Rules onClose={()=>setRules(false)}/>}
 </div>;
}
