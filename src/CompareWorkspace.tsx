import type { ReactNode } from 'react';
import type { PlanInput } from './taskStore';
import SourceExcerpt from './SourceExcerpt';
import TextChanges from './TextChanges';
import { useState } from 'react';
import { ArrowDownToLine, ArrowRight, Check, Clipboard, Cloud, GitCompareArrows, Info, LockKeyhole, RotateCcw, Sparkles } from 'lucide-react';
import { compareNotices, isConfigured } from './firebase';
import { sampleComparison, sampleNewNotice, sampleOldNotice } from './sample';
import type { Comparison, PrivacyMode, Source } from './types';

const sourceNames: Record<Source, string> = {
  SAMPLE: 'Prewritten example',
  ON_DEVICE: 'GENERATED ON THIS DEVICE',
  IN_CLOUD: 'GENERATED IN THE CLOUD',
  UNKNOWN: 'SOURCE NOT REPORTED',
};

function formatComparison(comparison: Comparison, source: Source): string {
  return [comparison.headline, sourceNames[source], '', comparison.summary, '',
    ...comparison.changes.flatMap((change, index) => [
      `${index + 1}. ${change.kind.toUpperCase()}: ${change.impact}`,
      change.before ? `   Before: ${change.before}` : '',
      change.after ? `   After: ${change.after}` : '',
      change.beforeEvidence ? `   Old notice: "${change.beforeEvidence}"` : '',
      change.afterEvidence ? `   New notice: "${change.afterEvidence}"` : '',
      '',
    ]),
    'Check both original notices before acting.',
  ].filter((line) => line !== '').join('\n');
}

