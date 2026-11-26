---
name: new::task
description: >-
  Plan, track, execute, and report single or multi-task engineering sessions using a
  unified session hub (tasks.md), sequential immutable technical plans (NN-<slug>.plan.md),
  calibrated scaffold-first phases, atomic Git commits, and dual-mode completion or audit
  reports (NN-<slug>.report.md). Activate this skill when /plan is invoked, preparing or
  executing multi-step changes, tracking task progress, auditing codebases, debugging
  failures, or wrapping up a session.
---

# Session Planning, Multi-Task Tracking, Phased Execution, and Reporting

Run engineering sessions with clear scope boundaries, scannable immutable plans, one live task hub (`tasks.md`), and
structured implementation or audit reports. Developers can then review decisions quickly, chain follow-up tasks without
losing history, or take over the keyboard at any step.

## 1. Project Precedence, Directory Resolution, and Task Numbering

### 1.1 Project Workflow Precedence

Before you plan steps, run checks, or create commits, inspect the target repository's `AGENTS.md`, `CLAUDE.md`,
`GEMINI.md`, `README.md`, and `CONTRIBUTING.md`:

1. Follow the repository's required verification commands, branch rules, code generation steps, and commit message
   conventions first (while preserving `rules/AGENTS.md` Section 1.2 operational safety gates).
2. Apply the rules in this skill whenever the repository does not specify its own workflow.

### 1.2 Session Directory, Numbering, and Immutability

Follow [../../references/session-contract.md](../../references/session-contract.md) and the active host adapter
in [../../harnesses/README.md](../../harnesses/README.md) for `<session-dir>`, file-write metadata, link formatting,
global integer `taskId` / zero-padded artifact allocation (`NNN-<kebab-slug>.<role>.md` starting at `001` via
`new-worker-ui`, or `NN` starting at `01` in manual fallback), mutability boundaries (`tasks.md` mutable, plan files
immutable after approval, report files immutable after delivery), VCS exclusion, and one-language parity per task.

### 1.3 `new-worker-ui` Structured MCP Tools (Preferred When Connected)

When `new-worker-ui` is connected, drive session artifacts through its MCP tools and pass `sessionId`, optional
`rootDir` / `groupId`, and `exportDir: "<session-dir>"` so `tasks.md`, `NNN-<slug>.plan.md`, and
`NNN-<slug>.report.md` stay exported on disk:

- **Plan creation**: Call `write_plan` (omitting `taskId` allocates the next global integer `taskId` starting at `1` and
  returns `taskId` plus `planFilePath` for the generated `001-<slug>.plan.md`) so the harness can present or move it as
  a native plan artifact, and pass that `taskId` into `upsert_task` (`status: "planned"`). Do not include plan creation
  or workspace initialization as numbered steps inside `steps`.
- **Live progress**: Call `update_task_item` with `sessionId`, global `taskId`, `itemId`, and `status` as items move
  through `pending`, `in_progress`, and `done`; the inline step widget renders an immutable snapshot of only the active
  step with read-only checklist items and emits timeline step transitions.
- **Sessions, groups, and timeline notes**: Call `manage_context` to update session metadata (`title`, `rootDir`,
  `exportDir`, `groupId`), create or assign 1:N session groups for shared context across related sessions, or append
  `add_timeline_note` entries with polymorphic entity `links`.
- **Context queries**: Call `query_workspace` (targets `session_context`, `groups`, `tasks`, `task_detail`, `plan`,
  `report`, `handoffs`, `questions`) and `query_timeline` to inspect metadata, sibling group sessions, active steps,
  plans, submitted answers, or entity event history in read-only mode.
- **Mid-session handoffs**: Call `record_handoff` with `workingNow`, `verifyCommand`, `entryPoint`, `nextStep`, and
  optional `taskId`.
- **Completion**: Call `write_report` (`implementation` or `audit`) and close the task via `upsert_task` or
  `update_task_item`.
- **Dashboard**: Call `open_workspace` (read-only) to open the isolated Dashboard UI in the side pane or sidebar. When
  `new-worker-ui` is unavailable, write and edit the Markdown files directly using host file tools.

---

## 2. Task Triage and Mid-Session Escalation

Select the document set based on task scope and runtime:

