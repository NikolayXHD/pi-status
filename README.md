# pi-status

A Pi extension that owns the terminal title. It shows the current Pi status;
manual tmux labels are preserved by the consumer.

## Title

| State                                  | Tag   |
| -------------------------------------- | ----- |
| A run or compaction is in progress     | `:⏳` |
| Pi is idle and subagents are active    | `:👀` |
| Pi is idle and no subagents are active | `:🖐️` |

The format is `:status name`. The name is the Pi session name as-is; the
extension does not interpret or move colons inside it. For example,
`/name Fix parser` produces `:🖐️ Fix parser` while idle, `:⏳ Fix parser` while
working, and `:👀 Fix parser` while background subagents are active.

Pi's own `π - name - cwd` title is replaced. If the session has no name, the
directory name is used.

## Subagents

`:👀` requires [pi-subagents](https://github.com/nicobailon/pi-subagents). The
extension asks its public RPC for `fleet.totalActive` and listens to the
`subagent:async-started` and `subagent:async-complete` events. Only active work
counts; completed subagent history does not keep the eye.

Background work that survives a session replacement in the same Pi process is
counted as belonging to the current session, because pi-subagents delivers its
results there. A separate Pi process in another terminal has its own event bus
and cannot affect this title.

## Install

```sh
pi install https://github.com/NikolayXHD/pi-status
```

Restart Pi after installation.

## tmux

With this extension, tmux can use `pane_title` directly:

```tmux
set -g set-titles on
set -g set-titles-string '#{?#{m/r:^:,#{pane_title}},#{s/^([^ ]+) .*$/\1/:#{pane_title}} #{window_name},#{window_name}}'
set -g window-status-format '#{window_index}:#{?#{m/r:^:,#{pane_title}},#{s|^.(.*)$|\1|:#{s/^([^ ]+) .*$/\1/:#{pane_title}}} #{window_name},#{window_name}} '
set -g window-status-current-format '#{window_index}:#{?#{m/r:^:,#{pane_title}},#{s|^.(.*)$|\1|:#{s/^([^ ]+) .*$/\1/:#{pane_title}}} #{window_name},#{window_name}} '
```

No process inspection is needed. For a pane whose title starts with a `:tag`,
tmux takes that first status token and prepends it to the manual `window_name`.
Other panes show their manual window name. Manual labels are preserved.

## How it works

The extension intercepts OSC 0 and OSC 2 title writes on `process.stdout` and
replaces them with its own title. This keeps the startup title and `/reload`
from erasing the status and makes session renames immediate. The original
`process.stdout.write` is restored on session shutdown.

Only TUI mode is affected. Print, JSON, and RPC modes do not change the
terminal title.

## Development

```sh
npm install
npm test
npm run check
```

Tests use Node's built-in test runner and TypeScript type stripping.

## License

MIT
