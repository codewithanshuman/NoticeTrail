import { useState } from 'react';
import { Check, CalendarDays, ArrowRight } from 'lucide-react';
import { acceptImpact, impacts } from './trailEngine';
import { downloadCalendar } from './calendar';
import type { Workspace, JourneyTask } from './domain';
type Props={workspace:Workspace;onChange:(workspace:Workspace)=>void;onInspect:(id:string,versionId:string)=>void};
export default function JourneyView({workspace,onChange,onInspect}:Props){
  const [message,setMessage]=useState('');
  const [mapping,setMapping]=useState<Record<string,string>>({});
  const pending=impacts(workspace);
  const latest=workspace.versions.at(-1)!;
  const completed=workspace.tasks.filter(task=>task.done).length;
  function update(taskId:string,fields:Partial<JourneyTask>){
    onChange({...workspace,tasks:workspace.tasks.map(task=>task.id===taskId?{...task,...fields}:task)});
  }
  async function calendar(){
    const safe=workspace.tasks.filter(task=>!pending.some(impact=>impact.task.id===task.id));
    await downloadCalendar(safe.map(task=>({id:task.id,task:task.title,evidence:task.quote,notice:workspace.title,origin:'Confirmed in NoticeTrail',done:task.done,due:task.due,created:0})));
  }
  function match(taskId:string){
    const node=latest.nodes.find(item=>item.id===mapping[taskId]);
    if(!node)return;
    if(workspace.tasks.some(item=>item.id!==taskId&&item.nodeId===node.id)){setMessage('That source already has a saved step. Remove the older step after reviewing both.');return;}
    onChange({...workspace,tasks:workspace.tasks.map(task=>task.id===taskId?{...task,nodeId:node.id,versionId:latest.id,title:node.title,quote:node.quote,due:'',reviewVersionId:undefined}:task),reviews:[...workspace.reviews,{id:crypto.randomUUID(),taskId,versionId:latest.id,decision:'accepted',created:Date.now()}]});
  }
  return <section className="journey-view">
    <div className="section-head"><div><span className="eyebrow">YOUR NEXT STEPS</span><h2>A journey you can follow.</h2></div><button disabled={!workspace.tasks.some(task=>!task.done&&task.due&&!pending.some(item=>item.task.id===task.id))} onClick={()=>calendar().catch(()=>setMessage('Calendar export failed. Try again.'))}><CalendarDays size={16}/>Export calendar</button></div>
    <p>{completed} of {workspace.tasks.length} complete</p><progress aria-label="Journey progress" max={Math.max(1,workspace.tasks.length)} value={completed}/>
    {message&&<p role="status">{message}</p>}
    {workspace.tasks.length===0&&<div className="empty-panel"><h3>Your journey starts with a fact.</h3><p>Select an object in the world, review its source, then save the step here.</p></div>}
    {workspace.tasks.map(task=>{
      const original=workspace.versions.find(v=>v.id===task.versionId);
      const node=original?.nodes.find(n=>n.id===task.nodeId);
      const impact=pending.find(item=>item.task.id===task.id);
      return <article key={task.id} className={'journey-step '+(task.done?'complete':'')}>
        <div className="step-top"><button className="completion-button" aria-pressed={task.done} aria-label={'Complete '+task.title} onClick={()=>update(task.id,{done:!task.done})}>{task.done&&<Check size={18}/>}</button><div><span className="eyebrow">{node?.obligation??'suggested'}{node?.condition?' · '+node.condition:''}</span><h3>{task.title}</h3><small>Saved from {original?.label??'earlier source'}</small></div></div>
        <button className="text-link" onClick={()=>onInspect(task.nodeId,task.versionId)}>Why this step? <ArrowRight size={14}/></button>
        <label className="due-control">Confirm calendar date <input type="date" value={task.due} onChange={e=>update(task.id,{due:e.target.value})}/></label>
        {!task.due&&<small>{node?.rawDate ? 'Source date: '+node.rawDate+'. Choose the full date, including year.' : 'Leave this empty if no deadline applies.'}</small>}
        {impact&&<div className="impact-review"><strong>Saved plan needs review</strong><p>{impact.next?'The source for this step changed. Review both passages before updating your plan.':'This step could not be matched confidently to the latest notice.'}</p><div className="quote-pair"><blockquote><small>Saved source</small>{task.quote}</blockquote><blockquote><small>Latest source</small>{impact.next?.quote??'Choose the corresponding fact below, or keep your original step.'}</blockquote></div>
          {impact.next?<button className="primary" onClick={()=>onChange(acceptImpact(workspace,task.id))}>Accept update · reconfirm date</button>:<div className="match-control"><select aria-label={'Match revised source for '+task.title} value={mapping[task.id]??''} onChange={e=>setMapping({...mapping,[task.id]:e.target.value})}><option value="">Choose a revised fact</option>{latest.nodes.filter(n=>n.kind!=='question'&&n.kind!=='location').map(n=><option key={n.id} value={n.id}>{n.title}</option>)}</select><button disabled={!mapping[task.id]} onClick={()=>match(task.id)}>Confirm source match</button></div>}
          <button onClick={()=>onChange({...workspace,reviews:[...workspace.reviews,{id:crypto.randomUUID(),taskId:task.id,versionId:latest.id,decision:'kept',created:Date.now()}]})}>Keep original for now</button>
          {workspace.reviews.some(r=>r.taskId===task.id&&r.versionId===latest.id&&r.decision==='kept')&&<small>Original retained. This step still needs review and is excluded from calendar export.</small>}
        </div>}
        <button className="text-link danger" onClick={()=>onChange({...workspace,tasks:workspace.tasks.filter(t=>t.id!==task.id)})}>Remove step</button>
      </article>;
    })}
  </section>;
}
