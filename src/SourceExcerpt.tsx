import { indexNotice } from './evidence';

type Props = { evidence: string; original: string; label?: string; expanded?: boolean };

export default function SourceExcerpt({ evidence, original, label = 'Source excerpt', expanded = false }: Props) {
  const match = indexNotice(original)(evidence);
  const start = match?.start ?? -1;
  const end = match?.end ?? 0;
  const before = original.slice(0, Math.max(start, 0));
  const after = original.slice(end);
  const prefix = before.length > 60 ? '… ' + before.slice(-60).replace(/^\S*\s/, '') : before;
  const suffix = after.length > 60 ? after.slice(0, 60).replace(/\s\S*$/, '') + ' …' : after;

  return <details key={evidence} className="source-excerpt" open={expanded || undefined}>
    <summary>{label}</summary>
    <blockquote>{start < 0 ? evidence : <>{prefix}<mark>{original.slice(start, end)}</mark>{suffix}</>}</blockquote>
  </details>;
}
