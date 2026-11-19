type Props = { evidence: string; original: string; label?: string };

export default function SourceExcerpt({ evidence, original, label = 'Source excerpt' }: Props) {
  const quote = evidence.trim().replace(/^[“"]|[”"]$/g, '');
  const start = quote ? original.indexOf(quote) : -1;
  const end = start + quote.length;
  const before = original.slice(0, Math.max(start, 0));
  const after = original.slice(end);
  const prefix = before.length > 60 ? '… ' + before.slice(-60).replace(/^\S*\s/, '') : before;
  const suffix = after.length > 60 ? after.slice(0, 60).replace(/\s\S*$/, '') + ' …' : after;

  return <details className="source-excerpt">
    <summary>{label}</summary>
    <blockquote>{start < 0 ? evidence : <>{prefix}<mark>{original.slice(start, end)}</mark>{suffix}</>}</blockquote>
  </details>;
}
