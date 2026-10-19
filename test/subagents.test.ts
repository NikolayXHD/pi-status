import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SUBAGENTS_RPC_REPLY_PREFIX,
  SUBAGENTS_RPC_REQUEST,
  isReadyWithFleet,
  parseActiveSubagents,
  requestActiveSubagents,
  type EventBusLike,
} from "../src/subagents.ts";

class FakeEventBus implements EventBusLike {
  private readonly handlers = new Map<
    string,
    Set<(data: unknown) => void>
  >();

  on(channel: string, handler: (data: unknown) => void): () => void {
    const handlers = this.handlers.get(channel) ?? new Set();
    handlers.add(handler);
    this.handlers.set(channel, handlers);
    return () => handlers.delete(handler);
  }

  emit(channel: string, data: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) handler(data);
  }
}

test("when reply has fleet then total active is parsed", () => {
  assert.equal(
    parseActiveSubagents({
      version: 1,
      success: true,
      data: { fleet: { totalActive: 3 } },
    }),
    3,
  );
});

test("when reply is an error then count is unknown", () => {
  assert.equal(
    parseActiveSubagents({ version: 1, success: false, data: {} }),
    null,
  );
});

test("when ready has fleet capability then it is accepted", () => {
  assert.equal(
    isReadyWithFleet({
      version: 1,
      capabilities: { fleetStatus: { version: 1 } },
    }),
    true,
  );
});

test("when ready lacks fleet capability then it is rejected", () => {
  assert.equal(isReadyWithFleet({ version: 1, capabilities: {} }), false);
});

test("when a reply arrives then the request resolves with the count", async () => {
  const bus = new FakeEventBus();
  let requestId = "";
  bus.on(SUBAGENTS_RPC_REQUEST, (data) => {
    requestId = (data as { requestId: string }).requestId;
  });

  const pending = requestActiveSubagents(bus, 50);
  bus.emit(`${SUBAGENTS_RPC_REPLY_PREFIX}${requestId}`, {
    version: 1,
    requestId,
    success: true,
    data: { fleet: { totalActive: 2 } },
  });

  assert.equal(await pending, 2);
});

test("when no reply arrives then the request resolves as unknown", async () => {
  const bus = new FakeEventBus();
  assert.equal(await requestActiveSubagents(bus, 10), null);
});
