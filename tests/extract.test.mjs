import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkspaceResponse } from '../src/factValidation.ts';

const text = 'Please return library books by June 17. The desk is in the West Library. If you need more time, email the library by June 15.';
const action = { key: 'return', kind: 'action', title: 'Return library books', description: 'Return the borrowed books.', quote: 'Please return library books by June 17.', obligation: 'required', rawDate: 'June 17', condition: '' };
const deadline = { key: 'due', kind: 'deadline', title: 'June 17', description: 'Book return deadline.', quote: 'Please return library books by June 17.', obligation: 'required', rawDate: 'June 17', condition: '' };
const encode = (nodes, edges = []) => JSON.stringify({ title: 'Library notice', nodes, edges });
const parse = (nodes, edges = [], options = {}) => parseWorkspaceResponse(encode(nodes, edges), { text, source: 'ON_DEVICE', ...options });

test('workspace parser preserves source wording and creates a supported relationship', () => {
  const result = parse([{ ...action, quote: 'PLEASE RETURN LIBRARY BOOKS BY JUNE 17.' }, deadline], [{ source: 'return', target: 'due', label: 'Due on', quote: text.split('. ')[0] + '.' }]);
  assert.equal(result.version.nodes[0].quote, action.quote);
  assert.equal(result.version.nodes[0].status, 'verified');
  assert.equal(result.version.edges.length, 1);
  assert.equal(result.version.edges[0].source, result.version.nodes[0].id);
  assert.equal(result.version.edges[0].target, result.version.nodes[1].id);
});

test('unsupported facts and invalid edge references are excluded', () => {
  const result = parse([action, { ...deadline, quote: 'Pay twenty dollars.' }], [{ source: 'return', target: 'due', label: 'Due on', quote: action.quote }]);
  assert.equal(result.version.nodes.length, 1);
  assert.deepEqual(result.version.edges, []);
});

test('a date must occur in its own excerpt and respect numeric boundaries', () => {
  assert.equal(parse([{ ...action, rawDate: 'June 1' }]).version.nodes.length, 0);
  assert.equal(parse([{ ...action, rawDate: 'June 15' }]).version.nodes.length, 0);
  assert.equal(parse([{ ...deadline, rawDate: '' }]).version.nodes.length, 0);
});

test('explicit conditional wording cannot become an unconditional obligation', () => {
  const conditional = { ...action, quote: 'If you need more time, email the library by June 15.', rawDate: 'June 15' };
  const node = parse([conditional]).version.nodes[0];
  assert.equal(node.obligation, 'conditional');
  assert.match(node.condition, /^If you need more time/);
  assert.equal(parse([{ ...conditional, obligation: 'conditional', condition: 'If you are a student' }]).version.nodes.length, 0);
});

test('image transcriptions retain review status even when matching user context', () => {
  const result = parse([action, { ...deadline, title: 'June 19', quote: 'Return books by June 19.', rawDate: 'June 19' }], [], { image: 'data:image/png;base64,example' });
  assert.equal(result.version.nodes.length, 2);
  assert.ok(result.version.nodes.every(node => node.status === 'needs_review'));
  assert.equal(result.version.image, 'data:image/png;base64,example');
});

test('duplicate model keys are excluded so relationships cannot target an arbitrary fact', () => {
  const result = parse([action, { ...deadline, key: 'return' }], [{ source: 'return', target: 'return', label: 'Due on', quote: action.quote }]);
  assert.deepEqual(result.version.nodes, []);
  assert.deepEqual(result.version.edges, []);
});

test('unchanged facts reuse identities and unrelated versions cannot inherit an action ID', () => {
  const first = parse([action]).version;
  first.nodes[0].id = 'existing-library-action';
  const second = parse([{ ...action, description: 'A shorter explanation.' }], [], { previous: first }).version;
  assert.equal(second.nodes[0].id, 'existing-library-action');
  const unrelated = parse([{ ...action, title: 'Attend rehearsal', quote: 'Attend rehearsal tomorrow.', rawDate: 'tomorrow' }], [], { text: 'Attend rehearsal tomorrow.', previous: first }).version;
  assert.notEqual(unrelated.nodes[0].id, 'existing-library-action');
});

test('questions stay suggested with no fabricated evidence or deadline', () => {
  const node = parse([{ ...action, kind: 'question', title: 'Can I return books online?' }]).version.nodes[0];
  assert.equal(node.obligation, 'suggested');
  assert.equal(node.status, 'needs_review');
  assert.equal(node.quote, '');
  assert.equal(node.rawDate, undefined);
});

