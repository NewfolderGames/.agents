---
name: my-working-task
description: >-
  Plan, track, execute, and report engineering tasks using Junie-style structured plans
  (plan.md with In Scope and Out of Scope boundaries), standalone live checkbox checklists
  (todo.md), calibrated scaffold-first phases, atomic Git commits, and session completion
  reports (report.md). Activate this skill when /plan is invoked, preparing or executing
  multi-step changes, tracking task progress, debugging failures, or wrapping up a session.
---

# Session Planning, Checkbox Tracking, Phased Execution, and Reporting

Run engineering sessions with clear scope boundaries, scannable plans, live progress checkboxes, and structured completion reports so the developer can review decisions quickly or take over the keyboard at any step.

## 1. Project Precedence and Session Directory Resolution

### 1.1 Project Workflow Precedence

Before you plan steps, run checks, or create commits, inspect the target repository's `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, and `CONTRIBUTING.md`:
1. Follow the repository's required verification commands, branch rules, code generation steps, and commit message conventions first.
2. Apply the rules in this skill whenever the repository does not specify its own workflow.

### 1.2 Session Document Directory Resolution

When a task triggers `plan.md`, `todo.md`, or `report.md` (Section 2), write them to the first accessible location in this order:
1. **Antigravity `<Artifact Directory>`**: Write `<appDataDir>/brain/<conversation-id>/plan.md`, `todo.md`, and `report.md` with `ArtifactMetadata` (`UserFacing: true`, `RequestFeedback: true` on `plan.md` when awaiting user approval, and `RequestFeedback: false` on `todo.md` and `report.md`).
2. **Agent-native plan or session directory**: In other AI coding agents, write to the agent's own accessible session directory (for example, `.junie/plans/` in JetBrains Junie).
3. **Workspace fallback**: When no agent-specific directory exists or is accessible, write to `.agents/sessions/<YYYYMMDD-HHMM>-<slug>/` (`plan.md`, `todo.md`, `report.md`) inside the workspace. Never stage or commit fallback `.agents/sessions/` files unless the user explicitly asks.

---

## 2. Task Triage and Mid-Session Escalation

Select the document set based on task scope and runtime:

| Task Tier | Criteria | `plan.md` | `todo.md` | `report.md` | Chat Reply |
|---|---|---|---|---|---|
| **Tier 0: Read-Only Q&A** | Fast explanations or code lookups with zero file edits | No | No | No* | Direct Mode 1 answer (*write `report.md` if explicitly planned or after extended multi-step research) |
| **Tier 1: Trivial Edit** | Single-file, obvious, fast edit with zero architectural decisions | No | No | No* | Concise Mode 1 outcome + verification command (*promote to `report.md` if debugging takes substantial time) |
| **Tier 2: Planned, Multi-Step, or Time-Intensive** | `/plan` invoked, 2 or more files, architectural decisions, or extended execution/debugging time | Yes | Yes | Yes | 1-to-2 sentence link to `plan.md` + `todo.md` (when awaiting approval) and 1-to-2 sentence link to `report.md` at completion |

**Mid-Session Escalation**: If a task started as Tier 1 expands to 2 or more files, uncovers architectural trade-offs, or requires extended debugging across multiple attempts, escalate immediately: create `todo.md` if multiple steps remain, and always write `report.md` at completion.

---

## 3. Preparation Phase: Junie-Style `plan.md` and Standalone `todo.md`

Use the skeletons in [references/session-templates.md](references/session-templates.md) and write all prose in Practical Software STE (`my-writing-docs`).

### 3.1 Authoring Clear, Scannable `plan.md` Documents

Model `plan.md` on JetBrains Junie's structured technical design format so reviewers grasp boundaries and architecture in one pass:
1. **`# Requirements` with Strict Scope Boundaries**:
   - Open with `Overview & Goals` (2 to 3 sentences on the problem and current gap, plus bulleted `Expected outcomes`).
   - Always include `Scope` split into `#### In Scope` and `#### Out of Scope`. Use `Out of Scope` to draw explicit boundaries around adjacent features, migrations, or refactors that belong in a separate session.
   - List numbered `Functional Requirements` and measurable `Non-Functional Requirements` (latency, concurrency, compatibility, or size bounds). Include `User Stories` only when user or operator workflows change.
2. **`# Technical Design` Focused on Contracts, Not Code Dumps**:
   - Cite exact `file:line` facts under `Current Implementation` and state numbered `Key Decisions` with concise rationale.
   - Show only concise interfaces, types, structs, or SQL schemas under `Data Models / Contracts`. Never paste long function bodies into `plan.md`.
   - Include a `Components` table, an ASCII `File Structure` tree annotated with `(added: ...)`, `(modified: ...)`, or `(deleted: ...)`, and a `Risks` table (`Risk | Impact | Mitigation`). Add a Mermaid `Architecture Diagram` when 3 or more components interact.
3. **Conditional Sections Only When Relevant**:
   - Include `# API Reference`, `# Migration Plan` (additive DDL, rollout order, and `< 1 minute` rollback), and `# Alternatives Considered` (comparison table + why chosen option won) only when the task touches those areas. Omit unused sections to keep small plans compact.
4. **`# Testing` Without Inline Delivery Steps**:
   - Specify `Validation Approach` (exact CLI commands), `Key Scenarios`, `Edge Cases`, and `Test Changes`.
   - Never place `Delivery Steps` inside `plan.md`. Put all step-by-step execution items in `todo.md`.

### 3.2 Authoring Standalone `todo.md` Checklists

