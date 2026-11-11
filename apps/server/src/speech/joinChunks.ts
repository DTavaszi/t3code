// Self-contained because the native worker embeds this function.
export function joinSpeechChunks(chunks: readonly string[], language: string) {
  const locale = language === "auto" ? undefined : language;
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  const words = (text: string) => [...segmenter.segment(text)].filter((part) => part.isWordLike);
  const key = (text: string) => text.normalize("NFC").toLowerCase();
  const spaceless = /^(ja|zh|yue|th|lo|km|my)(-|$)/.test(language);
  let joined = "";
  for (const chunk of chunks) {
    const next = chunk.trim();
    if (!next) continue;
    const left = words(joined).slice(-32);
    const right = words(next);
    let overlap = 0;
    for (let count = Math.min(left.length, right.length); count > 0; count--) {
      if (left.slice(-count).every((word, i) => key(word.segment) === key(right[i]!.segment))) {
        overlap = right[count - 1]!.index + right[count - 1]!.segment.length;
        break;
      }
    }
    const rest = next.slice(overlap).trimStart();
    if (overlap && /^[^\p{L}\p{M}\p{N}\s]/u.test(rest))
      joined = joined.replace(/[^\p{L}\p{M}\p{N}\s]+$/u, "");
    if (!rest) continue;
    const space =
      joined &&
      !spaceless &&
      (language === "auto"
        ? /^[\p{Script=Latin}\p{N}]/u.test(rest)
        : /^[\p{L}\p{M}\p{N}]/u.test(rest))
        ? " "
        : "";
    joined += space + rest;
  }
  return joined;
}
