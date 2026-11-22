import Dialog from './Dialog';
import { comparable } from './evidence';
import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, ChevronRight, Download, GitBranch, Globe2, History, ListChecks, Plus, Save, Trash2, Undo2, X } from 'lucide-react';
import type { Fact, Workspace } from './domain';
import type { PrivacyMode } from './types';
import { createDemoWorkspace, impacts, saveNode } from './trailEngine';
import { deleteWorkspace, listWorkspaces, loadWorkspace, saveWorkspace } from './workspaceStore';
import WorldView from './WorldView';
import JourneyView from './JourneyView';
import TimeMachine from './TimeMachine';
import ImportNotice from './ImportNotice';
import SourceExcerpt from './SourceExcerpt';
import AskPanel from './AskPanel';
import Planner from './Planner';
import { listTasks, saveTask, type PlanItem } from './taskStore';

type View='world'|'connections'|'time'|'journey'|'source'|'legacy';
const views=[{id:'world',name:'World',icon:Globe2},{id:'connections',name:'Connections',icon:GitBranch},{id:'time',name:'Time machine',icon:History},{id:'journey',name:'My journey',icon:ListChecks}] as const;
const sourceLabels={SAMPLE:'Prewritten example',ON_DEVICE:'Generated on device',IN_CLOUD:'Generated in cloud',UNKNOWN:'Inference source unreported'};

