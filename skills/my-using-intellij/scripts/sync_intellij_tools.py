#!/usr/bin/env python3
"""Synchronize my-using-intellij SKILL.md and references/ from live IntelliJ MCP schemas.

Why this script exists:
    IntelliJ IDE restarts and plugin updates add, remove, or change MCP tool
    schemas under ``~/.gemini/antigravity/mcp/intellij/*.json``. Hand-maintaining
    110+ tool entries drifts quickly and risks re-introducing raw MCP directives
    that tell agents to bypass native file or shell tools.

How it works:
    1. Load every ``*.json`` schema from ``--mcp-dir`` and extract required and
       optional parameters, enum choices, and nested object schemas.
    2. Partition tools into core IDE tools (``SKILL.md``) and language/runtime
       reference guides (``references/jvm.md``, ``go.md``, ``python.md``,
       ``php.md``, ``sql.md``, ``native.md``) plus ``references/tools-reference.md``.
    3. Combine curated workflow notes and safety gates with live-extracted
       parameter lists, and classify + sanitize any newly discovered tools
       against ``my-writing-docs`` Mode 2 rules.
    4. Run built-in coverage and Mode 2 style checks before writing files (or
       compare against disk without modifying anything under ``--check``).
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import sys
from typing import Any


UNIVERSAL_PARAM = "projectPath"
MAX_INLINE_ENUM = 8

LANGUAGE_ORDER = ("jvm", "go", "python", "php", "sql", "native")

CORE_SECTIONS: list[tuple[str, str, str]] = [
    (
        "4.1",
        "Semantic Navigation, Call Hierarchy, and Search",
        "Prefer `rg` for literal text or regex searches. Use these IDE tools when PSI resolution, type signatures, call hierarchies, or AST structure matter:",
    ),
    (
        "4.2",
        "Files, Editor Tabs, and Directory Tree",
        "Prefer native `read_file`, `write_file`, and shell `ls` or `find`. Escalate to these IDE tools for open-editor context, library or bytecode reads, or IDE-filtered directory trees:",
    ),
    (
        "4.3",
        "Refactoring, Formatting, and Patching",
        "Prefer native `edit_file` for normal code edits. Use IDE PSI refactoring and formatting tools to update cross-file references safely and match project code style:",
    ),
    (
        "4.4",
        "Inspections, Quick Fixes, and Project Compilation",
        "Use project CLI builds and linters via `run_command` as the baseline. Escalate to these IDE tools for semantic inspections, automated quick fixes, and fast incremental IDE builds:",
    ),
    (
        "4.5",
        "Project Structure, Run Configurations, Coverage, and Terminal",
        "Use `run_command` for direct CLI runs. Escalate to these IDE tools for saved Run Configurations, gutter run points, IDE coverage collection, or running inside the user's live IDE terminal tab:",
    ),
    (
        "4.6",
        "Multi-Language Debugger (`xdebug_*` Core)",
        "The `xdebug_*` prefix is JetBrains' cross-language XDebugger API for JVM, Python, JavaScript, TypeScript, Go, PHP, Ruby, C, C++, and Rust. It is not limited to PHP Xdebug. Low-level register, memory, disassembly, and watchpoint tools live in [references/native.md](references/native.md).",
    ),
    (
        "4.7",
        "VCS Roots and Changelists",
        "Prefer shell `git` via `run_command` for normal Git workflows. Use these tools for multi-repository IDE roots or when isolating edits inside IntelliJ Changelists:",
    ),
    (
        "4.8",
        "IDE Actions, Session Metadata, Specify, and Additional Core Tools",
        "Use these tools for IDE action invocation, JetBrains Air metadata, Specify reporting, and any newly added general IDE MCP tools:",
    ),
]


@dataclass(frozen=True)
class ToolSchema:
    name: str
    description: str
    params: tuple[tuple[str, bool, str], ...]
    nested_objects: dict[str, dict[str, Any]]
    raw_schema: dict[str, Any]


@dataclass(frozen=True)
class CuratedTool:
    bucket: str  # "core:<section_id>" or language key ("jvm", "go", ...)
    summary: str


CURATED_TOOLS: dict[str, CuratedTool] = {
    # --- Core 4.1: Semantic Navigation, Call Hierarchy, and Search (7) ---
    "search_symbol": CuratedTool(
        "core:4.1",
        "Find classes, methods, or fields by identifier fragment. If project results miss an SDK or library declaration, retry with `include_external: true`.",
    ),
    "get_symbol_info": CuratedTool(
        "core:4.1",
        "Retrieve Quick Documentation, resolved type signature, and declaration snippet at a 1-based position.",
    ),
    "analyze_calls": CuratedTool(
        "core:4.1",
        "Build an expandable call hierarchy (`INCOMING_CALLS` callers or `OUTGOING_CALLS` callees) across project sources and decompiled dependencies.",
    ),
    "search_structural": CuratedTool(
        "core:4.1",
        "Run Structural Search (SSR) using `$name$` pattern variables (such as `$a$->$b$()`), count quantifiers (`$a$+`, `$a$*`, `$a${2,5}`), and constraint filters keyed without `$`. See [references/tools-reference.md](references/tools-reference.md).",
    ),
    "search_file": CuratedTool(
        "core:4.1",
        "Match project files by glob while respecting IDE content roots and excluded directories.",
    ),
    "search_text": CuratedTool(
        "core:4.1",
        "Run fast substring search returning IDE-indexed 1-based match coordinates for follow-up PSI calls.",
    ),
    "search_regex": CuratedTool(
        "core:4.1",
        "Run regex search returning IDE-indexed 1-based match coordinates.",
    ),
    # --- Core 4.2: Files, Editor Tabs, and Directory Tree (5) ---
    "get_all_open_file_paths": CuratedTool(
        "core:4.2",
        "List the active editor tab and other open editor paths relative to the project root.",
    ),
    "open_file_in_editor": CuratedTool(
        "core:4.2",
        "Open a file in the user's IDE editor tab.",
    ),
    "read_file": CuratedTool(
        "core:4.2",
        "Read up to 5000 lines (default 2000) from project files, `jar://` or `jrt://` URLs, archive entries (`/path/lib.jar!/pkg/Foo.class`), or decompiled `.class` binaries.",
    ),
    "list_directory_tree": CuratedTool(
        "core:4.2",
        "Render a project-relative tree respecting IDE exclusions. Prefer shell `ls` or `find` unless IDE content-root exclusions matter.",
    ),
    "create_new_file": CuratedTool(
        "core:4.2",
        "Create a project file inside the IDE virtual file system. Prefer native `write_file` unless immediate IDE VFS creation is required.",
    ),
    # --- Core 4.3: Refactoring, Formatting, and Patching (4) ---
    "rename_refactoring": CuratedTool(
        "core:4.3",
        "Rename a symbol and all PSI-resolved references across the project. Prefer `contextSnippet` over `line` and `column`, test widely used renames with `preview: true`, and verify `applied: true`. See [references/tools-reference.md](references/tools-reference.md).",
    ),
    "reformat_file": CuratedTool(
        "core:4.3",
        "Apply IDE code style to project-relative files and optionally remove and sort imports. Returns a unified diff (capped at 200 lines) or `ok`.",
    ),
    "optimize_imports": CuratedTool(
        "core:4.3",
        "Remove unused imports and sort remaining imports according to IDE code style. This tool never adds missing imports.",
    ),
    "apply_patch": CuratedTool(
        "core:4.3",
        "Apply Codex `apply_patch` or unified Git diff text inside the IDE VFS. Prefer native `edit_file` for targeted edits.",
    ),
    # --- Core 4.4: Inspections, Quick Fixes, and Project Compilation (5) ---
    "get_inspections": CuratedTool(
        "core:4.4",
        "Inspect one file and return problem descriptions, 1-based coordinates, and `quickFixes[].name` identifiers.",
    ),
    "apply_quick_fix": CuratedTool(
        "core:4.4",
        "Re-run highlighting at the 1-based location and apply a matching `quickFixName` from `get_inspections`.",
    ),
    "get_file_problems": CuratedTool(
        "core:4.4",
        "Return file errors and warnings without quick-fix metadata.",
    ),
    "lint_files": CuratedTool(
        "core:4.4",
        "Batch-lint modified files. Check each entry for `timedOut: true` or `notAnalyzedReason`, and check top-level `more: true` for incomplete batches.",
    ),
    "build_project": CuratedTool(
        "core:4.4",
        "Trigger an incremental build (or specific `filesToRebuild`, or full `rebuild: true`) and return structured compiler diagnostics.",
    ),
    # --- Core 4.5: Project Structure, Run Configurations, Coverage, and Terminal (9) ---
    "get_project_modules": CuratedTool(
        "core:4.5",
        "List IDE modules and their module types.",
    ),
    "get_project_dependencies": CuratedTool(
        "core:4.5",
        "List JPS libraries and language-plugin dependencies (`package.json`, `deno.json`) with versions and scopes.",
    ),
    "get_run_configurations": CuratedTool(
        "core:4.5",
        "Omit `filePath` to list saved IDE Run Configurations and check `supportsDynamicLaunchOverrides`. Pass `filePath` to discover runnable gutter `runPoints` inside one file.",
    ),
    "execute_run_configuration": CuratedTool(
        "core:4.5",
        "Launch a saved `configurationName` OR a runnable `filePath` plus 1-based `line` (never both). Pass launch overrides only when `supportsDynamicLaunchOverrides` is `true`, and pass a single space `\" \"` to clear a string override.",
    ),
    "coverage_run_configuration": CuratedTool(
        "core:4.5",
        "Execute a saved configuration or gutter line with IDE coverage enabled and return a `runId`.",
    ),
    "coverage_get_status": CuratedTool(
        "core:4.5",
        "Poll whether a pending coverage `runId` has finished loading.",
    ),
    "coverage_get_stats": CuratedTool(
        "core:4.5",
        "Fetch batched coverage percentages for files, recursive packages, classes, or the whole run.",
    ),
    "coverage_get_file": CuratedTool(
        "core:4.5",
        "Retrieve line-by-line executable coverage ranges for one file.",
    ),
    "execute_terminal_command": CuratedTool(
        "core:4.5",
        "Run a command inside the IDE integrated terminal (output capped at 2000 lines). Use `run_command` instead unless the command must reuse the user's live IDE terminal environment.",
    ),
    # --- Core 4.6: Multi-Language Debugger (16) ---
    "xdebug_list_breakpoints": CuratedTool(
        "core:4.6",
        "List breakpoints, attributes (`id`, `owner`, `enabled`, `hitCount`), and session `breakpointsMuted` state.",
    ),
    "xdebug_set_breakpoints": CuratedTool(
        "core:4.6",
        "Create or update 1 to 50 breakpoints or logpoints by `filePath` + 1-based `line` or `breakpointId`. Always pass all 6 required per-item keys because ID updates overwrite full state. See [references/tools-reference.md](references/tools-reference.md).",
    ),
    "xdebug_remove_breakpoints": CuratedTool(
        "core:4.6",
        "Remove 1 to 50 breakpoints by `breakpointId`, `filePath` + `line`, or `owner` (defaults to `\"agent\"`, preserving user breakpoints unless `owner: \"user\"` is passed).",
    ),
    "xdebug_set_breakpoints_muted": CuratedTool(
        "core:4.6",
        "Mute or unmute all breakpoints in a session while preserving each breakpoint's `enabled` state.",
    ),
    "xdebug_get_debugger_status": CuratedTool(
        "core:4.6",
        "List active sessions and the 5 most recent stopped sessions. If multiple active sessions exist, pass `sessionId` in every follow-up call.",
    ),
    "xdebug_start_debugger_session": CuratedTool(
        "core:4.6",
        "Set at least one breakpoint first, then start debugging a saved configuration or gutter run point. Check `supportsDynamicLaunchOverrides` before passing overrides.",
    ),
    "xdebug_attach_to_process": CuratedTool(
        "core:4.6",
        "Attach a debugger to a running local PID. If multiple debuggers match and `selection_required` returns, retry with an exact returned `debuggerKind`.",
    ),
    "xdebug_control_session": CuratedTool(
        "core:4.6",
        "Control execution with `STEP_INTO`, `STEP_OVER`, `STEP_OUT`, `RESUME` (`timeout: 0` returns immediately), `PAUSE`, `STOP`, `WAIT_FOR_PAUSE`, or `DRAIN_EVENTS`. See [references/tools-reference.md](references/tools-reference.md).",
    ),
    "xdebug_run_to_line": CuratedTool(
        "core:4.6",
        "Resume a suspended session until execution reaches a 1-based source line.",
    ),
    "xdebug_get_threads": CuratedTool(
        "core:4.6",
        "List threads ordered by active thread first and descending stack depth.",
    ),
    "xdebug_get_stack": CuratedTool(
        "core:4.6",
        "Return stack frames with 0-based `index`, `file`, `line`, `isCurrent`, and `separatorAbove`. Pass the thread display name from `xdebug_get_threads` as `threadId`.",
    ),
    "xdebug_get_frame_values": CuratedTool(
        "core:4.6",
        "Inspect locals, parameters, and fields in the paused stack frame (`+` marks expandable nodes).",
    ),
    "xdebug_get_value_by_path": CuratedTool(
        "core:4.6",
        "Drill into nested properties using exact child node tokens from `xdebug_get_frame_values` (such as `[\"items\", \"[0]\", \"name\"]`).",
    ),
    "xdebug_evaluate_expression": CuratedTool(
        "core:4.6",
        "Evaluate a raw language expression in the paused frame without JSON-escaped quotes.",
    ),
    "xdebug_set_variable": CuratedTool(
        "core:4.6",
        "Mutate a modifiable variable by `path` using a raw assignable language expression, then re-read to confirm.",
    ),
    "xdebug_get_process_output": CuratedTool(
        "core:4.6",
        "Read captured stdout and stderr (up to 1,000,000 retained characters) using 0-based `startLine` and returned `endLine` for paging.",
    ),
    # --- Core 4.7: VCS Roots and Changelists (7) ---
    "get_repositories": CuratedTool(
        "core:4.7",
        "List all VCS root paths configured in the project.",
    ),
    "git_status": CuratedTool(
        "core:4.7",
        "Return porcelain status codes and summary counts per repository.",
    ),
    "get_changelists": CuratedTool(
        "core:4.7",
        "List pending changelists, active state, and optional changed file paths.",
    ),
    "create_changelist": CuratedTool(
        "core:4.7",
        "Create or fetch a changelist. If `activate: true`, record `previousActiveChangeList` from the result so you can restore it later.",
    ),
    "set_active_changelist": CuratedTool(
        "core:4.7",
        "Switch the active changelist for subsequent edits or restore `previousActiveChangeList`.",
    ),
    "move_changes_to_changelist": CuratedTool(
        "core:4.7",
        "Move existing pending file changes into a target changelist.",
    ),
    "delete_changelist": CuratedTool(
        "core:4.7",
        "Delete an inactive changelist (pending changes move to the active changelist). If the target is active, switch active changelists first.",
    ),
    # --- Core 4.8: IDE Actions, Session Metadata, and Specify (6) ---
    "search_ide_actions": CuratedTool(
        "core:4.8",
        "Search IDE action IDs, names, and descriptions before invoking an action.",
    ),
    "invoke_ide_action": CuratedTool(
        "core:4.8",
        "Trigger an IDE action programmatically, passing project-relative `filePaths` when selection context is required.",
    ),
    "execute_tool": CuratedTool(
        "core:4.8",
        "Dynamic command-line wrapper that invokes another IDE MCP tool. Prefer direct `call_mcp_tool` calls unless a workflow requires `execute_tool`.",
    ),
    "air_set_session_title": CuratedTool(
        "core:4.8",
        "Rename the current JetBrains Air session (at most 256 characters, metadata only).",
    ),
    "spec_report_status": CuratedTool(
        "core:4.8",
        "Record completion or failure and verification file anchors (`file#Lstart-Lend`) for one Specify checklist item. See [references/tools-reference.md](references/tools-reference.md).",
    ),
    "spec_specify_finished": CuratedTool(
        "core:4.8",
        "Signal Specify completion for a specification file via direct MCP call (never wrap inside `execute_tool`).",
    ),
    # --- Language: JVM (10) ---
    "convert_java_to_kotlin": CuratedTool(
        "jvm",
        "Convert existing `.java` files inside one Kotlin-configured module into `.kt` files using IntelliJ type inference, nullability inference, and import fixes.",
    ),
    "jvm_debug_list_exception_breakpoints": CuratedTool(
        "jvm",
        "List all JVM exception breakpoints with `exceptionClass`, `notifyCaught`, `notifyUncaught`, `isDefault`, `id`, `owner`, `enabled`, `condition`, logging flags, and `suspendPolicy`.",
    ),
    "jvm_debug_set_exception_breakpoint": CuratedTool(
        "jvm",
        "Create or update a JVM exception breakpoint for a fully qualified class (`java.lang.IllegalStateException` or `java.lang.Throwable`). At least one of `notifyCaught` or `notifyUncaught` must be `true`.",
    ),
    "jvm_debug_list_method_breakpoints": CuratedTool(
        "jvm",
        "List JVM method breakpoints targeted by class and method pattern. Method breakpoints placed on concrete source lines appear in `xdebug_list_breakpoints` instead.",
    ),
    "jvm_debug_set_method_breakpoint": CuratedTool(
        "jvm",
        "Watch method entry (`watchEntry`, default `true`) or exit (`watchExit`, default `false`) for class and method patterns (`com.example.*`, `get*`). Set `suspendPolicy: \"NONE\"` with `logExpression` for non-suspending parameter logging.",
    ),
    "jvm_debug_get_thread_dump": CuratedTool(
        "jvm",
        "Capture 1 to 10 thread dumps (`count * interval <= 300000` milliseconds) from a running or suspended JVM session and write UTF-8 dumps to temporary files (33 retained). Keep `includeExtended: true` for virtual threads and Kotlin coroutines.",
    ),
    "jvm_debug_memory_class_snapshot": CuratedTool(
        "jvm",
        "Capture baseline JDI instance counts (without `baselineId`) or diff instance count deltas (with `baselineId`). Filter noisy packages with `includePackagePrefixes` and force `System.gc()` via `gcBefore: true`.",
    ),
    "jvm_debug_memory_get_instances": CuratedTool(
        "jvm",
        "Sample concrete object `@handle` references and static/instance `fieldHints` for a `typeHandle` from `jvm_debug_memory_class_snapshot` (default `limit: 5`, max `50`).",
    ),
    "jvm_debug_memory_read_fields": CuratedTool(
        "jvm",
        "Read direct or dot-separated fields on selected `@handle` instances or static fields on `typeHandle`, optionally grouped via `groupBy`.",
    ),
    "jvm_debug_memory_closest_gc_roots": CuratedTool(
        "jvm",
        "Build shortest `target -> referrer -> GC root` retention trees for a few suspicious `@handle` objects. Requires a local run configuration with **Attach memory agent** enabled (unavailable on remote debug).",
    ),
    # --- Language: Go (12) ---
    "run_with_profiler": CuratedTool(
        "go",
        "Launch an exact saved Go run configuration with profiling enabled and return a `session` ID plus advertised profile kinds and sample types.",
    ),
    "list_profiled_runs": CuratedTool(
        "go",
        "List active and recently stopped Go profiler sessions, including runs launched manually from the IDE UI.",
    ),
    "get_profiled_run_output": CuratedTool(
        "go",
        "Read captured program output (1 to 1000 lines) starting at a 0-based `startLine` index (omit for earliest retained line, then pass `endLine` to page).",
    ),
    "stop_profiled_run": CuratedTool(
        "go",
        "Terminate a profiler session launched by `run_with_profiler`.",
    ),
    "start_cpu_recording": CuratedTool(
        "go",
        "Start on-demand CPU recording for an active profiled `session`.",
    ),
    "stop_cpu_recording": CuratedTool(
        "go",
        "Stop CPU recording, save the `.pprof` file, and return the file path with its default `profile_summary`.",
    ),
    "take_profile": CuratedTool(
        "go",
        "Capture an advertised profile `kind` (`cpu` requires `duration` 1 to 300 seconds, while snapshot kinds omit `duration`) and return the saved `.pprof` path plus summary.",
    ),
    "list_profiles": CuratedTool(
        "go",
        "List `.pprof` profiles (1 to 200 rows, default 5). Pass `session` when `scope` is `\"session\"`. Open tabs list the selected profile first, and other scopes sort newest first.",
    ),
    "profile_summary": CuratedTool(
        "go",
        "Return `.pprof` totals, CPU use, and top 5 hot functions with lines and call paths. Call directly when inspecting another file or switching `sampleType` (`alloc_space`, `inuse_space`).",
    ),
    "profile_top_frames": CuratedTool(
        "go",
        "Rank functions in a `.pprof` file by `self` (default) or `cumulative` cost, optionally narrowed under a substring `root`.",
    ),
    "profile_call_paths": CuratedTool(
        "go",
        "List ranked caller stacks reaching any function matching `target` (depth 1 to 64, limit 1 to 50) to find upstream callers responsible for hot paths.",
    ),
    "profile_source_lines": CuratedTool(
        "go",
        "Rank expensive source lines across functions matching `function` (1 to 200 lines). Compare line numbers carefully if files changed after the profiled build.",
    ),
    # --- Language: Python (2) ---
    "get_python_environment": CuratedTool(
        "python",
        "Report the configured Python interpreter version, environment type (`venv`, `conda`, `system`), executable path, and package manager for `filePath` without guessing system Python. If `noInterpreterConfigured` is non-null, follow its guidance and call `configure_python_interpreter` when instructed.",
    ),
    "configure_python_interpreter": CuratedTool(
        "python",
        "Configure a Python interpreter for the module containing `filePath` using PyCharm detection (existing `.venv` or fresh `uv`, `poetry`, `hatch`, or `pipenv` environment). Call only after `get_python_environment` reports no configured interpreter. This tool does not install missing environment tools.",
    ),
    # --- Language: PHP (3) ---
    "get_php_project_config": CuratedTool(
        "php",
        "Read PhpStorm's configured PHP language level, interpreter metadata (local, Docker, or SSH), exact PHP runtime version, loaded extensions, `php.ini` path, and active debuggers without disk or network calls.",
    ),
    "get_composer_dependencies": CuratedTool(
        "php",
        "Return installed Composer packages and exact versions from indexed `composer.lock` across the project and monorepo sub-projects, optionally filtered by case-insensitive glob `nameFilter`.",
    ),
    "get_structural_patterns": CuratedTool(
        "php",
        "List verified predefined PHP Structural Search (SSR) templates by category (`General`, `Expressions`, `Suspicious`) before calling `search_structural` with `fileType: \"PHP\"`.",
    ),
    # --- Language: SQL (20) ---
    "list_database_connections": CuratedTool(
        "sql",
        "Call this tool first to obtain exact `connectionId` and `name` values. Inspect `isDDL` and `readOnly` before calling DBMS-only or write tools.",
    ),
    "create_database_connection": CuratedTool(
        "sql",
        "Create a data source using a predefined DBMS driver and an assembled JDBC URL. Never guess `localhost` or default ports. Set `needToCheckDs: false` for batch setup or `true` to probe immediately.",
    ),
    "edit_database_connection": CuratedTool(
        "sql",
        "Update a non-DDL connection's driver and JDBC URL while keeping its `name` (cannot rename connections). Pass `driverName` as `dbms` when keeping the driver, and stop after 2 sequential failures without new user input.",
    ),
    "test_database_connection": CuratedTool(
        "sql",
        "Verify driver, credentials, and network reachability for one non-DDL `connectionId`.",
    ),
    "list_database_schemas": CuratedTool(
        "sql",
        "List schemas and `isIntrospected` flags. Preserve exact `databaseName` values (even `\"\"`). If empty, call `test_database_connection` to distinguish connection failure from an empty database.",
    ),
    "introspect_schema": CuratedTool(
        "sql",
        "Load tables, columns, and indexes into the IDE model when `isIntrospected` is `false`. Call once per schema rather than before every query.",
    ),
    "list_schema_object_kinds": CuratedTool(
        "sql",
        "Retrieve hyphenated schema object kind codes (`table`, `view`, `materialized-view`, `foreign-table`, `routine`).",
    ),
    "list_schema_objects": CuratedTool(
        "sql",
        "List database objects inside an introspected schema, optionally filtered by `kind`.",
    ),
    "get_database_object_description": CuratedTool(
        "sql",
        "Retrieve columns, types, keys, and indexes as hierarchical text (returns an empty `definitions` list when missing or unintrospected).",
    ),
    "preview_table_data": CuratedTool(
        "sql",
        "Preview CSV rows using dialect-specific paging (`maxRowCount` default `10`, must be `>= 1`) without writing SQL. Requires an introspected schema and non-DDL connection.",
    ),
    "execute_sql_query": CuratedTool(
        "sql",
        "Run one SQL statement on one non-DDL connection (10-row CSV cap, returns `resultSetId` or `\"Query executed successfully\"`). Format each major clause (`SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY`) on its own indented line.",
    ),
    "execute_cross_db_query": CuratedTool(
        "sql",
        "Join data across 2 or more IDE connections using DuckDB SQL and `dg_cross('<connection name>', '<read-only SQL>' [, search_path := '<db>.<schema>'])` with doubled single quotes `''`. Push filters, aggregations, and limits inside `<query>`.",
    ),
    "fetch_query_result": CuratedTool(
        "sql",
        "Paginate additional CSV rows from an earlier `execute_sql_query`, `execute_cross_db_query`, or `preview_table_data` `resultSetId` starting at 0-based `offset`.",
    ),
    "list_recent_sql_queries": CuratedTool(
        "sql",
        "Inspect recent and currently running SQL queries (`sessionId`, status, elapsed time, SQL text) on a non-DDL connection.",
    ),
    "cancel_sql_query": CuratedTool(
        "sql",
        "Cancel a stalled or long-running SQL query using its integer `sessionId` from `list_recent_sql_queries`.",
    ),
    "list_data_extractors": CuratedTool(
        "sql",
        "Discover valid `extractorName` values (CSV, JSON, XLSX, SQL inserts, Groovy) and each extractor's `applicableOptions` before calling `export_query_result`.",
    ),
    "export_query_result": CuratedTool(
        "sql",
        "Export a `resultSetId` using `extractorName` and `exportConfig` (`{}` for defaults, omit extension from `fileName`). Test with `preview: true` first, then run `preview: false` for the full stream.",
    ),
    "inspect_import_file": CuratedTool(
        "sql",
        "Inspect CSV, TSV, delimited text, JSON, XLS, XLSX, or Parquet files via absolute `source.filePath` without touching the database. Returns `resultSet.resultSetId` and repaired `resultSet.columns[].name` headers.",
    ),
    "inspect_import_query": CuratedTool(
        "sql",
        "Inspect columns and sample rows from a read-only `execute_sql_query` or `preview_table_data` `resultSetId` to prepare `import_data`.",
    ),
    "import_data": CuratedTool(
        "sql",
        "Import an inspected `resultSetId` into an existing target table using `columnMappings` from inspection (never runs DDL, asks `WRITE_DATA` consent after pre-validating `BLOCKER` mismatches).",
    ),
    # --- Language: Native (6 CMake + 6 GDB/LLDB/DAP = 12) ---
    "load_cmake": CuratedTool(
        "native",
        "Reload the CMake project and run CMake for every enabled profile (optionally switching to a different `projectRoot` directory containing `CMakeLists.txt`). Spawns external CMake processes.",
    ),
    "create_cmake_profile": CuratedTool(
        "native",
        "Add a new CMake profile (`buildType` defaults to `Debug`). Fails if `name` already exists. Persisted changes take effect only after `load_cmake`.",
    ),
    "update_cmake_profile": CuratedTool(
        "native",
        "Update selected fields of an existing CMake profile (persisted until `load_cmake`). Passing `environment` replaces all existing profile environment variables.",
    ),
    "enable_cmake_profiles": CuratedTool(
        "native",
        "Enable the listed CMake `names` (always pass a list of strings, optionally setting `disableOthers: true`). Persisted until `load_cmake`.",
    ),
    "disable_cmake_profiles": CuratedTool(
        "native",
        "Disable the listed CMake `names` (always pass a list of strings). Persisted until `load_cmake`.",
    ),
    "delete_cmake_profiles": CuratedTool(
        "native",
        "Remove the listed CMake `names` (always pass a list of strings). Persisted until `load_cmake`.",
    ),
    "xdebug_get_registers": CuratedTool(
        "native",
        "Read CPU registers grouped into target sets (`General Purpose`, `System`, `Floating Point`, `Other`, or `All`). Check `unmatched` and `truncated` (256-register cap), and prefer zero-padded `hexValue` for address math.",
    ),
    "xdebug_read_memory": CuratedTool(
        "native",
        "Atomically read `count` units (1 to 256) of `width` bytes (`1`, `2`, `4`, or `8`) from a `0x`-prefixed `address` (`byteOrder` defaults to `LITTLE`). Fails cleanly if any byte in range is unmapped.",
    ),
    "xdebug_disassemble": CuratedTool(
        "native",
        "Disassemble 1 to 256 instructions from a `0x`-prefixed `address` (or the frame program counter when omitted). Check `current`, missing `symbol` / `symbolOffset` (corrupted or unsymbolized addresses), and `nextAddress` when `truncated` is `true`.",
    ),
    "xdebug_set_data_breakpoint": CuratedTool(
        "native",
        "Arm a hardware watchpoint on a suspended session using either `expression` OR `0x`-prefixed `address` + `sizeBytes` (`1`, `2`, `4`, or `8`). Unmute breakpoints first because muted sessions never arm watchpoints.",
    ),
    "xdebug_list_data_breakpoints": CuratedTool(
        "native",
        "List user and agent watchpoints with `breakpointId`, watched `expression`, `accessType`, size in bytes, registration `error`, and `obsolete` flag.",
    ),
    "xdebug_remove_data_breakpoint": CuratedTool(
        "native",
        "Remove one watchpoint by `breakpointId` or clear all for `owner` (`removeAll: true`, defaults `owner` to `\"agent\"` so user watchpoints remain untouched).",
    ),
}


LANGUAGE_METADATA: dict[str, dict[str, str]] = {
    "jvm": {
        "file": "jvm.md",
        "title": "Using IntelliJ JVM MCP Tools (Java and Kotlin)",
        "router_desc": "Java-to-Kotlin conversion, JVM/coroutine thread dumps, exception/method breakpoints, and JDI heap leak analysis",
        "activate_when": "Converting Java to Kotlin, capturing JVM or coroutine thread dumps, setting JVM exception or method breakpoints, or finding heap leaks and GC roots",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`, `write_file`) and project build scripts (`./gradlew`, `./mvnw`) first for normal edits and CLI test runs. "
            "Escalate to these JVM MCP tools (and core [SKILL.md](../SKILL.md) tools) for Java-to-Kotlin conversion, live JVM or coroutine thread dumps, exception or method breakpoints, JDI memory leak diffing, or `.jar` and `.class` decompilation."
        ),
    },
    "go": {
        "file": "go.md",
        "title": "Using IntelliJ GoLand Profiler and `pprof` MCP Tools",
        "router_desc": "GoLand profiler run sessions, CPU recording, snapshots, and `pprof` hotspot/call-path analysis",
        "activate_when": "Launching GoLand profiler configurations, recording CPU profiles, capturing snapshots, or diagnosing hot Go functions and call paths",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`, `write_file`) and shell `go build`, `go test`, or `go test -bench` commands via `run_command` first. "
            "Escalate to these GoLand profiler tools when running an IDE Go profiler configuration, controlling live IDE profiling sessions, or querying `.pprof` bottlenecks without writing custom `go tool pprof` pipelines."
        ),
    },
    "python": {
        "file": "python.md",
        "title": "Using IntelliJ PyCharm Python MCP Tools",
        "router_desc": "PyCharm configured interpreter discovery and automatic virtual-environment setup",
        "activate_when": "Discovering which Python interpreter (`venv`, `conda`, `uv`, `poetry`) and package manager a PyCharm module uses, or configuring an unconfigured module interpreter",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`, `write_file`) and `run_command` first once the target Python executable and package manager are known. "
            "Escalate to these PyCharm MCP tools when working in an unfamiliar Python module so commands target the IDE-configured virtual environment instead of the wrong system Python binary."
        ),
    },
    "php": {
        "file": "php.md",
        "title": "Using IntelliJ PhpStorm MCP Tools",
        "router_desc": "PhpStorm PHP language level, remote Docker/SSH interpreters, indexed `composer.lock`, and PHP SSR patterns",
        "activate_when": "Inspecting PhpStorm PHP language levels or remote interpreters, querying indexed `composer.lock` dependencies, or loading PHP Structural Search templates",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`, `rg`) and local `composer` commands via `run_command` first when working locally. "
            "Escalate to these PhpStorm tools (and core `search_structural` or `xdebug_*` in [SKILL.md](../SKILL.md)) when inspecting remote Docker or SSH PHP interpreters, querying indexed monorepo `composer.lock` files without disk I/O, or running AST-based PHP Structural Search."
        ),
    },
    "sql": {
        "file": "sql.md",
        "title": "Using IntelliJ Database and SQL MCP Tools",
        "router_desc": "IDE database connections, schema introspection, table previews, SQL and DuckDB cross-DB queries, and import/export schemas",
        "activate_when": "Managing IDE data sources, introspecting live database schemas, previewing tables, executing SQL or cross-DB DuckDB joins, or exporting/importing tabular data",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`, `rg`) first when inspecting or editing local `.sql` scripts, schema migrations, and ORM models. "
            "Escalate to these Database tools when querying live IDE data sources, testing JDBC connections, introspecting schemas, joining data across databases, or importing and exporting tabular data."
        ),
    },
    "native": {
        "file": "native.md",
        "title": "Using IntelliJ Native CMake, GDB, LLDB, and DAP MCP Tools",
        "router_desc": "CLion CMake profile lifecycle, project reloads, CPU registers, raw memory reads, disassembly, and hardware watchpoints",
        "activate_when": "Managing CMake profiles or reloading CMake roots in CLion, or inspecting registers, memory, disassembly, and hardware watchpoints in paused GDB, LLDB, or DAP sessions",
        "intro": (
            "Use your default agent tools (`read_file`, `edit_file`) and CLI build commands (`cmake`, `cargo`, `make`) via `run_command` first. "
            "Escalate to these native MCP tools when managing IDE CMake profiles and reloads or inspecting machine-level state inside a **suspended** GDB, LLDB, or native DAP session."
        ),
    },
}


MODE2_BANNED_PATTERNS: tuple[tuple[str, str], ...] = (
    (r"\be\.g\.", "e.g."),
    (r"\bi\.e\.", "i.e."),
    (r"\betc\.", "etc."),
    (r"\band/or\b", "and/or"),
    (r"\bleverage\w*\b", "leverage"),
    (r"\butilize\w*\b", "utilize"),
    (r"\bharness\w*\b", "harness"),
    (r"\bin order to\b", "in order to"),
    (r"\bprior to\b", "prior to"),
    (r"\bensure\w*\b", "ensure"),
    (r"\bsimply\b", "simply"),
    (r"\bjust\b", "just"),
    (r"\beasily\b", "easily"),
    (r"\bseamlessly\b", "seamlessly"),
    (r"\beffortlessly\b", "effortlessly"),
    (r"\brobust\b", "robust"),
    (r"\bpowerful\b", "powerful"),
    (r"\bcomprehensive\b", "comprehensive"),
    (r"\bperformant\b", "performant"),
    (r"\bfacilitate\w*\b", "facilitate"),
    (r"\benhance\w*\b", "enhance"),
    (r"\belevate\w*\b", "elevate"),
    (r"\bstreamline\w*\b", "streamline"),
    (r"\bpivotal\b", "pivotal"),
    (r"\bvital\b", "vital"),
    (r"\bcrucially?\b", "crucial/crucially"),
    (r"\bfurthermore\b", "furthermore"),
    (r"\bmoreover\b", "moreover"),
    (r"\btherefore\b", "therefore"),
    (r"\bhowever\b", "however"),
    (r"\bsince\b", "since"),
    (r"\b(?:don't|can't|won't|it's|doesn't|isn't|aren't|didn't|shouldn't|wouldn't)\b", "contraction"),
    (r";", "semicolon"),
    (r"—", "em-dash"),
)


def default_mcp_dir() -> Path:
    app_data = os.environ.get("ANTIGRAVITY_APP_DATA_DIR")
    if app_data:
        return Path(app_data) / "mcp" / "intellij"
    return Path.home() / ".gemini" / "antigravity" / "mcp" / "intellij"


def _format_type_expr(prop: dict[str, Any]) -> str:
    ptype = prop.get("type")
    if isinstance(ptype, list):
        ptype = "|".join(str(x) for x in ptype)
    elif not ptype and "anyOf" in prop:
        ptype = "|".join(str(x.get("type", "any")) for x in prop["anyOf"])

    enum_vals = prop.get("enum")
    if isinstance(enum_vals, list) and enum_vals:
        if len(enum_vals) <= MAX_INLINE_ENUM:
            quoted = ", ".join(f"`{v}`" for v in enum_vals)
            return f" [{quoted}]"
        return f" [{len(enum_vals)} enum values]"

    if ptype == "array" and isinstance(prop.get("items"), dict):
        items = prop["items"]
        if "properties" in items:
            return " (array of objects)"
        itype = items.get("type", "any")
        return f" (array<{itype}>)"

    return ""


def _collect_nested_objects(props: dict[str, Any]) -> dict[str, dict[str, Any]]:
    nested: dict[str, dict[str, Any]] = {}
    for pname, pdef in props.items():
        if not isinstance(pdef, dict):
            continue
        if isinstance(pdef.get("properties"), dict):
            nested[pname] = pdef
        elif pdef.get("type") == "array" and isinstance(pdef.get("items"), dict):
            if isinstance(pdef["items"].get("properties"), dict):
                nested[f"{pname}[]"] = pdef["items"]
    return nested


def load_schemas(mcp_dir: Path) -> dict[str, ToolSchema]:
    if not mcp_dir.is_dir():
        raise FileNotFoundError(f"MCP schema directory does not exist: {mcp_dir}")

    json_files = sorted(mcp_dir.glob("*.json"))
    if not json_files:
        raise FileNotFoundError(f"No JSON tool schemas found in: {mcp_dir}")

    schemas: dict[str, ToolSchema] = {}
    for path in json_files:
        with path.open(encoding="utf-8") as fp:
            data = json.load(fp)
        name = data.get("name") or path.stem
        desc = (data.get("description") or "").strip()
        schema_obj = data.get("inputSchema") or data.get("parameters") or {}
        props = schema_obj.get("properties") or {}
        req = set(schema_obj.get("required") or [])

        # Order required parameters first (preserving schema declaration order),
        # then optional parameters, excluding universal projectPath.
        ordered_keys = [k for k in props if k != UNIVERSAL_PARAM and k in req] + [
            k for k in props if k != UNIVERSAL_PARAM and k not in req
        ]
        params = tuple(
            (k, k in req, _format_type_expr(props[k]))
            for k in ordered_keys
            if isinstance(props[k], dict)
        )
        nested = _collect_nested_objects(props)
        schemas[name] = ToolSchema(
            name=name,
            description=desc,
            params=params,
            nested_objects=nested,
            raw_schema=schema_obj,
        )
    return schemas


def classify_tool(name: str) -> str:
    """Map a tool name to its curated bucket or fallback language/core category."""
    if name in CURATED_TOOLS:
        return CURATED_TOOLS[name].bucket

    if name.startswith("jvm_debug_") or "_java_" in name or "_kotlin_" in name:
        return "jvm"
    if "_profile" in name or name.endswith("_cpu_recording"):
        return "go"
    if "_python_" in name:
        return "python"
    if "_php_" in name or "_composer_" in name:
        return "php"
    if (
        "_sql_" in name
        or "_database_" in name
        or "_schema" in name
        or "_import_" in name
        or name in {"export_query_result", "list_data_extractors", "preview_table_data", "fetch_query_result"}
    ):
        return "sql"
    if (
        "_cmake" in name
        or name in {
            "xdebug_get_registers",
            "xdebug_read_memory",
            "xdebug_disassemble",
            "xdebug_set_data_breakpoint",
            "xdebug_list_data_breakpoints",
            "xdebug_remove_data_breakpoint",
        }
    ):
        return "native"
    return "core:4.8"


def _sanitize_prose_segment(text: str) -> str:
    """Clean a non-code prose segment to obey my-writing-docs Mode 2 rules."""
    # Strip raw MCP directives that conflict with default-tools-first precedence.
    text = re.sub(
        r"(?i)\bYou\s+(?:MUST|have\s+to)\s+(?:prefer|use)\s+this\s+tool[^.\n]*[.\n]?",
        " ",
        text,
    )

    swaps: tuple[tuple[str, str], ...] = (
        (r"\be\.g\.,?\s*", "for example, "),
        (r"\bi\.e\.,?\s*", "that is, "),
        (r",?\s*\betc\.", ""),
        (r"\band/or\b", "or"),
        (r"\s*—\s*", ": "),
        (r";\s*", ". "),
        (r"\bdon't\b", "do not"),
        (r"\bcan't\b", "cannot"),
        (r"\bwon't\b", "will not"),
        (r"\bit's\b", "it is"),
        (r"\bdoesn't\b", "does not"),
        (r"\bisn't\b", "is not"),
        (r"\baren't\b", "are not"),
        (r"\bdidn't\b", "did not"),
        (r"\bshouldn't\b", "should not"),
        (r"\bwouldn't\b", "would not"),
        (r"\bleverage\b", "use"),
        (r"\butilize\b", "use"),
        (r"\bharness\b", "use"),
        (r"\bin order to\b", "to"),
        (r"\bprior to\b", "before"),
        (r"\bensure\b", "verify"),
        (r"\bsimply\b", ""),
        (r"\bjust\b", ""),
        (r"\beasily\b", ""),
        (r"\bseamlessly\b", ""),
        (r"\beffortlessly\b", ""),
        (r"\brobust\b", ""),
        (r"\bpowerful\b", ""),
        (r"\bcomprehensive\b", ""),
        (r"\bperformant\b", ""),
        (r"\bfacilitate\b", "help"),
        (r"\benhance\b", "improve"),
        (r"\belevate\b", "increase"),
        (r"\bstreamline\b", "simplify"),
        (r"\bpivotal\b", "important"),
        (r"\bvital\b", "important"),
        (r"\bcrucially\b", ""),
        (r"\bcrucial\b", "important"),
        (r"\bfurthermore\b", "also"),
        (r"\bmoreover\b", "also"),
        (r"\btherefore\b", "thus"),
        (r"\bhowever\b", "but"),
        (r"\bsince\b", "because"),
        (r"\b(this|these)\b(?=\s*(?:[,.:)]|$|is\b|are\b|when\b|with\b|for\b|to\b|over\b))", r"\1 tool"),
    )
    for pat, repl in swaps:
        text = re.sub(pat, repl, text, flags=re.I)

    text = re.sub(r"\s+([,.:])", r"\1", text)
    text = re.sub(r"\.{2,}", ".", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text


def sanitize_mcp_prose(raw_text: str) -> str:
    """Sanitize raw MCP schema descriptions while leaving backticked code untouched."""
    collapsed = " ".join(line.strip() for line in raw_text.splitlines() if line.strip())
    if not collapsed:
        return "No description provided in the tool schema."

    parts = re.split(r"(`[^`\n]+`)", collapsed)
    cleaned = [part if part.startswith("`") else _sanitize_prose_segment(part) for part in parts]
    result = "".join(cleaned).strip()
    result = re.sub(r"\s{2,}", " ", result)
    if result and result[0].islower():
        result = result[0].upper() + result[1:]
    if result and result[-1] not in ".!?":
        result += "."
    return result


def format_param_signature(schema: ToolSchema) -> str:
    if not schema.params:
        return "optional `projectPath` only"
    items = []
    for pname, is_req, suffix in schema.params:
        mark = "*" if is_req else ""
        items.append(f"`{pname}`{mark}{suffix}")
    return ", ".join(items)


def describe_tool(schema: ToolSchema) -> str:
    if schema.name in CURATED_TOOLS:
        return CURATED_TOOLS[schema.name].summary
    return sanitize_mcp_prose(schema.description)


def render_tool_bullet(schema: ToolSchema) -> str:
    sig = format_param_signature(schema)
    desc = describe_tool(schema)
    return f"- `{schema.name}` ({sig}): {desc}"


def render_auto_nested_section(schemas: list[ToolSchema]) -> str:
    blocks: list[str] = []
    for schema in schemas:
        if schema.name in CURATED_TOOLS or not schema.nested_objects:
            continue
        lines = [f"### `{schema.name}` Nested Object Fields", ""]
        for field_name, obj_schema in schema.nested_objects.items():
            props = obj_schema.get("properties") or {}
            req = set(obj_schema.get("required") or [])
            lines.append(f"Fields for `{field_name}`:")
            for sub_name, sub_def in props.items():
                mark = "*" if sub_name in req else ""
                sub_type = sub_def.get("type", "any")
                if isinstance(sub_type, list):
                    sub_type = "|".join(str(x) for x in sub_type)
                sub_desc = sanitize_mcp_prose(sub_def.get("description") or "")
                lines.append(f"- `{sub_name}`{mark} (`{sub_type}`): {sub_desc}")
            lines.append("")
        blocks.append("\n".join(lines).rstrip())
    return "\n\n".join(blocks)


def render_skill_md(
    schemas: dict[str, ToolSchema],
    grouped: dict[str, list[ToolSchema]],
) -> str:
    core_by_sec: dict[str, list[ToolSchema]] = {sec: [] for sec, _, _ in CORE_SECTIONS}
    for tool in grouped["core"]:
        bucket = classify_tool(tool.name)
        sec_id = bucket.split(":", 1)[1] if bucket.startswith("core:") else "4.8"
        core_by_sec.setdefault(sec_id, []).append(tool)

    # Router rows reflect live discovered counts per language category.
    router_rows = [
        "| `references/tools-reference.md` | Core nested schemas | Complex parameters for `search_structural`, `rename_refactoring`, `xdebug_set_breakpoints`, `xdebug_remove_breakpoints`, `xdebug_control_session`, launch overrides, and `spec_report_status` |",
    ]
    for lang in LANGUAGE_ORDER:
        tools = grouped.get(lang, [])
        if not tools:
            continue
        meta = LANGUAGE_METADATA[lang]
        router_rows.append(
            f"| `references/{meta['file']}` | {len(tools)} tools | {meta['activate_when']} |"
        )
    router_table = "\n".join(router_rows)

    section_blocks: list[str] = []
    for sec_id, title, intro in CORE_SECTIONS:
        tools = core_by_sec.get(sec_id, [])
        if not tools:
            continue
        lines = [f"### {sec_id} {title} ({len(tools)} Tools)", "", intro, ""]
        if sec_id == "4.6":
            lines.extend(_render_debugger_subsection(tools))
        else:
            for tool in tools:
                lines.append(render_tool_bullet(tool))
            if sec_id == "4.1":
                lines.extend([
                    "",
                    "**Call hierarchy workflow**:",
                    "",
                    "1. If you do not know the exact `symbolFqn`, call `search_symbol` with the short name first.",
                    "2. Call `analyze_calls` with `symbolFqn` and `analysisKind` (`INCOMING_CALLS` or `OUTGOING_CALLS`).",
                    "3. If the tool reports ambiguity, repeat `analyze_calls` using one of the returned exact signatures as `symbolFqn`.",
                    "4. To expand a truncated branch, pass the node's exact `treePath` array and `childOffset`.",
                ])
            elif sec_id == "4.3":
                lines.extend([
                    "",
                    "**Safe rename workflow**:",
                    "",
                    "1. Set `preview: true` first when renaming widely used public symbols.",
                    "2. Locate the target using `contextSnippet` (preferred, must match once in the file) or 1-based `line` and `column` from `search_symbol`.",
                    "3. If `ok` is `false` and `candidates` are returned, repeat the exact same call with all previous parameters plus 1-based `targetIndex`.",
                    "4. Confirm `applied` is `true` before proceeding.",
                ])
        section_blocks.append("\n".join(lines))

    core_count = len(grouped["core"])
    total_count = len(schemas)
    sections_text = "\n\n".join(section_blocks)

    return f"""---
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

