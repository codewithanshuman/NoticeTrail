import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { Workspace } from './domain';
import { compareNotices, isConfigured } from './firebase';
import type { Comparison, PrivacyMode } from './types';
import TextChanges from './TextChanges';
import SourceExcerpt from './SourceExcerpt';

type Props={workspace:Workspace;index:number;onVersion:(index:number)=>void;onInspect:(id:string,versionId:string)=>void;mode:PrivacyMode};
export default function TimeMachine({workspace,index,onVersion,onInspect,mode}:Props){
  const [analysis,setAnalysis]=useState<{key:string;result:Comparison;source:string}|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const current=workspace.versions[index];
  const previous=workspace.versions[Math.max(0,index-1)];
  const key=previous.id+current.id;
  const changes=current.nodes.filter(node=>{
    const old=previous.nodes.find(n=>n.id===node.id);
    return !old||old.quote!==node.quote||old.title!==node.title||old.description!==node.description;
  });
  const removed=previous.nodes.filter(node=>!current.nodes.some(n=>n.id===node.id));
  async function analyze(){
    setBusy(true);setError('');
    try {const response=await compareNotices({oldText:previous.text,newText:current.text,mode,onProgress:()=>{}});setAnalysis({key,result:response.comparison,source:response.source});}
    catch(e){setError(e instanceof Error?e.message:'Comparison failed.');}
    finally{setBusy(false);}
  }
  return <section className="time-view">
    <span className="eyebrow">VERSION HISTORY</span><h2>See what moved.</h2>
    <p>Move through the versions. Your saved plan changes only after review.</p>
    <div className="version-track">{workspace.versions.map((v,i)=><button key={v.id} aria-pressed={i===index} onClick={()=>onVersion(i)}><span className="version-dot"/>{v.label}<small>Version {i+1}</small></button>)}</div>
    <label className="scrubber">Explore versions<input type="range" min={0} max={workspace.versions.length-1} value={index} onChange={e=>onVersion(Number(e.target.value))}/></label>
    {index===0?<div className="empty-panel"><h3>The story starts here.</h3><p>This is the original notice. Choose a later version to inspect its changes.</p></div>:<>
      <div className="section-head"><h3>{previous.label} <ArrowRight size={16}/> {current.label}</h3><span>{changes.length} changed or newly extracted objects</span></div>
      {[...changes,...removed].map(node=>{
        const old=previous.nodes.find(n=>n.id===node.id);
        const next=current.nodes.find(n=>n.id===node.id);
        return <article className="version-change" key={node.id}><span className="eyebrow">{old&&next?'Changed':next?'New or unmatched':'Absent or unmatched'}</span><h3>{node.title}</h3><div className="quote-pair"><div>{old?<><SourceExcerpt original={previous.text} evidence={old.quote} label="Original evidence"/><button className="text-link" onClick={()=>onInspect(old.id,previous.id)}>Inspect original</button></>:<p>No confident match in the earlier version.</p>}</div><div>{next?<><SourceExcerpt original={current.text} evidence={next.quote} label="Updated evidence"/><button className="text-link" onClick={()=>onInspect(next.id,current.id)}>Inspect update</button></>:<p>Review the full updated notice before treating this as removed.</p>}</div></div></article>;
      })}
      {changes.length===0&&removed.length===0&&<p>No changes to extracted objects.</p>}
      <TextChanges before={previous.text} after={current.text}/>
      {current.source!=='SAMPLE'&&<button disabled={!isConfigured||busy} onClick={analyze}>{busy?'Comparing…':'Explain changes with AI'}</button>}
      {error&&<p role="alert">{error}</p>}
      {analysis?.key===key&&<article className="answer"><small>{analysis.source==='ON_DEVICE'?'Generated on this device':analysis.source==='IN_CLOUD'?'Generated in the cloud':'Inference source unreported'}</small><h3>{analysis.result.headline}</h3><p>{analysis.result.summary}</p>{analysis.result.changes.map((change,i)=><div key={i}><p>{change.impact}</p><blockquote>{change.beforeEvidence}</blockquote><blockquote>{change.afterEvidence}</blockquote></div>)}</article>}
    </>}
  </section>;
}
