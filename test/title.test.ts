import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTitle, splitSessionName } from "../src/title.ts";

test("when busy then clock and tags move to the front", () => {
  assert.equal(
    buildTitle({
      busy: true,
      subagentsActive: false,
      sessionName: "Fix parser :review",
      cwd: "/repo",
    }),
    ":⏳ :review Fix parser",
  );
});

test("when idle with subagents then eye", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: true,
      sessionName: ":review Fix parser",
      cwd: "/repo",
    }),
    ":👀 :review Fix parser",
  );
});

test("when idle without subagents then hand", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: ":review Fix parser",
      cwd: "/repo",
    }),
    ":🖐️ :review Fix parser",
  );
});

test("when session has no name then cwd basename", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: undefined,
      cwd: "/home/kolia/git/pi-status",
    }),
    ":🖐️ pi-status",
  );
});

test("when cwd has no basename then pi", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: undefined,
      cwd: "/",
    }),
    ":🖐️ pi",
  );
});

test("when session name has duplicate and status tags then they are removed", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: ":⏳ :review :review Fix parser",
      cwd: "/repo",
    }),
    ":🖐️ :review Fix parser",
  );
});

test("when session name has a colon followed by a space then it is not a tag", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: "notes: fix parser",
      cwd: "/repo",
    }),
    ":🖐️ notes: fix parser",
  );
});

test("when session name has control characters then they are removed", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: "Fix\u0007 parser\nnow",
      cwd: "/repo",
    }),
    ":🖐️ Fix parser now",
  );
});

test("when splitting a session name then tags are separate", () => {
  assert.deepEqual(splitSessionName(":review:urgent  Fix   parser"), {
    tags: ["review", "urgent"],
    name: "Fix parser",
  });
});