This skill covers all **{total_count}** currently discovered IntelliJ MCP tools (**{core_count}** core tools below, plus language and runtime tools in `references/`).

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
2. Otherwise, check `<appDataDir>/mcp/intellij/<toolName>.json` when you need exact nested object fields, then invoke `call_mcp_tool` with `ServerName: "intellij"`, `ToolName: "<toolName>"`, and `Arguments: {{...}}`.
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
{router_table}

---

## 4. Core Language-Agnostic Tool Catalog ({core_count} Tools)

Parameters marked with `*` are required. Every tool also accepts optional `projectPath`.

{sections_text}
"""


def _render_debugger_subsection(tools: list[ToolSchema]) -> list[str]:
    by_name = {t.name: t for t in tools}
    bp_names = [
        "xdebug_list_breakpoints",
        "xdebug_set_breakpoints",
        "xdebug_remove_breakpoints",
        "xdebug_set_breakpoints_muted",
    ]
    ctrl_names = [
        "xdebug_get_debugger_status",
        "xdebug_start_debugger_session",
        "xdebug_attach_to_process",
        "xdebug_control_session",
        "xdebug_run_to_line",
    ]
    inspect_names = [
        "xdebug_get_threads",
        "xdebug_get_stack",
        "xdebug_get_frame_values",
        "xdebug_get_value_by_path",
        "xdebug_evaluate_expression",
        "xdebug_set_variable",
        "xdebug_get_process_output",
    ]
    known = set(bp_names + ctrl_names + inspect_names)
    extra = [t for t in tools if t.name not in known]

    lines: list[str] = ["**Breakpoint management**:", ""]
    for n in bp_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "**Session lifecycle and execution control**:", ""])
    for n in ctrl_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "**Stack, variables, expressions, and output inspection**:", ""])
    for n in inspect_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    if extra:
        lines.extend(["", "**Additional debugger tools**:", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))

    lines.extend([
        "",
        "> [!CAUTION]",
        "> Never reuse a cached `frameIndex` or `path` token after `RESUME`, `STEP_*`, `xdebug_run_to_line`, or any pause transition. Always re-fetch `xdebug_get_stack` and `xdebug_get_frame_values` at each new pause, and clear `isCaptureThreadDump` or remove agent-owned breakpoints when done.",
    ])
    return lines


def render_tools_reference(core_tools: list[ToolSchema]) -> str:
    auto_nested = render_auto_nested_section(core_tools)
    extra_block = f"\n\n---\n\n## 6. Additional Discovered Nested Schemas\n\n{auto_nested}" if auto_nested else ""

    return f"""# IntelliJ Core MCP Nested Schemas and Edge Cases

