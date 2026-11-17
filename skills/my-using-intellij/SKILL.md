---
name: my-using-intellij
description: >-
  Interact with the active IntelliJ IDE MCP server (`intellij` or `jetbrains_air_ide`)
  while prioritizing default agent tools (`read_file`, `edit_file`, `write_file`,
  and shell `run_command`) first. Activate this skill when escalating to IDE PSI
  navigation, Call Hierarchy, Structural Search, safe rename, inspections, incremental
  builds, saved run configurations, coverage, changelists, multi-language debugging,
  or language-specific IDE reference guides (JVM, Go, Python, PHP, SQL, CMake/native).
---

# Using the Active IntelliJ IDE MCP

Use your built-in agent tools first for plain file reads, edits, text search, and shell runs. Escalate to the `intellij` (or `jetbrains_air_ide`) MCP server only when IDE semantic analysis, project indexes, code style, run configurations, databases, or live debuggers provide capabilities that default tools cannot match.

This skill covers all **118** currently discovered IntelliJ MCP tools (**59** core tools below, plus language and runtime tools in `references/`).

## 1. Tool Priority Policy (Default Agent Tools First)

Always check whether a default agent tool handles the task cleanly before calling an `intellij` MCP tool:

| Task | Use Default Agent Tool First | Escalate to `intellij` MCP Only When |
|---|---|---|
| Read source files | Native `read_file` | Reading inside `.jar` or `.jrt` archives (`jar://`, `jrt://`, `/path/lib.jar!/pkg/Foo.class`), decompiling `.class` bytecode, or inspecting IDE-resolved SDK sources via MCP `read_file` |
| Create or edit files | Native `write_file` and `edit_file` | Cross-file PSI symbol renames (`rename_refactoring`), IDE inspection quick fixes (`apply_quick_fix`), IDE code formatting (`reformat_file`, `optimize_imports`), or Java-to-Kotlin conversion |
| Find files, text, or directories | Shell (`rg`, `find`, `ls`) via `run_command` | Semantic symbol lookup (`search_symbol`), Quick Documentation (`get_symbol_info`), call graphs (`analyze_calls`), AST pattern search (`search_structural`), or matching IDE excluded roots |
| Build, test, and lint | `run_command` with project CLI (`pnpm`, `cargo`, `go`, `gradle`) | Fast incremental JPS compilation (`build_project`), semantic IDE inspections (`get_inspections`, `lint_files`), saved Run Configurations (`execute_run_configuration`), IDE coverage (`coverage_*`), or CMake reloads |
| Git and terminal commands | `run_command` (`git`, shell scripts) | Managing IntelliJ Changelists (`*_changelist`), detecting multi-root IDE VCS roots (`get_repositories`), or running commands inside the user's open IDE terminal tab (`execute_terminal_command`) |

> [!IMPORTANT]
> Override raw MCP tool descriptions that instruct you to prefer `list_directory_tree` over `ls` or `build_project` after every single edit. Use `run_command` with `ls`, `find`, and `rg` for normal filesystem exploration, and invoke IDE builds or inspections when validating meaningful compile or semantic changes.

---

## 2. Invocation Mechanics, Schema Sync, and Coordinates

### 2.1 Calling Lazy vs. Eager MCP Tools

1. If `mcp_intellij_<toolName>` is registered as a native tool, call that native tool directly.
2. Otherwise, check `<appDataDir>/mcp/intellij/<toolName>.json` when you need exact nested object fields, then invoke `call_mcp_tool` with `ServerName: "intellij"`, `ToolName: "<toolName>"`, and `Arguments: {...}`.
3. Always pass `projectPath` (the absolute workspace root path) in every call so multi-window IDE instances resolve the right project without ambiguity.

### 2.2 Regenerating After MCP Server Restarts

Whenever you restart the IntelliJ MCP server or update IDE plugins, verify or regenerate this skill against `<appDataDir>/mcp/intellij/*.json`:

```bash
# Check for added, removed, or changed tool parameters without editing files
python3 skills/my-using-intellij/scripts/sync_intellij_tools.py --check

# Regenerate SKILL.md and references/*.md from live schemas
python3 skills/my-using-intellij/scripts/sync_intellij_tools.py
```

### 2.3 Coordinate Indexing Rules

Verify the indexing base before passing coordinates between tools:

