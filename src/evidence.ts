const typography: Record<string, string> = { '“': '"', '”': '"', '‘': "'", '’': "'" };

export function comparable(value: string) {
  return value.trim().replace(/\s+/gu, ' ').replace(/[“”‘’]/gu, char => typography[char]).toLowerCase();
}

export type EvidenceMatch = { start: number; end: number; text: string };

// Keep UTF-16 offsets into the original string for rendering and export.
export function indexNotice(original: string) {
  let normalized = '';
  const offsets: number[] = [];
  for (const match of original.matchAll(/\s+|[^\s]/gu)) {
    const char = match[0];
    const token = /^\s/u.test(char) ? ' ' : (typography[char] ?? char).toLowerCase();
    normalized += token;
    for (let i = 0; i < token.length; i++) offsets.push(match.index);
  }
  offsets.push(original.length);

  function locateAll(quote: string): EvidenceMatch[] {
    const needle = comparable(quote);
    if (!needle) return [];
    // Avoid interpreting "April 1" as evidence for a notice that says "April 17".
    const word = /[\p{L}\p{M}\p{N}_]/u;
    const wordStart = /^[\p{L}\p{M}\p{N}_]/u.test(needle);
    const wordEnd = /[\p{L}\p{M}\p{N}_]$/u.test(needle);
    const matches: EvidenceMatch[] = [];
    let from = 0;
    while (from < normalized.length) {
      const pos = normalized.indexOf(needle, from);
      if (pos < 0) break;
      const end = pos + needle.length;
      const left = normalized.slice(0, pos).match(/.$/u)?.[0] ?? '';
      const right = normalized.slice(end).match(/^./u)?.[0] ?? '';
      const insideWord = (word.test(left) && wordStart) || (word.test(right) && wordEnd);
      if (!insideWord) matches.push({ start: offsets[pos], end: offsets[end], text: original.slice(offsets[pos], offsets[end]) });
      from = pos + Math.max(1, needle.length);
    }
    return matches;
  }

  const all = (evidence: string) => {
    const literal = locateAll(evidence);
    if (literal.length) return literal;
    const wrapped = evidence.trim().match(/^(?:“([\s\S]+)”|"([\s\S]+)"|'([\s\S]+)'|‘([\s\S]+)’)$/u);
    return wrapped ? locateAll(wrapped.slice(1).find(Boolean) ?? '') : [];
  };
  const locate = (evidence: string) => all(evidence)[0] ?? null;
  return Object.assign(locate, { all });
}

export function enclosingPassage(original: string, match: EvidenceMatch): string {
  const before = original.slice(0, match.start).split(/(?<=[.!?])\s+|\n+/).at(-1) ?? '';
  const after = /[.!?]$/.test(match.text) ? '' : original.slice(match.end).split(/(?<=[.!?])\s+|\n+/)[0] ?? '';
  return (before + match.text + after).trim();
}

export function passageQualifiers(quote: string) {
  // A calendar month (May 17) is not permission, and "may not" is not optional.
  const optional = /\bmay\s+(?!(?:not\b|\d))\p{L}|\b(?:optional|optionally|welcome to|can choose to|not required|not necessary|need not|no need to|do not have to|don't have to|recommended|encouraged)\b/iu.test(quote);
  const condition = quote.match(/\b(?:only if|if|unless|provided that|only when|except when|except for)\b[^,.!?;]*/i)?.[0] ?? '';
  const negative = /\b(?:not|never|no longer|without|except|unless|prohibited|forbidden|don't|cannot|can't|mustn't)\b/i.test(quote);
  return { optional, condition, negative };
}

// Deterministic checks protect high-consequence literal details. They deliberately
// do not pretend that matching numbers or words proves a paraphrase is true.
export function unsupportedLiterals(claim: string, evidence: string): string[] {
  const candidates = claim.match(/(?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:[$€£₹]\s*)?\d+(?:[.,:/-]\d+)*(?:\s*(?:%|am|pm))?/gi) ?? [];
  const locate = indexNotice(evidence);
  return candidates.map(value => value.replace(/[.,;:!?)]*$/, '')).filter(value => value && !locate(value));
}