Use this reference alongside [SKILL.md](../SKILL.md) when constructing nested JSON arguments or handling non-obvious tool responses.

## 1. `search_structural` Constraints Schema

Pass `constraints` as a map keyed by the SSR variable name without `$` delimiters (`"b"` for `$b$`):

```json
{{
  "fileType": "Java",
  "pattern": "$a$.$b$($args$)",
  "constraints": {{
    "b": {{
      "regex": "^get.*",
      "invertRegex": false,
      "minCount": 1,
      "maxCount": 1
    }}
  }}
}}
```

Supported constraint fields:
- `regex`: Match variable text against a regular expression.
- `invertRegex`: Negate the `regex` check when `true`.
- `minCount` and `maxCount`: Occurrence bounds for multi-match variables.
- `exprType`: Match the resolved expression type (such as `"string"` or `"int"`).

---

## 2. `rename_refactoring` Targeting and Recovery

Target the symbol using this priority order:
1. `contextSnippet`: Exact single-occurrence code fragment from `pathInProject` containing `symbolName`.
2. `line` and `column`: Both 1-based integers copied from `search_symbol`.
3. Omitted position: Allowed only when `pathInProject` declares exactly one symbol named `symbolName`.

Handle responses strictly:
- `ok: true` and `applied: true`: Rename succeeded across PSI references.
- `ok: false` with `candidates`: Do not treat `targetIndex` as a standalone target selector. Repeat the identical request with all previous parameters and add the 1-based `targetIndex` from `candidates`.
- `ok: false` with `conflicts`: Choose another `newName`.
- `error.kind == "write_failed"`: Inspect `hint` to determine which files changed partially on disk.

