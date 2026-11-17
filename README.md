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
| `AGENTS.md` | Always-on core rules: precedence order, Mode 1 chat flow, anti-slop discipline, safety gates, and skill router |
| `skills/my-using-tools/` | Project-aware tool selection, JetBrains IDE routing, `rg`, `python3` automation, and subagent delegation |
| `skills/my-working-task/` | Bounded multistep execution, clean human handoffs, calibrated scaffold-first workflow, `TODO`s, and atomic commits |
| `skills/my-working-project/` | Deletable module design, functional pipeline chunking, documented dense code, co-change untangling, plus `references/` for language defaults and worked examples |
| `skills/my-writing-docs/` | Practical Software STE for documentation and comments, plus `references/` for the 50-row slop table and domain templates |
| `skills/rscss/` | RSCSS stylesheet conventions for components, elements, variants, layouts, and helpers |
