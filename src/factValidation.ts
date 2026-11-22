import type { Fact, Relation, Version } from './domain';
import type { Source } from './types';
import { comparable, indexNotice } from './evidence.ts';

type ParseInput = { text: string; source: Source; previous?: Version; image?: string };
type Candidate = { key: string; fact: Omit<Fact, 'id'> };

const kinds = new Set<Fact['kind']>(['event', 'action', 'deadline', 'requirement', 'location', 'question']);
const obligations = new Set<Fact['obligation']>(['required', 'conditional', 'suggested']);

function string(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function signature(fact: Omit<Fact, 'id'>) {
  return JSON.stringify([fact.kind, comparable(fact.title), comparable(fact.quote), fact.obligation,
    comparable(fact.rawDate ?? ''), comparable(fact.condition ?? '')]);
}

function hash(value: string) {
  let result = 2166136261;
  for (const char of value) result = Math.imul(result ^ char.codePointAt(0)!, 16777619);
  return (result >>> 0).toString(36);
}

export function parseWorkspaceResponse(raw: string, input: ParseInput): { version: Version; title: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch { throw new Error('The document analysis was incomplete. Please try again.'); }
  const value = record(parsed);
  if (typeof value.title !== 'string' || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    throw new Error('The document analysis was incomplete. Please try again.');
  }

  const locate = indexNotice(input.text);
  const rows = value.nodes.map(record);
  const keyCounts = new Map<string, number>();
  for (const row of rows) {
    const key = string(row.key);
    keyCounts.set(key, (keyCounts.get(key) ?? 0) + 1);
  }

  const candidates: Candidate[] = [];
  for (const row of rows) {
    const key = string(row.key);
    const kind = string(row.kind) as Fact['kind'];
    const title = string(row.title);
    const description = string(row.description);
    if (!key || keyCounts.get(key) !== 1 || !title || !kinds.has(kind)) continue;

    if (kind === 'question') {
      candidates.push({ key, fact: { kind, title, description, quote: '', status: 'needs_review', obligation: 'suggested' } });
      continue;
    }

    const proposedQuote = string(row.quote);
    if (proposedQuote.length < 4 || !/[\p{L}\p{N}]/u.test(proposedQuote)) continue;
    const matched = locate(proposedQuote);
    if (!input.image && !matched) continue;
    let quote = input.image ? proposedQuote : matched!.text;
    if (matched && !input.image) {
      const before = input.text.slice(0, matched.start).split(/(?<=[.!?])\s+|\n+/).at(-1) ?? '';
      const after = /[.!?]$/.test(quote) ? '' : input.text.slice(matched.end).split(/(?<=[.!?])\s+|\n+/)[0] ?? '';
      const sentence = (before + quote + after).trim();
      if (/\b(?:if|unless|provided that|only when|optional|optionally|may)\b/i.test(sentence)) quote = sentence;
    }
    const inQuote = indexNotice(quote);
    let obligation = string(row.obligation) as Fact['obligation'];
    if (!obligations.has(obligation)) continue;
    let condition = string(row.condition);

    // Preserve an explicitly conditional sentence even if the model labels it required.
    const conditionalPassage = quote.match(/\b(?:if|unless|provided that|only when)\b[^.!?]*/i)?.[0];
    if (conditionalPassage && obligation === 'required') {
      obligation = 'conditional';
      condition = condition || conditionalPassage;
    }
    if (obligation === 'conditional' && (!condition || !inQuote(condition))) continue;
    if (/\bmay\s+(?!not\b)|\b(?:optional|optionally|welcome to|can choose to)\b/i.test(quote)) obligation = 'suggested';
    if (obligation !== 'conditional') condition = '';
    const rawDate = string(row.rawDate);
    if (rawDate && !inQuote(rawDate)) continue;
    if (kind === 'deadline' && !rawDate) continue;

    candidates.push({
      key,
      fact: {
        kind, title, description, quote,
        status: input.image ? 'needs_review' : 'verified',
        obligation,
        ...(rawDate ? { rawDate: inQuote(rawDate)!.text } : {}),
        ...(condition ? { condition: inQuote(condition)!.text } : {}),
      },
    });
  }

  const ordered = [
    ...candidates.filter(candidate => candidate.fact.kind !== 'question'),
    ...candidates.filter(candidate => candidate.fact.kind === 'question').slice(0, 4),
  ];
  const nodes: Fact[] = [];
  const signatures = new Map<string, Fact>();
  const keys = new Map<string, string>();
  const ids = new Set<string>();
  for (const candidate of ordered) {
    const identity = signature(candidate.fact);
    const duplicate = signatures.get(identity);
    if (duplicate) { keys.set(candidate.key, duplicate.id); continue; }
    if (nodes.length >= 24) continue;
    const previousMatches = input.previous?.nodes.filter(fact => signature(fact) === identity) ?? [];
    const base = previousMatches.length === 1 ? previousMatches[0].id : 'fact-' + hash(identity);
    let id = base;
    let suffix = 1;
    while (ids.has(id)) id = base + '-' + suffix++;
    const fact = { ...candidate.fact, id };
    nodes.push(fact);
    signatures.set(identity, fact);
    keys.set(candidate.key, id);
    ids.add(id);
  }

  const edges: Relation[] = [];
  const seenEdges = new Set<string>();
  for (const row of value.edges.map(record)) {
    const source = keys.get(string(row.source));
    const target = keys.get(string(row.target));
    const label = string(row.label);
    const proposedQuote = string(row.quote);
    const matched = locate(proposedQuote);
    if (!source || !target || source === target || !label || proposedQuote.length < 4) continue;
    if (!input.image && !matched) continue;
    const quote = input.image ? proposedQuote : matched!.text;
    const sourceFact = nodes.find(fact => fact.id === source)!;
    const targetFact = nodes.find(fact => fact.id === target)!;
    if (sourceFact.kind === 'question' || targetFact.kind === 'question') continue;
    // Both endpoints must have a textual connection to the relationship's passage.
    const connects = (fact: Fact) => Boolean(indexNotice(quote)(fact.quote) || indexNotice(fact.quote)(quote));
    if (!connects(sourceFact) || !connects(targetFact)) continue;
    const identity = JSON.stringify([source, target, comparable(label), comparable(quote)]);
    if (seenEdges.has(identity)) continue;
    seenEdges.add(identity);
    edges.push({ id: 'edge-' + hash(identity), source, target, label, quote });
    if (edges.length >= 48) break;
  }

  return {
    title: string(value.title) || 'Untitled notice',
    version: {
      id: crypto.randomUUID(),
      label: input.previous ? 'Updated notice' : 'Original notice',
      created: Date.now(),
      source: input.source,
      text: input.text,
      ...(input.image ? { image: input.image } : {}),
      nodes,
      edges,
    },
  };
}
