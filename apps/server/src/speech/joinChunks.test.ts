import { expect, it } from "vite-plus/test";
import { joinSpeechChunks } from "./joinChunks.ts";

it("joins overlapping words once without eating deliberate repeated words", () => {
  expect(joinSpeechChunks(["go very very fast", "very fast and keep going"], "en")).toBe(
    "go very very fast and keep going",
  );
  expect(joinSpeechChunks(["one two", "three four"], "en")).toBe("one two three four");
  expect(joinSpeechChunks(["hello world", "world, again"], "en")).toBe("hello world, again");
  expect(joinSpeechChunks(["hello world.", "world, again"], "en")).toBe("hello world, again");
  expect(joinSpeechChunks(["hello world.", "world. Next"], "en")).toBe("hello world. Next");
});

it("recognizes Unicode letters, combining marks and language word boundaries", () => {
  expect(joinSpeechChunks(["नमस्ते दुनिया", "दुनिया फिर"], "hi")).toBe("नमस्ते दुनिया फिर");
  expect(joinSpeechChunks(["코드를 검토", "검토 해주세요"], "ko")).toBe("코드를 검토 해주세요");
  expect(joinSpeechChunks(["こんにちは世界", "世界です"], "ja")).toBe("こんにちは世界です");
  expect(joinSpeechChunks(["café", "cafe\u0301 encore"], "fr")).toBe("café encore");
});
