import assert from "node:assert/strict";
import { test } from "node:test";
import {
  installTitleWriter,
  type TitleStream,
} from "../src/title-writer.ts";

interface FakeStream extends TitleStream {
  writes: string[];
}

function fakeStream(): FakeStream {
  const writes: string[] = [];
  return {
    writes,
    write(chunk: string | Uint8Array): boolean {
      writes.push(String(chunk));
      return true;
    },
  };
}

test("when core writes a title then our title replaces it", () => {
  const stream = fakeStream();
  let current = "ours";
  const writer = installTitleWriter(stream, () => current);

  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;ours\u0007"]);

  current = "next";
  writer.render();
  assert.deepEqual(stream.writes, [
    "\u001b]0;ours\u0007",
    "\u001b]0;next\u0007",
  ]);
});

test("when a non-title write happens then it passes through", () => {
  const stream = fakeStream();
  const writer = installTitleWriter(stream, () => "ours");

  stream.write("plain output");
  assert.deepEqual(stream.writes, ["plain output"]);
  writer.dispose();
});

test("when OSC 2 is written then it is replaced too", () => {
  const stream = fakeStream();
  const writer = installTitleWriter(stream, () => "ours");

  stream.write("\u001b]2;tab title\u001b\\");
  assert.deepEqual(stream.writes, ["\u001b]0;ours\u0007"]);
  writer.dispose();
});

test("when disposed then title writes pass through again", () => {
  const stream = fakeStream();
  const writer = installTitleWriter(stream, () => "ours");
  writer.dispose();

  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;core title\u0007"]);
});

test("when installed twice then only the second writer is active", () => {
  const stream = fakeStream();
  const first = installTitleWriter(stream, () => "first");
  const second = installTitleWriter(stream, () => "second");

  stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(stream.writes, ["\u001b]0;second\u0007"]);

  second.dispose();
  first.dispose();
});
