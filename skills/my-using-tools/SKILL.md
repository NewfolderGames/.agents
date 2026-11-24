---
name: my-using-tools
description: >-
  Select codebase discovery, CLI, scripting, and subagent tools while respecting
  project-local toolchains and deciding when to escalate to IDE tools. Activate this
  skill when searching a repository, running builds or tests, writing python3 analysis
  or batch scripts, mapping module imports, inspecting Git co-change history, or
  delegating to subagents.
---

# Tool Selection, Automation, and Subagent Delegation

Choose direct, deterministic tools that match the target repository's existing toolchain and keep the working tree clean.

## 1. Respect Project Tooling First

Before you pick a package manager, build runner, linter, or test command, inspect the target repository's own conventions:
1. Check `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, and `CONTRIBUTING.md` for project-mandated commands.
2. Check lockfiles and task manifests (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`, `bun.lock`, `Makefile`, `justfile`, `Cargo.toml`, `build.gradle`, `pom.xml`, and `.github/workflows/`).
3. Use the project's configured scripts (`pnpm test`, `npm run check`, `make lint`) instead of inventing raw CLI invocations that skip project flags.

---

## 2. Default-First Discovery and IDE Escalation

Use built-in agent tools (`read_file`, `edit_file`, `write_file`, and `run_command` with `rg`, `find`, `ls`, `git`, and project CLI runners) as your first priority. Escalate to `my-using-intellij` (`intellij` or `jetbrains_air_ide` MCP server) only when IDE semantic indexes, PSI refactoring, inspections, or live runtimes provide capabilities that default tools cannot match:

- **Semantic code and refactoring**: Symbol lookup, Quick Documentation, Call Hierarchy, AST Structural Search, PSI-safe `rename_refactoring`, Java-to-Kotlin conversion, or inspection quick fixes (activate `my-using-intellij`).
- **IDE builds, inspections, and VCS**: Incremental JPS `build_project`, `get_inspections`, `lint_files`, saved Run Configurations, coverage, IntelliJ Changelists, `.jar`/`.class` archive reads, Python interpreter discovery, or CMake profile reloads (activate `my-using-intellij`).
- **Live runtimes and data sources**: Multi-language `xdebug_*` or `jvm_debug_*` debugging, Go `pprof` profiling, remote PHP interpreters, native registers or watchpoints, or IDE database queries (activate `my-using-intellij`).

### Local Environment Fallbacks

When a repository does not mandate a specific tool, apply these defaults:
- **Search**: `rg` (ripgrep) over `grep`.
- **Node.js**: Use `pnpm` when starting a greenfield project or when `pnpm-lock.yaml` is present. Otherwise, match the existing lockfile.
- **Go SDK**: If `PATH` lacks the required Go version, check the repository's version pin (`go.mod`, `.tool-versions`, or `.go-version`) and installed Go toolchains on the machine.
- **Scripting**: `python3`.

---

## 3. Automation Scripts and Structural Analysis

Use `python3` scripts to replace error-prone manual repetition and to inspect large codebases:

1. **Batch transformations**: Write a `python3` script for mechanical text, path, or fixture transforms, fixture generation, and migration verification instead of editing dozens of files by hand. When IntelliJ MCP is active, use PSI-safe `rename_refactoring` (`my-using-intellij`) for renaming language symbols across files instead of text scripts.
2. **Skeleton extraction**: When an unfamiliar module is large, run a script to list exported types and function signatures so you see the full contract map without reading every body at once.
3. **Import-direction checks**: Script import graphs when untangling modules to verify that core domain packages do not import volatile adapters.
4. **Git co-change evidence**: Inspect `git log` commit frequency and files that change together to spot hidden coupling before refactoring.
5. **Keep the repository clean ("nothing left to remove")**: Store one-off analysis or migration scripts in a temporary or scratch directory and remove temporary artifacts when done. When teammates or CI pipelines need to run a script again, commit it into `scripts/` and document its usage clearly.

---

## 4. Parallel Subagent Delegation

Spend subagent turns freely when parallel context keeps the main session clean and focused:
1. **Project scouting (`project-scout`)**: When onboarding to an unfamiliar codebase or starting a task that requires local code style, placement rules, formatter configs, and Git or documentation conventions, delegate scouting to `project-scout` (never invoke `project-scout-worker` directly). `project-scout` runs `scripts/scout_prescan.py` once to build a shared digest and fans out to read-only `project-scout-worker` subagents with disjoint file lists on large or multi-module repositories, falling back to single-agent scanning when nested subagents or the script are unavailable. Pass an `OutputPath` outside the target repository (in Antigravity, `<Artifact Directory Path>/scratch/scout-<repo>.md` or `scout-<repo>-<scope>.md` for parallel scoped scouts, and in other harnesses, a writable scratch directory outside the target repository) so the scout writes the full guideline to disk and returns a short handoff summary. In harnesses that do not register `agents/*.md` subagents, execute the workflow in `<plugin-root>/agents/project-scout.md` directly or through the host's native subagent mechanism.
2. **Subsystem mapping**: Delegate read-only exploration of independent packages or services in parallel.
3. **Isolated stub implementation**: Once interfaces, types, and contracts compile (see `my-working-task`), delegate independent function implementations to subagents against those fixed signatures.
4. **Post-refactor audits**: After untangling a module (see `my-working-project`), use a fresh subagent to scan for leftover dead code, broken comments, or missed edge cases.
