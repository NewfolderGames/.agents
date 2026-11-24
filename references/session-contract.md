# Session Document and Scratch Contract

This contract governs session documents (`tasks.md`, `NN-<slug>.plan.md`, `NN-<slug>.report.md`,
`NN-<slug>.diy-guide.md`, `NN-<slug>.learning-log.md`) and external scratch outputs across all skills and subagents.

## 1. Directory, Metadata, and Link Resolution

1. Resolve `<session-dir>`, `<scratch-dir>`, file-write metadata flags, and Markdown link formatting by reading the
   single host adapter matching the active runtime in [../harnesses/README.md](../harnesses/README.md).
2. When the active host places `<session-dir>` inside the target repository workspace, inspect `.gitignore` or
   `.git/info/exclude` first and never stage or commit session documents unless the user explicitly asks to commit them.
3. Never write `<scratch-dir>` outputs (such as `project-scout` reports or temporary analysis scripts) inside a target
   repository tree.

## 2. Sequential Task Numbering (`NN`)

1. Before creating any task file inside `<session-dir>`, inspect `tasks.md` and existing `NN-*` files and allocate
   `max(NN) + 1` as a zero-padded two-digit ID starting at `01` (`01`, `02`, `03`).
2. Name task artifacts `NN-<kebab-slug>.<role>.md`, keeping `<kebab-slug>` to 3 to 5 lowercase ASCII words. Supported
   roles are `plan`, `report`, `diy-guide`, and `learning-log`.
3. Never reuse an allocated `NN` or overwrite an earlier task's documents.

## 3. Mutability Rules

1. **`tasks.md` (single mutable hub)**:
    - Keep a `# Session Tasks` header and `# | Status | Task | Docs` Overview Table at the top so every task's status
      and artifact links remain visible in the first 10 lines.
    - Collapse completed, cancelled, or superseded tasks inside `<details>` blocks
      (`<summary>[x] Task NN - Title</summary>`), placing Markdown links in the Overview Table and on the first Markdown
      line inside `<details>` (never inside `<summary>`). Once more than 3 tasks finish in one session, older collapsed
      `<details>` blocks can keep only `Docs` and `Summary` instead of every historical checkbox.
    - Keep only active tasks expanded under `## Task NN - <Title>` using standard GFM `- [ ]` and `- [x]` checkboxes,
      with at most one item marked `- [ ] **(in progress)**`.
2. **`NN-<slug>.plan.md`**: Immutable once approved. Record mid-execution adjustments in the report's `Plan Deviations`
   section instead of editing the approved plan.
3. **`NN-<slug>.report.md` and `NN-<slug>.learning-log.md`**: Immutable once delivered.
4. **`NN-<slug>.diy-guide.md`**: Immutable once delivered. If a mode switch requires generating a second guide for the
   same Task `NN`, write a non-colliding filename (`NN-<slug>.diy-guide-part2.md`) or allocate the next sequential `NN`.

## 4. Language Parity

Write the `tasks.md` entry and every `NN-<slug>.*` artifact for a task in one consistent language matching the user's
prompt or explicit language request.

## 5. Minimal Chat Handoff Discipline

Never paste `NN-<slug>.plan.md` or `NN-<slug>.report.md` contents into chat. Reply in 1 to 2 sentences linking the
relevant files (flagging open decisions when awaiting plan approval), using the link format required by the active host
adapter in [../harnesses/README.md](../harnesses/README.md).