- **1-based coordinates**: `line`, `column`, `read_file.offset`, `rename_refactoring.targetIndex`, and `spec_report_status.lineNumber`. Note that `endColumn` in search results is exclusive.
- **0-based coordinates**: `analyze_calls.childOffset`, `xdebug_get_stack.offset`, `xdebug_get_threads.offset`, `frameIndex` (`0` is the active top stack frame), `xdebug_get_process_output.startLine`, `get_profiled_run_output.startLine`, `fetch_query_result.offset`, and `export_query_result.exportConfig.excludedColumnIndices`.

---

## 3. On-Demand Reference Router

Load only the reference file that matches your task domain:

| Reference File | Scope | Read When |
|---|---|---|
| `references/tools-reference.md` | Core nested schemas | Complex parameters for `search_structural`, `rename_refactoring`, `xdebug_set_breakpoints`, `xdebug_remove_breakpoints`, `xdebug_control_session`, launch overrides, and `spec_report_status` |
| `references/jvm.md` | 10 tools | Converting Java to Kotlin, capturing JVM or coroutine thread dumps, setting JVM exception or method breakpoints, or finding heap leaks and GC roots |
| `references/go.md` | 12 tools | Launching GoLand profiler configurations, recording CPU profiles, capturing snapshots, or diagnosing hot Go functions and call paths |
| `references/python.md` | 2 tools | Discovering which Python interpreter (`venv`, `conda`, `uv`, `poetry`) and package manager a PyCharm module uses, or configuring an unconfigured module interpreter |
| `references/php.md` | 3 tools | Inspecting PhpStorm PHP language levels or remote interpreters, querying indexed `composer.lock` dependencies, or loading PHP Structural Search templates |
| `references/sql.md` | 20 tools | Managing IDE data sources, introspecting live database schemas, previewing tables, executing SQL or cross-DB DuckDB joins, or exporting/importing tabular data |
| `references/native.md` | 12 tools | Managing CMake profiles or reloading CMake roots in CLion, or inspecting registers, memory, disassembly, and hardware watchpoints in paused GDB, LLDB, or DAP sessions |

---

## 4. Core Language-Agnostic Tool Catalog (59 Tools)

Parameters marked with `*` are required. Every tool also accepts optional `projectPath`.

### 4.1 Semantic Navigation, Call Hierarchy, and Search (7 Tools)

Prefer `rg` for literal text or regex searches. Use these IDE tools when PSI resolution, type signatures, call hierarchies, or AST structure matter:

- `analyze_calls` (`analysisKind`* [`INCOMING_CALLS`, `OUTGOING_CALLS`], `symbolFqn`*, `childOffset`, `depth`, `maxChildren`, `maxNodes`, `timeout`, `treePath` (array<string>)): Build an expandable call hierarchy (`INCOMING_CALLS` callers or `OUTGOING_CALLS` callees) across project sources and decompiled dependencies.
- `get_symbol_info` (`column`*, `filePath`*, `line`*): Retrieve Quick Documentation, resolved type signature, and declaration snippet at a 1-based position.
- `search_file` (`q`*, `includeExcluded`, `limit`, `paths` (array<string>)): Match project files by glob while respecting IDE content roots and excluded directories.
- `search_regex` (`q`*, `limit`, `paths` (array<string>)): Run regex search returning IDE-indexed 1-based match coordinates.
- `search_structural` (`fileType`*, `pattern`*, `constraints`, `directoryToSearch`, `maxResults`, `timeout`): Run Structural Search (SSR) using `$name$` pattern variables (such as `$a$->$b$()`), count quantifiers (`$a$+`, `$a$*`, `$a${2,5}`), and constraint filters keyed without `$`. See [references/tools-reference.md](references/tools-reference.md).
- `search_symbol` (`q`*, `include_external`, `limit`, `paths` (array<string>)): Find classes, methods, or fields by identifier fragment. If project results miss an SDK or library declaration, retry with `include_external: true`.
- `search_text` (`q`*, `limit`, `paths` (array<string>)): Run fast substring search returning IDE-indexed 1-based match coordinates for follow-up PSI calls.

**Call hierarchy workflow**:

1. If you do not know the exact `symbolFqn`, call `search_symbol` with the short name first.
2. Call `analyze_calls` with `symbolFqn` and `analysisKind` (`INCOMING_CALLS` or `OUTGOING_CALLS`).
3. If the tool reports ambiguity, repeat `analyze_calls` using one of the returned exact signatures as `symbolFqn`.
4. To expand a truncated branch, pass the node's exact `treePath` array and `childOffset`.