---

## 3. `xdebug_set_breakpoints` and `xdebug_remove_breakpoints` Payloads

### 3.1 `xdebug_set_breakpoints` Item Schema

Every object inside `breakpoints` (1 to 50 items) requires these 6 fields:

```json
{{
  "breakpoints": [
    {{
      "filePath": "src/main/java/App.java",
      "line": 42,
      "enabled": true,
      "suspendPolicy": "ALL",
      "temporary": false,
      "condition": "count > 10",
      "isLogMessage": false,
      "isLogStack": false,
      "logExpression": null,
      "isCaptureThreadDump": false
    }}
  ]
}}
```

Update rules:
- Omit `breakpointId` when creating or targeting by `filePath` + 1-based `line`.
- Pass `breakpointId` when updating an existing breakpoint. Optional `filePath` and `line` relocate a line breakpoint and are ignored for other breakpoint types.
- Pass `null` for `condition` or `logExpression` to clear an existing expression on update.
- `suspendPolicy` accepts `"ALL"`, `"THREAD"`, or `"NONE"`.

### 3.2 `xdebug_remove_breakpoints` Item Schema

Every object inside `breakpoints` (1 to 50 items) requires `owner` (`"agent"` or `"user"`):

```json
{{
  "breakpoints": [
    {{ "owner": "agent" }}
  ]
}}
```

