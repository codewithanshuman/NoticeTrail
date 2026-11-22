import { useEffect, useRef, type ReactNode } from 'react';
export default function Dialog({children,onClose,locked=false}:{children:ReactNode;onClose:()=>void;locked?:boolean}){
  const element=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    const dialog=element.current;
    dialog?.showModal();
    return ()=>dialog?.close();
  },[]);
  return <dialog ref={element} className="native-dialog" aria-label="Workspace dialog" onCancel={event=>{event.preventDefault();if(!locked)onClose();}}>{children}</dialog>;
}