function downloadComparison(comparison: Comparison, source: Source) {
  const blob = new Blob([formatComparison(comparison, source)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'noticetrail-changes.txt';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function CompareWorkspace({saveButton}: {saveButton: (input: PlanInput) => ReactNode}) {
  const [oldText, setOldText] = useState(sampleOldNotice);
  const [newText, setNewText] = useState(sampleNewNotice);
  const [mode, setMode] = useState<PrivacyMode>('auto');
  const [comparison, setComparison] = useState<Comparison | null>(sampleComparison);
  const [source, setSource] = useState<Source>('SAMPLE');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const canCompare = isConfigured && !busy && oldText.trim().length >= 20 && newText.trim().length >= 20;

  function updateOld(value: string) { setOldText(value); setComparison(null); setError(''); }
  function updateNew(value: string) { setNewText(value); setComparison(null); setError(''); }
  function reset() { setOldText(sampleOldNotice); setNewText(sampleNewNotice); setComparison(sampleComparison); setSource('SAMPLE'); setError(''); }

  async function run() {
    if (!canCompare) return;
    setBusy(true);
    setComparison(null);
    setProgress(null);
    setError('');
    try {
      const result = await compareNotices({ oldText: oldText.trim(), newText: newText.trim(), mode, onProgress: setProgress });
      setComparison(result.comparison);
      setSource(result.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not compare these notices. Please try again.');
    } finally { setBusy(false); }
  }

  async function copy() {
    if (!comparison) return;
    try { await navigator.clipboard.writeText(formatComparison(comparison, source)); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setError('Could not copy. Check clipboard permissions.'); }
  }

  return <div className="compare-grid">
    <div className="input-card compare-input">
      <div className="card-heading"><GitCompareArrows size={19}/><h2>Source notices</h2><button className="text-button compare-reset" disabled={busy} onClick={reset}><RotateCcw size={14} /> Example</button></div>
      <a className="jump-result" href="#revision-brief">Jump to revision brief ↓</a><label className="field-label" htmlFor="old-notice">ORIGINAL NOTICE</label>
      <textarea id="old-notice" value={oldText} maxLength={6000} disabled={busy} onChange={(e) => updateOld(e.target.value)} placeholder="Paste the first version here..." />
      <div className="compare-meta">{oldText.length.toLocaleString()} / 6,000</div>
      <div className="compare-arrow" aria-hidden="true"><ArrowRight size={18} /><span>UPDATED TO</span></div>
      <label className="field-label" htmlFor="new-notice">UPDATED NOTICE</label>
      <textarea id="new-notice" value={newText} maxLength={6000} disabled={busy} onChange={(e) => updateNew(e.target.value)} placeholder="Paste the newer version here..." />
      <div className="compare-meta">{newText.length.toLocaleString()} / 6,000</div>
      <TextChanges before={oldText} after={newText}/>
      <div className="privacy-title"><span className="field-label">WHERE SHOULD AI RUN?</span></div>
      <div className="mode-options" role="radiogroup" aria-label="Comparison privacy mode" onKeyDown={(e) => { if (!busy && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); const next = mode === 'auto' ? 'device' : 'auto'; setMode(next); (e.currentTarget.querySelector(`[data-mode="${next}"]`) as HTMLButtonElement | null)?.focus(); } }}>
        <button className={`mode-option ${mode === 'auto' ? 'selected' : ''}`} data-mode="auto" disabled={busy} role="radio" aria-checked={mode === 'auto'} onClick={() => setMode('auto')}><span className="radio-dot" /><span><strong>Automatic</strong><small>Device first, cloud fallback</small></span><Cloud size={19} /></button>
        <button className={`mode-option ${mode === 'device' ? 'selected' : ''}`} data-mode="device" disabled={busy} role="radio" aria-checked={mode === 'device'} onClick={() => setMode('device')}><span className="radio-dot" /><span><strong>Device only</strong><small>Never send either notice to cloud AI</small></span><LockKeyhole size={19} /></button>
      </div>
      <p className="privacy-note">{mode === 'device' ? 'If the local model is unavailable, comparison stops.' : 'Automatic mode may send both notices to Gemini in the cloud.'}</p>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="generate-button" disabled={!canCompare} onClick={run}><GitCompareArrows size={18} /> {busy ? (mode === 'device' && progress !== null ? `Preparing device model ${Math.round(progress * 100)}%` : 'Checking for changes…') : 'Compare notices'} <ArrowRight size={18} /></button>
      {!isConfigured && <p className="config-note">Live AI is awaiting setup. Exact text changes are available on this device.</p>}
    </div>
    <div className="result-card compare-result" id="revision-brief" aria-live="polite" aria-busy={busy}>
      <div className="card-heading result-heading"><GitCompareArrows size={19}/><h2>Revision brief</h2>{comparison && <div className="result-actions"><button className="icon-button" onClick={copy} title="Copy comparison" aria-label="Copy comparison">{copied ? <Check size={18} /> : <Clipboard size={18} />}</button><button className="icon-button" onClick={() => downloadComparison(comparison, source)} title="Download comparison" aria-label="Download comparison"><ArrowDownToLine size={18} /></button></div>}</div>
      {comparison ? <>
        <div className={`source-chip ${source === 'ON_DEVICE' ? 'device' : source === 'IN_CLOUD' ? 'cloud' : ''}`}>{source === 'SAMPLE' ? <Sparkles size={14} /> : source === 'ON_DEVICE' ? <LockKeyhole size={14} /> : source === 'IN_CLOUD' ? <Cloud size={14} /> : <Info size={14} />}{sourceNames[source]}</div>
        <h4 className="brief-title">{comparison.headline}</h4><p className="brief-summary">{comparison.summary || 'Review both notices for changes.'}</p>
        <div className="compare-count"><strong>{comparison.changes.length}</strong><span>meaningful {comparison.changes.length === 1 ? 'change' : 'changes'} found</span></div>
        {comparison.changes.length ? <div className="change-list">{comparison.changes.map((change, index) => <article className="change-card" key={`${index}-${change.impact}`}><div className="change-top"><span className={`change-kind ${change.kind}`}>{change.kind}</span><strong>{change.impact}</strong></div><div className="change-pair">{change.before && <div><small>BEFORE</small><p>{change.before}</p></div>}{change.after && <div><small>AFTER</small><p>{change.after}</p></div>}</div>{change.beforeEvidence && <SourceExcerpt original={oldText} evidence={change.beforeEvidence} label="Original excerpt"/>}{change.afterEvidence && <SourceExcerpt original={newText} evidence={change.afterEvidence} label="Updated excerpt"/>}{change.kind !== 'removed' && saveButton({task: change.impact, notice: comparison.headline, evidence: change.afterEvidence, origin: sourceNames[source]})}</article>)}</div> : <p className="empty-line">No supported changes found. Read both originals to confirm.</p>}
        <div className="result-footnote"><Info size={14} /> For pasted text, unsupported quotes are filtered out. Review both originals before acting.</div>
      </> : <div className="empty-result"><div className="empty-illustration"><GitCompareArrows size={38} /><Sparkles size={21} /></div><h4>Your revision brief will appear here.</h4><p>Paste both versions to see changed dates, places, requirements, and instructions here.</p></div>}
    </div>
  </div>;
}