Targeting rules:
- Provide `breakpointId` + `owner` for ID mode.
- Provide `filePath` + 1-based `line` + `owner` for location mode.
- Provide `owner` alone to delete all breakpoints for that owner. Pass two items (`{{"owner": "agent"}}` and `{{"owner": "user"}}`) to clear both owners when requested.
- Default breakpoints cannot be deleted. The tool disables them and reports that outcome in `message`.

---

## 4. Launch Overrides and `xdebug_control_session` Responses

### 4.1 Dynamic Launch Overrides (`execute_run_configuration` and `xdebug_start_debugger_session`)

1. Call `get_run_configurations` without `filePath` first.
2. Pass `programArguments`, `workingDirectory`, or `envs` only when the selected configuration reports `supportsDynamicLaunchOverrides: true`.
3. Omit or pass `null` (or `""` for string fields) to preserve the saved configuration value.
4. Pass a single whitespace string (`" "`) to clear `programArguments` or `workingDirectory` for that single launch.
5. Note that `envs` merges provided keys on top of existing configuration variables for that launch only.

### 4.2 `xdebug_control_session` Result Fields

- `state`: `"running"`, `"paused"` (includes a depth-0 `frameValues` snapshot when available), or `"stopped"`.
- `breakpointErrorsTail`: Returned on every `action`.
- `tracepointOutputsTail`: Returned only when `action` is `"DRAIN_EVENTS"`. Currently populated only by JVM debuggers, including asynchronous thread dump paths (`TRACEPOINT_OUTPUT` with `dumpPath` and `byteCount`, or `THREAD_DUMP_FAILURE`). If a dump file is still pending, call `DRAIN_EVENTS` again.

