// Self-contained because the native worker embeds this function.
export function joinSpeechChunks(
  chunks: readonly {
    text: string;
    durationMs: number;
    overlapMs?: number;
    words?: readonly { text: string; t0Ms: number; t1Ms: number }[];
  }[],
  language: string,
) {
  const segmenter = new Intl.Segmenter(language === "auto" ? undefined : language, {
    granularity: "word",
  });
  const words = (text: string) => [...segmenter.segment(text)].filter((part) => part.isWordLike);
  const key = (text: string) => text.normalize("NFC").toLowerCase();
  const timedWords = (chunk: (typeof chunks)[number]) => {
    const lexical = words(chunk.text);
    if (!chunk.words?.length || lexical.length !== chunk.words.length) return [];
    let end = 0;
    return chunk.words.every((word, i) => {
      const valid =
        words(word.text).length === 1 &&
        key(words(word.text)[0]!.segment) === key(lexical[i]!.segment) &&
        Number.isFinite(word.t0Ms) &&
        Number.isFinite(word.t1Ms) &&
        word.t0Ms >= end &&
        word.t1Ms > word.t0Ms &&
        word.t1Ms <= chunk.durationMs;
      end = word.t1Ms;
      return valid;
    })
      ? chunk.words.map((word, i) => ({ ...word, text: lexical[i]!.segment }))
      : [];
  };
  const spaceless = /^(ja|zh|yue|th|lo|km|my)(-|$)/.test(language);
  const spacelessScript =
    /[\p{Script=Han}\p{Script_Extensions=Hiragana}\p{Script_Extensions=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;
  let joined = "";
  let previous: (typeof chunks)[number] | undefined;
  for (const chunk of chunks) {
    const next = chunk.text.trim();
    const right = words(next);
    let overlap = 0;
    const sharedMs = chunk.overlapMs ?? 0;
    if (previous && sharedMs > 0 && sharedMs <= Math.min(previous.durationMs, chunk.durationMs)) {
      const leftTimed = timedWords(previous);
      const rightTimed = timedWords(chunk);
      const left = leftTimed.filter((word) => word.t0Ms >= previous!.durationMs - sharedMs);
      const prefix = rightTimed.filter((word) => word.t1Ms <= sharedMs);
      // Separate recognitions can shift word timestamps slightly within the shared audio.
      for (let count = Math.min(left.length, prefix.length); count > 0; count--) {
        if (
          left.slice(-count).every((word, i) => {
            const other = prefix[i]!;
            return (
              key(word.text.trim()) === key(other.text.trim()) &&
              Math.abs(word.t0Ms - previous!.durationMs + sharedMs - other.t0Ms) <= 250 &&
              Math.abs(word.t1Ms - previous!.durationMs + sharedMs - other.t1Ms) <= 250
            );
          })
        ) {
          overlap = right[count - 1]!.index + right[count - 1]!.segment.length;
          break;
        }
      }
    }
    previous = chunk;
    const rest = next.slice(overlap).trimStart();
    if (overlap && /^[^\p{L}\p{M}\p{N}\s]/u.test(rest))
      joined = joined.replace(/[^\p{L}\p{M}\p{N}\s]+$/u, "");
    if (!rest) continue;
    const leftEdge = words(joined).at(-1)?.segment ?? "";
    const rightEdge = words(rest)[0]?.segment ?? "";
    const needsSpace =
      !spaceless &&
      (language !== "auto" ||
        (!spacelessScript.test(leftEdge) && !spacelessScript.test(rightEdge)));
    joined += (joined && needsSpace && /^[\p{L}\p{M}\p{N}]/u.test(rest) ? " " : "") + rest;
  }
  return joined;
}
