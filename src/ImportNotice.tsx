import Dialog from './Dialog';
import { useRef, useState } from 'react';
import { Upload, X, LockKeyhole } from 'lucide-react';
import { isConfigured } from './firebase';
import { extractWorkspace } from './extractWorkspace';
import type { Version } from './domain';
import type { PrivacyMode } from './types';

type Props = { previous?: Version; mode: PrivacyMode; onMode: (mode: PrivacyMode) => void; onImport: (version: Version, title: string) => void; onClose: () => void };
export default function ImportNotice({previous, mode, onMode, onImport, onClose}: Props) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState('');
  const [fileName,setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const revision = useRef(0);

  async function choose(next?: File) {
    if (!next || busy) return;
    const token = ++revision.current;
    setReading(true);
    setError('');
    try {
      if (next.type === 'text/plain' || next.name.toLowerCase().endsWith('.txt')) {
        if (next.size > 30_000) throw new Error('Choose a TXT file under 30 KB.');
        const value = (await next.text()).replace(/^\uFEFF/,'');
        if (token !== revision.current) return;
        if(value.includes('\0'))throw new Error('This file does not contain readable plain text. Choose a UTF-8 TXT file.');
        if(!value.trim())throw new Error('This file is empty. Choose another notice or paste its text.');
        if (value.length > 12_000) throw new Error('Use a notice of at most 12,000 characters.');
        setText(value); setFile(null); setImage('');setFileName(next.name);
      } else {
        if (!['image/png','image/jpeg'].includes(next.type) || next.size > 8 * 1024 * 1024) throw new Error('Choose a PNG or JPEG under 8 MB, or a TXT file.');
        const value = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error('Could not read this image.'));
          reader.readAsDataURL(next);
        });
        await new Promise<void>((resolve,reject)=>{
          const preview=new Image();
          preview.onload=()=>preview.naturalWidth&&preview.naturalHeight?resolve():reject(new Error('This image is empty. Choose another screenshot.'));
          preview.onerror=()=>reject(new Error('This image could not be decoded. Choose a valid PNG or JPEG.'));
          preview.src=value;
        });
        if (token !== revision.current) return;
        setImage(value); setFile(next);setFileName(next.name);
      }
    } catch (e) { if (token === revision.current) setError(e instanceof Error ? e.message : 'Could not read this file.'); }
    finally { if (token === revision.current) setReading(false); }
  }

  async function build() {
    setBusy(true); setError(''); setProgress(null);
    try {
      const result = await extractWorkspace({ text, file, mode, onProgress: setProgress, previous });
      onImport(result.version, title.trim() || result.title);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not analyze the notice.'); }
    finally { setBusy(false); }
  }

  return <Dialog labelledBy="import-title" onClose={onClose} locked={busy}><section className="import-dialog" aria-labelledby="import-title" aria-busy={busy}>
    <div className="section-head"><h2 id="import-title">{previous ? 'Add a revision' : 'A new workspace'}</h2><button aria-label="Close import" disabled={busy} onClick={onClose}><X size={18}/></button></div>
    <p>{previous ? 'Use an updated version of the same notice. Existing actions stay intact until you review the changes.' : 'Bring a notice. Explore the instructions, dates, and evidence together.'}</p>
    {!previous && <label>Workspace name <small>Optional</small><input autoFocus disabled={busy} value={title} maxLength={100} onChange={e=>setTitle(e.target.value)} placeholder="For example, community garden"/></label>}
    <label>{image ? 'Additional context' : 'Notice text'}<textarea aria-describedby="notice-text-help" autoFocus={Boolean(previous)} value={text} disabled={busy} maxLength={12000} onChange={e=>{revision.current++;setReading(false);setText(e.target.value);}} placeholder="Paste the complete notice, including dates and conditions…"/></label>
    <div className="input-help" id="notice-text-help"><span>{image?'The image is your source; this text adds context.':'Keep the original wording so evidence can be traced.'}</span><span>{text.length.toLocaleString()} / 12,000</span></div>
    <label className="file-picker"><Upload size={20}/><span>{reading ? 'Reading file…' : fileName || 'Choose a TXT file or screenshot'}<small>TXT up to 30 KB · PNG or JPEG up to 8 MB</small></span><input type="file" aria-label="Choose notice file" disabled={busy} accept=".txt,image/png,image/jpeg" onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/></label>
    {image && <div className="import-image"><img src={image} alt="Notice to analyze"/><button disabled={busy} onClick={()=>{revision.current++;setReading(false);setFile(null);setImage('');setFileName('');}}>Remove image</button><small>Image-derived facts need your review against the screenshot.</small></div>}
    <label className="mode-select"><LockKeyhole size={16}/>Inference<select disabled={busy} value={mode} onChange={e=>onMode(e.target.value as PrivacyMode)}><option value="auto">Automatic</option><option value="device">Device only</option></select></label>
    <p className="muted">{mode==='auto' ? 'Automatic tries your device and may send this notice to cloud AI.' : 'Device only stops if the on-device model is unavailable.'}</p>
    {!isConfigured && <p className="notice">AI analysis is not connected on this installation. Open text and select its facts yourself; your sources, revisions, and saved steps work locally.</p>}
    {error && <p role="alert" className="error">{error}</p>}
    <div className="import-actions"><button className={!isConfigured?'primary':undefined} disabled={busy || reading || text.trim().length<1 || Boolean(file)} onClick={()=>onImport({id:crypto.randomUUID(),label:previous?'Updated notice':'Original notice',created:Date.now(),text,source:'UNKNOWN',method:'manual',nodes:[],edges:[]},title.trim()||text.trim().split('\n')[0].slice(0,80))}>Open text without AI</button>
    <button className={isConfigured?'primary':undefined} disabled={busy || reading || !isConfigured || (text.trim().length<20 && !file)} onClick={build}>{busy ? progress===null ? 'Reading your notice…' : 'Preparing model ' + Math.round(Math.max(0,Math.min(1,progress))*100)+'%' : 'Build workspace'}</button></div>
  </section></Dialog>;
}
