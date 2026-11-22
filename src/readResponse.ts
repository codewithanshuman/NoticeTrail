import type { Brief, Change, Comparison } from './types';
import { comparable, indexNotice } from './evidence.ts';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function string(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function response(raw: string, kind: string) {
  try { return record(JSON.parse(raw)); }
  catch { throw new Error('The model returned an incomplete ' + kind + '. Please try again.'); }
}

function unique<T>(rows: T[], key: (row: T) => string, limit: number) {
  const seen = new Set<string>();
  return rows.filter(row => {
    const id = key(row);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  }).slice(0, limit);
}

export function readBrief(raw: string, original: string, image: boolean): Brief {
  const value = response(raw, 'brief');
  if (!Array.isArray(value.actions) || !Array.isArray(value.dates) || !Array.isArray(value.questions) ||
      typeof value.title !== 'string' || typeof value.summary !== 'string') {
    throw new Error('The model returned an incomplete brief. Please try again.');
  }
  const locate = indexNotice(original);
  function quote(item: unknown) {
    const evidence = string(item);
    if (comparable(evidence).length < 4 || !/[\p{L}\p{N}]/u.test(evidence)) return '';
    return image ? evidence : locate(evidence)?.text ?? '';
  }
  const actions = value.actions.map(record).map(row => ({task: string(row.task), evidence: quote(row.evidence)}))
    .filter(row => row.task && row.evidence);
  const dates = value.dates.map(record).map(row => ({date: string(row.date), meaning: string(row.meaning), evidence: quote(row.evidence)}))
    .filter(row => row.date && row.meaning && row.evidence && indexNotice(row.evidence)(row.date));
  const partial = actions.length < value.actions.length || dates.length < value.dates.length;
  return {
    title: partial ? 'Reviewed notice' : string(value.title) || 'Your notice',
    summary: partial ? 'Some suggested items could not be supported by their excerpts. Review the original for any missing steps or dates.' : string(value.summary),
    actions: unique(actions, row => comparable(row.task) + '\n' + comparable(row.evidence), 8),
    dates: unique(dates, row => JSON.stringify([comparable(row.date), comparable(row.meaning), comparable(row.evidence)]), 8),
    questions: unique(value.questions.map(string).filter(Boolean), comparable, 5),
  };
}

export function readComparison(raw: string, original: string, updated: string): Comparison {
  const value = response(raw, 'comparison');
  if (!Array.isArray(value.changes) || typeof value.summary !== 'string' || typeof value.headline !== 'string') {
    throw new Error('The model returned an incomplete comparison. Please try again.');
  }
  if (original.trim() === updated.trim()) {
    return { headline: 'Identical notices', summary: 'Both versions contain the same text.', changes: [] };
  }
  const oldQuote = indexNotice(original);
  const newQuote = indexNotice(updated);
  const changes: Change[] = [];
  for (const row of value.changes.map(record)) {
    const {kind} = row;
    if (kind !== 'added' && kind !== 'removed' && kind !== 'changed') continue;
    const before = string(row.before);
    const after = string(row.after);
    const impact = string(row.impact);
    const oldEvidence = string(row.beforeEvidence);
    const newEvidence = string(row.afterEvidence);
    const beforeEvidence = oldQuote(oldEvidence)?.text ?? '';
    const afterEvidence = newQuote(newEvidence)?.text ?? '';
    if (!impact) continue;
    if (kind !== 'added' && (!before || beforeEvidence.trim().length < 4)) continue;
    if (kind !== 'removed' && (!after || afterEvidence.trim().length < 4)) continue;
    if (kind === 'added' && (before || oldEvidence || oldQuote(afterEvidence))) continue;
    if (kind === 'removed' && (after || newEvidence || newQuote(beforeEvidence))) continue;
    if (kind === 'changed' && comparable(beforeEvidence) === comparable(afterEvidence)) continue;
    changes.push({ kind, impact, before, after, beforeEvidence, afterEvidence });
  }
  const rows = unique(changes, row => JSON.stringify([row.kind, comparable(row.beforeEvidence), comparable(row.afterEvidence), comparable(row.impact)]), 12);
  if (rows.length !== value.changes.length) return {
    headline: rows.length + (rows.length === 1 ? ' supported change' : ' supported changes'),
    summary: 'Review the excerpts alongside both originals to confirm the differences.',
    changes: rows,
  };
  return { headline: string(value.headline) || 'What changed', summary: string(value.summary), changes: rows };
}
