import type { EventBusLike } from "../src/subagents.ts";
import type { TitleStream } from "../src/title-writer.ts";

export class FakeEventBus implements EventBusLike {
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

export interface FakeTitleStream extends TitleStream {
  writes: string[];
}

export function fakeTitleStream(): FakeTitleStream {
  const writes: string[] = [];
  return {
    writes,
    write(chunk: string | Uint8Array): boolean {
      writes.push(
        typeof chunk === "string" ? chunk : Buffer.from(chunk).toString(),
      );
      return true;
    },
  };
}
