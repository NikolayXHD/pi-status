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
import { FakeEventBus } from "./helpers.ts";

const INVALID_REPLIES = [
  null,
  "reply",
  { version: 2, success: true, data: { fleet: { totalActive: 1 } } },
  { version: 1, success: false, data: { fleet: { totalActive: 1 } } },
  { version: 1, success: true, data: {} },
  { version: 1, success: true, data: { fleet: {} } },
  { version: 1, success: true, data: { fleet: { totalActive: "3" } } },
  { version: 1, success: true, data: { fleet: { totalActive: -1 } } },
  { version: 1, success: true, data: { fleet: { totalActive: 2.5 } } },
] as const;

test("when reply shape is invalid then count is unknown", () => {
  for (const reply of INVALID_REPLIES) {
    assert.equal(parseActiveSubagents(reply), null);
  }
});

test("when total active is zero then zero is parsed", () => {
  assert.equal(
    parseActiveSubagents({
      version: 1,
      success: true,
      data: { fleet: { totalActive: 0 } },
    }),
    0,
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

const NOT_READY_PAYLOADS = [
  null,
  {},
  { capabilities: null },
  { capabilities: { fleetStatus: { version: 2 } } },
] as const;

test("when ready lacks fleet capability then it is rejected", () => {
  for (const payload of NOT_READY_PAYLOADS) {
    assert.equal(isReadyWithFleet(payload), false);
  }
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

test("when reply request id mismatches then the reply is ignored", async () => {
  const bus = new FakeEventBus();
  let requestId = "";
  bus.on(SUBAGENTS_RPC_REQUEST, (data) => {
    requestId = (data as { requestId: string }).requestId;
  });

  const pending = requestActiveSubagents(bus, 50);
  bus.emit(`${SUBAGENTS_RPC_REPLY_PREFIX}foreign`, {
    version: 1,
    requestId: "foreign",
    success: true,
    data: { fleet: { totalActive: 3 } },
  });
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

test("when emit throws then the request resolves as unknown", async () => {
  const bus: EventBusLike = {
    on: () => () => {},
    emit: () => {
      throw new Error("no handlers");
    },
  };
  assert.equal(await requestActiveSubagents(bus, 10), null);
});
