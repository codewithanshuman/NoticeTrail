import { useMemo, useState } from 'react';
import { diffWordsWithSpace } from 'diff';

export default function TextChanges({ before, after }: { before: string; after: string }) {
  const [expanded, setExpanded] = useState(false);
  const ready = Boolean(before.trim() && after.trim());
  const parts = useMemo(() => ready && expanded ? diffWordsWithSpace(before, after, { maxEditLength: 400 }) : undefined, [ready, expanded, before, after]);
  return <details className="diff-panel" onToggle={e => setExpanded(e.currentTarget.open)}>
    <summary>Inspect exact text changes</summary>
    {!ready ? <p>Enter both versions to compare their wording.</p> : before === after ? <p>The two texts are identical.</p> : parts ? <>
      <p>Struck-through words were removed. Underlined words were added. Compared on this device.</p>
      <div className="diff-lines">{parts.map((part, i) => part.added ? <ins key={i}>{part.value}</ins> : part.removed ? <del key={i}>{part.value}</del> : <span key={i}>{part.value}</span>)}</div>
    </> : expanded && <><p>These versions differ substantially. Review the full passages below.</p><h4>Original</h4><p className="diff-lines">{before}</p><h4>Updated</h4><p className="diff-lines">{after}</p></>}
  </details>;
}
