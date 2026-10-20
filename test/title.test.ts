import assert from "node:assert/strict";
import { test } from "node:test";
import { buildTitle } from "../src/title.ts";

const STATUS_CASES = [
  { busy: true, subagentsActive: false, status: ":⏳" },
  { busy: true, subagentsActive: true, status: ":⏳" },
  { busy: false, subagentsActive: true, status: ":👀" },
  { busy: false, subagentsActive: false, status: ":🖐️" },
] as const;

test("when status flags change then status icon follows priority", () => {
  for (const { busy, subagentsActive, status } of STATUS_CASES) {
    assert.equal(
      buildTitle({
        busy,
        subagentsActive,
        sessionName: "Fix parser",
        cwd: "/repo",
      }),
      `${status} Fix parser`,
    );
  }
});

test("when session name contains colon tags then they stay in the name", () => {
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

test("when session has no name then cwd basename is used", () => {
  for (const sessionName of [undefined, ""]) {
    assert.equal(
      buildTitle({
        busy: false,
        subagentsActive: false,
        sessionName,
        cwd: "/home/kolia/git/pi-status",
      }),
      ":🖐️ pi-status",
    );
  }
});

test("when cwd basename has control characters then they are removed", () => {
  assert.equal(
    buildTitle({
      busy: false,
      subagentsActive: false,
      sessionName: undefined,
      cwd: "/bad\nname",
    }),
    ":🖐️ bad name",
  );
});

test("when cwd has no basename then pi is used", () => {
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

test("when session name has a colon followed by a space then it is kept", () => {
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
