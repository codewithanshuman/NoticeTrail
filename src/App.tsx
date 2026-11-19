import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpenText, Check, CheckCircle2, Clipboard, Cloud, FileImage, FileText, GitCompareArrows, Info, LockKeyhole, RotateCcw, Sparkles, UploadCloud, X } from 'lucide-react';
import { isConfigured, makeBrief } from './firebase';
import { downloadBrief, formatBrief } from './export';
import Planner from './Planner';
import { listTasks, saveTask, taskId, type PlanInput, type PlanItem } from './taskStore';
import SourceExcerpt from './SourceExcerpt';
import CompareWorkspace from './CompareWorkspace';
import { sampleBrief, sampleNotice } from './sample';
import type { Brief, PrivacyMode, Source } from './types';

function App() {
  const [text, setText] = useState(sampleNotice);
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<PrivacyMode>('auto');
  const [brief, setBrief] = useState<Brief | null>(sampleBrief);
  const [source, setSource] = useState<Source | null>('SAMPLE');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [checked, setChecked] = useState<number[]>([]);
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [workflow, setWorkflow] = useState<'brief' | 'compare' | 'plan'>('brief');

  const [items, setItems] = useState<PlanItem[]>([]);
  const [planMessage, setPlanMessage] = useState('');
  async function refresh() { setItems(await listTasks()); }
  useEffect(() => {
    const reload = () => { refresh().catch(() => setPlanMessage('Browser storage is unavailable. Saving requires storage access.')); };
    reload();
    window.addEventListener('focus', reload);
    return () => window.removeEventListener('focus', reload);
  }, []);

  async function save(input: PlanInput, done = false) {
    try {
      await saveTask(input, done);
      await refresh();
      setPlanMessage('Saved to My plan.');
      return true;
    } catch { setPlanMessage('Could not save this task. Check your browser storage.'); return false; }
  }

  function saveButton(input: PlanInput, done = false) {
    const saved = items.some(item => item.id === taskId(input));
    return <button className="save-step" disabled={saved} onClick={() => save(input, done)}>{saved ? 'Saved to My plan' : 'Save to My plan'}</button>;
  }

  useEffect(() => {
    if (!file) { setImageUrl(null); return; }
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const [selection, setSelection] = useState({ notice: '', quote: '' });
  const excerpt = selection.notice === text ? selection.quote : '';
  const count = useMemo(() => text.trim().length, [text]);
  const canGenerate = isConfigured && !busy && (count >= 20 || Boolean(file));

  async function selectFile(next: File | null) {
    if (busy) return;
    setError('');
    if (!next) { setFile(null); setBrief(null); setSource(null); setChecked([]); return; }
    if (next.type === 'text/plain' || next.name.toLowerCase().endsWith('.txt')) {
      if (next.size > 30_000) { setError('Choose a text file under 30 KB.'); return; }
      let content: string;
      try { content = await next.text(); }
      catch { setError('Could not read the text file.'); return; }
      if (content.length > 12_000) { setError('This notice is too long. Use the first 12,000 characters.'); return; }
      setText(content);
      setFile(null);
      setBrief(null);
      setSource(null);
      setChecked([]);
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(next.type)) { setError('Choose a PNG, JPEG, or TXT file.'); return; }
    if (next.size > 8 * 1024 * 1024) { setError('Choose an image under 8 MB.'); return; }
    if (text === sampleNotice) setText('');
    setFile(next);
    setBrief(null);
    setSource(null);
    setChecked([]);
  }

  function resetExample() {
    setText(sampleNotice);
    setFile(null);
    setBrief(sampleBrief);
    setSource('SAMPLE');
    setChecked([]);
    setError('');
  }

  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    setError('');
    setProgress(null);
    setChecked([]);
    setBrief(null);
    setSource(null);
    try {
      const result = await makeBrief({ text: text.trim(), file, mode, onProgress: setProgress });
      setBrief(result.brief);
      setSource(result.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function copyBrief() {
    if (!brief) return;
    try { await navigator.clipboard.writeText(formatBrief(brief, source || 'UNKNOWN')); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError('Could not copy. Check clipboard permissions.'); }
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" onClick={() => setWorkflow('brief')} aria-label="NoticeTrail home"><img src="/icon.svg" width="32" height="32" alt="" />NoticeTrail</a>
        <nav className="workflow-tabs" aria-label="Workspace">
          <button aria-current={workflow === 'brief' ? 'page' : undefined} onClick={() => setWorkflow('brief')}><FileText size={16}/>Read</button>
          <button aria-current={workflow === 'compare' ? 'page' : undefined} onClick={() => setWorkflow('compare')}><GitCompareArrows size={16}/>Compare</button>
          <button aria-current={workflow === 'plan' ? 'page' : undefined} onClick={() => setWorkflow('plan')}><CheckCircle2 size={16}/>My plan <span>{items.length}</span></button>
        </nav>
      </header>
      <main id="top">
        <section className="workspace" aria-labelledby="desk-title">
          <div className="desk-intro">
            <div><h1 id="desk-title">{workflow === 'brief' ? <>Read a <em>notice.</em></> : workflow === 'compare' ? <>Compare <em>versions.</em></> : <>My <em>plan.</em></>}</h1>
            <p>{workflow === 'brief' ? 'Find the next step and the words that support it.' : workflow === 'compare' ? 'Trace a change from the original wording to the update.' : 'Your saved steps, sources, and deadlines in one place.'}</p></div>
            <div className="paper-index" aria-hidden="true"><i/><i/><i/></div>
          </div>
          {planMessage && <p className="plan-feedback" role="status">{planMessage}</p>}
          {workflow === 'plan' && <Planner items={items} refresh={refresh} save={save} report={setPlanMessage}/>}
          <div className="workspace-grid" hidden={workflow !== 'brief'}>
            <div className="input-card">
              <div className="card-heading"><FileText size={19}/><h2><label htmlFor="notice-text">Original notice</label></h2><button className="text-button" disabled={busy} onClick={resetExample}><RotateCcw size={14}/> Load example</button></div>
              <a className="jump-result" href="#reading-brief">Jump to brief ↓</a>
              <textarea id="notice-text" onSelect={e => {
                const field = e.currentTarget;
                setSelection({ notice: field.value, quote: field.value.slice(field.selectionStart, field.selectionEnd).trim() });
              }} value={text} maxLength={12000} disabled={busy} onChange={(e) => { setText(e.target.value); setBrief(null); setSource(null); setChecked([]); setError(''); }} placeholder="Paste a school note, community update, workplace message, or other everyday notice..." />
              <div className="field-meta"><span>{count.toLocaleString()} / 12,000</span></div>
              <div className="excerpt-save">{excerpt ? saveButton({ task: excerpt, notice: text.trim().split(/\r?\n/)[0].slice(0, 80), evidence: excerpt, origin: text === sampleNotice ? 'Example excerpt' : 'Selected by you' }) : <small>Select a passage above to save it to your plan.</small>}</div>

              <label className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0] || null); }}>
                <input type="file" accept="image/png,image/jpeg,text/plain,.txt" disabled={busy} onChange={(e) => selectFile(e.target.files?.[0] || null)} />
                {file && imageUrl ? <><img className="upload-preview" src={imageUrl} alt="Selected notice" /><span className="upload-name"><FileImage size={15} /> {file.name}</span></> : <><span className="upload-icon"><UploadCloud size={22} /></span><strong>Attach a notice</strong><small>PNG, JPEG, or TXT</small></>}
              </label>
              {file && <button className="remove-image" disabled={busy} onClick={() => selectFile(null)}><X size={14} /> Remove image</button>}
              <div className="privacy-title"><span className="field-label">WHERE SHOULD AI RUN?</span><span className="privacy-help" title="Automatic uses the device when available and can fall back to the cloud."><Info size={15} /></span></div>
              <div className="mode-options" role="radiogroup" aria-label="AI privacy mode" onKeyDown={(e) => { if (!busy && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const next = mode === 'auto' ? 'device' : 'auto'; setMode(next); (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLButtonElement | null)?.focus(); } }}>
                <button className={`mode-option ${mode === 'auto' ? 'selected' : ''}`} data-mode="auto" disabled={busy} role="radio" aria-checked={mode === 'auto'} onClick={() => setMode('auto')}><span className="radio-dot" /><span><strong>Automatic</strong><small>Try this device, then cloud if needed</small></span><Cloud size={19} /></button>
                <button className={`mode-option ${mode === 'device' ? 'selected' : ''}`} data-mode="device" disabled={busy} role="radio" aria-checked={mode === 'device'} onClick={() => setMode('device')}><span className="radio-dot" /><span><strong>Device only</strong><small>Never send notice content to cloud AI</small></span><LockKeyhole size={19} /></button>
              </div>
              <p className="privacy-note">{mode === 'device' ? 'If the local model is unavailable, analysis stops. Chrome may need to download the model first.' : 'Automatic mode may send your notice to Gemini in the cloud when the local model is unavailable.'}</p>
              {error && <div className="error-box" role="alert">{error}</div>}
              <button className="generate-button" disabled={!canGenerate} onClick={generate}><Sparkles size={18} /> {busy ? (progress !== null && mode === 'device' ? `Preparing device model ${Math.round(progress * 100)}%` : 'Making your brief…') : 'Generate brief'} <ArrowRight size={18} /></button>
              {!isConfigured && <p className="config-note">Live AI is awaiting setup. You can still select and save a passage.</p>}
            </div>

            <div className="result-card" id="reading-brief" aria-live="polite" aria-busy={busy}>
              <div className="card-heading result-heading"><BookOpenText size={19}/><h2>Reading brief</h2>{brief && <div className="result-actions"><button className="icon-button" onClick={copyBrief} title="Copy brief" aria-label="Copy brief">{copied ? <Check size={18} /> : <Clipboard size={18} />}</button><button className="icon-button" onClick={() => downloadBrief(brief, source || 'UNKNOWN')} title="Download brief" aria-label="Download brief"><ArrowDownToLine size={18} /></button></div>}</div>
              {brief ? <>
                <div className={`source-chip ${source === 'ON_DEVICE' ? 'device' : source === 'IN_CLOUD' ? 'cloud' : ''}`}>{source === 'SAMPLE' ? <Sparkles size={14} /> : source === 'ON_DEVICE' ? <LockKeyhole size={14} /> : source === 'IN_CLOUD' ? <Cloud size={14} /> : <Info size={14} />}{source === 'SAMPLE' ? 'Prewritten example' : source === 'ON_DEVICE' ? 'Generated on this device' : source === 'IN_CLOUD' ? 'Generated in the cloud' : 'Source unreported'}</div>
                <h4 className="brief-title">{brief.title}</h4><p className="brief-summary">{brief.summary || 'No reliable summary was returned.'}</p>
                <div className="result-section"><div className="result-section-heading"><span className="section-symbol purple"><Check size={16} /></span><h5>Next steps</h5><span className="section-count">{brief.actions.length}</span></div>{brief.actions.length ? <div className="action-list">{brief.actions.map((item, i) => <div className={`action-item ${checked.includes(i) ? 'done' : ''}`} key={`${i}-${item.task}`}><button className="check-button" aria-label={`Mark step ${i + 1} ${checked.includes(i) ? 'incomplete' : 'complete'}`} onClick={() => setChecked((old) => old.includes(i) ? old.filter((x) => x !== i) : [...old, i])}>{checked.includes(i) && <Check size={14} />}</button><div><p>{item.task}</p>{saveButton({ task: item.task, evidence: item.evidence, notice: brief.title, origin: { ON_DEVICE: 'On-device AI', IN_CLOUD: 'Cloud AI', SAMPLE: 'Example', UNKNOWN: 'AI source unreported' }[source || 'UNKNOWN'] }, checked.includes(i))}{item.evidence && <SourceExcerpt original={file ? '' : text} evidence={item.evidence}/>}</div></div>)}</div> : <p className="empty-line">No explicit action found.</p>}</div>
                <div className="result-section"><div className="result-section-heading"><span className="section-symbol orange">◎</span><h5>Dates to notice</h5><span className="section-count">{brief.dates.length}</span></div>{brief.dates.length ? <div className="date-list">{brief.dates.map((item, i) => <div className="date-item" key={`${i}-${item.date}`}><strong>{item.date}</strong><span>{item.meaning}</span>{item.evidence && <SourceExcerpt original={file ? '' : text} evidence={item.evidence}/>}</div>)}</div> : <p className="empty-line">No explicit dates found.</p>}</div>
                <div className="result-section last"><div className="result-section-heading"><span className="section-symbol blue">?</span><h5>Worth asking</h5></div>{brief.questions.length ? <ul className="question-list">{brief.questions.map((q, i) => <li key={`${i}-${q}`}>{q}</li>)}</ul> : <p className="empty-line">No unanswered questions suggested.</p>}</div>
                <div className="result-footnote"><Info size={14} /> AI can miss details. Check the original notice before acting.</div>
              </> : <div className="empty-result"><div className="empty-illustration"><FileText size={38} /><Sparkles size={21} /></div><h4>Your brief will appear here.</h4><p>Add a notice and choose <strong>Generate brief</strong> to see your summary, steps, and important dates here.</p></div>}
            </div>
          </div>
          <div hidden={workflow !== 'compare'}><CompareWorkspace saveButton={saveButton} /></div>
        </section>

      </main>
      <footer><span>NoticeTrail</span><a href="https://firebase.google.com/docs/ai-logic/hybrid/web/get-started" target="_blank" rel="noreferrer">Firebase AI Logic <ArrowRight size={14}/></a></footer>
    </div>
  );
}

export default App;
