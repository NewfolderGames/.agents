---
name: my-working-task
description: >-
  Run engineering tasks with project-workflow awareness, calibrated scaffold-first phases,
  clean human handoffs, TODO tracking, anti-spiral debugging, and atomic Git commits.
  Activate this skill when planning or implementing multi-step changes, managing stubs
  and TODOs, debugging failures, or committing work.
---

# Task Execution, Phased Implementation, and Human Handoff

Execute tasks so the human developer can follow every step without cognitive overload and take over the keyboard at any point.

## 1. Project Workflow Precedence

Before you plan steps, run checks, or create commits, inspect the target repository's `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `README.md`, and `CONTRIBUTING.md`:
1. Follow the repository's required verification commands, branch rules, code generation steps, and commit message conventions first.
2. Apply the rules in this skill whenever the repository does not specify its own workflow.

---

## 2. Bounded Steps, Triage, and Human Resumability

### 2.1 Turn-by-Turn Clarity

1. **One bounded action per numbered step**: Break multi-step work into numbered items without chaining sequential actions via "and then" inside one step.
2. **Preconditions right where needed**: State required setup or dependencies immediately before the step that uses them.
3. **Restate progress every turn**: Keep working-memory load near zero by stating what finished and what comes next:
   ```text
   Step 2 of 4 done: token parser and unit fixtures passing. Next: wire middleware into router.
   ```
4. **One active checklist item**: Keep at most one task item marked in progress (`[/]`) at a time.
5. **Concrete time estimates and next steps**: Give concrete durations ("About 10 minutes since unit fixtures already exist") and end open turns with one concrete action under 2 minutes.

### 2.2 Leave a Clean Workbench for the Human

Design every intermediate state so the maintainer can resume work immediately without reverse-engineering what happened:
- Keep the tree compiling and tests runnable between phases.
- When pausing multi-phase work or handing back control, state three facts clearly:
  1. **What works right now** and the exact command to run or test it.
  2. **Where to look** (the primary entry-point file and function).
  3. **What remains** (the single next logical step).

### 2.3 Tangent Suppression

Finish the requested task first. When you notice unrelated bugs, stale dependencies, or cleanup opportunities along the way, do not derail the active change. List them separately at the end of the turn:

```text
Middleware wired and passing tests. Separate findings if you want to tackle one next:

- [MUST  ] `auth/refresh.ts:88` swallows expired-key errors without logging.
- [SHOULD] `README.md` still lists the removed `AUTH_LEGACY_SECRET` variable.
- [COULD ] Delete unused fixture helper in `auth/__fixtures__/old_tokens.ts`.
```

---

## 3. Calibrated Scaffold-First Implementation

Do not rush multi-file changes into a single giant pass just to save tokens or turns. Spend extra turns to validate structure before writing details, calibrated to task size:

- **Small localized edits** (single-function bug fix, config tweak, small isolated helper): Implement directly, then run the formatter, linter, and targeted tests.
- **Multi-function features, new modules, or structural refactors**: Build in four phases:
  1. **Phase 1 (Scaffold contracts)**: Create target files, data types, interfaces, boundary docblocks, and function signatures with stub bodies (`todo!()`, `throw new Error("TODO: ...")`, `raise NotImplementedError("TODO: ...")`).
  2. **Phase 2 (Validate the skeleton)**: Run the compiler, type checker, or IDE diagnostics on the skeleton. Confirm that module boundaries, imports, and caller-callee types fit cleanly before writing internal logic.
  3. **Phase 3 (Fill bodies incrementally)**: Implement bodies in dependency order (foundational data/domain helpers first, outer handlers/UI second). Delegate independent stubs to subagents when helpful (`my-using-tools`).
  4. **Phase 4 (Validate each slice)**: Run formatters, linters, and targeted tests after each logical slice before moving on.

---

## 4. `TODO` Lifecycle and Atomic Git Commits

### 4.1 Active Stubs and `TODO` Cleanup

1. Use `TODO` markers and language-standard unimplemented stubs (`@todo`, `// TODO:`, `todo!("...")`, `UnsupportedOperationException`, `NotImplementedError`) to track unfinished slices during Phase 1–3 or across paused sessions.
2. Put any blocker or condition first (`// TODO: Once webhook v2 payload lands, remove legacy signature fallback.`).
3. Delete all temporary `TODO` comments and stubs once the task is complete and verified. Leave a `TODO` in committed code only when work is intentionally deferred with the user's knowledge.

### 4.2 Atomic Git Commits

When committing work in Git:
1. **Verify before committing**: Make sure formatters, linters, targeted tests, and any affected docs (`README.md`, `AGENTS.md`, API schemas, comments) are updated and clean.
2. **One logical change per commit**: Commit each verified sub-task before starting the next. Never mix unrelated formatting sweeps, refactors, and feature work in one commit.
3. **Match repo history**: Follow the repository's existing commit style (`feat:`, `fix:`, Conventional Commits, or plain imperative subject lines) and language. Write plain factual commit bodies explaining what changed and why.
4. **Preserve authorship**: Commit under the user's configured Git author identity, adding `Co-authored-by:` when appropriate for the environment.

---

## 5. Anti-Spiral Debugging and Safety Gates

### 5.1 Anti-Spiral Protocol

1. Read complete error output, stack traces, and failing lines before editing code.
2. If a failure is still unresolved after 2 to 3 fix attempts, **stop guessing and stop editing**.
3. State the exact assumptions you made, which ones remain unverified, and ask the user one focused diagnostic question.

### 5.2 Destructive Action Gate

Ask explicit user confirmation before any irreversible or high-risk operation:
- Deleting user files or directories (`rm`, `rm -rf`)
- Destructive Git history or worktree commands (`git reset --hard`, `git push --force`, `git clean -fd`, deleting branches)
- Database or state mutations (`DROP`, `TRUNCATE`, irreversible migrations, production scripts)
- Touching credentials or secrets (never stage or commit `.env` files, tokens, or private keys)