export default function App(){
  const [workspace,setWorkspace]=useState<Workspace>(()=>({id:crypto.randomUUID(),title:'Your workspace',versions:[],tasks:[],reviews:[]}));
  const [view,setView]=useState<View>('world');
  const [versionIndex,setVersionIndex]=useState(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [saved,setSaved]=useState<Workspace[]>([]);
  const [persistent,setPersistent]=useState(false);
  const [mode,setMode]=useState<PrivacyMode>('auto');
  const [importing,setImporting]=useState<'new'|'revision'|null>(null);
  const [message,setMessage]=useState('');
  const [saveState,setSaveState]=useState('Session only');
  const [undo,setUndo]=useState<Workspace|null>(null);
  const [deleting,setDeleting]=useState(false);
  const [deletingBusy,setDeletingBusy]=useState(false);
  const [legacy,setLegacy]=useState<PlanItem[]>([]);
  const [selection,setSelection]=useState('');
  const [manualKind,setManualKind]=useState<Fact['kind']>('action');
  const queue=useRef(Promise.resolve());
  const writeNumber=useRef(0);
  const version=workspace.versions[versionIndex];
  const selected=version?.nodes.find(node=>node.id===selectedId);
  const pending=impacts(workspace);
  const latest=workspace.versions.at(-1);
  const previous=workspace.versions[Math.max(0,versionIndex-1)];
  const completedIds=workspace.tasks.filter(task=>task.done&&!pending.some(impact=>impact.task.id===task.id)&&version?.nodes.some(node=>node.id===task.nodeId&&comparable(node.quote)===comparable(task.quote))).map(task=>task.nodeId);
  const changedIds=versionIndex>0?version.nodes.filter(node=>{const old=previous.nodes.find(n=>n.id===node.id);return !old||old.quote!==node.quote;}).map(n=>n.id):[];

  useEffect(()=>{
    listWorkspaces().then(setSaved).catch(()=>setMessage('Local workspace storage is unavailable.'));
    listTasks().then(setLegacy).catch(()=>setMessage('Earlier saved tasks could not be loaded.'));
  },[]);
  useEffect(()=>{
    if(!persistent)return;
    const number=++writeNumber.current;
    setSaveState('Saving…');
    queue.current=queue.current.catch(()=>{}).then(()=>saveWorkspace(workspace)).then(async()=>{
      setSaved(await listWorkspaces());
      if(number===writeNumber.current)setSaveState('Saved on this device');
    }).catch(error=>{
      if(number===writeNumber.current){setSaveState('Save failed');setMessage(error instanceof Error?error.message:'Could not save this workspace. Export a copy or try saving again.');}
    });
  },[workspace,persistent]);
  useEffect(()=>{setSelection('');},[workspace.id,versionIndex]);
  function change(next:Workspace){setUndo(workspace);setWorkspace(next);}
  function open(next:Workspace,remember=false,discard=false){
    if(!discard&&workspace.versions.length&&(!persistent||saveState==='Save failed')&&!window.confirm('This workspace has unsaved changes. Leave without saving?'))return false;
    setPersistent(remember);setWorkspace(next);setVersionIndex(0);setSelectedId(next.versions[0]?.nodes[0]?.id??null);setView('world');setUndo(null);setMessage('');setSaveState(remember?'Saved on this device':'Session only');return true;
  }
  async function reopen(id:string){
    if(id===workspace.id)return;
    await queue.current;
    try {const fresh=await loadWorkspace(id);if(fresh)open(fresh,true);else setMessage('This workspace was removed. Reload to refresh the list.');}
    catch {setMessage('Could not open the saved workspace. Try again.');}
  }
  function selectVersion(index:number){
    setVersionIndex(index);
    if(!workspace.versions[index]?.nodes.some(n=>n.id===selectedId))setSelectedId(workspace.versions[index]?.nodes[0]?.id??null);
  }
  function inspect(id:string,versionId:string){
    const index=workspace.versions.findIndex(v=>v.id===versionId);
    if(index>=0)setVersionIndex(index);
    setSelectedId(id);setView('world');
    window.setTimeout(()=>document.getElementById('fact-inspector')?.scrollIntoView({block:'nearest',behavior:'auto'}),0);
  }
  function exportWorkspace(){
    const url=URL.createObjectURL(new Blob([JSON.stringify({format:'noticetrail-workspace',schemaVersion:1,workspace},null,2)],{type:'application/json'}));
    const anchor=document.createElement('a');anchor.href=url;anchor.download='noticetrail-workspace.json';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function remove(){
    setDeletingBusy(true);
    setPersistent(false);writeNumber.current++;
    try {await queue.current;await deleteWorkspace(workspace.id);setSaved(await listWorkspaces());open({id:crypto.randomUUID(),title:'Your workspace',versions:[],tasks:[],reviews:[]},false,true);setDeleting(false);}
    catch {setMessage('Workspace deletion failed. Try again.');}
    finally {setDeletingBusy(false);}
  }
  function manualFact(){
    if(!selection.trim()||!version||!version.text.includes(selection))return;
    const duplicate=version.nodes.find(node=>node.kind===manualKind&&comparable(node.quote)===comparable(selection));
    if(duplicate){setSelectedId(duplicate.id);setView('world');return;}
    const existing=workspace.versions.slice(0,versionIndex).flatMap(v=>v.nodes).find(node=>node.kind===manualKind&&comparable(node.quote)===comparable(selection));
    const fact:Fact={id:existing?.id??crypto.randomUUID(),kind:manualKind,title:selection.trim().slice(0,140),description:'Selected by you. Review this passage in its original context.',quote:selection,status:'verified',obligation:'suggested'};
    change({...workspace,versions:workspace.versions.map(v=>v.id===version.id?{...v,nodes:[...v.nodes,fact]}:v)});
    setSelectedId(fact.id);setSelection('');setView('world');
  }

  return <div className="studio">
    <aside className="app-sidebar">
      <a className="studio-brand" href="#workspace"><img src="/icon.svg" alt="" width="30" height="30"/>NoticeTrail<span>2.0</span></a>
      <button className="new-workspace" onClick={()=>setImporting('new')}><Plus size={17}/>New workspace</button>
      <div className="nav-label">EXPLORE</div>
      <nav aria-label="Workspace views">{views.map(({id,name,icon:Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>setView(id)}><Icon size={18}/>{name}{id==='journey'&&workspace.tasks.length>0&&<span>{workspace.tasks.length}</span>}</button>)}</nav>
      <div className="nav-label">SOURCES</div>
      <div className="source-nav">{workspace.versions.map((v,i)=><button key={v.id} className={versionIndex===i?'current':''} onClick={()=>{selectVersion(i);setView('source');}}><BookOpen size={15}/><span>{v.label}</span><small>v{i+1}</small></button>)}
      <button disabled={!version} onClick={()=>setImporting('revision')}><Plus size={15}/>Add revision</button></div>
      <div className="nav-label">ON THIS DEVICE</div>
      <div className="saved-nav">{saved.length?saved.map(item=><button key={item.id} onClick={()=>void reopen(item.id)}>{item.title}</button>):<small>Saved workspaces appear here.</small>}</div>
      {legacy.length>0&&<button className="legacy-link" onClick={()=>setView('legacy')}>Earlier saved tasks ({legacy.length})</button>}
      <div className="sidebar-bottom"><span className="local-dot"/>Private workspace<p>{saveState}</p><button onClick={()=>open(createDemoWorkspace())}>Explore garden example <ArrowUpRight size={14}/></button></div>
    </aside>
    <div className="studio-main" id="workspace">
      <header className="workspace-bar"><div><span>Workspace</span><ChevronRight size={14}/><strong>{workspace.title}</strong><small className="save-status" role="status">{saveState}</small></div><div className="workspace-actions">
        <button disabled={!undo} onClick={()=>{if(undo){setWorkspace(undo);setVersionIndex(i=>Math.min(i,undo.versions.length-1));setUndo(null);}}} title="Undo last workspace change"><Undo2 size={16}/><span>Undo</span></button>
        <button disabled={!version} onClick={()=>{setPersistent(true);if(persistent)setWorkspace({...workspace});}}><Save size={16}/><span>Save on device</span></button>
        <button disabled={!version} aria-label="Export workspace" onClick={exportWorkspace}><Download size={16}/></button>
        <button disabled={!version} aria-label="Delete workspace" onClick={()=>setDeleting(true)}><Trash2 size={16}/></button>
      </div></header>
      {message&&<div className="status-message" role="status">{message}<button aria-label="Dismiss message" onClick={()=>setMessage('')}><X size={15}/></button></div>}
      {!version&&view!=='legacy'?<section className="welcome">
        <span className="eyebrow">INFORMATION, BROUGHT TO LIFE</span><h1>Understand the notice.<br/><em>Follow the trail.</em></h1><p>A place to explore what matters, trace every detail to its source, and keep your plan in step with changes.</p>
        <div className="welcome-actions"><button className="primary" onClick={()=>setImporting('new')}><Plus size={18}/>Open your notice</button><button onClick={()=>open(createDemoWorkspace())}>Explore the garden example <ArrowUpRight size={17}/></button></div>
        <div className="welcome-steps"><article><Globe2 size={26}/><h3>Explore connected facts</h3><p>Every object leads back to the words in your notice.</p></article><article><History size={26}/><h3>Understand revisions</h3><p>Compare versions and review the impact on your plan.</p></article><article><ListChecks size={26}/><h3>Finish the next step</h3><p>Save actions, confirm dates, and pick up where you left off.</p></article></div>
        <small>Stored on your device when you choose Save. AI processing follows your privacy choice.</small>
      </section>:view==='legacy'?<section className="legacy-panel"><h1>Earlier saved tasks</h1><Planner items={legacy} refresh={async()=>setLegacy(await listTasks())} save={async input=>{await saveTask(input);setLegacy(await listTasks());return true;}} report={setMessage}/></section>:<>
        <div className="view-heading"><div><span className="eyebrow">{version.source==='SAMPLE'?'INTERACTIVE EXAMPLE':version.method==='manual'?'YOUR NOTICE':sourceLabels[version.source]}</span><h1>{view==='world'?'A world of understanding.':view==='connections'?'Follow the connections.':view==='time'?'Every version has a story.':view==='source'?'Stay close to the source.':'Make your next move.'}</h1><p>{view==='world'?'Select an object. Find its meaning. See the evidence.':view==='connections'?'Each connection shows the passage that supports it.':view==='source'?'Select a passage to create an object you can explore and save.':'Your sources and progress stay connected.'}</p></div>
          <div className="version-controls"><div className="source-actions"><button onClick={()=>setView('source')}><BookOpen size={14}/>Read source</button><button onClick={()=>setImporting('revision')}><Plus size={14}/>Add revision</button></div><label className="version-picker">Viewing<select value={versionIndex} onChange={e=>selectVersion(Number(e.target.value))}>{workspace.versions.map((v,i)=><option key={v.id} value={i}>{v.label} · v{i+1}</option>)}</select></label></div>
        </div>
        {pending.length>0&&<button className="review-banner" onClick={()=>setView('journey')}><History size={18}/><span><strong>{pending.length} saved {pending.length===1?'step needs':'steps need'} review</strong> An update may affect your journey.</span><ArrowUpRight size={18}/></button>}
        <div className={'workspace-content '+(['world','connections','source'].includes(view)?'with-inspector':'')}>
          <div className="view-content">
            {(view==='world'||view==='connections')&&<><WorldView version={version} selectedId={selectedId} onSelect={setSelectedId} completedIds={completedIds} changedIds={changedIds} connections={view==='connections'}/>{version.nodes.length===0&&<button className="primary" onClick={()=>setView('source')}>Select facts from your notice</button>}<div className="world-caption"><span>{version.nodes.length} objects · {version.edges.length} supported connections</span><span>{versionIndex+1} of {workspace.versions.length} versions</span></div></>}
            {view==='time'&&<TimeMachine workspace={workspace} index={versionIndex} onVersion={selectVersion} onInspect={inspect} mode={mode}/>}
            {view==='journey'&&<JourneyView workspace={workspace} onChange={change} onInspect={inspect}/>}
            {view==='source'&&<section className="source-document"><div className="section-head"><h2>{version.label}</h2><span>v{versionIndex+1}</span></div>{version.image&&<img className="source-image" src={version.image} alt="Original notice screenshot"/>}<label>Original text<textarea readOnly value={version.text} onSelect={e=>setSelection(e.currentTarget.value.slice(e.currentTarget.selectionStart,e.currentTarget.selectionEnd))} placeholder="This source is an image. Inspect it above."/></label>{selection&&<div className="selection-actions"><span>{selection.length} characters selected</span><select aria-label="Selected fact type" value={manualKind} onChange={e=>setManualKind(e.target.value as Fact['kind'])}>{['action','event','deadline','requirement','location'].map(kind=><option key={kind}>{kind}</option>)}</select><button className="primary" onClick={manualFact}>Add selected passage</button></div>}</section>}
          </div>
          {['world','connections','source'].includes(view)&&<aside className="fact-inspector" id="fact-inspector" aria-label="Selected fact">
            {selected?<><div className="inspector-heading"><span className="eyebrow">{selected.kind}</span><span className={'evidence-status '+selected.status}>{selected.status==='verified'?'Quote matched':'Needs review'}</span></div><h2>{selected.title}</h2><p>{selected.description}</p><span className="obligation">{selected.obligation==='suggested'?'Suggested or selected by you':selected.obligation}{selected.condition?' · '+selected.condition:''}</span>{selected.rawDate&&<div className="raw-date"><small>AS WRITTEN</small><strong>{selected.rawDate}</strong><small>Confirm a full calendar date in your journey.</small></div>}
              {selected.quote?<SourceExcerpt original={version.text} evidence={selected.quote} label={version.image?'Model excerpt · check image':'Why this matters · source'}/>:<p className="muted">The notice leaves this question open.</p>}
              {version.image&&<details><summary>Check original image</summary><img className="source-image" src={version.image} alt="Original evidence"/></details>}
              {!['question','location'].includes(selected.kind)&&<button className="primary wide" disabled={workspace.tasks.some(t=>t.nodeId===selected.id)} onClick={()=>change(saveNode(workspace,selected.id,version.id))}>{workspace.tasks.some(t=>t.nodeId===selected.id)?<><Check size={16}/>Saved in journey</>:'Save to my journey'}</button>}
              <button className="text-link" onClick={()=>setView('source')}>Read full source <ArrowUpRight size={14}/></button>
            </>:<div className="empty-inspector"><BookOpen size={26}/><h2>Every detail has a source.</h2><p>Select an object to inspect its meaning and evidence.</p></div>}
            <AskPanel key={workspace.id} version={version} selected={selected} mode={mode}/>
          </aside>}
        </div>
        <footer className="workspace-footer"><span>Firebase AI Logic</span><label>AI privacy<select value={mode} onChange={e=>setMode(e.target.value as PrivacyMode)}><option value="auto">Automatic · device then cloud</option><option value="device">Device only</option></select></label><small>{mode==='auto'?'Automatic may send notice content to cloud AI.':'Device only stops when local inference is unavailable.'}</small></footer>
      </>}
    </div>
    {importing&&<ImportNotice previous={importing==='revision'?latest:undefined} mode={mode} onMode={setMode} onClose={()=>setImporting(null)} onImport={(next,title)=>{
      if(importing==='revision'){change({...workspace,versions:[...workspace.versions,next]});setVersionIndex(workspace.versions.length);setSelectedId(next.nodes[0]?.id??null);}
      else if(!open({id:crypto.randomUUID(),title,versions:[next],tasks:[],reviews:[]}))return;
      setImporting(null);setView(next.nodes.length?'world':'source');
    }}/>}
    {deleting&&<Dialog locked={deletingBusy} onClose={()=>setDeleting(false)}><section aria-labelledby="delete-title" className="confirm-dialog"><h2 id="delete-title">Delete this workspace?</h2><p>This removes its locally saved notices, versions, journey steps, and review history.</p><button disabled={deletingBusy} onClick={()=>setDeleting(false)}>Cancel</button><button disabled={deletingBusy} className="danger-button" onClick={remove}>{deletingBusy?'Deleting…':'Delete workspace'}</button></section></Dialog>}
  </div>;
}
