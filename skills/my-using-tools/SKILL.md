---
name: my-using-tools
description: >-
  Select discovery, search, IDE, CLI, scripting, and subagent tools. Activate this skill
  when searching a codebase, using JetBrains IDE tools, running CLI builds or tests,
  writing python3 automation or skeleton-extraction scripts, mapping module imports,
  analyzing Git co-change history, or delegating parallel work to subagents.
---

# Tool Selection, Automation, and Subagent Delegation

Select direct, deterministic tools for codebase discovery, builds, batch edits, and parallel analysis.

## 1. Discovery Routing Matrix

Route every codebase inspection and build action through the primary tool in this table:

| Scenario | Primary Tool | Fallback / Next Step |
|---|---|---|
| JetBrains IDE connected (definitions, references, call/type hierarchy, safe refactor, test runner) | `intellij` or `jetbrains_air_ide` | Interact with the IDE directly |
| Known symbol, exact string, or regex pattern | `rg` (ripgrep) | Prefer `rg` over `grep` for fast, syntax-aware search |
| File already identified or open | Direct file read or IDE inspection | Skip broad search completely |
| Non-discovery tasks (Git, builds, test runs) | Direct CLI or IDE runner | Skip search tools completely |

---

## 2. Standard CLI and Runtime Preferences

When you run CLI commands or local runtimes, obey these preferences:
1. **Text search**: Run `rg` (ripgrep) instead of `grep`.
2. **Node package manager**: Use `pnpm` when `pnpm` is installed. If the repository lockfile requires `npm` or another manager, use the lockfile-mandated manager.
3. **Go SDK**: If the default `PATH` lacks the required Go version, inspect `~/sdk/go1.xxx`.
4. **Automation interpreter**: Run standalone helper scripts with `python3`.

---

## 3. Automation Scripts and Structural Analysis

Prefer repeatable `python3` scripts over manual multi-file edits and ad-hoc reading:

1. **Script repetitive work**: If `python3` is installed, write standalone Python scripts for batch refactoring, multi-file transformations, data generation, bulk renaming, and migration checks. Do not do repetitive manual edits across files.
2. **Extract code skeletons**: When you inspect a large module or codebase, run a script that strips function bodies so all signatures fit in context.
3. **Map module imports**: Write and run a script that maps module imports so that stable modules never import volatile modules.
4. **Inspect Git coupling history**: When Git history exists, inspect commit frequency and co-change patterns to locate volatile modules and files that change together.
5. **Retain reusable scripts**: Save project-wide automation scripts in `scripts/` (or the repository utility directory). Document the run command in Mode 2 (see `my-writing-docs`) so teammates and CI pipelines can run the script again.

---

## 4. Parallel Subagent Delegation

When a task contains independent analysis or isolated implementation slices, invoke subagents in parallel:
1. **Subsystem summaries**: Invoke read-only subagents to summarize separate subsystems concurrently without filling the primary context window.
2. **Isolated stub bodies**: After you validate scaffolded signatures and docstrings (see `my-working-task`), invoke subagents to fill independent function bodies against fixed contracts.
3. **Coupling and special-case audits**: After a structural refactor (see `my-working-project`), invoke subagents to search for remaining special cases, hidden links, needless links, and dead code.
