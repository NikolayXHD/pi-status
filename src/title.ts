import { basename } from "node:path";

export const STATUS_CLOCK = "⏳";
export const STATUS_EYE = "👀";
export const STATUS_HAND = "🖐️";

const STATUS_TAGS = new Set([STATUS_CLOCK, STATUS_EYE, STATUS_HAND]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f-\u009f]+/g;
const TAGS = /:([^\s:]+)/g;

export interface TitleState {
  busy: boolean;
  subagentsActive: boolean;
  sessionName: string | undefined;
  cwd: string;
}

interface SessionName {
  tags: string[];
  name: string;
}

export function buildTitle(state: TitleState): string {
  const status = state.busy
    ? STATUS_CLOCK
    : state.subagentsActive
      ? STATUS_EYE
      : STATUS_HAND;
  const session = splitSessionName(state.sessionName);
  const customTags = [
    ...new Set(session.tags.map((tag) => squash(tag)).filter(Boolean)),
  ].filter((tag) => !STATUS_TAGS.has(tag));
  const tags = [status, ...customTags].map((tag) => `:${tag}`).join(" ");
  const fallback = basename(state.cwd) || "pi";
  return `${tags}  ${squash(session.name || fallback)}`;
}

export function splitSessionName(name: string | undefined): SessionName {
  if (!name) return { tags: [], name: "" };
  const tags = [...name.matchAll(TAGS)].map((match) => match[1]);
  return { tags, name: squash(name.replace(TAGS, "")) };
}

function squash(text: string): string {
  return text.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
}