---

## 5. `spec_report_status` Check Entries

Each item in `checks` requires `description`, `status` (`"passed"` or `"failed"`), `files`, and `fileProblems` (leave `fileProblems` empty or omit this computed field, and obey target anchor rules):

```json
{{
  "description": "unit tests verify token refresh lock",
  "status": "passed",
  "files": ["../../src/AuthService.kt#L24-L40"],
  "fileProblems": []
}}
```

Target strings in `files` (up to 2 items) must be relative to `specPath`, include a `#L<line>` or `#L<start>-L<end>` anchor, and omit Markdown link brackets.{extra_block}
"""


def render_jvm_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["jvm"]
    known_j2k = ["convert_java_to_kotlin"]
    known_bp = [
        "jvm_debug_list_exception_breakpoints",
        "jvm_debug_set_exception_breakpoint",
        "jvm_debug_list_method_breakpoints",
        "jvm_debug_set_method_breakpoint",
    ]
    known_dump = ["jvm_debug_get_thread_dump"]
    known_mem = [
        "jvm_debug_memory_class_snapshot",
        "jvm_debug_memory_get_instances",
        "jvm_debug_memory_read_fields",
        "jvm_debug_memory_closest_gc_roots",
    ]
    known = set(known_j2k + known_bp + known_dump + known_mem)
    extra = [t for t in tools if t.name not in known]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "---",
        "",
        "## 1. Java-to-Kotlin Conversion",
        "",
    ]
    for n in known_j2k:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "> [!CAUTION]",
        "> `convert_java_to_kotlin` renames `.java` files to `.kt` and updates external callers in place. Always pass `file_paths` from one module, set `fix_external_usages: true` (default) unless isolating edits deliberately, read every path returned in `externalUsageFiles` (including unpatched callers), and run `build_project` afterward to confirm clean compilation.",
        "",
        "---",
        "",
        "## 2. JVM Exception and Method Breakpoints",
        "",
    ])
    for n in known_bp:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "> [!CAUTION]",
        "> Exception breakpoints (keyed by `exceptionClass`) and method breakpoints (keyed by `classPattern` + `methodName`) overwrite their entire configuration on every call. Pass every setting you want to keep. If a method breakpoint logs nothing, check `jvm_debug_list_method_breakpoints` because wrong patterns fail silently. Remove JVM exception and method breakpoints using `xdebug_remove_breakpoints` from [SKILL.md](../SKILL.md).",
        "",
        "---",
        "",
        "## 3. JVM Thread Dumps and Tracepoint Event Draining",
        "",
    ])
    for n in known_dump:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "Cross-references in [SKILL.md](../SKILL.md):",
        "- Set `isCaptureThreadDump: true` on `xdebug_set_breakpoints` to capture JVM thread dumps on breakpoint hits, and clear the flag or remove the breakpoint before finishing.",
        "- Call `xdebug_control_session(action=\"DRAIN_EVENTS\")` to collect JVM-only `breakpointErrorsTail` and `tracepointOutputsTail` (`TRACEPOINT_OUTPUT` dump paths and `THREAD_DUMP_FAILURE`).",
        "",
        "---",
        "",
        "## 4. JDI Heap Leak Investigation",
        "",
        "Run these 4 steps on a **suspended** JVM debug session (start from a local run configuration with **Attach memory agent** enabled when GC roots are needed, because the memory agent is unavailable in remote debug sessions):",
        "",
    ])
    for idx, n in enumerate(known_mem, start=1):
        if n in by_name:
            lines.append(f"{idx}. {render_tool_bullet(by_name[n])[2:]}")

    lines.extend([
        "",
        "---",
        "",
        "## 5. Dependency Bytecode Inspection Cross-Reference",
        "",
        "To inspect Java or Kotlin dependencies inside `.jar` archives or JDK modules, call MCP `read_file` from [SKILL.md](../SKILL.md) with `jar://`, `jrt://`, or `/path/to/lib.jar!/pkg/ClassName.class` paths. The IDE returns decompiled class sources.",
    ])

    if extra:
        lines.extend(["", "---", "", "## 6. Additional JVM Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


def render_go_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["go"]
    lifecycle = ["run_with_profiler", "list_profiled_runs", "get_profiled_run_output", "stop_profiled_run"]
    capture = ["start_cpu_recording", "stop_cpu_recording", "take_profile", "list_profiles"]
    analyze = ["profile_summary", "profile_top_frames", "profile_call_paths", "profile_source_lines"]
    known = set(lifecycle + capture + analyze)
    extra = [t for t in tools if t.name not in known]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "---",
        "",
        "## 1. Profiled Run Lifecycle",
        "",
    ]
    for n in lifecycle:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "---", "", "## 2. Capturing and Discovering `.pprof` Files", ""])
    for n in capture:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "---",
        "",
        "## 3. Analyzing `.pprof` Profiles",
        "",
        "Pass the `.pprof` file path from `take_profile`, `stop_cpu_recording`, or `list_profiles` as `profile`:",
        "",
    ])
    for idx, n in enumerate(analyze, start=1):
        if n in by_name:
            lines.append(f"{idx}. {render_tool_bullet(by_name[n])[2:]}")

    if extra:
        lines.extend(["", "---", "", "## 4. Additional Go Profiler Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


def render_python_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["python"]
    known_names = ["get_python_environment", "configure_python_interpreter"]
    extra = [t for t in tools if t.name not in set(known_names)]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "---",
        "",
        "## 1. Python Environment Discovery and Configuration",
        "",
    ]
    for n in known_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "**Recommended workflow before running Python commands**:",
        "",
        "1. Call `get_python_environment` with a project Python `filePath` to obtain the exact interpreter path and package manager (`uv`, `poetry`, `pip`, `conda`).",
        "2. If `noInterpreterConfigured` is non-null and directs you to configure one, call `configure_python_interpreter` for that `filePath`.",
        "3. If `configure_python_interpreter` fails because a required tool (`uv` or `poetry`) is missing, report the missing tool rather than silently switching to an unconfigured system Python.",
        "4. Once the interpreter path is known, run tests, linters, and scripts directly through `run_command`.",
    ])

    if extra:
        lines.extend(["", "---", "", "## 2. Additional Python Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


def render_php_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["php"]
    known_names = ["get_php_project_config", "get_composer_dependencies", "get_structural_patterns"]
    extra = [t for t in tools if t.name not in set(known_names)]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "---",
        "",
        "## 1. PHP Interpreter and Composer Tools",
        "",
    ]
    for n in known_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "---",
        "",
        "## 2. Running PHP Structural Search (`search_structural`)",
        "",
        "Combine `get_structural_patterns` with `search_structural` from [SKILL.md](../SKILL.md) (`fileType: \"PHP\"`):",
        "",
        "1. Call `get_structural_patterns` first to discover reliable templates and pattern syntax (`$a$->$b$()`, `new $Class$()`, `class $a$ extends $b$ {}`).",
        "2. Call `search_structural` with `fileType: \"PHP\"`, `pattern`, optional `directoryToSearch`, and optional `constraints` (keyed by variable name without `$` signs).",
        "3. Keep PHP SSR limits in mind: some class modifiers such as `readonly` may not match, and complex nested patterns with constraints can behave inconsistently compared to Java SSR.",
        "",
        "---",
        "",
        "## 3. PHP Runtime Debugging Note",
        "",
        "Interactive PHP step debugging, breakpoints, stack frames, and expression evaluation use the cross-language `xdebug_*` tools documented in [SKILL.md](../SKILL.md).",
    ])

    if extra:
        lines.extend(["", "---", "", "## 4. Additional PHP Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


def render_sql_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["sql"]
    conn_names = [
        "list_database_connections",
        "create_database_connection",
        "edit_database_connection",
        "test_database_connection",
    ]
    schema_names = [
        "list_database_schemas",
        "introspect_schema",
        "list_schema_object_kinds",
        "list_schema_objects",
        "get_database_object_description",
    ]
    query_names = [
        "preview_table_data",
        "execute_sql_query",
        "execute_cross_db_query",
        "fetch_query_result",
        "list_recent_sql_queries",
        "cancel_sql_query",
    ]
    transfer_names = [
        "list_data_extractors",
        "export_query_result",
        "inspect_import_file",
        "inspect_import_query",
        "import_data",
    ]
    known = set(conn_names + schema_names + query_names + transfer_names)
    extra = [t for t in tools if t.name not in known]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "> [!WARNING]",
        "> Never ask the user for database usernames or passwords in chat. Let the user enter credentials inside the IDE UI when authentication is required, unless the user already supplied credentials in the active conversation.",
        "",
        "> [!CAUTION]",
        "> Obtain explicit user confirmation before executing `DROP`, `TRUNCATE`, irreversible DDL or DML writes, or `import_data` writes (see `AGENTS.md` Section 4).",
        "",
        "---",
        "",
        "## 1. Connection Setup and Diagnostics",
        "",
    ]
    for n in conn_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "---", "", "## 2. Schema Introspection and Object Metadata", ""])
    for n in schema_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "---", "", "## 3. Table Preview, SQL Queries, and Execution Control", ""])
    for n in query_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "---", "", "## 4. Data Export and Tabular Import", ""])
    for n in transfer_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "---",
        "",
        "## 5. Nested Export and Import Payloads",
        "",
        "### 5.1 `export_query_result.exportConfig`",
        "",
        "Pass `{}` to export all columns with extractor defaults. When specifying an explicit object, include all 8 required keys below (`excludedColumnIndices` always applies, while extractor-specific keys outside `applicableOptions` are ignored):",
        "",
        "```json",
        "{",
        "  \"excludedColumnIndices\": [0, 3],",
        "  \"addColumnHeader\": true,",
        "  \"addRowHeader\": false,",
        "  \"addTableDdl\": false,",
        "  \"isTransposed\": false,",
        "  \"addComputedColumns\": false,",
        "  \"addGeneratedColumns\": false,",
        "  \"addQuery\": false",
        "}",
        "```",
        "",
        "### 5.2 `inspect_import_file.source`",
        "",
        "`source.filePath` is required and must be an absolute filesystem path. Set `firstColumnIsHeader` to `null` for scripted loaders (JSON, XLS, XLSX, Parquet), and use `resultSet.columns[].name` from the response in `import_data` because blank or duplicate headers are repaired during inspection:",
        "",
        "```json",
        "{",
        "  \"filePath\": \"/abs/path/to/users.csv\",",
        "  \"charset\": \"UTF-8\",",
        "  \"firstRowIsHeader\": true,",
        "  \"firstColumnIsHeader\": null,",
        "  \"csvFormat\": {",
        "    \"valueSeparator\": \",\",",
        "    \"recordSeparator\": \"\\n\",",
        "    \"quote\": \"\\\"\",",
        "    \"quoteEscape\": null,",
        "    \"nullText\": \"\",",
        "    \"trimWhitespace\": false",
        "  }",
        "}",
        "```",
        "",
        "### 5.3 `import_data` Nested Payloads",
        "",
        "At least one entry in `columnMappings` must carry both `sourceColumn` and `targetColumn`. Omit a target column from `columnMappings` to keep its database default. Any `BLOCKER` mismatch (`TYPE_NOT_CONVERTIBLE`, `UNMAPPED_TARGET_COLUMN`, `MAPPED_TO_NONEXISTENT_TARGET`) fails pre-validation before consent or row insertion:",
        "",
        "```json",
        "{",
        "  \"resultSetId\": \"<id from inspect_import_file or inspect_import_query>\",",
        "  \"target\": {",
        "    \"connectionId\": \"<connectionId>\",",
        "    \"databaseName\": \"<databaseName>\",",
        "    \"schemaName\": \"<schemaName>\",",
        "    \"tableName\": \"<existingTableName>\"",
        "  },",
        "  \"columnMappings\": [",
        "    {",
        "      \"sourceColumn\": \"email\",",
        "      \"targetColumn\": \"email\",",
        "      \"inferredTargetType\": null,",
        "      \"mismatch\": null",
        "    }",
        "  ],",
        "  \"excludedSourceColumns\": [\"internal_note\"],",
        "  \"options\": {",
        "    \"insertInconvertibleAsNull\": false,",
        "    \"disableConstraintsAndLockTable\": false",
        "  }",
        "}",
        "```",
    ])

    if extra:
        lines.extend(["", "---", "", "## 6. Additional Database Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


def render_native_md(tools: list[ToolSchema]) -> str:
    by_name = {t.name: t for t in tools}
    meta = LANGUAGE_METADATA["native"]
    cmake_names = [
        "load_cmake",
        "create_cmake_profile",
        "update_cmake_profile",
        "enable_cmake_profiles",
        "disable_cmake_profiles",
        "delete_cmake_profiles",
    ]
    inspect_names = ["xdebug_get_registers", "xdebug_read_memory", "xdebug_disassemble"]
    watch_names = [
        "xdebug_set_data_breakpoint",
        "xdebug_list_data_breakpoints",
        "xdebug_remove_data_breakpoint",
    ]
    known = set(cmake_names + inspect_names + watch_names)
    extra = [t for t in tools if t.name not in known]

    lines = [
        f"# {meta['title']}",
        "",
        meta["intro"],
        "",
        "Use [SKILL.md](../SKILL.md) for general breakpoints, session launch or attach (`xdebug_start_debugger_session`, `xdebug_attach_to_process`), execution control (`xdebug_control_session`), and source-level stack or variable inspection.",
        "",
        "Parameters marked with `*` are required. Always pass `projectPath` on every tool call.",
        "",
        "---",
        "",
        "## 1. CMake Profiles and Project Reload",
        "",
        "Profile creation, update, enable, disable, and deletion tools persist changes to IDE configuration immediately, **but changes do not take effect until `load_cmake` runs**. Batch profile edits first, then call `load_cmake` once:",
        "",
    ]
    for n in cmake_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "> [!CAUTION]",
        "> `update_cmake_profile` replaces all existing profile `environment` variables whenever `environment` is provided, and `enable_cmake_profiles`, `disable_cmake_profiles`, and `delete_cmake_profiles` require `names` as a JSON array of strings even for a single profile.",
        "",
        "---",
        "",
        "## 2. Native Debugger Invariants (GDB, LLDB, and DAP)",
        "",
        "1. **Session must be suspended**: Pause execution first using `xdebug_control_session(action=\"WAIT_FOR_PAUSE\")` or `PAUSE`.",
        "2. **Require `0x` hex addresses**: Every raw `address` parameter must begin with `0x` (such as `\"0xE000ED28\"`). Bare numbers fail intentionally.",
        "3. **Pass integer `threadId` here**: `xdebug_get_registers`, `xdebug_read_memory`, and `xdebug_disassemble` take an **integer** debugger thread number (from `xdebug_get_registers`, or `null` for the selected frame), not the string display name used by `xdebug_get_threads` or `xdebug_get_stack`.",
        "4. **Refresh `frameIndex` after movement**: Never reuse a cached `frameIndex` after `RESUME`, `STEP_*`, `xdebug_run_to_line`, or any pause transition.",
        "",
        "---",
        "",
        "## 3. CPU Registers, Raw Memory, and Disassembly",
        "",
    ])
    for n in inspect_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend(["", "---", "", "## 4. Hardware Data Breakpoints / Watchpoints", ""])
    for n in watch_names:
        if n in by_name:
            lines.append(render_tool_bullet(by_name[n]))

    lines.extend([
        "",
        "> [!CAUTION]",
        "> Hardware watchpoint slots are scarce (typically 4 slots per CPU). Remove agent watchpoints with `xdebug_remove_data_breakpoint` as soon as you capture the offending `xdebug_get_stack` access.",
    ])

    if extra:
        lines.extend(["", "---", "", "## 5. Additional Native Tools", ""])
        for t in extra:
            lines.append(render_tool_bullet(t))
    auto_nested = render_auto_nested_section(extra)
    if auto_nested:
        lines.extend(["", auto_nested])

    return "\n".join(lines) + "\n"


LANGUAGE_RENDERERS = {
    "jvm": render_jvm_md,
    "go": render_go_md,
    "python": render_python_md,
    "php": render_php_md,
    "sql": render_sql_md,
    "native": render_native_md,
}


def build_expected_files(schemas: dict[str, ToolSchema], skill_dir: Path) -> dict[Path, str]:
    grouped: dict[str, list[ToolSchema]] = {"core": [], **{lang: [] for lang in LANGUAGE_ORDER}}
    for name in sorted(schemas):
        bucket = classify_tool(name)
        key = "core" if bucket.startswith("core:") else bucket
        grouped[key].append(schemas[name])

    files: dict[Path, str] = {
        skill_dir / "SKILL.md": render_skill_md(schemas, grouped),
        skill_dir / "references" / "tools-reference.md": render_tools_reference(grouped["core"]),
    }
    for lang in LANGUAGE_ORDER:
        tools = grouped[lang]
        if not tools:
            continue
        meta = LANGUAGE_METADATA[lang]
        files[skill_dir / "references" / meta["file"]] = LANGUAGE_RENDERERS[lang](tools)
    return files


def validate_outputs(schemas: dict[str, ToolSchema], files: dict[Path, str]) -> list[str]:
    errors: list[str] = []
    combined_text = "\n".join(files.values())

    for name in sorted(schemas):
        if f"`{name}`" not in combined_text:
            errors.append(f"Tool `{name}` is missing from generated documentation.")

    for path, content in files.items():
        no_fence = re.sub(r"```.*?```", lambda m: "\n" * m.group(0).count("\n"), content, flags=re.S)
        prose = re.sub(r"`[^`\n]+`", "CODE", no_fence)
        prose_no_fm = re.sub(r"^---\n.*?\n---\n", lambda m: "\n" * m.group(0).count("\n"), prose, flags=re.S)

        for pat, label in MODE2_BANNED_PATTERNS:
            for hit in re.finditer(pat, prose_no_fm, re.I):
                line_no = prose_no_fm[: hit.start()].count("\n") + 1
                errors.append(f"Mode 2 violation ({label}) in {path.name}:{line_no}: {hit.group(0)!r}")

        bare_pat = r"\b(this|these)\b(?=\s*(?:[,.:)]|$|is\b|are\b|when\b|with\b|for\b|to\b|over\b))"
        for hit in re.finditer(bare_pat, prose_no_fm, re.I):
            line_no = prose_no_fm[: hit.start()].count("\n") + 1
            errors.append(f"Bare `{hit.group(0)}` in {path.name}:{line_no}")

    return errors


def check_sync(expected: dict[Path, str], skill_dir: Path) -> list[str]:
    drift: list[str] = []
    for path, content in expected.items():
        if not path.is_file():
            drift.append(f"Missing generated file: {path}")
            continue
        if path.read_text(encoding="utf-8") != content:
            drift.append(f"Out-of-date file: {path}")

    refs_dir = skill_dir / "references"
    if refs_dir.is_dir():
        for existing in sorted(refs_dir.glob("*.md")):
            if existing not in expected:
                drift.append(f"Stale reference file: {existing}")
    return drift


def write_sync(expected: dict[Path, str], skill_dir: Path) -> None:
    refs_dir = skill_dir / "references"
    refs_dir.mkdir(parents=True, exist_ok=True)
    for existing in sorted(refs_dir.glob("*.md")):
        if existing not in expected:
            existing.unlink()

    for path, content in expected.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Sync my-using-intellij markdown docs from MCP JSON schemas.")
    parser.add_argument(
        "--mcp-dir",
        type=Path,
        default=default_mcp_dir(),
        help="Directory containing IntelliJ MCP *.json tool schemas.",
    )
    parser.add_argument(
        "--skill-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent,
        help="Target my-using-intellij skill directory.",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check whether SKILL.md and references/ match live schemas without modifying files.",
    )
    args = parser.parse_args(argv)

    schemas = load_schemas(args.mcp_dir)
    expected = build_expected_files(schemas, args.skill_dir)
    validation_errors = validate_outputs(schemas, expected)
    if validation_errors:
        print("VALIDATION FAILED:", file=sys.stderr)
        for err in validation_errors:
            print(f" - {err}", file=sys.stderr)
        return 1

    if args.check:
        drift = check_sync(expected, args.skill_dir)
        if drift:
            print("OUT OF SYNC:", file=sys.stderr)
            for item in drift:
                print(f" - {item}", file=sys.stderr)
            print("Run without --check to regenerate.", file=sys.stderr)
            return 1
        print(f"IN SYNC ({len(schemas)}/{len(schemas)} tools verified across {len(expected)} files)")
        return 0

    write_sync(expected, args.skill_dir)
    print(f"SYNCED ({len(schemas)}/{len(schemas)} tools written across {len(expected)} files)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
