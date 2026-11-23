# Using IntelliJ GoLand Profiler and `pprof` MCP Tools

Use your default agent tools (`read_file`, `edit_file`, `write_file`) and shell `go build`, `go test`, or `go test -bench` commands via `run_command` first. Escalate to these GoLand profiler tools (alongside core [SKILL.md](../SKILL.md) tools) when running a Go profiler configuration in the IDE, controlling live IDE profiling sessions, or querying `.pprof` bottlenecks without writing custom `go tool pprof` pipelines.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

---

## 1. Profiled Run Lifecycle

- `run_with_profiler` (`runConfig`*): Launch a saved Go run configuration by exact name with profiling enabled and return a `session` ID plus advertised profile kinds and sample types.
- `list_profiled_runs` (optional `projectPath` only): List active and recently stopped Go profiler sessions, including runs launched manually from the IDE UI.
- `get_profiled_run_output` (`session`*, `maxLines`, `startLine`): Read captured program output (1 to 1000 lines) starting at a 0-based `startLine` index (omit for earliest retained line, then pass `endLine` to page).
- `stop_profiled_run` (`session`*): Terminate a profiler session launched by `run_with_profiler`.

---

## 2. Capturing and Discovering `.pprof` Files

- `start_cpu_recording` (`session`*): Start on-demand CPU recording for an active profiled `session`.
- `stop_cpu_recording` (`session`*): Stop CPU recording, save the `.pprof` file, and return the file path with its default `profile_summary`.
- `take_profile` (`kind`*, `session`*, `duration`): Capture an advertised profile `kind` (pass `duration` from 1 to 300 seconds for `cpu`, and omit `duration` for snapshot kinds) and return the saved `.pprof` path plus summary.
- `list_profiles` (`limit`, `scope` [`recent`, `open`, `session`], `session`): List `.pprof` profiles (1 to 200 rows, default 5). Pass `session` when `scope` is `"session"`. Open tabs list the selected profile first, and other scopes sort newest first.

---

## 3. Analyzing `.pprof` Profiles

Pass the `.pprof` file path from `take_profile`, `stop_cpu_recording`, or `list_profiles` as `profile`:

1. `profile_summary` (`profile`*, `sampleType`): Return `.pprof` totals, CPU use, and top 5 hot functions with lines and call paths. Call directly when inspecting another file or switching `sampleType` (`alloc_space`, `inuse_space`).
2. `profile_top_frames` (`profile`*, `limit`, `root`, `sampleType`, `sortBy` [`self`, `cumulative`]): Rank functions in a `.pprof` file by `self` (default) or `cumulative` cost, optionally narrowed under a substring `root`.
3. `profile_call_paths` (`profile`*, `target`*, `depth`, `limit`, `sampleType`): List ranked caller stacks reaching any function matching `target` (depth 1 to 64, limit 1 to 50) to find upstream callers responsible for hot paths.
4. `profile_source_lines` (`function`*, `profile`*, `limit`, `sampleType`): Rank expensive source lines across functions matching `function` (1 to 200 lines). If files changed after the profiled build, re-profile after rebuilding or verify reported line numbers against the profiled commit SHA.
