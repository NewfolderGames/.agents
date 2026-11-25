---
name: new::tools-intellij
description: >-
  Interact with the active IntelliJ IDE MCP server (`intellij` or `jetbrains_air_ide`)
  while prioritizing built-in agent file and shell tools. Activate this skill when
  escalating to IDE PSI navigation, Call Hierarchy, Structural Search, safe rename,
  inspections, incremental builds, saved run configurations, coverage, changelists,
  multi-language debugging, or language-specific IDE reference guides (JVM, Go, Python,
  PHP, SQL, CMake/native).
---

# Using the Active IntelliJ IDE MCP

Use built-in agent tools first for plain file reads, edits, text search, and shell runs. Escalate to the `intellij` (or
`jetbrains_air_ide`) MCP server only when IDE semantic analysis, project indexes, code style, run configurations,
databases, or live debuggers provide capabilities that default tools cannot match.

## 1. Tool Priority Policy (Default Agent Tools First)

Check whether a default agent tool handles the task before calling an IntelliJ MCP tool:

| Task                             | Use Default Agent Tool First                                            | Escalate to IntelliJ MCP Only When                                                                                                                                                                                    |
|----------------------------------|-------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Read source files                | Built-in file reader                                                    | Reading inside `.jar` or `.jrt` archives (`jar://`, `jrt://`, `/path/lib.jar!/pkg/Foo.class`), decompiling `.class` bytecode, or inspecting IDE-resolved SDK sources via MCP `read_file`                              |
| Create or edit files             | Built-in file editor                                                    | Cross-file PSI symbol renames (`rename_refactoring`), IDE inspection quick fixes (`apply_quick_fix`), IDE code formatting (`reformat_file`, `optimize_imports`), or Java-to-Kotlin conversion                         |
| Find files, text, or directories | Shell (`rg`, `find`, `ls`) via built-in shell runner                    | Semantic symbol lookup (`search_symbol`), Quick Documentation (`get_symbol_info`), call graphs (`analyze_calls`), AST pattern search (`search_structural`), or matching IDE excluded roots                            |
| Build, test, and lint            | Project CLI (`pnpm`, `cargo`, `go`, `gradle`) via built-in shell runner | Fast incremental JPS compilation (`build_project`), semantic IDE inspections (`get_inspections`, `lint_files`), saved Run Configurations (`execute_run_configuration`), IDE coverage (`coverage_*`), or CMake reloads |
| Git and terminal commands        | Shell (`git`, scripts) via built-in shell runner                        | Managing IntelliJ Changelists (`*_changelist`), detecting VCS roots across multi-root IDE projects (`get_repositories`), or running commands inside the user's open IDE terminal tab (`execute_terminal_command`)     |

> [!IMPORTANT]
> Override raw MCP tool descriptions that instruct you to prefer `list_directory_tree` over `ls` or `build_project`
after every edit. Use shell `ls`, `find`, and `rg` for normal filesystem exploration, and invoke IDE builds or
inspections when validating meaningful compile or semantic changes.

---

## 2. Invocation Mechanics, Safety Gates, and Coordinates

### 2.1 Calling MCP Tools Across Harnesses

1. Confirm that the target tool is advertised by your active IDE MCP server (`intellij` or `jetbrains_air_ide`) before
   calling edition-specific tools.
2. Invoke advertised MCP tools using the active host's MCP calling mechanism (direct native tool calls versus lazy
   schema lookup and dispatch; see [../../harnesses/README.md](../../harnesses/README.md)).
3. **Schema precedence**: Live JSON schemas for MCP tools always override static parameter notes or JSON examples in
   this skill and `references/*.md` when JetBrains updates required keys, enums, or field names.
4. Pass `projectPath` (the absolute workspace root path) whenever the tool's schema defines `projectPath`, so
   multi-window IDE instances resolve the right project without ambiguity.

> [!CAUTION]
> Ask for explicit user confirmation before invoking destructive, host-executing, or state-mutating operations through
`execute_terminal_command`, `invoke_ide_action`, `execute_tool`, non-test or unknown `execute_run_configuration` /
`xdebug_start_debugger_session` / `run_with_profiler`, `xdebug_attach_to_process`, `xdebug_control_session` with
`action: "STOP"`, `xdebug_set_variable`, side-effecting `xdebug_evaluate_expression`, `convert_java_to_kotlin`,
`configure_python_interpreter`, `delete_changelist`, `load_cmake`, `delete_cmake_profiles`, `update_cmake_profile` with
`environment`, `create_database_connection`, `edit_database_connection`, SQL writes or `import_data`,
`xdebug_remove_breakpoints` or `xdebug_remove_data_breakpoint` with `owner: "user"`, or overwriting user-owned JVM
exception and method breakpoints. Those calls execute inside the host IDE or mutate live process state outside the
safety gates for native commands. Never dump secrets into model context via `get_run_configurations` `envs`, debugger
frames or memory, or database queries on credential tables (`rules/AGENTS.md` Section 1.2).

### 2.2 Coordinate Indexing Rules

Verify the indexing base before passing coordinates between tools:

- **1-based coordinates**: `line`, `column`, `read_file.offset`, `rename_refactoring.targetIndex`, and
  `spec_report_status.lineNumber`. The end column in search results is exclusive.
