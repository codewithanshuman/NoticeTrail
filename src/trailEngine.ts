import type { Brief, Source } from './types';
import type { Fact, Impact, Relation, Version, Workspace } from './domain';
import { comparable, indexNotice } from './evidence.ts';

function identifier(value: string) {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return (hash >>> 0).toString(36);
}

function sameFact(left: Fact, right: Fact) {
  return left.kind === right.kind && comparable(left.title) === comparable(right.title) &&
    comparable(left.quote) === comparable(right.quote) && left.rawDate === right.rawDate &&
    left.obligation === right.obligation && left.condition === right.condition;
}

export function graphFromBrief(brief: Brief, text: string, source: Source, previous?: Version, hasImage = false): Version {
  const locate = indexNotice(text);
  const nodes: Fact[] = [];
  const edges: Relation[] = [];
  const usedIds = new Set<string>();

  function add(kind: Fact['kind'], title: string, evidence: string, description = '', rawDate?: string) {
    const match = locate(evidence);
    if (!title.trim()) return;
    if (kind !== 'question' && (!evidence.trim() || (!hasImage && !match))) return;
    let quote = match?.text ?? evidence.trim();
    // Short excerpts can drop the condition that limits an instruction. Keep its
    // enclosing sentence when it supplies an explicit condition.
    const before = match ? text.slice(0, match.start).split(/(?<=[.!?])\s+|\n+/).at(-1) ?? '' : '';
    const after = match && !/[.!?]$/.test(quote) ? text.slice(match.end).split(/(?<=[.!?])\s+|\n+/)[0] ?? '' : '';
    const sentence = hasImage ? quote : before + quote + after;
    const conditional = sentence.match(/\b(?:if|unless|only if)\b[^,.!?]*/i)?.[0];
    const optional = /\bmay\s+(?!not\b)|\b(?:optional|optionally|welcome to|can choose to)\b/i.test(sentence);
    if ((conditional || optional) && match && !hasImage) quote = sentence.trim();
    if (rawDate && !indexNotice(quote)(rawDate)) return;
    const fact: Fact = {
      id: '', kind, title, description, quote,
      status: match && !hasImage ? 'verified' : 'needs_review',
      obligation: kind === 'question' || optional ? 'suggested' : conditional ? 'conditional' : 'required',
      ...(rawDate ? { rawDate } : {}),
      ...(conditional ? { condition: conditional } : {}),
    };
    // An exact phrase and title identify an unchanged fact. Rephrased obligations
    // remain unmatched until a person reviews them; text similarity is insufficient.
    const unchanged = previous?.nodes.find(node => sameFact(node, fact));
    const baseId = unchanged?.id ?? `${kind}-${identifier(JSON.stringify([kind, comparable(title), comparable(quote)]))}`;
    if (nodes.some(node => sameFact(node, fact))) return;
    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) id = `${baseId}-${suffix++}`;
    usedIds.add(id);
    nodes.push({ ...fact, id });
  }

  for (const action of brief.actions) add('action', action.task, action.evidence);
  for (const date of brief.dates) add('deadline', date.date, date.evidence, date.meaning, date.date);
  for (const question of brief.questions) add('question', question, '', 'The notice leaves this question open.');

  for (const deadline of nodes.filter(node => node.kind === 'deadline' && node.status === 'verified')) {
    for (const action of nodes.filter(node => node.kind === 'action' && node.status === 'verified')) {
      const related = indexNotice(action.quote)(deadline.quote) || indexNotice(deadline.quote)(action.quote);
      if (!related) continue;
      edges.push({ id: `${action.id}-${deadline.id}`, source: action.id, target: deadline.id,
        label: 'Shared source passage', quote: action.quote.length > deadline.quote.length ? action.quote : deadline.quote });
    }
  }

  return { id: crypto.randomUUID(), label: previous ? 'Updated notice' : 'Original notice', created: Date.now(), source, text, nodes, edges };
}

export function impacts(workspace: Workspace): Impact[] {
  const latest = workspace.versions.at(-1);
  if (!latest) return [];
  return workspace.tasks.flatMap(task => {
    if (task.versionId === latest.id) return [];
    const previous = workspace.versions.find(version => version.id === task.versionId)?.nodes.find(node => node.id === task.nodeId);
    const next = latest.nodes.find(node => node.id === task.nodeId);
    if (previous && next && sameFact(previous, next)) return [];
    return [{ task, previous, next, kind: next ? 'changed' as const : 'unmatched' as const, versionId: latest.id }];
  });
}

