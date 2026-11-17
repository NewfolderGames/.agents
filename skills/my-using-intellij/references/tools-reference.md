# IntelliJ Core MCP Nested Schemas and Edge Cases

Use this reference alongside [SKILL.md](../SKILL.md) when constructing nested JSON arguments or handling non-obvious tool responses.

## 1. `search_structural` Constraints Schema

Pass `constraints` as a map keyed by the SSR variable name without `$` delimiters (`"b"` for `$b$`):

```json
{
  "fileType": "Java",
  "pattern": "$a$.$b$($args$)",
  "constraints": {
    "b": {
      "regex": "^get.*",
      "invertRegex": false,
      "minCount": 1,
      "maxCount": 1
    }
  }
}
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
{
  "breakpoints": [
    {
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
    }
  ]
}
```

Update rules:
- Omit `breakpointId` when creating or targeting by `filePath` + 1-based `line`.
- Pass `breakpointId` when updating an existing breakpoint. Optional `filePath` and `line` relocate a line breakpoint and are ignored for other breakpoint types.
- Pass `null` for `condition` or `logExpression` to clear an existing expression on update.
- `suspendPolicy` accepts `"ALL"`, `"THREAD"`, or `"NONE"`.

### 3.2 `xdebug_remove_breakpoints` Item Schema

Every object inside `breakpoints` (1 to 50 items) requires `owner` (`"agent"` or `"user"`):

```json
{
  "breakpoints": [
    { "owner": "agent" }
  ]
}
```

Targeting rules:
- Provide `breakpointId` + `owner` for ID mode.
- Provide `filePath` + 1-based `line` + `owner` for location mode.
- Provide `owner` alone to delete all breakpoints for that owner. Pass two items (`{"owner": "agent"}` and `{"owner": "user"}`) to clear both owners when requested.
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
{
  "description": "unit tests verify token refresh lock",
  "status": "passed",
  "files": ["../../src/AuthService.kt#L24-L40"],
  "fileProblems": []
}
```

Target strings in `files` (up to 2 items) must be relative to `specPath`, include a `#L<line>` or `#L<start>-L<end>` anchor, and omit Markdown link brackets.
