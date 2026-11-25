# Using IntelliJ JVM MCP Tools (Java and Kotlin)

Use your built-in file tools and project build scripts (`./gradlew`, `./mvnw`) first for normal edits and CLI test runs.
Escalate to these JVM MCP tools (and core [SKILL.md](../SKILL.md) tools) for Java-to-Kotlin conversion, live JVM or
coroutine thread dumps, exception or method breakpoints, diffing JDI memory snapshots for leaks, or `.jar` and `.class`
decompilation.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

---

## 1. Java-to-Kotlin Conversion

- `convert_java_to_kotlin` (`file_paths`* (`array<string>`), `fix_external_usages`): Convert existing `.java` files
  inside one Kotlin-configured module into `.kt` files using IntelliJ type inference, nullability inference, and import
  fixes.

> [!CAUTION]
> Ask for explicit user confirmation and pass `file_paths` from one module before running `convert_java_to_kotlin`,
because this tool renames `.java` files to `.kt` and updates external callers in place. Keep `fix_external_usages: true`
(default) unless isolating edits deliberately, read every path returned in `externalUsageFiles` (including unpatched
callers), and run `build_project` afterward to confirm clean compilation.

---

## 2. JVM Exception and Method Breakpoints

- `jvm_debug_list_exception_breakpoints` (optional `projectPath` only): List all JVM exception breakpoints with
  `exceptionClass`, `isDefault`, stable ID, owner, enabled state, caught/uncaught flags, condition, logging flags, and
  suspend policy.
- `jvm_debug_set_exception_breakpoint` (`exceptionClass`*, `condition`, `enabled`, `isLogMessage`, `isLogStack`,
  `logExpression`, `notifyCaught`, `notifyUncaught`, `suspendPolicy` [`ALL`, `THREAD`, `NONE`]): Create or update a JVM
  exception breakpoint for a fully qualified class (`java.lang.IllegalStateException` or `java.lang.Throwable`). At
  least one of `notifyCaught` or `notifyUncaught` must be `true`.
- `jvm_debug_list_method_breakpoints` (optional `projectPath` only): List JVM method breakpoints targeted by class and
  method pattern. Method breakpoints placed on concrete source lines appear in `xdebug_list_breakpoints` instead.
- `jvm_debug_set_method_breakpoint` (`classPattern`*, `methodName`*, `condition`, `enabled`, `isLogMessage`,
  `isLogStack`, `logExpression`, `suspendPolicy` [`ALL`, `THREAD`, `NONE`], `watchEntry`, `watchExit`): Watch method
  entry (`watchEntry`, default `true`) or exit (`watchExit`, default `false`) for class and method patterns
  (`com.example.*`, `get*`). Set `suspendPolicy: "NONE"` with `logExpression` for non-suspending parameter logging.

> [!CAUTION]
> Pass every parameter that you want to preserve on each `jvm_debug_set_exception_breakpoint` or
`jvm_debug_set_method_breakpoint` call (and ask for explicit user confirmation before overwriting a user-owned
breakpoint), because updates keyed by `exceptionClass` or `classPattern` + `methodName` overwrite the entire breakpoint.
If a method breakpoint logs nothing, check `jvm_debug_list_method_breakpoints` because mismatched patterns fail
silently. Remove JVM exception and method breakpoints using `xdebug_remove_breakpoints` from [SKILL.md](../SKILL.md).

---

## 3. JVM Thread Dumps and Tracepoint Event Draining

- `jvm_debug_get_thread_dump` (`count`, `includeExtended`, `interval`, `sessionId`, `timeout`): Capture 1 to 10 thread
  dumps (`count * interval <= 300000` milliseconds) from a running or suspended JVM session and write UTF-8 dumps to
  temporary files (33 retained). Keep `includeExtended: true` for virtual threads and Kotlin coroutines.

Cross-references in [SKILL.md](../SKILL.md):

- Set `isCaptureThreadDump: true` on `xdebug_set_breakpoints` to capture JVM thread dumps on breakpoint hits, and clear
  the flag or remove the breakpoint before finishing.
- Call `xdebug_control_session(action="DRAIN_EVENTS")` to collect JVM-only `breakpointErrorsTail` and
  `tracepointOutputsTail` (`TRACEPOINT_OUTPUT` dump paths and `THREAD_DUMP_FAILURE`).

---

## 4. JDI Heap Leak Investigation

Run these 4 steps on a **suspended** JVM debug session (start from a local run configuration with **Attach memory
agent** enabled when GC roots are needed, because the memory agent is unavailable in remote debug sessions):

1. `jvm_debug_memory_class_snapshot` (`baselineId`, `gcBefore`, `gcCycles`, `includePackagePrefixes` (`array<string>`),
   `limit`, `minDelta`, `sessionId`): Capture baseline instance counts via JDI (without `baselineId`) or compute count
   deltas (with `baselineId`). Filter noisy packages with `includePackagePrefixes`. Avoid `gcBefore: true` on
   latency-sensitive or remote JVMs because it triggers a stop-the-world `System.gc()` pause.
2. `jvm_debug_memory_get_instances` (`typeHandle`*, `limit`, `sessionId`): Sample concrete object `@handle` references
   and static/instance `fieldHints` for a `typeHandle` from `jvm_debug_memory_class_snapshot` (default `limit: 5`, max
   `50`).
3. `jvm_debug_memory_read_fields` (`reads`* (array of objects), `groupBy` (`array<string>`), `sessionId`): Read direct
   or dot-separated fields on selected `@handle` instances or static fields on `typeHandle`, optionally grouped via
   `groupBy`.
4. `jvm_debug_memory_closest_gc_roots` (`objectHandles`* (`array<string>`), `sessionId`): Build shortest
   `target -> referrer -> GC root` retention trees for a few suspicious `@handle` objects. Requires a local run
   configuration with **Attach memory agent** enabled (unavailable on remote debug).

### `jvm_debug_memory_read_fields` Payload

Each object in `reads` specifies either `handle` (instance read) or `typeHandle` (static field read, requiring
`fieldPath`), plus optional `fieldPath` and `label`. Pass `groupBy` field paths that appear in `reads` to group handles:

```json
{
  "reads": [
    {
      "handle": "@123",
      "fieldPath": "name",
      "label": "name"
    },
    {
      "typeHandle": "@type42",
      "fieldPath": "CACHE",
      "label": "cache"
    }
  ],
  "groupBy": [
    "name"
  ]
}
```

---

## 5. Cross-Reference for Inspecting Dependency Bytecode

To inspect Java or Kotlin dependencies inside `.jar` archives or JDK modules, call MCP `read_file`
from [SKILL.md](../SKILL.md) with `jar://`, `jrt://`, or `/path/to/lib.jar!/pkg/ClassName.class` paths. The IDE returns
decompiled class sources.
