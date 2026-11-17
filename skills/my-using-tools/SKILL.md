---
name: my-using-tools
description: >-
  Select codebase discovery, IDE, CLI, scripting, and subagent tools while respecting
  project-local toolchains. Activate this skill when searching a repository, using
  JetBrains IDE tools, running builds or tests, writing python3 analysis or batch scripts,
  mapping module imports, inspecting Git co-change history, or delegating to subagents.
---

# Tool Selection, Automation, and Subagent Delegation

Choose direct, deterministic tools that match the target repository's existing toolchain and keep the working tree clean.

## 1. Respect Project Tooling First

Before you pick a package manager, build runner, linter, or test command, inspect the target repository's own conventions:
1. Check `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, and `CONTRIBUTING.md` for project-mandated commands.
2. Check lockfiles and task manifests (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `Makefile`, `justfile`, `Cargo.toml`, `build.gradle`, `pom.xml`, and `.github/workflows/`).
3. Use the project's configured scripts (`pnpm test`, `npm run check`, `make lint`) instead of inventing raw CLI invocations that skip project flags.

---

## 2. Discovery Routing Matrix

Use your default built-in tools (`read_file`, `edit_file`, `write_file`, and `run_command` with `rg`, `ls`, `git`, and project CLI runners) as your first priority. Escalate to `intellij` (or `jetbrains_air_ide`) MCP tools (see `my-using-intellij` and its `references/` guides) when IDE semantic indexes, refactoring, inspections, run configurations, databases, or live debuggers provide capabilities beyond default tools:

| Scenario | Primary Tool (Default First) | Escalate to IntelliJ MCP When |
|---|---|---|
| File path already known or open | Built-in `read_file`, `write_file`, and `edit_file` | Reading inside `.jar` or `.jrt` archives, decompiling `.class` files, listing open IDE tabs, or applying IDE code style (`my-using-intellij`) |
| Literal string or regex search | Shell `rg` (ripgrep) via `run_command` | Semantic symbol lookup, Quick Documentation, Call Hierarchy, AST Structural Search, or IDE excluded-root matching (`my-using-intellij`) |
| Cross-file symbol rename or inspection fixes | Built-in `edit_file` for local edits | PSI-safe `rename_refactoring`, `apply_quick_fix`, or `convert_java_to_kotlin` (`my-using-intellij` and `references/jvm.md`) |
| Builds, linters, Git, and test suites | `run_command` with project CLI scripts and `git` | Incremental JPS `build_project`, IDE inspections (`get_inspections`, `lint_files`), saved Run Configurations, coverage, IntelliJ Changelists, Python interpreter lookup (`references/python.md`), or CMake profiles (`references/native.md`) |
| Live debugging, profiling, or database queries | Project CLI test runners or local DB clients | Live `xdebug_*` or `jvm_debug_*` debugging, Go `pprof` profiling, remote PHP interpreter info, native registers/memory, or IDE database queries (`my-using-intellij` `references/`) |

### Local Environment Fallbacks

When a repository does not mandate a specific tool, apply these defaults:
- **Search**: `rg` (ripgrep) over `grep`.
- **Node.js**: Use `pnpm` when starting a greenfield project or when `pnpm-lock.yaml` is present. Otherwise, match the existing lockfile.
- **Go SDK**: If `PATH` lacks the required Go version, inspect `~/sdk/go1.xxx`.
- **Scripting**: `python3`.

---

## 3. Automation Scripts and Structural Analysis

Use `python3` scripts to replace error-prone manual repetition and to inspect large codebases:

1. **Batch transformations**: Write a `python3` script for multi-file renames, mechanical refactors, fixture generation, and migration verification instead of editing dozens of files by hand.
2. **Skeleton extraction**: When an unfamiliar module is large, run a script to list exported types and function signatures so you see the full contract map without reading every body at once.
3. **Import-direction checks**: Script import graphs when untangling modules to verify that core domain packages do not import volatile adapters.
4. **Git co-change evidence**: Inspect `git log` commit frequency and files that change together to spot hidden coupling before refactoring.
5. **Keep the repository clean ("nothing left to remove")**: Store one-off analysis or migration scripts in a temporary or scratch directory and remove temporary artifacts when done. Commit a script into `scripts/` only when teammates or CI pipelines genuinely need to run it again, and document its usage clearly.

---

## 4. Parallel Subagent Delegation

Spend subagent turns freely when parallel context keeps the main session clean and focused:
1. **Subsystem mapping**: Delegate read-only exploration of independent packages or services in parallel.
2. **Isolated stub implementation**: Once interfaces, types, and contracts compile (see `my-working-task`), delegate independent function implementations to subagents against those fixed signatures.
3. **Post-refactor audits**: After untangling a module (see `my-working-project`), use a fresh subagent to scan for leftover dead code, broken comments, or missed edge cases.
