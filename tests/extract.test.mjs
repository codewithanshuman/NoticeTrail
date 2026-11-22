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
  const result = parse([action, { ...deadline, quote: 'Return books by June 19.', rawDate: 'June 19' }], [], { image: 'data:image/png;base64,example' });
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