| Task Tier                                          | Criteria                                                                                                    | `tasks.md` | `NN-<slug>.plan.md` | `NN-<slug>.report.md` | Chat Reply                                                                                                          |
|----------------------------------------------------|-------------------------------------------------------------------------------------------------------------|------------|---------------------|-----------------------|---------------------------------------------------------------------------------------------------------------------|
| **Tier 0: Quick Q&A**                              | Fast explanations or code lookups with zero file edits                                                      | No         | No                  | No                    | Direct Mode 1 answer                                                                                                |
| **Tier 0-Extended: Audit / Investigation**         | Extended read-only code review, migration audit, or root-cause analysis                                     | Yes        | No*                 | Yes (Audit mode)      | 1-to-2 sentence link to report (*write plan only if `/plan` was invoked)                                            |
| **Tier 1: Trivial Edit**                           | Fast, obvious edit to 1 file (or 1 source file plus its paired test file) with zero architectural decisions | No         | No                  | No*                   | Concise Mode 1 outcome + verification command (*escalate via Mid-Session Escalation if runtime expands)             |
| **Tier 2: Planned, Multi-Step, or Time-Intensive** | `/plan` invoked, cross-module or 3+ file changes, architectural decisions, or extended execution/debugging  | Yes        | Yes                 | Yes (Impl mode)       | 1-to-2 sentence link to plan + `tasks.md` (when awaiting approval) and 1-to-2 sentence link to report at completion |

**Mid-Session Escalation**: If a task that started as Tier 1 expands beyond a paired source-and-test edit, uncovers
architectural trade-offs, or requires extended debugging across multiple attempts, allocate the next ID `NN` in
`tasks.md` without fabricating a retroactive plan, track remaining steps there, and write `NN-<slug>.report.md` at
completion.

---

## 3. Preparation Phase: `NN-<slug>.plan.md` and `tasks.md`

Use the copy-ready skeletons in [references/session-templates.md](references/session-templates.md). Follow
`rules/AGENTS.md` Section 3 for routine `tasks.md` entries, and activate `new::docs` when drafting substantial
plans, reports, or Korean session documents.

### 3.1 Authoring Clear, Scannable `NN-<slug>.plan.md` Documents

Model `NN-<slug>.plan.md` on the structured technical design format so reviewers grasp boundaries and architecture in
one pass:

1. **Header metadata and strict heading hierarchy**: Open with `# Plan NN: <Short Task Title>`, followed by `Task` (link
   to `tasks.md`), `Target` (`<repo> @ <branch> (<short-sha>)`), and optional `Follows` (link to a prior task's report
   when chaining work). Use monotonic `H1 -> H2 -> H3 -> H4` nesting with one `H1` per document.
2. **Required core in every plan**:
    - `## Requirements`: `### Overview & Goals` (2 to 3 sentences plus bulleted `Expected outcomes`) and `### Scope`
      split into `#### In Scope` and `#### Out of Scope`.
    - `## Technical Design`: `### Current Implementation` (citing exact `file:line` facts), `### Key Decisions`,
      `### Proposed Changes`, and `### File Structure` (ASCII tree annotated with `(added: ...)`, `(modified: ...)`, or
      `(deleted: ...)`).
    - `## Testing`: `### Validation Approach` (exact CLI commands), `### Key Scenarios`, and `### Test Changes`.
3. **Conditional sections by task complexity**: Keep compact plans between 40 and 90 lines, omit long function bodies or
   duplicated external specs, and include optional sections only when relevant:
    - Requirements & decisions: `### Open Questions & Assumptions` (when ambiguities or trade-offs require
      confirmation), `### User Stories`, `### Functional Requirements`, `### Non-Functional Requirements`, and
      `## Alternatives Considered`.
    - Design & contracts: `### Data Models / Contracts` (concise interfaces, types, or DDL only), `### Components`,
      `### Architecture Diagram` (Mermaid when 3 or more components interact), and `### Risks`
      (`Risk | Impact | Mitigation`).
    - Interfaces & rollout: `## API Reference`, `## Migration Plan`, and `### Edge Cases`.
4. **Omit delivery steps**: Never place step-by-step execution checklists inside `NN-<slug>.plan.md`. Put all execution
   items in `tasks.md`.

