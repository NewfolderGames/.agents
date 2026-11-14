# .agents

Centralized rules and modular skills repository for AI coding agents.

## Prerequisites

Install and enable these tools in the local environment:
- JetBrains IDE with MCP server enabled (`intellij` or `jetbrains_air_ide`)
- `ripgrep` (`rg`) for syntax-aware text search
- `python3` for automation, skeleton extraction, and validation scripts
- `pnpm` for Node.js package management

## Repository Layout

`AGENTS.md` stays under `8 KB` so agent harnesses load core chat rules, terminology discipline, safety gates, and skill triggers without file truncation. Detailed engineering and writing workflows live in self-contained `SKILL.md` files under `skills/` (each under `15 KB`).

| Path | Role |
|---|---|
| `AGENTS.md` | Always-on core rules: Mode 1 interactive chat, terminology consistency, safety gates, and skill routing |
| `skills/my-using-tools/SKILL.md` | Discovery routing matrix, CLI/IDE tool selection, `python3` automation scripts, and subagent delegation |
| `skills/my-working-task/SKILL.md` | Bounded multistep execution, 4-phase scaffold-first implementation, `TODO` lifecycle, and atomic Git commits |
| `skills/my-working-project/SKILL.md` | Code architecture, co-change untangling, style, language rules (TypeScript, React, Go, Rust, Java), and 6-part docblocks |
| `skills/my-writing-docs/SKILL.md` | Mode 2 (ASD-STE100 Issue 9) technical writing, 50-row slop table, dictionary rulings, and prose audit checklist |
| `skills/rscss/SKILL.md` | RSCSS stylesheet organization for UI components, elements, variants, layouts, and helpers |
| `refs/` | Upstream source references (`SIMPLE.md`, `STE.md`) and archived early skill drafts |
