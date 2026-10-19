import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
  SUBAGENTS_ASYNC_COMPLETE,
  SUBAGENTS_ASYNC_STARTED,
  SUBAGENTS_RPC_READY,
  isReadyWithFleet,
  requestActiveSubagents,
} from "./src/subagents.ts";
import { buildTitle } from "./src/title.ts";
import {
  installTitleWriter,
  type TitleWriter,
} from "./src/title-writer.ts";

export default function piStatus(pi: ExtensionAPI) {
  let enabled = false;
  let writer: TitleWriter | undefined;
  let cwd = process.cwd();
  let runActive = false;
  let compacting = false;
  let subagentsActive = false;
  let rpcReady = false;
  let stateVersion = 0;
  let queryId = 0;
  let eventUnsubscribes: Array<() => void> = [];

  const bump = () => {
    stateVersion += 1;
  };

  const title = () =>
    buildTitle({
      busy: runActive || compacting,
      subagentsActive,
      sessionName: pi.getSessionName(),
      cwd,
    });

  const render = () => {
    if (enabled) writer?.render();
  };

  const refreshSubagents = async (force: boolean) => {
    if (!enabled || (!rpcReady && !force)) return;
    const version = stateVersion;
    const id = ++queryId;
    const total = await requestActiveSubagents(pi.events);
    if (!enabled || id !== queryId || version !== stateVersion) return;
    if (total === null) return;
    rpcReady = true;
    subagentsActive = total > 0;
    render();
  };

  const subscribeToSubagents = () => {
    for (const unsubscribe of eventUnsubscribes) unsubscribe();
    eventUnsubscribes = [
      pi.events.on(SUBAGENTS_RPC_READY, (payload) => {
        if (!isReadyWithFleet(payload)) return;
        rpcReady = true;
        if (enabled) void refreshSubagents(false);
      }),
      pi.events.on(SUBAGENTS_ASYNC_STARTED, () => {
        if (!enabled) return;
        rpcReady = true;
        subagentsActive = true;
        bump();
        render();
      }),
      pi.events.on(SUBAGENTS_ASYNC_COMPLETE, () => {
        if (!enabled) return;
        bump();
        if (!runActive && !compacting) void refreshSubagents(false);
      }),
    ];
  };

  pi.on("session_start", (_event, ctx) => {
    enabled = ctx.mode === "tui";
    cwd = ctx.cwd;
    runActive = !ctx.isIdle();
    compacting = false;
    subagentsActive = false;
    bump();

    if (!enabled) {
      writer?.dispose();
      writer = undefined;
      for (const unsubscribe of eventUnsubscribes) unsubscribe();
      eventUnsubscribes = [];
      return;
    }

    subscribeToSubagents();
    writer = installTitleWriter(process.stdout, title);
    render();
    void refreshSubagents(true);
  });

  pi.on("agent_start", () => {
    if (!enabled) return;
    runActive = true;
    bump();
    render();
  });

  pi.on("agent_settled", () => {
    if (!enabled) return;
    runActive = false;
    bump();
    render();
    void refreshSubagents(false);
  });

  pi.on("session_before_compact", () => {
    if (!enabled) return;
    compacting = true;
    bump();
    render();
  });

  const compactionFinished = () => {
    if (!enabled) return;
    compacting = false;
    bump();
    render();
    if (!runActive) void refreshSubagents(false);
  };

  pi.on("session_compact", compactionFinished);
  pi.on("session_compact_failed", compactionFinished);

  pi.on("session_shutdown", () => {
    enabled = false;
    bump();
    queryId += 1;
    writer?.dispose();
    writer = undefined;
    for (const unsubscribe of eventUnsubscribes) unsubscribe();
    eventUnsubscribes = [];
  });
}