test('a notice with no actionable facts returns an empty graph', () => {
  const result = parse([], [], { text: 'The library appreciates everyone who reads.' });
  assert.deepEqual(result.version.nodes, []);
  assert.deepEqual(result.version.edges, []);
});

test('relationship evidence must connect both endpoints', () => {
  const location = { ...action, key: 'place', kind: 'location', title: 'West Library', quote: 'The desk is in the West Library.', rawDate: '', obligation: 'suggested' };
  const result = parse([action, location], [{ source: 'return', target: 'place', label: 'Requires', quote: action.quote }]);
  assert.deepEqual(result.version.edges, []);
});

test('invalid response structure produces an actionable retry error', () => {
  for (const raw of ['{', '[]', '{"title":"Missing arrays"}']) {
    assert.throws(() => parseWorkspaceResponse(raw, { text, source: 'UNKNOWN' }), /try again/i);
  }
});

test('a short quote retains an explicit condition or optional wording from its sentence', () => {
  const conditional = parse([{...action, quote:'email the library by June 15', rawDate:'', condition:''}]);
  assert.equal(conditional.version.nodes[0].obligation, 'conditional');
  assert.match(conditional.version.nodes[0].quote, /^If you need more time/);
  const optional = parse([{...action, quote:'bring a notebook', rawDate:''}], [], {text:'You may bring a notebook.'});
  assert.equal(optional.version.nodes[0].obligation, 'suggested');
});

test('May dates stay mandatory and optional conditions are not inferred from month names', () => {
  const quote = 'Return books by May 17.';
  const node = parse([{...action, quote, rawDate:'May 17'}], [], {text:quote}).version.nodes[0];
  assert.equal(node.obligation, 'required');
});

test('a short quote cannot erase a prohibition or turn an exemption into a requirement', () => {
  const quote = 'You are not required to bring a notebook.';
  const node = parse([{...action, title:'Bring a notebook', description:'Bring a notebook.', quote:'bring a notebook', rawDate:''}], [], {text:quote}).version.nodes[0];
  assert.equal(node.quote, quote);
  assert.equal(node.obligation, 'suggested');
  assert.equal(node.status, 'needs_review');
});

test('ambiguous repeated fragments require a longer distinguishing excerpt', () => {
  const original = 'Guests may bring a notebook. Volunteers must bring a notebook.';
  const short = {...action, quote:'bring a notebook', rawDate:''};
  assert.equal(parse([short], [], {text:original}).version.nodes.length, 0);
  const clear = parse([{...short, quote:'Volunteers must bring a notebook.'}], [], {text:original});
  assert.equal(clear.version.nodes.length, 1);
});

test('real quotes do not authorize fabricated dates, amounts or contact information', () => {
  for (const title of ['Return books by June 19', 'Pay $50', 'Email admin@invented.example']) {
    assert.equal(parse([{...action, title}]).version.nodes.length, 0);
  }
});

test('a shared passage cannot manufacture a prerequisite relationship', () => {
  const result = parse([action, deadline], [{source:'return',target:'due',label:'Requires',quote:action.quote}]);
  assert.equal(result.version.edges[0].label, 'Shared source passage');
});

test('a generic subphrase shared by two larger excerpts cannot link their endpoints', () => {
  const source = 'Applicants should check the library notice. Volunteers should check the garden notice.';
  const first = {...action, key:'a', quote:'Applicants should check the library notice.', rawDate:''};
  const second = {...action, key:'b', title:'Check garden notice', quote:'Volunteers should check the garden notice.', rawDate:''};
  const result = parse([first,second], [{source:'a',target:'b',label:'Requires',quote:'should check'}], {text:source});
  assert.deepEqual(result.version.edges, []);
});

test('announcing an event or location does not itself require attendance', () => {
  const quote = 'Orientation is at the West Library on June 17.';
  const node = parse([{...action, kind:'event', title:'Orientation', quote, rawDate:'June 17'}], [], {text:quote}).version.nodes[0];
  assert.equal(node.obligation, 'suggested');
  const mandatory = 'You must attend orientation at the West Library on June 17.';
  assert.equal(parse([{...action,kind:'event',title:'Orientation',quote:mandatory,rawDate:'June 17'}], [], {text:mandatory}).version.nodes[0].obligation, 'required');
});
