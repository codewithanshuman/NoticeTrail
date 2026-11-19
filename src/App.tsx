import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRight, BookOpenText, Check, CheckCircle2, ChevronDown, Clipboard, Cloud, FileImage, FileText, GitCompareArrows, Info, LockKeyhole, RotateCcw, ScanLine, ShieldCheck, Sparkles, UploadCloud, X } from 'lucide-react';
import { isConfigured, makeBrief } from './firebase';
import { downloadBrief, formatBrief } from './export';
import Planner from './Planner';
import { listTasks, saveTask, taskId, type PlanInput, type PlanItem } from './taskStore';
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
        <a className="brand" href="#top" aria-label="NoticeTrail home"><span className="brand-mark"><ScanLine size={21} strokeWidth={2.3} /></span><span>NoticeTrail<span className="brand-dot">.</span></span></a>
        <div className="header-right"><span className="header-note"><ShieldCheck size={15} /> Built with Firebase AI Logic</span><a className="header-link" href="#how-it-works">How it works <ArrowRight size={16} /></a></div>
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-main">
            <div className="eyebrow"><span className="eyebrow-line" /> A CLEARER WAY FORWARD</div>
            <h1 id="hero-title">The important part<br /><em>shouldn’t be hard to find.</em></h1>
            <p>Turn a long notice into a clear action plan. When an update arrives, compare both versions to see exactly what changed.</p>
            <div className="hero-pills"><span><CheckCircle2 size={16} /> Actionable next steps</span><span><ShieldCheck size={16} /> Evidence from the original</span><span><LockKeyhole size={16} /> Your privacy choice</span></div>
          </div>
          <div className="hero-art" aria-hidden="true"><div className="paper paper-back"><i /><i /><i /><i /></div><div className="paper paper-front"><div className="paper-top"><span>THE CLEAR VERSION</span><Sparkles size={17} /></div><div className="paper-title" /><div className="paper-line long" /><div className="paper-line" /><div className="paper-check"><Check size={14} /><span /></div><div className="paper-check"><Check size={14} /><span /></div></div><div className="art-badge"><span className="art-badge-icon"><Sparkles size={16} /></span> Make sense of it</div></div>
        </section>

        <section className="workspace" aria-label="Notice analyzer">
          <div className="workspace-heading"><div><span className="section-kicker">YOUR WORKSPACE</span><h2>{workflow === 'brief' ? 'Start with a notice.' : workflow === 'compare' ? 'See what changed.' : 'Track your next steps.'}</h2><p>{workflow === 'brief' ? 'Paste the words or add a screenshot. We’ll help pull out the signal.' : workflow === 'plan' ? 'Review saved steps, check their sources, and set deadlines.' : 'Compare an original notice with an update, backed by excerpts from both.'}</p></div>{workflow === 'brief' && <button className="text-button" disabled={busy} onClick={resetExample}><RotateCcw size={15} /> Load example</button>}</div>
          <div className="workflow-tabs" role="tablist" aria-label="Choose workflow"><button role="tab" aria-selected={workflow === 'brief'} className={workflow === 'brief' ? 'active' : ''} onClick={() => setWorkflow('brief')}><FileText size={16} /> Make a brief</button><button role="tab" aria-selected={workflow === 'compare'} className={workflow === 'compare' ? 'active' : ''} onClick={() => setWorkflow('compare')}><GitCompareArrows size={16} /> Compare updates</button><button role="tab" aria-selected={workflow === 'plan'} className={workflow === 'plan' ? 'active' : ''} onClick={() => setWorkflow('plan')}><CheckCircle2 size={16}/> My plan ({items.length})</button></div>
          {planMessage && <p role="status">{planMessage}</p>}
          {workflow === 'plan' && <Planner items={items} refresh={refresh} save={save} report={setPlanMessage}/>}
          {!isConfigured && workflow !== 'plan' && <div className="setup-banner" role="status"><Info size={18}/><div><strong>Live AI needs setup</strong><span>Explore the labeled examples, compare wording locally, or save tasks to your plan.</span></div></div>}
          <div className="workspace-grid" hidden={workflow !== 'brief'}>
            <div className="input-card">
              <div className="card-heading"><div className="card-icon"><FileText size={19} /></div><div><span className="card-step">01 / INPUT</span><h3>What does it say?</h3></div></div>
              <label className="field-label" htmlFor="notice-text">PASTE YOUR NOTICE</label>
              <textarea id="notice-text" onSelect={e => {
                const field = e.currentTarget;
                setSelection({ notice: field.value, quote: field.value.slice(field.selectionStart, field.selectionEnd).trim() });
              }} value={text} maxLength={12000} disabled={busy} onChange={(e) => { setText(e.target.value); setBrief(null); setSource(null); setChecked([]); setError(''); }} placeholder="Paste a school note, community update, workplace message, or other everyday notice..." />
              <div className="field-meta"><span>Plain text works best for quick on-device analysis</span><span>{count.toLocaleString()} / 12,000</span></div>
              <div className="excerpt-save">{excerpt ? saveButton({ task: excerpt, notice: text.trim().split(/\r?\n/)[0].slice(0, 80), evidence: excerpt, origin: text === sampleNotice ? 'Example excerpt' : 'Selected by you' }) : <small>Select a passage above to save it to your plan.</small>}</div>
              <div className="divider"><span>OR ADD A FILE</span></div>
              <label className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(e) => { e.preventDefault(); setDragging(false); selectFile(e.dataTransfer.files[0] || null); }}>
                <input type="file" accept="image/png,image/jpeg,text/plain,.txt" disabled={busy} onChange={(e) => selectFile(e.target.files?.[0] || null)} />
                {file && imageUrl ? <><img className="upload-preview" src={imageUrl} alt="Selected notice" /><span className="upload-name"><FileImage size={15} /> {file.name}</span></> : <><span className="upload-icon"><UploadCloud size={22} /></span><strong>Drop a notice here, or browse</strong><small>PNG, JPEG, or TXT</small></>}
              </label>
              {file && <button className="remove-image" disabled={busy} onClick={() => selectFile(null)}><X size={14} /> Remove image</button>}
              <div className="privacy-title"><span className="field-label">WHERE SHOULD AI RUN?</span><span className="privacy-help" title="Automatic uses the device when available and can fall back to the cloud."><Info size={15} /></span></div>
              <div className="mode-options" role="radiogroup" aria-label="AI privacy mode" onKeyDown={(e) => { if (!busy && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const next = mode === 'auto' ? 'device' : 'auto'; setMode(next); (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLButtonElement | null)?.focus(); } }}>
                <button className={`mode-option ${mode === 'auto' ? 'selected' : ''}`} data-mode="auto" disabled={busy} role="radio" aria-checked={mode === 'auto'} onClick={() => setMode('auto')}><span className="radio-dot" /><span><strong>Automatic</strong><small>Try this device, then cloud if needed</small></span><Cloud size={19} /></button>
                <button className={`mode-option ${mode === 'device' ? 'selected' : ''}`} data-mode="device" disabled={busy} role="radio" aria-checked={mode === 'device'} onClick={() => setMode('device')}><span className="radio-dot" /><span><strong>Device only</strong><small>Never send notice content to cloud AI</small></span><LockKeyhole size={19} /></button>
              </div>
              <p className="privacy-note">{mode === 'device' ? 'If the local model is unavailable, analysis stops. Chrome may need to download the model first.' : 'Automatic mode may send your notice to Gemini in the cloud when the local model is unavailable.'}</p>
              {error && <div className="error-box" role="alert">{error}</div>}
              <button className="generate-button" disabled={!canGenerate} onClick={generate}><Sparkles size={18} /> {busy ? (progress !== null && mode === 'device' ? `Preparing device model ${Math.round(progress * 100)}%` : 'Making your brief…') : 'Make it clear'} <ArrowRight size={18} /></button>
              {!isConfigured && <p className="config-note">To enable this button, add Firebase and App Check values to <code>.env</code>.</p>}
            </div>

            <div className="result-card" aria-live="polite" aria-busy={busy}>
              <div className="card-heading result-heading"><div className="card-icon teal"><BookOpenText size={19} /></div><div><span className="card-step">02 / YOUR BRIEF</span><h3>The clear version</h3></div>{brief && <div className="result-actions"><button className="icon-button" onClick={copyBrief} title="Copy brief" aria-label="Copy brief">{copied ? <Check size={18} /> : <Clipboard size={18} />}</button><button className="icon-button" onClick={() => downloadBrief(brief, source || 'UNKNOWN')} title="Download brief" aria-label="Download brief"><ArrowDownToLine size={18} /></button></div>}</div>
              {brief ? <>
                <div className={`source-chip ${source === 'ON_DEVICE' ? 'device' : source === 'IN_CLOUD' ? 'cloud' : ''}`}>{source === 'SAMPLE' ? <Sparkles size={14} /> : source === 'ON_DEVICE' ? <LockKeyhole size={14} /> : source === 'IN_CLOUD' ? <Cloud size={14} /> : <Info size={14} />}{source === 'SAMPLE' ? 'PREWRITTEN EXAMPLE' : source === 'ON_DEVICE' ? 'GENERATED ON THIS DEVICE' : source === 'IN_CLOUD' ? 'GENERATED IN THE CLOUD' : 'SOURCE NOT REPORTED'}</div>
                <h4 className="brief-title">{brief.title}</h4><p className="brief-summary">{brief.summary || 'No reliable summary was returned.'}</p>
                <div className="result-section"><div className="result-section-heading"><span className="section-symbol purple"><Check size={16} /></span><h5>Your next steps</h5><span className="section-count">{brief.actions.length}</span></div>{brief.actions.length ? <div className="action-list">{brief.actions.map((item, i) => <div className={`action-item ${checked.includes(i) ? 'done' : ''}`} key={`${i}-${item.task}`}><button className="check-button" aria-label={`Mark step ${i + 1} ${checked.includes(i) ? 'incomplete' : 'complete'}`} onClick={() => setChecked((old) => old.includes(i) ? old.filter((x) => x !== i) : [...old, i])}>{checked.includes(i) && <Check size={14} />}</button><div><p>{item.task}</p>{saveButton({ task: item.task, evidence: item.evidence, notice: brief.title, origin: { ON_DEVICE: 'On-device AI', IN_CLOUD: 'Cloud AI', SAMPLE: 'Example', UNKNOWN: 'AI source unreported' }[source || 'UNKNOWN'] }, checked.includes(i))}{item.evidence && <details><summary>Show source <ChevronDown size={13} /></summary><blockquote>{item.evidence}</blockquote></details>}</div></div>)}</div> : <p className="empty-line">No explicit action found.</p>}</div>
                <div className="result-section"><div className="result-section-heading"><span className="section-symbol orange">◎</span><h5>Dates to notice</h5><span className="section-count">{brief.dates.length}</span></div>{brief.dates.length ? <div className="date-list">{brief.dates.map((item, i) => <div className="date-item" key={`${i}-${item.date}`}><strong>{item.date}</strong><span>{item.meaning}</span>{item.evidence && <details><summary>Source <ChevronDown size={13} /></summary><blockquote>{item.evidence}</blockquote></details>}</div>)}</div> : <p className="empty-line">No explicit dates found.</p>}</div>
                <div className="result-section last"><div className="result-section-heading"><span className="section-symbol blue">?</span><h5>Worth asking</h5></div>{brief.questions.length ? <ul className="question-list">{brief.questions.map((q, i) => <li key={`${i}-${q}`}>{q}</li>)}</ul> : <p className="empty-line">No unanswered questions suggested.</p>}</div>
                <div className="result-footnote"><Info size={14} /> AI can miss details. Check the original notice before acting.</div>
              </> : <div className="empty-result"><div className="empty-illustration"><FileText size={38} /><Sparkles size={21} /></div><h4>A little clarity is on its way.</h4><p>Add a notice and choose <strong>Make it clear</strong> to see your summary, steps, and important dates here.</p></div>}
            </div>
          </div>
          <div hidden={workflow !== 'compare'}><CompareWorkspace saveButton={saveButton} /></div>
        </section>

        <section className="how-section" id="how-it-works"><div><span className="section-kicker">THOUGHTFULLY HYBRID</span><h2>The right intelligence<br />for the moment.</h2><p>Every notice deserves a clear reading. You choose how much of it leaves your device.</p></div><div className="how-cards"><div className="how-card"><span className="how-icon green"><LockKeyhole size={21} /></span><h3>Local when possible</h3><p>Firebase AI Logic can run Gemini Nano on a supported Chrome desktop, including when you’re offline after setup.</p></div><div className="how-card"><span className="how-icon peach"><Cloud size={21} /></span><h3>Cloud when needed</h3><p>Automatic mode falls back to Gemini in the cloud if the local model is unavailable. The brief shows which path ran.</p></div></div></section>
      </main>
      <footer><span className="footer-brand">NoticeTrail<span>.</span></span><span>Making everyday information easier to act on.</span><a href="https://firebase.google.com/docs/ai-logic/hybrid/web/get-started" target="_blank" rel="noreferrer">Powered by Firebase AI Logic <ArrowRight size={14} /></a></footer>
    </div>
  );
}

export default App;
