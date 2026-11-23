import { comparable, enclosingPassage, indexNotice, passageQualifiers, unsupportedLiterals } from './evidence.ts';
import type { Source } from './types';

export type NoticeAnswer = { answer: string; quote: string; source: Source; grounding?: 'excerpt' | 'interpretation' | 'not_stated' };

export function readAnswer(raw: string, text: string, source: Source): NoticeAnswer {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new Error('The answer was incomplete. Please try again.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The answer was incomplete. Please try again.');
  const result = value as Record<string, unknown>;
  if (typeof result.answer !== 'string' || typeof result.quote !== 'string' || result.answer.length > 1200 || result.quote.length > 2400) {
    throw new Error('The answer was incomplete. Please try again.');
  }
  const answer = result.answer.trim();
  const quote = result.quote.trim();
  const locate = indexNotice(text);
  const matches = quote.length >= 4 ? locate.all(quote) : [];
  const contexts = new Set(matches.map(match => comparable(enclosingPassage(text, match))));
  if (!answer || !matches.length || contexts.size > 1) {
    return { answer: 'The document does not say.', quote: '', source, grounding: 'not_stated' };
  }
  const sentence = enclosingPassage(text, matches[0]);
  const qualifiers = passageQualifiers(sentence);
  const evidence = qualifiers.condition || qualifiers.optional || qualifiers.negative ? sentence : matches[0].text;
  const answerQualifiers = passageQualifiers(answer);
  const strengthened = /\b(?:must|required|mandatory|have to|need to)\b/i.test(answer) &&
    (qualifiers.optional || Boolean(qualifiers.condition && !answerQualifiers.condition));
  const lostScope = (qualifiers.optional && !answerQualifiers.optional) ||
    Boolean(qualifiers.condition && !indexNotice(answer)(qualifiers.condition));
  const lostException = qualifiers.negative && !answerQualifiers.negative;
  const inventedNegation = answerQualifiers.negative && !qualifiers.negative;
  const claimsExecution = /\b(?:I(?:'ve| have)|we(?:'ve| have))\s+(?:sent|saved|booked|submitted|completed|registered|emailed)\b/i.test(answer);
  // If a generated paraphrase changes a literal detail, permission, condition,
  // or prohibition, show the source passage instead of an unsafe interpretation.
  if (unsupportedLiterals(answer, evidence).length || strengthened || lostScope || lostException || inventedNegation || claimsExecution) {
    return { answer: evidence, quote: evidence, source, grounding: 'excerpt' };
  }
  return { answer, quote: evidence, source, grounding: comparable(answer) === comparable(evidence) ? 'excerpt' : 'interpretation' };
}
