import test from 'node:test';
import assert from 'node:assert/strict';
import { indexNotice } from '../src/evidence.ts';
import { readBrief, readComparison } from '../src/readResponse.ts';

const brief = fields => JSON.stringify({ title: 'Library', summary: 'Return books.', actions: [], dates: [], questions: [], ...fields });
const comparison = changes => JSON.stringify({ headline: 'Library update', summary: 'Review the deadline.', changes });
const original = 'Return all books by June 17.';
const updated = 'Return all books by June 19. Bring your card.';
const change = { kind: 'changed', before: 'June 17', after: 'June 19', impact: 'The deadline moved.', beforeEvidence: 'by June 17', afterEvidence: 'by June 19' };

test('evidence retains original punctuation, line breaks and offsets after non-BMP characters', () => {
  const text = '📚 Read the LIBRARY’S\n  “notice” today.';
  const hit = indexNotice(text)('“library\'s "notice"”');
  assert.equal(hit.text, 'LIBRARY’S\n  “notice”');
  assert.equal(text.slice(hit.start, hit.end), hit.text);
});

test('a date or word fragment cannot match inside a larger token', () => {
  const find = indexNotice('June 17. Use a cardholder or a card.');
  assert.equal(find('June 1'), null);
  assert.equal(find('holder'), null);
  assert.equal(find('card').start, 'June 17. Use a cardholder or a card.'.lastIndexOf('card'));
});

test('filter unsupported items before capping the brief and suppress a misleading overview', () => {
  const unsupported = { task: 'Pay a fee.', evidence: 'fee required' };
  const valid = { task: 'Return books.', evidence: 'RETURN   ALL BOOKS' };
  const result = readBrief(brief({summary:'Pay a fee.', actions:[...Array(9).fill(unsupported),valid,valid]}), original, false);
  assert.deepEqual(result.actions, [{ task: valid.task, evidence: 'Return all books' }]);
  assert.doesNotMatch(result.summary, /fee/);
});

test('a real excerpt cannot support a different date in the date field', () => {
  const dates = [{date:'June 1', meaning:'Return deadline', evidence:'by June 17'}, {date:'June 17', meaning:'Return deadline', evidence:'by June 17'}];
  assert.deepEqual(readBrief(brief({dates}), original, false).dates, [dates[1]]);
});

test('an image can have model-transcribed evidence but empty citations are removed', () => {
  const actions = [{task:'Return books', evidence:''}, {task:'Bring a card', evidence:'Bring your card'}];
  assert.deepEqual(readBrief(brief({actions}), '', true).actions, [actions[1]]);
});

test('broken JSON and missing required collections report a retryable error', () => {
  for (const raw of ['{', '[]', '{}', '{"changes":null}']) {
    assert.throws(() => readComparison(raw,original,updated), /try again/i);
    assert.throws(() => readBrief(raw,original,false), /try again/i);
  }
});

test('a revision keeps valid changes and rejects unknown types, mismatched sides and unchanged quotes', () => {
  const result = readComparison(comparison([change, change, {...change,kind:'other'}, {...change,afterEvidence:'by June 17'}, {...change,beforeEvidence:'Return all books',afterEvidence:'Return all books'}]),original,updated);
  assert.deepEqual(result.changes,[change]);
});

test('a claimed addition or removal needs a distinguishing excerpt', () => {
  const added = {kind:'added',before:'',after:'Bring a card',impact:'Pack a card.',beforeEvidence:'',afterEvidence:'Bring your card'};
  const removed = {kind:'removed',before:added.after,after:'',impact:'Card requirement removed.',beforeEvidence:added.afterEvidence,afterEvidence:''};
  assert.deepEqual(readComparison(comparison([added,{...added,afterEvidence:'Return all books'}]),original,updated).changes,[added]);
  assert.deepEqual(readComparison(comparison([removed,{...removed,beforeEvidence:'Return all books'}]),updated,original).changes,[removed]);
});

test('identical notices cannot acquire a change by citing different passages', () => {
  assert.deepEqual(readComparison(comparison([{...change,beforeEvidence:'Return all books',afterEvidence:'by June 17'}]),original,original).changes,[]);
});

test('comparison paraphrases cannot introduce a date absent from their own evidence', () => {
  const result = readComparison(comparison([{...change,after:'June 20'}]),original,updated);
  assert.deepEqual(result.changes,[]);
});

test('comparison summaries cannot introduce a fabricated year', () => {
  const raw = JSON.stringify({headline:'A deadline in 2028',summary:'Return books.',changes:[change]});
  assert.doesNotMatch(readComparison(raw,original,updated).headline,/2028/);
});