### 3.2 Updating the Session Hub (`tasks.md`)

1. **Maintain the top Overview Table**: Keep `# Session Tasks` and the `# | Status | Task | Docs` table at the top of
   `tasks.md` so every task's status and `[plan]` / `[report]` links remain visible in the first 10 lines.
2. **Collapse finished tasks safely**: Before adding Task `NN`, confirm that any prior completed or cancelled task is
   collapsed in a `<details>` block (`<summary>[x] Task 01 - Title</summary>`). Place Markdown links in the Overview
   Table and on the first Markdown line inside `<details>`, never inside `<summary>`. Once more than 3 tasks finish in
   one session, older collapsed `<details>` blocks can keep only `Docs` and `Summary` instead of every historical
   checkbox.
3. **Expand the active task**: Append `## Task NN - <Title>` with `Status`, `Docs`, a 1-sentence `Summary`, and 3 to 7
   `### Step N: <Title>` blocks (imperative in English, declarative in Korean). Steps cover concrete execution,
   verification, and reporting work only; never create a step for initializing a plan, opening the workspace, or
   bootstrapping `tasks.md`. Start each step with one sentence stating what works when that step finishes. Follow with
   2 to 5 bounded `- [ ]` checkboxes naming target files, symbols, and test commands (one action per checkbox, without
   chaining sequential actions via "and then").
4. **Plan Approval Gate**: Use `NN-<slug>.plan.md` unless the user or host workflow explicitly requires a host-native
   plan artifact. If the user invoked `/plan` or requested approval before edits, stop after creating
   `NN-<slug>.plan.md` and updating `tasks.md`. Reply in 1 to 2 sentences linking both files (flagging open decisions if
   present) without re-summarizing the plan, and wait for explicit approval using the active host's approval prompt
   ([../../harnesses/README.md](../../harnesses/README.md)). On autonomous multi-step requests without a plan-approval
   request, move directly to Step 1.

---

## 4. Execution Phase: Live `tasks.md`, Scope Guard, and Phased Code

### 4.1 Live `tasks.md` Updates, Scope Guard, and Cancellation

1. **Check checkboxes as you progress**: Mark the single active item `- [ ] **(in progress)**` under the active task in
   `tasks.md` (preserving standard GFM `- [ ]` syntax) and flip it to `- [x]` immediately after verification passes.
   Keep the Overview Table's `Status` column (`In Progress (Step X/Y)`) in sync.
2. **Enforce `Out of Scope` boundaries**: When you spot unrelated bugs, stale docs, or refactor ideas during execution,
   leave out-of-scope files untouched and record exact `file:line` and priority (`MUST`, `SHOULD`, `COULD`) for
   `NN-<slug>.report.md`.
3. **Handle abandoned or superseded tasks**: If the user cancels Task `NN` or pivots to Task `MM`, update Task `NN` in
   the Overview Table to `Cancelled` or `Superseded by Task MM`, collapse its section in `tasks.md`, and keep
   `NN-<slug>.plan.md` intact on disk.

### 4.2 Calibrated Scaffold-First Implementation

Calibrate implementation passes to change complexity instead of rushing multi-file edits in one pass:

- **Small localized edits** (single-function fix, config tweak, isolated helper): Edit directly, then run the formatter,
  linter, and targeted tests.
- **Multi-function features, new modules, or structural refactors**: Build in four phases:
    1. **Phase 1 (Scaffold contracts)**: Create target files, data types, interfaces, boundary docblocks, and function
       signatures with stub bodies (`todo!()`, `throw new Error("TODO: ...")`,
       `raise NotImplementedError("TODO: ...")`).
    2. **Phase 2 (Validate the skeleton)**: Run the compiler, type checker, or IDE diagnostics (`new::tools-intellij`)
       on the skeleton to verify module boundaries and caller-callee types before writing internal logic.
    3. **Phase 3 (Fill bodies incrementally)**: Implement bodies in dependency order (foundational domain/data helpers
       first, outer handlers/UI second). When 2 or more independent read-only subsystem explorations or independent
       function stub implementations can run in parallel once interfaces and contracts compile, delegate them
       concurrently
       to subagents.
    4. **Phase 4 (Validate each slice)**: Run formatters, linters, and targeted tests after each logical slice before
       checking off the step in `tasks.md`.

