# AGENTS.md - Personal Code Style and Architecture Rules

Aim for human-readable, maintainable code where features are easy to replace or delete ("nothing left to remove" beats
"nothing left to add"). Spend tokens freely to inspect context, validate changes, and explain non-obvious mechanics: 20
concise lines with a clear *why* and *how* block beat 200 lines of boilerplate, including for regexes, macros, and
reflection.

## 1. Precedence

Resolve code architecture and style decisions in this strict order:

1. **Target repository guides and configs**: `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, `CONTRIBUTING.md`,
   `.editorconfig`, linter/formatter rules, build manifests, and CI workflows always override these personal defaults.
2. **Neighboring codebase conventions**: Match existing directory layout, naming, error types, state management, and
   testing patterns in adjacent files unless refactoring was explicitly requested.
3. **These `new-personal` rules and bundled skill defaults**: Apply when the target repository defines no local
   standard.

## 2. Skill Router

| Name        | Kind  | Activate When                                                                                                                                                                                                            |
|-------------|-------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `new::code` | Skill | ALWAYS whenever writing, editing, refactoring, debugging, or reviewing code in any language (covering architecture, error design, native doc comments, pipelines, tests, `python3` structural analysis, and untangling). |
