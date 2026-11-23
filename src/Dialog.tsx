import { useEffect, useRef, type ReactNode } from 'react';
export default function Dialog({children,onClose,locked=false,labelledBy}:{children:ReactNode;onClose:()=>void;locked?:boolean;labelledBy?:string}){
  const element=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=element.current;
    const previousFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    dialog?.showModal();
    return ()=>{dialog?.close();document.body.style.overflow=previousOverflow;if(previousFocus?.isConnected)previousFocus.focus();};
  },[]);
  return <dialog ref={element} className="native-dialog" aria-labelledby={labelledBy} aria-label={labelledBy?undefined:'Workspace dialog'} onCancel={event=>{event.preventDefault();if(!locked)onClose();}}>{children}</dialog>;
}
