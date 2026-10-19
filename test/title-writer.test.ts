import assert from "node:assert/strict";
import { test } from "node:test";
import { installTitleWriter } from "../src/title-writer.ts";
import { fakeTitleStream } from "./helpers.ts";

const INTERCEPTED_TITLES = [
  "\u001b]0;core title\u0007",
  "\u001b]2;tab title\u001b\\",
] as const;

test("when core writes a title then our title replaces it", () => {
  for (const titleSequence of INTERCEPTED_TITLES) {
    const stream = fakeTitleStream();
    const writer = installTitleWriter(stream, () => "ours");

    stream.write(titleSequence);
    assert.deepEqual(stream.writes, ["\u001b]0;ours\u0007"]);
    writer.dispose();
  }
});

test("when render is called then title is written", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");

  writer.render();
  assert.deepEqual(stream.writes, ["\u001b]0;ours\u0007"]);
  writer.dispose();
});

test("when a non-title write happens then it passes through", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");

  stream.write("plain output");
  assert.deepEqual(stream.writes, ["plain output"]);
  writer.dispose();
});

test("when a title sequence is embedded in a larger chunk then it passes through", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");
  const chunk = "prefix\u001b]0;core title\u0007";

  stream.write(chunk);
  assert.deepEqual(stream.writes, [chunk]);
  writer.dispose();
});

test("when a title sequence is a buffer then it passes through", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");
  const chunk = Buffer.from("\u001b]0;core title\u0007");

  stream.write(chunk);
  assert.deepEqual(stream.writes, ["\u001b]0;core title\u0007"]);
  writer.dispose();
});

test("when disposed then title writes pass through again", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");
  writer.dispose();

  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;core title\u0007"]);
});

test("when disposed after a foreign wrapper then title writes pass through", () => {
  const stream = fakeTitleStream();
  const writer = installTitleWriter(stream, () => "ours");
  const ourWrite = stream.write;
  stream.write = (chunk, ...args) => ourWrite(chunk, ...args);

  writer.dispose();
  stream.writes.length = 0;
  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;core title\u0007"]);
});

test("when installed twice then only the second writer is active", () => {
  const stream = fakeTitleStream();
  const first = installTitleWriter(stream, () => "first");
  const second = installTitleWriter(stream, () => "second");

  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;second\u0007"]);

  second.dispose();
  first.dispose();
});
