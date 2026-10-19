import { randomUUID } from "node:crypto";

export const SUBAGENTS_RPC_READY = "subagents:rpc:v1:ready";
export const SUBAGENTS_RPC_REQUEST = "subagents:rpc:v1:request";
export const SUBAGENTS_RPC_REPLY_PREFIX = "subagents:rpc:v1:reply:";
export const SUBAGENTS_ASYNC_STARTED = "subagent:async-started";
export const SUBAGENTS_ASYNC_COMPLETE = "subagent:async-complete";

export interface EventBusLike {
  on(channel: string, handler: (data: unknown) => void): () => void;
  emit(channel: string, data: unknown): void;
}

export function isReadyWithFleet(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const capabilities = (
    payload as {
      capabilities?: { fleetStatus?: { version?: unknown } };
    }
  ).capabilities;
  return capabilities?.fleetStatus?.version === 1;
}

export function parseActiveSubagents(reply: unknown): number | null {
  if (!reply || typeof reply !== "object") return null;
  const record = reply as {
    version?: unknown;
    success?: unknown;
    data?: unknown;
  };
  if (record.version !== 1 || record.success !== true) return null;
  if (!record.data || typeof record.data !== "object") return null;
  const fleet = (
    record.data as { fleet?: { totalActive?: unknown } }
  ).fleet;
  const total = fleet?.totalActive;
  return typeof total === "number" && Number.isInteger(total) && total >= 0
    ? total
    : null;
}

export function requestActiveSubagents(
  events: EventBusLike,
  timeoutMs = 1000,
): Promise<number | null> {
  return new Promise((resolve) => {
    const requestId = randomUUID();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;
    let settled = false;

    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      unsubscribe?.();
      resolve(value);
    };

    unsubscribe = events.on(
      `${SUBAGENTS_RPC_REPLY_PREFIX}${requestId}`,
      (reply) => {
        if (
          !reply ||
          typeof reply !== "object" ||
          (reply as { requestId?: unknown }).requestId !== requestId
        ) {
          return;
        }
        finish(parseActiveSubagents(reply));
      },
    );

    timer = setTimeout(() => finish(null), timeoutMs);

    try {
      events.emit(SUBAGENTS_RPC_REQUEST, {
        version: 1,
        requestId,
        method: "status",
        params: {},
      });
    } catch {
      finish(null);
    }
  });
}
