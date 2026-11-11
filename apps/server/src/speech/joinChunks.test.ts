import { expect, it } from "vite-plus/test";
import { joinSpeechChunks } from "./joinChunks.ts";

const plain = (text: string) => ({ text, durationMs: 5000 });
const timedPair = (left: string, right: string, count: number) => {
  const segments = (text: string) =>
    [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)].filter(
      (word) => word.isWordLike,
    );
  const previous = segments(left);
  return [
    {
      text: left,
      durationMs: 5000,
      words: previous.map((word, i) => ({
        text: word.segment,
        t0Ms: 4000 + (i - previous.length + count) * 200,
        t1Ms: 4200 + (i - previous.length + count) * 200,
      })),
    },
    {
      text: right,
      durationMs: 5000,
      overlapMs: 1000,
      words: segments(right).map((word, i) => ({
        text: word.segment,
        t0Ms: i * 200,
        t1Ms: (i + 1) * 200,
      })),
    },
  ];
};

it("deduplicates matching words only within timed audio overlap", () => {
  expect(
    joinSpeechChunks(timedPair("go very very fast", "very fast and keep going", 2), "en"),
  ).toBe("go very very fast and keep going");
  expect(joinSpeechChunks(timedPair("hello world.", "world, again", 1), "en")).toBe(
    "hello world, again",
  );
  expect(joinSpeechChunks(timedPair("hello world.", "world. Next", 1), "en")).toBe(
    "hello world. Next",
  );
  expect(joinSpeechChunks(timedPair("café", "cafe\u0301 encore", 1), "fr")).toBe("café encore");
});

it("does not align a repeated phrase outside the shared second", () => {
  const pair = timedPair("yes yes yes yes yes yes", "yes yes yes yes yes yes again", 2);
  expect(joinSpeechChunks(pair, "en")).toBe("yes yes yes yes yes yes yes yes yes yes again");
  const phrase = "we should review this complete sentence again";
  expect(
    joinSpeechChunks([plain(phrase), { ...plain(phrase + " tomorrow"), overlapMs: 1000 }], "en"),
  ).toBe(phrase + " " + phrase + " tomorrow");
});

it("preserves repetitions with absent, inconsistent or non-overlapping timings", () => {
  const pair = timedPair("say yes", "yes again", 1);
  expect(joinSpeechChunks([pair[0]!, { ...pair[1]!, overlapMs: 0 }], "en")).toBe(
    "say yes yes again",
  );
  expect(joinSpeechChunks([pair[0]!, { ...plain(pair[1]!.text), overlapMs: 1000 }], "en")).toBe(
    "say yes yes again",
  );
  expect(
    joinSpeechChunks(
      [pair[0]!, { ...pair[1]!, words: [{ text: "yes", t0Ms: 0, t1Ms: 200 }] }],
      "en",
    ),
  ).toBe("say yes yes again");
  expect(
    joinSpeechChunks(
      [
        pair[0]!,
        {
          ...pair[1]!,
          words: pair[1]!.words.map((word) => ({
            ...word,
            t0Ms: word.t0Ms + 500,
            t1Ms: word.t1Ms + 500,
          })),
        },
      ],
      "en",
    ),
  ).toBe("say yes yes again");
});

it.each([
  ["नमस्ते दुनिया", "फिर मिलेंगे", "नमस्ते दुनिया फिर मिलेंगे"],
  ["코드를", "검토", "코드를 검토"],
  ["привет", "мир", "привет мир"],
  ["مرحبا", "بالعالم", "مرحبا بالعالم"],
  ["hello", "दुनिया", "hello दुनिया"],
  ["दुनिया", "hello", "दुनिया hello"],
  ["hello", "世界", "hello世界"],
  ["世界", "hello", "世界hello"],
  ["hello", "𠀀", "hello𠀀"],
  ["hello", "world", "hello world"],
  ["こんにちはー", "world", "こんにちはーworld"],
  ["hello", "안녕하세요", "hello 안녕하세요"],
  ["مرحبا", "hello", "مرحبا hello"],
])("spaces auto-detected boundaries: %s + %s", (left, right, expected) => {
  expect(joinSpeechChunks([plain(left), plain(right)], "auto")).toBe(expected);
});

it("keeps explicit language spacing and timed Unicode matches", () => {
  expect(joinSpeechChunks(timedPair("नमस्ते दुनिया", "दुनिया फिर", 1), "hi")).toBe("नमस्ते दुनिया फिर");
  expect(joinSpeechChunks(timedPair("코드를 검토", "검토 해주세요", 1), "ko")).toBe(
    "코드를 검토 해주세요",
  );
  expect(joinSpeechChunks([plain("こんにちは"), plain("世界です")], "ja")).toBe(
    "こんにちは世界です",
  );
});
