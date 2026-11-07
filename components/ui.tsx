'use client';
import { useEffect,useRef,type ReactNode } from 'react';
import { X,Heart } from 'lucide-react';
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const d=ref.current;d?.showModal();const prev=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=prev;d?.close();};},[]);
 return <dialog ref={ref} className={'modal '+(wide?'modal-wide':'')} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="modal-inner"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="关闭弹窗" onClick={onClose}><X size={20}/></button></div>{children}</div></dialog>;
}
export function Avatar({name,photo,size='normal'}:{name:string;photo?:string;size?:'normal'|'large'}){return <span className={'avatar '+size}>{photo?<img src={photo} alt={name}/>:name.slice(0,1)}</span>;}
export function Empty({title,description,children}:{title:string;description:string;children?:ReactNode}){return <div className="empty"><div className="empty-icon"><Heart size={30}/></div><h2>{title}</h2><p>{description}</p>{children}</div>;}
export function Rules({onClose}:{onClose:()=>void}){return <Modal title="让每一次相遇，都有温度" onClose={onClose}><p className="muted">一位主持人，几位真诚的你，三个慢慢靠近的环节。</p><div className="rule-list">{[['初次心动','爱之初体验','轮流介绍自己。嘉宾可以点亮或熄灭心动灯，表达当下感受。'],['深入了解','爱之再判断','聊聊兴趣、生活和期待。认真倾听，选择保留或改变心意。'],['双向奔赴','爱之终抉择','每位嘉宾私下选择一位心动对象。主持人公布结果时，双方互选即牵手成功。']].map(([title,sub,body],i)=><div key={title}><span className="step-number">0{i+1}</span><section><h3>{title} <small>{sub}</small></h3><p>{body}</p></section></div>)}</div><div className="notice">仅限18岁及以上参与。尊重他人意愿，不传播不雅内容，不泄露隐私。主持人可禁言、移出成员；相亲结果不代表现实身份认证。</div><button className="button primary full" onClick={onClose}>带着真诚，开启相遇</button></Modal>;}
