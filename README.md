# .agents

Personal rules and modular skills repository for AI coding agents.

## Prerequisites

- JetBrains IDE with MCP server enabled (`intellij` or `jetbrains_air_ide`)
- `ripgrep` (`rg`) for fast text search
- `python3` for batch scripts and structural analysis
- `pnpm` as the default Node.js package manager when unspecified by a project lockfile

## Repository Structure

| Path | Purpose |
|---|---|
| `AGENTS.md` | Always-on core rules: precedence order, multi-task session document lifecycle (`tasks.md`, `NN-<slug>.plan.md`, `NN-<slug>.report.md`), Mode 1 chat flow, anti-compression readability and anti-slop discipline, safety gates, and skill router |
| `skills/my-using-tools/` | Project-aware tool selection, default-first escalation routing, `rg`, `python3` automation, and subagent delegation |
| `skills/my-using-intellij/` | Core IntelliJ IDE MCP usage, default-tools-first policy, 59 core tools, on-demand `references/` guides (JVM, Go, Python, PHP, SQL, CMake/native), and `scripts/sync_intellij_tools.py` |
| `skills/my-working-task/` | Multi-task session hub (`tasks.md`), Junie-style immutable plans (`NN-<slug>.plan.md` with `In Scope` / `Out of Scope`), calibrated scaffold-first workflow, atomic commits, dual-mode reports (`NN-<slug>.report.md`), plus `references/` templates |
| `skills/my-working-project/` | Deletable module design, functional pipeline chunking, documented dense code, co-change untangling, plus `references/` for language defaults and worked examples |
| `skills/my-writing-docs/` | Practical Software STE and anti-compression readability for documentation and comments, plus `references/` for the 50-row slop table, readability swaps, domain templates, and Korean style guide |
| `skills/my-learning-diy/` | User-driven self-learning guidance in `guide` mode (calibrated study and task blueprints with minimal or zero solution code) and `active` mode (chunked Socratic pair coding with tiered hints and explain-back reviews), plus `references/` templates and playbooks |
| `skills/rscss/` | RSCSS stylesheet conventions for components, elements, variants, layouts, and helpers |
