import type { Brief, Source } from './types';

const sourceLabel: Record<Source, string> = {
  ON_DEVICE: 'Generated on this device',
  IN_CLOUD: 'Generated in the cloud',
  UNKNOWN: 'Inference source not reported',
  SAMPLE: 'Prewritten example',
};

export function formatBrief(brief: Brief, source: Source): string {
  return [
    brief.title,
    sourceLabel[source],
    '',
    brief.summary,
    '',
    'NEXT STEPS',
    ...(brief.actions.length ? brief.actions.flatMap((a, i) => [`${i + 1}. ${a.task}`, `   Source: ${a.evidence}`]) : ['No explicit actions found.']),
    '',
    'DATES TO NOTICE',
    ...(brief.dates.length ? brief.dates.flatMap((d) => [`- ${d.date}: ${d.meaning}`, `  Source: ${d.evidence}`]) : ['No explicit dates found.']),
    '',
    'WORTH ASKING',
    ...(brief.questions.length ? brief.questions.map((q) => `- ${q}`) : ['No unanswered questions suggested.']),
    '',
    'AI can miss details. Check the original notice before acting.',
  ].join('\n');
}

export function downloadBrief(brief: Brief, source: Source) {
  const blob = new Blob([formatBrief(brief, source)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'noticetrail-brief.txt';
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
