import assert from 'node:assert/strict';
import test from 'node:test';
import { readAnswer } from '../src/answerValidation.ts';

const read = (answer, quote, text = quote) => readAnswer(JSON.stringify({answer, quote}), text, 'ON_DEVICE');

test('contextual answers retain original source wording and distinguish interpretation', () => {
  const answer = read('Return the books by June 17.', 'RETURN BOOKS BY JUNE 17.', 'Return books by June 17.');
  assert.equal(answer.quote, 'Return books by June 17.');
  assert.equal(answer.grounding, 'interpretation');
});

test('an invented date, contact, amount or year falls back to the actual passage', () => {
  const text = 'Return books by June 17.';
  for (const answer of ['Return books by June 19.', 'Return books by June 17, 2027.', 'Pay $50.', 'Email admin@invented.example.']) {
    const result = read(answer, text);
    assert.equal(result.answer, text);
    assert.equal(result.grounding, 'excerpt');
  }
});

test('a shortened quote cannot erase optionality or conditions', () => {
  const optional = read('You must bring a notebook.', 'bring a notebook', 'You may bring a notebook.');
  assert.equal(optional.answer, 'You may bring a notebook.');
  const condition = read('You need to email the library.', 'email the library', 'If you need more time, email the library.');
  assert.equal(condition.answer, 'If you need more time, email the library.');
});

test('negated instructions and exceptions survive source summarization', () => {
  const negative = read('Bring identification.', 'bring identification', 'You do not need to bring identification.');
  assert.equal(negative.answer, 'You do not need to bring identification.');
  const fabricated = read('Do not bring identification.', 'Bring identification.');
  assert.equal(fabricated.answer, 'Bring identification.');
});

test('missing and ambiguous citations abstain', () => {
  assert.equal(read('It is free.', 'No fee applies.', 'Bring identification.').grounding, 'not_stated');
  assert.equal(read('Bring identification.', 'bring identification', 'Guests may bring identification. Staff must bring identification.').grounding, 'not_stated');
});

test('answers cannot claim to have performed a real-world action', () => {
  const result = read('I have emailed the library.', 'Email the library.');
  assert.equal(result.answer, 'Email the library.');
});

test('malformed or oversized responses produce an actionable error', () => {
  for (const raw of ['{','[]','{}',JSON.stringify({answer:'a'.repeat(1201),quote:'Return books.'})]) {
    assert.throws(() => readAnswer(raw, 'Return books.', 'UNKNOWN'), /try again/i);
  }
});

test('bare imperatives cannot discard optional or audience-limited wording', () => {
  assert.equal(read('Bring a notebook.', 'You may bring a notebook.').grounding, 'excerpt');
  assert.equal(read('Email the library.', 'If you need more time, email the library.').grounding, 'excerpt');
});
