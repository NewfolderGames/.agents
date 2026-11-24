# Using IntelliJ Native CMake, GDB, LLDB, and DAP MCP Tools

Use your built-in file tools and CLI build commands (`cmake`, `cargo`, `make`) via your shell runner first. Escalate to
these native MCP tools when managing IDE CMake profiles and reloads or inspecting machine-level state inside a
**suspended** GDB, LLDB, or native DAP session.

Use [SKILL.md](../SKILL.md) for general breakpoints, session launch or attach (`xdebug_start_debugger_session`, `xdebug_attach_to_process`), execution control (`xdebug_control_session`), and source-level stack or variable inspection.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

---

## 1. CMake Profiles and Project Reload

CMake profile tools (`create`, `update`, `enable`, `disable`, and `delete`) persist changes to IDE configuration immediately, **but changes do not take effect until `load_cmake` runs**. Batch profile edits first, then call `load_cmake` once:

- `load_cmake` (`projectRoot`, `timeoutMs`): Reload the CMake project and run CMake for every enabled profile (optionally switching to a different `projectRoot` directory containing `CMakeLists.txt`). Spawns external CMake processes.
- `create_cmake_profile` (`name`*, `buildOptions`, `buildType`, `disableOthers`, `enabled`, `environment`, `generationDir`, `generationOptions`, `passSystemEnvironment`, `timeoutMs`, `toolchainName`): Add a new CMake profile (`buildType` defaults to `Debug`). Fails if `name` already exists. Takes effect after `load_cmake`.
- `update_cmake_profile` (`name`*, `buildOptions`, `buildType`, `environment`, `generationDir`, `generationOptions`, `passSystemEnvironment`, `timeoutMs`, `toolchainName`): Update selected fields of an existing CMake profile. Takes effect after `load_cmake`. Passing `environment` replaces all existing environment variables on the profile.
- `enable_cmake_profiles` (`names`* (`array<string>`), `disableOthers`, `timeoutMs`): Enable the listed CMake `names` (always pass a list of strings, optionally setting `disableOthers: true`). Takes effect after `load_cmake`.
- `disable_cmake_profiles` (`names`* (`array<string>`), `timeoutMs`): Disable the listed CMake `names` (always pass a list of strings). Takes effect after `load_cmake`.
- `delete_cmake_profiles` (`names`* (`array<string>`), `timeoutMs`): Remove the listed CMake `names` (always pass a list of strings). Takes effect after `load_cmake`.

> [!CAUTION]
> Ask for explicit user confirmation before running `load_cmake`, deleting profiles, or passing `environment` to `update_cmake_profile`, because `load_cmake` spawns external CMake processes, `update_cmake_profile` overwrites all existing environment variables on the profile, and `delete_cmake_profiles` removes IDE profile definitions. Always pass `names` as a JSON array of strings even for a single profile.

---

## 2. Native Debugger Invariants (GDB, LLDB, and DAP)

1. **Session must be suspended**: Pause execution first using `xdebug_control_session(action="WAIT_FOR_PAUSE")` or `PAUSE`.
2. **Require `0x` hex addresses**: Every raw `address` parameter must begin with `0x` (such as `"0xE000ED28"`). Bare numbers fail intentionally.
3. **Pass integer `threadId` here**: `xdebug_get_registers`, `xdebug_read_memory`, and `xdebug_disassemble` take an **integer** thread number from the debugger (from `xdebug_get_registers`, or `null` for the selected frame), not the string display name used by `xdebug_get_threads` or `xdebug_get_stack`.
4. **Refresh `frameIndex` after movement**: Never reuse a cached `frameIndex` after `RESUME`, `STEP_*`, `xdebug_run_to_line`, or any pause transition.

---

## 3. CPU Registers, Raw Memory, and Disassembly

- `xdebug_get_registers` (`frameIndex`, `registerNames` (`array<string>`), `registerSets` (`array<string>`), `sessionId`, `threadId`, `timeout`): Read CPU registers grouped into target sets (`General Purpose`, `System`, `Floating Point`, `Other`, or `All`). Check `unmatched` and `truncated` (256-register cap), and prefer zero-padded `hexValue` for address math.
- `xdebug_read_memory` (`address`*, `byteOrder` [`LITTLE`, `BIG`], `count`, `sessionId`, `threadId`, `timeout`, `width`): Atomically read `count` units (1 to 256) of `width` bytes (`1`, `2`, `4`, or `8`) from a `0x`-prefixed `address` (`byteOrder` defaults to `LITTLE`). Returns an error without partial data if any byte in the range is unmapped.
- `xdebug_disassemble` (`address`, `count`, `flavor` [`INTEL`, `ATT`], `frameIndex`, `sessionId`, `threadId`, `timeout`): Disassemble 1 to 256 instructions from a `0x`-prefixed `address` (or the frame program counter when omitted). Check `current`, missing `symbol` / `symbolOffset` (corrupted or unsymbolized addresses), and `nextAddress` when `truncated` is `true`.

---

## 4. Hardware Data Breakpoints / Watchpoints

- `xdebug_set_data_breakpoint` (`accessType` [`READ`, `WRITE`, `ANY`], `address`, `expression`, `sessionId`, `sizeBytes`, `timeout`): Arm a hardware watchpoint on a suspended session using either `expression` OR `0x`-prefixed `address` + `sizeBytes` (`1`, `2`, `4`, or `8`). Unmute breakpoints first because muted sessions never arm watchpoints.
- `xdebug_list_data_breakpoints` (optional `projectPath` only): List user and agent watchpoints with `breakpointId`, `owner`, watched expression, access type, size in bytes, registration `error`, and `obsolete` flag.
- `xdebug_remove_data_breakpoint` (`breakpointId`, `owner` [`user`, `agent`], `removeAll`): Remove one watchpoint by `breakpointId` or clear all for `owner` (`removeAll: true`, defaults `owner` to `"agent"` so user watchpoints remain untouched).

> [!CAUTION]
> Remove agent watchpoints with `xdebug_remove_data_breakpoint` immediately after capturing the offending `xdebug_get_stack` access, because CPUs typically provide only 4 hardware watchpoint slots and leftover watchpoints block new ones.
