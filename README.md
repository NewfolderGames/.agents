# my-agents

This repository provides a harness-agnostic personal bundle of engineering rules, modular skills, per-host adapters, and
repository-scouting subagents for AI coding agents.

## Prerequisites

- `ripgrep` (`rg`) for fast text search
- `python3` for batch scripts, structural analysis, and `scripts/scout_prescan.py`
- `pnpm` as the default Node.js package manager when a project lockfile does not specify one
- Optional: JetBrains IDE with MCP server enabled (`intellij` or `jetbrains_air_ide`) when using `my-using-intellij`

## Repository Structure

| Path                             | Purpose                                                                                                                                                                                                                                |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `plugin.json`                    | Plugin manifest (`name`, `displayName`, `version`, `description`, `repository`, and starter prompts)                                                                                                                                   |
| `rules/AGENTS.md`                | Always-on harness-agnostic core rules (`< 10 KB`) covering precedence, safety gates, Mode 1 chat flow, session document triggers, local toolchain defaults, prose invariants, and skill or subagent routing                            |
| `harnesses/`                     | On-demand host adapters (`README.md`, `antigravity.md`, `junie.md`, `claude-code.md`, `generic.md`) mapping abstract capabilities to host tools, directories, metadata flags, and link formats                                         |
| `references/session-contract.md` | Canonical harness-agnostic specification for `<session-dir>`, `<scratch-dir>`, sequential `NN` IDs, mutability rules, and language parity                                                                                              |
| `scripts/`                       | Zero-dependency repository pre-scan CLI (`scout_prescan.py`) and unit tests (`test_scout_prescan.py`) owned by `project-scout`                                                                                                         |
| `agents/project-scout.md`        | Repository-read-only scout orchestrator that runs `scripts/scout_prescan.py`, fans out to `project-scout-worker` on large or multi-module repositories, writes an external guideline, and returns a short handoff                      |
| `agents/project-scout-worker.md` | Read-only partition analyst started by `project-scout` to inspect an assigned, disjoint file list using the pre-collected repo digest                                                                                                  |
| `skills/my-working-task/`        | Multi-task session hub (`tasks.md`), immutable plans (`NN-<slug>.plan.md` with `In Scope` / `Out of Scope`), calibrated scaffold-first phases, parallel stub delegation, atomic commits, and dual-mode reports (`NN-<slug>.report.md`) |
| `skills/my-working-project/`     | Deletable module design, caller-focused error design, functional pipeline chunking, documented dense code, `python3` structural analysis, co-change untangling, and post-refactor audits                                               |
| `skills/my-writing-docs/`        | Practical Software STE and anti-compression readability for documentation and comments, plus `references/` for slop substitutions, readability swaps, domain templates, and Korean style guide                                         |
| `skills/my-using-intellij/`      | Core MCP escalation rules for IntelliJ IDEs, built-in-tools-first policy, coordinate and safety traps, plus `references/` guides (`tools-reference.md`, JVM, Go, Python, PHP, SQL, and CMake/native)                                   |
| `skills/my-learning-diy/`        | Self-learning guidance in `guide` mode (calibrated study and task blueprints with minimal or zero solution code) and `active` mode (chunked Socratic pair coding with tiered hints and explain-back reviews)                           |
| `skills/rscss/`                  | RSCSS stylesheet conventions for components, elements, variants, layouts, and helper classes                                                                                                                                           |

## Multi-Harness Setup

Read [harnesses/README.md](harnesses/README.md) for host detection, abstract capability mappings, and setup instructions
across Antigravity, JetBrains Junie, Claude Code, and generic `AGENTS.md` hosts (Codex, Cursor, OpenCode).

## Citations

External sources adapted across the rules and skills in this repository:

- **`skills/my-working-project/`**:
  - Roman Kashitsyn (2022). [*Designing error types in Rust*](https://mmapped.blog/posts/12-rust-error-handling).
  - The Rust Standard Library. [*When to use `panic!` vs `Result`*](https://doc.rust-lang.org/std/macro.panic.html#when-to-use-panic-vs-result).
  - Alexis King (2019). [*Parse, don't validate*](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/).
- **`rules/AGENTS.md` and `skills/my-writing-docs/`**:
  - [ASD-STE100 Simplified Technical English](https://www.asd-ste100.org/).
  - Thomas Hikaru Clark, Matias B. Martin, and Kyle Mahowald (2026). [*Why is AI-generated language so hard to understand?*](https://arxiv.org/abs/2610.29162) (`arXiv:2610.29162`).
  - [eGovFramework Documentation (`egovframe-docs`)](https://github.com/eGovFramework/egovframe-docs).
- **`skills/rscss/`**:
  - Rico Sta. Cruz. [*RSCSS (Reasonable System for CSS Stylesheet Structure)*](https://ricostacruz.com/rscss/).