1. Link `plan.md` at the top of `todo.md` and show a one-line `Status` field.
2. Group work into `### Step N: <Imperative Title>` sections (3 to 7 steps for typical features).
3. Start each step with one sentence stating what works once that step finishes, followed by 2 to 5 concrete `- [ ]` checkboxes naming target files, symbols, and test commands (one bounded action per checkbox, without chaining sequential actions via "and then").
4. **Plan Approval Gate**: If the user invoked `/plan` or asked to review the plan before edits, stop after creating `plan.md` and `todo.md`. Output a 1-to-2 sentence chat reply linking both files without re-summarizing `plan.md`, and wait for explicit approval. On autonomous multi-step requests without `/plan`, proceed directly to Step 1.

---

## 4. Execution Phase: Live Checkboxes, Scope Guard, and Phased Code

### 4.1 Live `todo.md` Updates and Scope Guard

1. **Check checkboxes as you progress**: Mark the single active item `- [ ] **(in progress)**` (preserving standard `- [ ]` syntax so Markdown viewers render real checkboxes). Update each item to `- [x]` immediately after its verification check passes.
2. **Enforce `Out of Scope` boundaries**: When you spot unrelated bugs, stale docs, or refactor ideas during execution, do not expand the current session's edits. Leave out-of-scope files untouched and note the exact `file:line` and severity (`[MUST]`, `[SHOULD]`, `[COULD]`) for `report.md`.

### 4.2 Calibrated Scaffold-First Implementation

Calibrate implementation passes to change complexity instead of rushing multi-file edits in one giant pass:
- **Small localized edits** (single-function fix, config tweak, isolated helper): Edit directly, then run the formatter, linter, and targeted tests.
- **Multi-function features, new modules, or structural refactors**: Build in four phases:
  1. **Phase 1 (Scaffold contracts)**: Create target files, data types, interfaces, boundary docblocks, and function signatures with stub bodies (`todo!()`, `throw new Error("TODO: ...")`, `raise NotImplementedError("TODO: ...")`).
  2. **Phase 2 (Validate the skeleton)**: Run the compiler, type checker, or IDE diagnostics (`my-using-intellij`) on the skeleton to verify module boundaries and caller-callee types before writing internal logic.
  3. **Phase 3 (Fill bodies incrementally)**: Implement bodies in dependency order (foundational domain/data helpers first, outer handlers/UI second). Delegate independent stubs to subagents when helpful (`my-using-tools`).
  4. **Phase 4 (Validate each slice)**: Run formatters, linters, and targeted tests after each logical slice before checking off the step in `todo.md`.

### 4.3 Clean Human Handoff When Pausing Mid-Session

Keep the working tree compiling between steps. When pausing multi-step work or asking for user input mid-session:
1. Update `todo.md` so `- [x]` and `- [ ] **(in progress)**` reflect exact live state.
2. State three brief facts in chat: (a) what works right now and the command to test it, (b) the primary entry-point `file:function`, and (c) the single next step.

### 4.4 Code `TODO` Lifecycle and Atomic Git Commits

1. **Active code stubs**: Put any blocker or condition first (`// TODO: Once webhook v2 payload lands, remove legacy signature fallback.`). Delete all temporary `TODO` comments and stubs before marking the session complete unless work was explicitly deferred with the user's approval.
2. **Atomic Git commits** (when committing is requested or part of the repo workflow):
   - Verify formatters, linters, targeted tests, and affected docs before committing.
   - Commit one verified logical change per commit without mixing unrelated formatting sweeps or temporary `.agents/sessions/` files.
   - Match repository commit history (`feat:`, `fix:`, or plain imperative subject lines) under the user's configured Git author identity.

---

## 5. Completion Phase: `report.md` and Minimal Chat Handoff

When a Tier 2 task (or an escalated time-intensive task) finishes and all `todo.md` checkboxes are marked `- [x]`:
1. Write `report.md` in the resolved session directory using the template in [references/session-templates.md](references/session-templates.md):
   - **`# Summary & Outcome`**: Goal, final outcome, scope adherence, and links to `plan.md` and `todo.md`.
   - **`# Actions Completed`**: Concise summary by component, a `Files Changed` table with clickable `file://` links, and `Plan Deviations` (if any).
   - **`# Verification & How to Run`**: Exact commands executed, pass/output counts, and a concrete `**Try**:` command or entry point.
   - **`# Follow-Up & Future Work`**: Out-of-scope items and mid-session discoveries rendered as a Markdown table (`Priority | Location | Follow-Up Action` with `MUST`, `SHOULD`, and `COULD` rows) for future sessions.
2. **Tell the user to read `report.md` without chat duplication**: Do not paste action lists, verification logs, or `[MUST]` / `[SHOULD]` / `[COULD]` bullets into your final chat message. Reply in 1 to 2 sentences stating completion and linking `[report.md](file:///...)`.

---

## 6. Anti-Spiral Debugging, Safety Gates, and References

1. **Anti-spiral protocol**: Read complete error output and stack traces before editing code. If a failure remains unresolved after 2 to 3 fix attempts, stop editing, state confirmed facts versus unverified assumptions, and ask one focused diagnostic question.
2. **Destructive action gate**: Ask explicit user confirmation before deleting user files (`rm`, `rm -rf`), running destructive Git commands (`git reset --hard`, `git push --force`, `git clean -fd`, deleting branches), mutating databases (`DROP`, `TRUNCATE`, irreversible migrations), or touching credentials/secrets.
3. **Templates**: Read [references/session-templates.md](references/session-templates.md) for copy-ready `plan.md`, `todo.md`, `report.md`, and chat handoff structures.