### 4.2 Files, Editor Tabs, and Directory Tree (5 Tools)

Prefer native `read_file`, `write_file`, and shell `ls` or `find`. Escalate to these IDE tools for open-editor context, library or bytecode reads, or IDE-filtered directory trees:

- `create_new_file` (`pathInProject`*, `overwrite`, `text`): Create a project file inside the IDE virtual file system. Prefer native `write_file` unless immediate IDE VFS creation is required.
- `get_all_open_file_paths` (optional `projectPath` only): List the active editor tab and other open editor paths relative to the project root.
- `list_directory_tree` (`directoryPath`*, `maxDepth`, `timeout`): Render a project-relative tree respecting IDE exclusions. Prefer shell `ls` or `find` unless IDE content-root exclusions matter.
- `open_file_in_editor` (`filePath`*): Open a file in the user's IDE editor tab.
- `read_file` (`file_path`*, `limit`, `offset`): Read up to 5000 lines (default 2000) from project files, `jar://` or `jrt://` URLs, archive entries (`/path/lib.jar!/pkg/Foo.class`), or decompiled `.class` binaries.

### 4.3 Refactoring, Formatting, and Patching (4 Tools)

Prefer native `edit_file` for normal code edits. Use IDE PSI refactoring and formatting tools to update cross-file references safely and match project code style:

- `apply_patch` (`input`, `patch`): Apply Codex `apply_patch` or unified Git diff text inside the IDE VFS. Prefer native `edit_file` for targeted edits.
- `optimize_imports` (`files`* (array<string>)): Remove unused imports and sort remaining imports according to IDE code style. This tool never adds missing imports.
- `reformat_file` (`files`* (array<string>), `optimizeImports`): Apply IDE code style to project-relative files and optionally remove and sort imports. Returns a unified diff (capped at 200 lines) or `ok`.
- `rename_refactoring` (`newName`*, `pathInProject`*, `symbolName`*, `applyAutomaticRenamers`, `column`, `contextSnippet`, `line`, `preview`, `targetIndex`): Rename a symbol and all PSI-resolved references across the project. Prefer `contextSnippet` over `line` and `column`, test widely used renames with `preview: true`, and verify `applied: true`. See [references/tools-reference.md](references/tools-reference.md).

**Safe rename workflow**:

1. Set `preview: true` first when renaming widely used public symbols.
2. Locate the target using `contextSnippet` (preferred, must match once in the file) or 1-based `line` and `column` from `search_symbol`.
3. If `ok` is `false` and `candidates` are returned, repeat the exact same call with all previous parameters plus 1-based `targetIndex`.
4. Confirm `applied` is `true` before proceeding.

### 4.4 Inspections, Quick Fixes, and Project Compilation (5 Tools)

Use project CLI builds and linters via `run_command` as the baseline. Escalate to these IDE tools for semantic inspections, automated quick fixes, and fast incremental IDE builds:

- `apply_quick_fix` (`column`*, `filePath`*, `line`*, `quickFixName`*): Re-run highlighting at the 1-based location and apply a matching `quickFixName` from `get_inspections`.
- `build_project` (`filesToRebuild` (array<string>), `rebuild`, `timeout`): Trigger an incremental build (or specific `filesToRebuild`, or full `rebuild: true`) and return structured compiler diagnostics.
- `get_file_problems` (`filePath`*, `errorsOnly`, `timeout`): Return file errors and warnings without quick-fix metadata.
- `get_inspections` (`filePath`*, `minSeverity`, `timeout`): Inspect one file and return problem descriptions, 1-based coordinates, and `quickFixes[].name` identifiers.
- `lint_files` (`files`* (array<string>), `min_severity`, `timeout`): Batch-lint modified files. Check each entry for `timedOut: true` or `notAnalyzedReason`, and check top-level `more: true` for incomplete batches.

### 4.5 Project Structure, Run Configurations, Coverage, and Terminal (9 Tools)

Use `run_command` for direct CLI runs. Escalate to these IDE tools for saved Run Configurations, gutter run points, IDE coverage collection, or running inside the user's live IDE terminal tab:

- `coverage_get_file` (`filePath`*, `runId`*): Retrieve line-by-line executable coverage ranges for one file.
- `coverage_get_stats` (`runId`*, `classNames` (array<string>), `filePaths` (array<string>), `packageNames` (array<string>)): Fetch batched coverage percentages for files, recursive packages, classes, or the whole run.
- `coverage_get_status` (`runId`*): Poll whether a pending coverage `runId` has finished loading.
- `coverage_run_configuration` (`classNames` (array<string>), `collectHitCounts`, `configurationName`, `coverageLoadTimeout`, `filePath`, `line`, `packageNames` (array<string>), `timeout`): Execute a saved configuration or gutter line with IDE coverage enabled and return a `runId`.
- `execute_run_configuration` (`configurationName`, `envs`, `filePath`, `line`, `programArguments`, `timeout`, `waitForExit`, `workingDirectory`): Launch a saved `configurationName` OR a runnable `filePath` plus 1-based `line` (never both). Pass launch overrides only when `supportsDynamicLaunchOverrides` is `true`, and pass a single space `" "` to clear a string override.
- `execute_terminal_command` (`command`*, `executeInShell`, `maxLinesCount`, `reuseExistingTerminalWindow`, `timeout`, `truncateMode` [`START`, `MIDDLE`, `END`, `NONE`]): Run a command inside the IDE integrated terminal (output capped at 2000 lines). Use `run_command` instead unless the command must reuse the user's live IDE terminal environment.
- `get_project_dependencies` (optional `projectPath` only): List JPS libraries and language-plugin dependencies (`package.json`, `deno.json`) with versions and scopes.
- `get_project_modules` (optional `projectPath` only): List IDE modules and their module types.
- `get_run_configurations` (`filePath`): Omit `filePath` to list saved IDE Run Configurations and check `supportsDynamicLaunchOverrides`. Pass `filePath` to discover runnable gutter `runPoints` inside one file.

### 4.6 Multi-Language Debugger (`xdebug_*` Core) (16 Tools)

The `xdebug_*` prefix is JetBrains' cross-language XDebugger API for JVM, Python, JavaScript, TypeScript, Go, PHP, Ruby, C, C++, and Rust. It is not limited to PHP Xdebug. Low-level register, memory, disassembly, and watchpoint tools live in [references/native.md](references/native.md).

**Breakpoint management**:

- `xdebug_list_breakpoints` (`filePath`, `sessionId`): List breakpoints, attributes (`id`, `owner`, `enabled`, `hitCount`), and session `breakpointsMuted` state.
- `xdebug_set_breakpoints` (`breakpoints`* (array of objects)): Create or update 1 to 50 breakpoints or logpoints by `filePath` + 1-based `line` or `breakpointId`. Always pass all 6 required per-item keys because ID updates overwrite full state. See [references/tools-reference.md](references/tools-reference.md).
- `xdebug_remove_breakpoints` (`breakpoints`* (array of objects)): Remove 1 to 50 breakpoints by `breakpointId`, `filePath` + `line`, or `owner` (defaults to `"agent"`, preserving user breakpoints unless `owner: "user"` is passed).
- `xdebug_set_breakpoints_muted` (`muted`*, `sessionId`): Mute or unmute all breakpoints in a session while preserving each breakpoint's `enabled` state.

**Session lifecycle and execution control**:

- `xdebug_get_debugger_status` (`sessionId`): List active sessions and the 5 most recent stopped sessions. If multiple active sessions exist, pass `sessionId` in every follow-up call.
- `xdebug_start_debugger_session` (`configurationName`, `envs`, `filePath`, `graceWaitMs`, `line`, `programArguments`, `timeout`, `workingDirectory`): Set at least one breakpoint first, then start debugging a saved configuration or gutter run point. Check `supportsDynamicLaunchOverrides` before passing overrides.
- `xdebug_attach_to_process` (`pid`*, `debuggerKind`, `timeout`): Attach a debugger to a running local PID. If multiple debuggers match and `selection_required` returns, retry with an exact returned `debuggerKind`.
- `xdebug_control_session` (`action`* [`STEP_INTO`, `STEP_OVER`, `STEP_OUT`, `RESUME`, `PAUSE`, `STOP`, `WAIT_FOR_PAUSE`, `DRAIN_EVENTS`], `clearEventsAfterRead`, `eventsLimit`, `sessionId`, `timeout`): Control execution with `STEP_INTO`, `STEP_OVER`, `STEP_OUT`, `RESUME` (`timeout: 0` returns immediately), `PAUSE`, `STOP`, `WAIT_FOR_PAUSE`, or `DRAIN_EVENTS`. See [references/tools-reference.md](references/tools-reference.md).
- `xdebug_run_to_line` (`filePath`*, `line`*, `sessionId`, `timeout`): Resume a suspended session until execution reaches a 1-based source line.

