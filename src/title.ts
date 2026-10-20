import { basename } from "node:path";

export const STATUS_CLOCK = "⏳";
export const STATUS_EYE = "👀";
export const STATUS_HAND = "🖐️";

const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]+/g;

export interface TitleState {
  busy: boolean;
  subagentsActive: boolean;
  sessionName: string | undefined;
  cwd: string;
}

export function buildTitle(state: TitleState): string {
  const status = state.busy
    ? STATUS_CLOCK
    : state.subagentsActive
      ? STATUS_EYE
      : STATUS_HAND;
  const body = squash(
    state.sessionName || basename(state.cwd) || "pi",
  );
  return `:${status} ${body}`;
}

function squash(text: string): string {
  return text.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
}