export function saveNode(workspace: Workspace, nodeId: string, versionId: string): Workspace {
  const version = workspace.versions.find(item => item.id === versionId);
  const node = version?.nodes.find(item => item.id === nodeId);
  if (!node || node.kind === 'question' || node.kind === 'location') return workspace;
  if (workspace.tasks.some(task => task.nodeId === nodeId)) return workspace;
  return { ...workspace, tasks: [...workspace.tasks, { id: crypto.randomUUID(), nodeId, versionId,
    title: node.title, quote: node.quote, done: false, due: '' }] };
}

export function acceptImpact(workspace: Workspace, taskId: string): Workspace {
  const impact = impacts(workspace).find(item => item.task.id === taskId);
  if (!impact?.next) return workspace;
  const next = impact.next;
  return {
    ...workspace,
    tasks: workspace.tasks.map(task => task.id === taskId ? { ...task, versionId: impact.versionId,
      title: next.title, quote: next.quote, due: '', reviewVersionId: undefined } : task),
    reviews: [...workspace.reviews, { id: crypto.randomUUID(), taskId, versionId: impact.versionId,
      decision: 'accepted', created: Date.now() }],
  };
}

export function createDemoWorkspace(): Workspace {
  const original = 'Community Garden Volunteer Orientation\n\nPlease complete the volunteer agreement by Friday, April 17. Orientation is Saturday, April 18 at 9:30 AM in the East Library meeting room. Bring a photo ID and closed-toe shoes. If you cannot attend, email garden@neighborhood.example by April 15 to request another session.';
  const updated = 'Community Garden Volunteer Orientation — Updated\n\nPlease complete the volunteer agreement by Thursday, April 16. Orientation is Sunday, April 19 at 10:00 AM in the West Library meeting room. Bring a photo ID, closed-toe shoes, and a reusable water bottle. If you cannot attend, email garden@neighborhood.example by April 17 to request another session.';
  const created = Date.now();

  function version(isUpdated: boolean): Version {
    const text = isUpdated ? updated : original;
    const agreement = isUpdated ? 'Thursday, April 16' : 'Friday, April 17';
    const time = isUpdated ? 'Sunday, April 19 at 10:00 AM' : 'Saturday, April 18 at 9:30 AM';
    const location = isUpdated ? 'West Library meeting room' : 'East Library meeting room';
    const bring = isUpdated ? 'Bring a photo ID, closed-toe shoes, and a reusable water bottle.' : 'Bring a photo ID and closed-toe shoes.';
    const alternate = isUpdated ? 'April 17' : 'April 15';
    const nodes: Fact[] = [
      { id: 'garden-agreement', kind: 'action', title: `Complete the agreement by ${agreement}`, description: 'Complete your volunteer agreement.', quote: `Please complete the volunteer agreement by ${agreement}.`, status: 'verified', obligation: 'required', rawDate: agreement },
      { id: 'garden-deadline', kind: 'deadline', title: agreement, description: 'Volunteer agreement deadline. Confirm the year before exporting a calendar event.', quote: `Please complete the volunteer agreement by ${agreement}.`, status: 'verified', obligation: 'required', rawDate: agreement },
      { id: 'garden-orientation', kind: 'event', title: 'Volunteer orientation', description: `${time} · ${location}`, quote: `Orientation is ${time} in the ${location}.`, status: 'verified', obligation: 'required', rawDate: time },
      { id: 'garden-location', kind: 'location', title: location, description: 'Orientation meeting place.', quote: `Orientation is ${time} in the ${location}.`, status: 'verified', obligation: 'required' },
      { id: 'garden-bring', kind: 'requirement', title: isUpdated ? 'Photo ID, shoes, and a water bottle' : 'Photo ID and closed-toe shoes', description: 'Prepare what the notice asks you to bring.', quote: bring, status: 'verified', obligation: 'required' },
      { id: 'garden-alternative', kind: 'action', title: `Request another session by ${alternate}`, description: 'Email garden@neighborhood.example if you cannot attend.', quote: `If you cannot attend, email garden@neighborhood.example by ${alternate} to request another session.`, status: 'verified', obligation: 'conditional', condition: 'If you cannot attend', rawDate: alternate },
    ];
    const edges: Relation[] = [
      { id: 'garden-due', source: 'garden-agreement', target: 'garden-deadline', label: 'Due on', quote: nodes[0].quote },
      { id: 'garden-place', source: 'garden-orientation', target: 'garden-location', label: 'Occurs at', quote: nodes[2].quote },
      { id: 'garden-alternate', source: 'garden-orientation', target: 'garden-alternative', label: 'If you cannot attend', quote: nodes[5].quote },
    ];
    return { id: isUpdated ? 'garden-updated' : 'garden-original', label: isUpdated ? 'Updated notice' : 'Original notice', created: created + (isUpdated ? 1 : 0), source: 'SAMPLE', text, nodes, edges };
  }

  return { id: crypto.randomUUID(), title: 'Community garden', versions: [version(false), version(true)], tasks: [], reviews: [] };
}