**Stack, variables, expressions, and output inspection**:

- `xdebug_get_threads` (`limit`, `offset`, `sessionId`): List threads ordered by active thread first and descending stack depth.
- `xdebug_get_stack` (`limit`, `offset`, `sessionId`, `threadId`): Return stack frames with 0-based `index`, `file`, `line`, `isCurrent`, and `separatorAbove`. Pass the thread display name from `xdebug_get_threads` as `threadId`.
- `xdebug_get_frame_values` (`depth`, `frameIndex`, `sessionId`): Inspect locals, parameters, and fields in the paused stack frame (`+` marks expandable nodes).
- `xdebug_get_value_by_path` (`path`* (array<string>), `depth`, `frameIndex`, `sessionId`): Drill into nested properties using exact child node tokens from `xdebug_get_frame_values` (such as `["items", "[0]", "name"]`).
- `xdebug_evaluate_expression` (`expression`*, `depth`, `frameIndex`, `sessionId`): Evaluate a raw language expression in the paused frame without JSON-escaped quotes.
- `xdebug_set_variable` (`newValue`*, `path`* (array<string>), `frameIndex`, `sessionId`): Mutate a modifiable variable by `path` using a raw assignable language expression, then re-read to confirm.
- `xdebug_get_process_output` (`maxLines`, `sessionId`, `startLine`): Read captured stdout and stderr (up to 1,000,000 retained characters) using 0-based `startLine` and returned `endLine` for paging.

> [!CAUTION]
> Never reuse a cached `frameIndex` or `path` token after `RESUME`, `STEP_*`, `xdebug_run_to_line`, or any pause transition. Always re-fetch `xdebug_get_stack` and `xdebug_get_frame_values` at each new pause, and clear `isCaptureThreadDump` or remove agent-owned breakpoints when done.

### 4.7 VCS Roots and Changelists (7 Tools)

Prefer shell `git` via `run_command` for normal Git workflows. Use these tools for multi-repository IDE roots or when isolating edits inside IntelliJ Changelists:

- `create_changelist` (`name`*, `activate`, `comment`): Create or fetch a changelist. If `activate: true`, record `previousActiveChangeList` from the result so you can restore it later.
- `delete_changelist` (`name`*): Delete an inactive changelist (pending changes move to the active changelist). If the target is active, switch active changelists first.
- `get_changelists` (`includeFiles`, `maxFilesPerChangelist`): List pending changelists, active state, and optional changed file paths.
- `get_repositories` (optional `projectPath` only): List all VCS root paths configured in the project.
- `git_status` (`includeIgnored`, `includeUntracked`, `limit`, `repositoryPathRelativeToProject`): Return porcelain status codes and summary counts per repository.
- `move_changes_to_changelist` (`changeListName`*, `files`* (array<string>), `comment`, `createIfMissing`): Move existing pending file changes into a target changelist.
- `set_active_changelist` (`name`*): Switch the active changelist for subsequent edits or restore `previousActiveChangeList`.

### 4.8 IDE Actions, Session Metadata, Specify, and Additional Core Tools (6 Tools)

Use these tools for IDE action invocation, JetBrains Air metadata, Specify reporting, and any newly added general IDE MCP tools:

- `air_set_session_title` (`title`*): Rename the current JetBrains Air session (at most 256 characters, metadata only).
- `execute_tool` (`command`*): Dynamic command-line wrapper that invokes another IDE MCP tool. Prefer direct `call_mcp_tool` calls unless a workflow requires `execute_tool`.
- `invoke_ide_action` (`actionId`*, `filePaths` (array<string>)): Trigger an IDE action programmatically, passing project-relative `filePaths` when selection context is required.
- `search_ide_actions` (`query`*, `includeGroups`, `limit`): Search IDE action IDs, names, and descriptions before invoking an action.
- `spec_report_status` (`lineNumber`*, `specPath`*, `status`* [`done`, `failed`], `text`*, `checks` (array of objects), `reason`): Record completion or failure and verification file anchors (`file#Lstart-Lend`) for one Specify checklist item. See [references/tools-reference.md](references/tools-reference.md).
- `spec_specify_finished` (`specPath`*): Signal Specify completion for a specification file via direct MCP call (never wrap inside `execute_tool`).