### 4.3 Clean Human Handoff When Pausing Mid-Session

Keep the working tree compiling between steps. When pausing multi-step work or asking for user input mid-session:

1. Update `tasks.md` so `- [x]` and `- [ ] **(in progress)**` reflect exact live state.
2. State three brief facts in chat: (a) what works right now and the command to test it, (b) the primary entry-point
   `file:function`, and (c) the single next step.

### 4.4 Code `TODO` Lifecycle and Atomic Git Commits

1. **Active code stubs**: Put any blocker or condition first
   (`// TODO: Once webhook v2 payload lands, remove legacy signature fallback.`). Delete all temporary `TODO` comments
   and stubs before marking the task complete unless work was explicitly deferred with user approval.
2. **Atomic Git commits** (when committing is requested or part of the repository workflow):
    - Verify formatters, linters, targeted tests, and affected docs before committing.
    - Commit one verified logical change per commit without mixing unrelated formatting sweeps or temporary workspace
      session files (see [../../references/session-contract.md](../../references/session-contract.md)).
    - Match repository commit history (`feat:`, `fix:`, or plain imperative subject lines) under the user's configured
      Git author identity.

---

## 5. Completion Phase: Dual-Mode `NN-<slug>.report.md` and Minimal Handoff

When a Tier 2 task, Tier 0-Extended audit, or escalated task finishes:

1. **Write `NN-<slug>.report.md`** using [references/session-templates.md](references/session-templates.md) with
   `# Report NN: <Title>`, metadata (`Task`, `Outcome`, `Target`, and `Plan` when present), and `H1 -> H2 -> H3`
   nesting:
    - **Implementation mode** (code edits):
        - `## Summary & Outcome`: Requested goal, completion state, and scope adherence.
        - `## Actions Completed`, containing `### Files Changed` followed by conditional `### Plan Deviations`. List
          every file individually when 15 or fewer files changed. When more than 15 files changed, include the diff
          stat, group bulk directories with counts, and list key architectural files individually.
        - `## Verification & How to Run`: `Check | Command | Result | Notes` table using `PASS`/`FAIL`/`SKIPPED`/
          `NOT RUN`, a `**Try**:` command, and `**Unverified / Limitations**:` whenever checks were skipped or deferred.
        - Conditional `## Operational Notes & Rollback` and `## Follow-Up & Future Work`
          (`ID | Priority | Location | Follow-Up Action` using `F1`, `F2`, ...).
    - **Audit / Investigation mode** (read-only reviews or root-cause analyses): Include `## Summary & Verdict`,
      `## Scope & Verification Matrix`, `## Findings` grouped by severity (`Critical`, `High`, `Medium`, `Low` with
      `C1`/`H1`/`M1`/`L1` IDs and `file:line`), and `## Recommended Next Tasks`
      (`ID | Priority | Location | Follow-Up Action`).
2. **Close out Task `NN` in `tasks.md`**: Mark all completed checkboxes `- [x]`, set the Overview Table row to `Done`
   with the `[report]` link, and collapse Task `NN` into a `<details>` block.
3. **Minimal chat handoff**: Do not paste action lists, verification logs, or follow-up rows into chat. Reply in 1 to 2
   sentences stating completion and linking `NN-<slug>.report.md` using the active host's link format
   ([../../harnesses/README.md](../../harnesses/README.md)).

---

## 6. Anti-Spiral Debugging, Safety Gates, and References

1. **Anti-spiral protocol**: Read complete error output and stack traces before editing code. If a failure remains
   unresolved after 2 to 3 fix attempts, stop editing, state confirmed facts versus unverified assumptions, and ask one
   focused diagnostic question.
2. **Destructive action and secret gate**: Follow `rules/AGENTS.md` Section 1.2 for secret-file exclusion and
   destructive-action confirmation gates across file deletions, Git history mutations, database mutations, and external
   publishes or production deploys.
3. **Templates**: Read [references/session-templates.md](references/session-templates.md) for copy-ready `tasks.md`,
   `NN-<slug>.plan.md`, Implementation and Audit `NN-<slug>.report.md`, and chat handoff structures.
