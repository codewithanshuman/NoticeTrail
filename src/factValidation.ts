import type { Fact, Relation, Version } from './domain';
import type { Source } from './types';
import { comparable, enclosingPassage, indexNotice, passageQualifiers, unsupportedLiterals } from './evidence.ts';

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
    if (!key || key.length > 100 || keyCounts.get(key) !== 1 || !title || title.length > 180 || description.length > 600 || !kinds.has(kind)) continue;

    if (kind === 'question') {
      candidates.push({ key, fact: { kind, title, description, quote: '', status: 'needs_review', obligation: 'suggested' } });
      continue;
    }

    const proposedQuote = string(row.quote);
    if (proposedQuote.length < 4 || proposedQuote.length > 2400 || !/[\p{L}\p{N}]/u.test(proposedQuote)) continue;
    const matched = locate(proposedQuote);
    if (!input.image && !matched) continue;
    let quote = input.image ? proposedQuote : matched!.text;
    if (matched && !input.image) {
      const contexts = new Set(locate.all(proposedQuote).map(hit => comparable(enclosingPassage(input.text, hit))));
      // A repeated fragment under different instructions has no unique meaning.
      // The model must quote enough context to disambiguate it.
      if (contexts.size > 1) continue;
      const sentence = enclosingPassage(input.text, matched);
      const qualifiers = passageQualifiers(sentence);
      if (qualifiers.condition || qualifiers.optional || qualifiers.negative) quote = sentence;
    }
    const inQuote = indexNotice(quote);
    let obligation = string(row.obligation) as Fact['obligation'];
    if (!obligations.has(obligation)) continue;
    let condition = string(row.condition);

    // Preserve an explicitly conditional sentence even if the model labels it required.
    const qualifiers = passageQualifiers(quote);
    const conditionalPassage = qualifiers.condition;
    if (conditionalPassage && obligation !== 'conditional') {
      obligation = 'conditional';
      condition = condition || conditionalPassage;
    }
    if (obligation === 'conditional' && (!condition || !inQuote(condition))) continue;
    if (qualifiers.optional && !conditionalPassage) obligation = 'suggested';
    if ((kind === 'event' || kind === 'location') && obligation === 'required' &&
        !/\b(?:must|required|mandatory|compulsory|have to|need to)\b|^(?:please\s+)?(?:attend|meet|report|come)\b/i.test(quote)) obligation = 'suggested';
    if (obligation !== 'conditional') condition = '';
    const rawDate = string(row.rawDate);
    if (rawDate && !inQuote(rawDate)) continue;
    if (kind === 'deadline' && !rawDate) continue;
    if (unsupportedLiterals(title + ' ' + description, quote).length) continue;
    // Source matching verifies the excerpt, not the generated interpretation.
    // Require review when the paraphrase drops a source prohibition or exception.
    const lostQualification = qualifiers.negative && !passageQualifiers(title + ' ' + description).negative;

    candidates.push({
      key,
      fact: {
        kind, title, description, quote,
        status: input.image || lostQualification ? 'needs_review' : 'verified',
        obligation,
        ...(rawDate ? { rawDate: inQuote(rawDate)!.text } : {}),
        ...(condition ? { condition: inQuote(condition)!.text } : {}),
      },
    });
  }

  const ordered = [
    ...candidates.filter(candidate => candidate.fact.kind !== 'question'),
    ...candidates.filter(candidate => candidate.fact.kind === 'question').slice(0, 3),
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
    const proposedLabel = string(row.label);
    const proposedQuote = string(row.quote);
    const matched = locate(proposedQuote);
    if (!source || !target || source === target || !proposedLabel || proposedLabel.length > 120 || proposedQuote.length < 4 || proposedQuote.length > 2400) continue;
    if (!input.image && !matched) continue;
    const quote = input.image ? proposedQuote : matched!.text;
    const sourceFact = nodes.find(fact => fact.id === source)!;
    const targetFact = nodes.find(fact => fact.id === target)!;
    if (sourceFact.kind === 'question' || targetFact.kind === 'question') continue;
    // Both endpoints must have a textual connection to the relationship's passage.
    const connects = (fact: Fact) => Boolean(indexNotice(quote)(fact.quote));
    if (!connects(sourceFact) || !connects(targetFact)) continue;
    // Sharing evidence does not prove a dependency. Keep specific labels only
    // for narrow, checkable relationships; otherwise show the actual guarantee.
    let label = 'Shared source passage';
    if (/^due (?:on|by)$/i.test(proposedLabel) && targetFact.kind === 'deadline' && targetFact.rawDate &&
        indexNotice(sourceFact.quote)(targetFact.rawDate) && /\b(?:by|before|due|deadline)\b/i.test(quote)) label = 'Due on';
    else if (/^occurs at$/i.test(proposedLabel) && sourceFact.kind === 'event' && targetFact.kind === 'location' &&
        indexNotice(sourceFact.quote)(targetFact.title)) label = 'Occurs at';
    else if (targetFact.condition && comparable(proposedLabel) === comparable(targetFact.condition)) label = targetFact.condition;
    const identity = JSON.stringify([source, target, comparable(label), comparable(quote)]);
    if (seenEdges.has(identity)) continue;
    seenEdges.add(identity);
    edges.push({ id: 'edge-' + hash(identity), source, target, label, quote });
    if (edges.length >= 48) break;
  }

  return {
    title: string(value.title).slice(0, 160) || 'Untitled notice',
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
