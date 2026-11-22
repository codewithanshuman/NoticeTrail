const typography: Record<string, string> = { '“': '"', '”': '"', '‘': "'", '’': "'" };

export function comparable(value: string) {
  return value.trim().replace(/\s+/gu, ' ').replace(/[“”‘’]/gu, char => typography[char]).toLowerCase();
}

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

  function locate(quote: string) {
    const needle = comparable(quote);
    if (!needle) return null;
    // Avoid interpreting "April 1" as evidence for a notice that says "April 17".
    const word = /[\p{L}\p{M}\p{N}_]/u;
    const wordStart = /^[\p{L}\p{M}\p{N}_]/u.test(needle);
    const wordEnd = /[\p{L}\p{M}\p{N}_]$/u.test(needle);
    let from = 0;
    while (from < normalized.length) {
      const pos = normalized.indexOf(needle, from);
      if (pos < 0) return null;
      const end = pos + needle.length;
      const left = normalized.slice(0, pos).match(/.$/u)?.[0] ?? '';
      const right = normalized.slice(end).match(/^./u)?.[0] ?? '';
      const insideWord = (word.test(left) && wordStart) ||
        (word.test(right) && wordEnd);
      if (!insideWord) return { start: offsets[pos], end: offsets[end], text: original.slice(offsets[pos], offsets[end]) };
      from = pos + 1;
    }
    return null;
  }

  return (evidence: string) => {
    const literal = locate(evidence);
    if (literal) return literal;
    const wrapped = evidence.trim().match(/^(?:“([\s\S]+)”|"([\s\S]+)"|'([\s\S]+)'|‘([\s\S]+)’)$/u);
    return wrapped ? locate(wrapped.slice(1).find(Boolean) ?? '') : null;
  };
}
