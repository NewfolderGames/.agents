# DIY Session Document and Host Adapter Contract

This self-contained contract governs DIY session documents (`tasks.md`, `NN-<slug>.diy-guide.md`, and
`NN-<slug>.learning-log.md`) across coding hosts.

## 1. Host Detection, Directories, and Capability Mapping

Load the row matching your active runtime before creating `tasks.md`, `NN-<slug>.diy-guide.md`, or
`NN-<slug>.learning-log.md`:

| Host                | Detection Signals                                                                                  | `<session-dir>`                                                       | File Metadata & VCS Hygiene                                                                         | Link Format                      | Structured Prompt & Web Search                                         |
|---------------------|----------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|----------------------------------|------------------------------------------------------------------------|
| **Antigravity**     | `<Artifact Directory Path>`, `ArtifactMetadata`, `invoke_subagent`, or `~/.gemini/config/plugins/` | `<Artifact Directory Path>` (`<appDataDir>/brain/<conversation-id>/`) | Pass `Overwrite: true` and `ArtifactMetadata` with `UserFacing: true`, `RequestFeedback: false`     | Absolute `file:///...`           | `ask_question`, `search_web`                                           |
| **JetBrains Junie** | JetBrains IDE Junie environment or `.junie/` workspace configuration                               | `.junie/plans/<YYYYMMDD-HHMM>-<slug>/`                                | Plain Markdown; check `.gitignore` / `.git/info/exclude` and never stage or commit unless requested | Relative `./NN-<slug>.<role>.md` | Native prompt or numbered chat options; native search or doc citations |
| **Claude Code**     | `Read`/`Edit`/`Write`/`Bash`/`Agent` toolset or `~/.claude/`                                       | `~/.claude/plans/<repo-slug>/<YYYYMMDD-HHMM>-<session-slug>/`         | Plain Markdown outside the target repo                                                              | Relative `./NN-<slug>.<role>.md` | `AskUserQuestion`, `WebSearch`                                         |
| **Generic / Other** | Codex, Cursor, OpenCode, or unlisted host                                                          | `.agents/sessions/<YYYYMMDD-HHMM>-<slug>/`                            | Plain Markdown; check `.gitignore` / `.git/info/exclude` and never stage or commit unless requested | Relative `./NN-<slug>.<role>.md` | Numbered chat options; canonical books/docs when search is unavailable |

## 2. Sequential Task Numbering (`NN`)

1. Before creating any DIY task file inside `<session-dir>`, inspect `tasks.md` and existing `NN-*` files and allocate
   `max(NN) + 1` as a zero-padded two-digit ID starting at `01` (`01`, `02`, `03`).
2. Name DIY artifacts `NN-<kebab-slug>.<role>.md`, keeping `<kebab-slug>` to 3 to 5 lowercase ASCII words. Supported
   DIY roles are `diy-guide` and `learning-log`.
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
2. **`NN-<slug>.learning-log.md`**: Immutable once delivered.
3. **`NN-<slug>.diy-guide.md`**: Immutable once delivered. If a mode switch requires generating a second guide for the
   same Task `NN`, write a non-colliding filename (`NN-<slug>.diy-guide-part2.md`) or allocate the next sequential `NN`.

## 4. Language Parity and Minimal Handoff

1. Write the `tasks.md` entry and every `NN-<slug>.*` artifact for a task in one consistent language matching the user's
   prompt or explicit language request.
2. Never paste full generated guide documents into chat. Reply in 1 to 2 sentences linking `NN-<slug>.diy-guide.md` or
   `NN-<slug>.learning-log.md` using the link format required by Section 1.