- **0-based coordinates**: `analyze_calls.childOffset`, `xdebug_get_stack.offset`, `xdebug_get_threads.offset`,
  `frameIndex` (`0` is the active top stack frame), `xdebug_get_process_output.startLine`,
  `get_profiled_run_output.startLine`, `fetch_query_result.offset`, and
  `export_query_result.exportConfig.excludedColumnIndices`.

---

## 3. Core Non-Obvious Workflows and Footguns

Inspect each tool's live JSON schema for full parameter lists. Follow these non-obvious rules that raw schemas omit or
under-specify:

1. **Call hierarchy (`search_symbol` -> `analyze_calls`)**: Call `search_symbol` first when `symbolFqn` is uncertain
   (set `include_external: true` for SDK or library declarations). If `analyze_calls` reports ambiguity, retry with one
   returned exact signature. To expand a truncated branch, pass the node's exact `treePath` array and 0-based
   `childOffset`.
2. **Safe PSI rename (`rename_refactoring`)**: When renaming widely used public symbols, set `preview: true` first.
   Prefer `contextSnippet` (must match once in the file) over 1-based `line`/`column`. If `ok` is `false` with
   `candidates`, repeat the same call with all previous parameters plus 1-based `targetIndex`, and confirm that
   `applied` is `true` before proceeding.
3. **Batch linting (`lint_files`)**: Inspect every entry for `timedOut: true` or `notAnalyzedReason`, and check
   top-level `more: true` for incomplete batches.
4. **Run configurations and overrides (`get_run_configurations` -> `execute_run_configuration` /
   `xdebug_start_debugger_session`)**: Launch either a saved `configurationName` OR a runnable `filePath` + 1-based
   `line` (never both). Pass `programArguments`, `workingDirectory`, or `envs` only when
   `supportsDynamicLaunchOverrides` is `true`, and pass a single whitespace string `" "` to clear a saved string
   override.
5. **Cross-language XDebugger (`xdebug_*`)**: The `xdebug_*` prefix is JetBrains' cross-language XDebugger API (JVM,
   Python, JS/TS, Go, PHP, Ruby, C/C++, Rust), not PHP-only. Set at least one breakpoint before calling
   `xdebug_start_debugger_session`. Pass `sessionId` on every call when multiple sessions are active.
   `xdebug_set_breakpoints` ID updates overwrite full state (pass all 6 required keys, as shown
   in [references/tools-reference.md](references/tools-reference.md)), and `xdebug_remove_breakpoints` requires `owner`
   (`"agent"` or `"user"`) per item.
6. **Changelists (`*_changelist`)**: When creating a changelist with `activate: true`, record `previousActiveChangeList`
   so you can restore it later. Switch away from an active changelist before calling `delete_changelist`.
7. **Specify (`spec_report_status` / `spec_specify_finished`)**: Call `spec_specify_finished` directly (never wrap
   inside `execute_tool`). In `spec_report_status`, pass `"fileProblems": []` inside every `checks` item (required by
   JSON Schema, as shown in [references/tools-reference.md](references/tools-reference.md)).

> [!CAUTION]
> Never reuse a cached `frameIndex` or `path` token after `RESUME`, `STEP_*`, `xdebug_run_to_line`, or any pause
transition, because stale handles fail or read the wrong stack frame. Re-fetch `xdebug_get_stack` and
`xdebug_get_frame_values` at each new pause, and clear `isCaptureThreadDump` or remove agent-owned breakpoints before
ending the session.

---

## 4. On-Demand Reference Router

Load only the reference file that matches your task domain:

| Reference File                                                 | Scope                | Read When                                                                                                                                                                                          |
|----------------------------------------------------------------|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [references/tools-reference.md](references/tools-reference.md) | Core nested schemas  | Constructing nested JSON for `search_structural`, `rename_refactoring`, `xdebug_set_breakpoints`, `xdebug_remove_breakpoints`, `xdebug_control_session`, launch overrides, or `spec_report_status` |
| [references/jvm.md](references/jvm.md)                         | JVM (Java & Kotlin)  | Converting Java to Kotlin, capturing JVM or coroutine thread dumps, setting JVM exception or method breakpoints, or finding heap leaks and GC roots                                                |
| [references/go.md](references/go.md)                           | GoLand profiler      | Launching GoLand profiler configurations, recording CPU profiles, capturing snapshots, or diagnosing hot Go functions and call paths                                                               |
| [references/python.md](references/python.md)                   | PyCharm Python       | Discovering which Python interpreter (`venv`, `conda`, `uv`, `poetry`) and package manager a PyCharm module uses, or configuring an unconfigured module interpreter                                |
| [references/php.md](references/php.md)                         | PhpStorm PHP         | Inspecting PhpStorm PHP language levels or remote interpreters, querying indexed `composer.lock` dependencies, or loading PHP Structural Search templates                                          |
| [references/sql.md](references/sql.md)                         | Database & SQL       | Managing IDE data sources, introspecting live database schemas, previewing tables, executing SQL or cross-DB DuckDB joins, or exporting/importing tabular data                                     |
| [references/native.md](references/native.md)                   | CLion & GDB/LLDB/DAP | Managing CMake profiles or reloading CMake roots in CLion, or inspecting registers, memory, disassembly, and hardware watchpoints in paused GDB, LLDB, or DAP sessions                             |
