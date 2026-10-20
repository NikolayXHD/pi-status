import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ExtensionAPI,
  ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { createPiStatus } from "../index.ts";
import {
  SUBAGENTS_ASYNC_STARTED,
  SUBAGENTS_RPC_REPLY_PREFIX,
  SUBAGENTS_RPC_REQUEST,
} from "../src/subagents.ts";
import {
  FakeEventBus,
  fakeTitleStream,
  type FakeTitleStream,
} from "./helpers.ts";

type Handler = (event: unknown, ctx: unknown) => void;

interface FakePi {
  pi: ExtensionAPI;
  bus: FakeEventBus;
  fire(event: string, payload?: unknown, ctx?: ExtensionContext): void;
}

function createFakePi(sessionName: string): FakePi {
  const handlers = new Map<string, Handler[]>();
  const bus = new FakeEventBus();
  const pi = {
    on(event: string, handler: Handler) {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
      return () => {
        const current = handlers.get(event);
        if (!current) return;
        const index = current.indexOf(handler);
        if (index >= 0) current.splice(index, 1);
      };
    },
    events: bus,
    getSessionName: () => sessionName,
  } as unknown as ExtensionAPI;

  return {
    pi,
    bus,
    fire(event, payload = {}, ctx = tuiContext()) {
      for (const handler of handlers.get(event) ?? []) handler(payload, ctx);
    },
  };
}

function tuiContext(mode: "tui" | "print" = "tui"): ExtensionContext {
  return {
    mode,
    cwd: "/repo",
    isIdle: () => true,
  } as unknown as ExtensionContext;
}

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

function lastTitle(stream: FakeTitleStream): string {
  const write = stream.writes.at(-1);
  assert.ok(write, "no title was written");
  assert.match(write, /^\u001b\]0;.*\u0007$/);
  return write.slice(4, -1);
}

function respondWith(bus: FakeEventBus, totalActive: number): void {
  bus.on(SUBAGENTS_RPC_REQUEST, (payload) => {
    const requestId = (payload as { requestId: string }).requestId;
    bus.emit(`${SUBAGENTS_RPC_REPLY_PREFIX}${requestId}`, {
      version: 1,
      requestId,
      success: true,
      data: { fleet: { totalActive } },
    });
  });
}

function setup(totalActive = 0, mode: "tui" | "print" = "tui") {
  const fake = createFakePi("Fix parser");
  const stream = fakeTitleStream();
  respondWith(fake.bus, totalActive);
  createPiStatus(fake.pi, stream);
  const ctx = tuiContext(mode);
  fake.fire(
    "session_start",
    { type: "session_start", reason: "startup" },
    ctx,
  );
  return { ...fake, stream, ctx };
}

function shutdown(fake: FakePi, ctx: ExtensionContext = tuiContext()): void {
  fake.fire(
    "session_shutdown",
    { type: "session_shutdown", reason: "quit" },
    ctx,
  );
}

test("when agent starts then clock is written", async () => {
  const fake = setup(0);
  await flush();
  assert.equal(lastTitle(fake.stream), ":🖐️  Fix parser");

  fake.fire("agent_start");
  assert.equal(lastTitle(fake.stream), ":⏳  Fix parser");
  shutdown(fake);
});

test("when agent settles then hand or eye follows subagents", async () => {
  for (const totalActive of [0, 1]) {
    const fake = setup(totalActive);
    await flush();
    fake.fire("agent_start");
    fake.fire("agent_settled");
    await flush();

    const expected = totalActive > 0 ? ":👀  Fix parser" : ":🖐️  Fix parser";
    assert.equal(lastTitle(fake.stream), expected);
    shutdown(fake);
  }
});

test("when compaction starts then clock is written", async () => {
  const fake = setup(0);
  await flush();

  fake.fire("session_before_compact");
  assert.equal(lastTitle(fake.stream), ":⏳  Fix parser");
  shutdown(fake);
});

test("when compaction ends while run is active then clock stays", async () => {
  const fake = setup(0);
  await flush();

  fake.fire("agent_start");
  fake.fire("session_before_compact");
  fake.fire("session_compact");
  assert.equal(lastTitle(fake.stream), ":⏳  Fix parser");
  shutdown(fake);
});

test("when compaction ends while idle then hand or eye follows subagents", async () => {
  for (const totalActive of [0, 1]) {
    const fake = setup(totalActive);
    await flush();

    fake.fire("session_before_compact");
    fake.fire("session_compact_failed");
    await flush();

    const expected = totalActive > 0 ? ":👀  Fix parser" : ":🖐️  Fix parser";
    assert.equal(lastTitle(fake.stream), expected);
    shutdown(fake);
  }
});

test("when async starts while parent is idle then eye appears", async () => {
  const fake = setup(0);
  await flush();
  assert.equal(lastTitle(fake.stream), ":🖐️  Fix parser");

  fake.bus.emit(SUBAGENTS_ASYNC_STARTED, {});
  assert.equal(lastTitle(fake.stream), ":👀  Fix parser");
  shutdown(fake);
});

test("when async starts while run is active then clock wins", async () => {
  const fake = setup(0);
  await flush();

  fake.fire("agent_start");
  fake.bus.emit(SUBAGENTS_ASYNC_STARTED, {});
  assert.equal(lastTitle(fake.stream), ":⏳  Fix parser");
  shutdown(fake);
});

test("when mode is not tui then stream is untouched", async () => {
  const fake = setup(0, "print");
  await flush();

  assert.deepEqual(fake.stream.writes, []);
  shutdown(fake, tuiContext("print"));
});

test("when session shuts down then writer is disposed and events unsubscribed", async () => {
  const fake = setup(0);
  await flush();
  const activeWriter = fake.stream.write;

  shutdown(fake);
  assert.notEqual(fake.stream.write, activeWriter);

  fake.stream.writes.length = 0;
  fake.stream.write("\u001b]0;core title\u0007");
  assert.deepEqual(fake.stream.writes, ["\u001b]0;core title\u0007"]);

  fake.bus.emit(SUBAGENTS_ASYNC_STARTED, {});
  assert.deepEqual(fake.stream.writes, ["\u001b]0;core title\u0007"]);
});

test("when state changes before reply then stale reply is ignored", async () => {
  const fake = createFakePi("Fix parser");
  const stream = fakeTitleStream();
  const requests: Array<{ requestId: string }> = [];
  fake.bus.on(SUBAGENTS_RPC_REQUEST, (payload) => {
    requests.push(payload as { requestId: string });
  });

  createPiStatus(fake.pi, stream);
  fake.fire(
    "session_start",
    { type: "session_start", reason: "startup" },
    tuiContext(),
  );
  await flush();
  assert.equal(requests.length, 1);

  fake.fire("agent_start");
  assert.equal(lastTitle(stream), ":⏳  Fix parser");

  const request = requests[0];
  fake.bus.emit(`${SUBAGENTS_RPC_REPLY_PREFIX}${request.requestId}`, {
    version: 1,
    requestId: request.requestId,
    success: true,
    data: { fleet: { totalActive: 1 } },
  });
  await flush();

  assert.equal(lastTitle(stream), ":⏳  Fix parser");
  shutdown(fake);
});
