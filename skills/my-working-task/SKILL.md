---
name: my-working-task
description: >-
  Run engineering tasks with bounded steps, scaffold-first phased implementation,
  active TODO tracking, anti-spiral debugging, and atomic Git commits. Activate this
  skill before planning or implementing code changes, fixing build or test errors,
  managing stubs and TODO markers, or creating Git commits.
---

# Task Execution, Phased Implementation, and Git Workflow

Run engineering tasks in bounded, verifiable phases. Build skeletons before bodies, track active stubs explicitly, and commit each verified sub-task atomically.

## 1. Bounded Multistep Execution and Triage

### 1.1 Multistep Turn Discipline

When a task takes more than one step, obey these execution rules:
1. **Number multistep tasks**: Write a numbered list where each item is one bounded action.
2. **Eliminate chained actions**: Do not join sequential operations with "and then" inside one step.
3. **State preconditions first**: State required preconditions or dependencies immediately before the step that requires them.
4. **Restate state at every turn**: Start each turn update with completed items and the active next step:
   ```text
   Step 3 of 5 done: schema updated. Next: backfill the new column.
   ```
5. **Keep one active checklist item**: If a harness task tool or checklist exists, mark one item in progress (`[/]`) at a time.
6. **End with one concrete action**: If work stays open, end the turn with one bounded action that takes less than 2 minutes:
   ```text
   Next: run `pnpm test -- auth.spec.ts` and inspect the first failing assertion.
   ```
7. **State concrete time and scale**: Replace vague estimates with concrete units ("About 15 minutes if unit tests cover the handler.").

### 1.2 Tangent Suppression and Priority Triage

Resolve the primary task first. If you find secondary defects, stale dependencies, or refactoring work during execution, obey these rules:
1. Do not interrupt the primary task flow.
2. List secondary findings at the end of the turn under priority tags:
   ```text
   Fix generated. Additional problems found, select one to resolve next:

   - [MUST  ] Stale dependencies: 5 packages are outdated. Run `pnpm outdated`.
   - [SHOULD] README.md out of date: Update authentication setup instructions.
   - [COULD ] Extract shared token utility into a helper module.
   ```

Note: The literal triage tags `[MUST]`, `[SHOULD]`, and `[COULD]` are exempt from the Mode 2 modal ban.

---

## 2. Scaffold-First Gradual Implementation

Do not write full implementations in one pass. One-pass generation causes cascading edits and structural drift. Build every feature or refactor in four phases:

1. **Phase 1 (Scaffold signatures and types)**: Create target files, data structures, interfaces, 6-part public docstrings (see `my-working-project`), and function signatures with unimplemented stub bodies first.
2. **Phase 2 (Validate the skeleton)**: Run the compiler, type tool, or IDE diagnostics on the stubbed skeleton. Make sure that module boundaries, imports, dependency directions, and caller-callee contracts compile before you write body logic.
3. **Phase 3 (Fill bodies incrementally or delegate)**: Implement one function body at a time in dependency order (least volatile modules first). If multiple stubbed functions are independent, invoke subagents (see `my-using-tools`) to fill the bodies against fixed signatures and docstrings.
4. **Phase 4 (Validate each step)**: After you fill each body, run formatters, linters, and targeted unit tests before you move to the next stub.

---

## 3. Active Work Tracking, Stubs, and `TODO` Lifecycle

1. **Mark scaffolded stubs**: If a task is in Phase 1 or Phase 3, or hits a blocker, mark the site with unimplemented stubs and `TODO` comments.
2. **Write `TODO` text in Mode 2**: Activate `my-writing-docs` rules. Put the condition or blocker first, and state an unambiguous imperative action in 20 words or fewer.
3. **Use language-standard markers**:
   - **TypeScript / JavaScript**: JSDoc `@todo`, `// TODO: <imperative instruction>`, or `throw new Error("TODO: <imperative instruction>")`
   - **Rust**: `// TODO: <imperative instruction>`, `todo!("reason")`, or `unimplemented!("reason")`
   - **Go / Java**: `// TODO: <imperative instruction>`, `panic("TODO: ...")`, or `throw new UnsupportedOperationException("TODO: ...")`
   - **Python / Shell / YAML**: `# TODO: <imperative instruction>` or `raise NotImplementedError("TODO: ...")`
4. **Remove completed markers**: After you implement and validate a task, delete all temporary `TODO` comments and stubs before you commit. Never leave stale in-progress markers in committed code.

---

## 4. Verification Gate and Atomic Git Commits

When Git version control is present, run this verification pipeline before every commit:

```text
Scaffold Signatures -> Verify Types -> Fill Bodies Incrementally -> Run Formatter & Linter -> Run Targeted Tests -> Remove Completed TODOs -> Commit
```

When you create commits, obey these rules:
1. **Commit per sub-task**: Commit each verified sub-task before you switch context to the next step. Never bundle unrelated refactors, bug fixes, and features into one commit.
2. **Synchronize documentation**: If behavior, configuration keys, CLI flags, or public interfaces change, update `README.md`, `AGENTS.md`, API specs, schemas, and inline docstrings in Mode 2 inside the same task.
3. **Write imperative subject lines**: Describe what changed in the imperative mood (`Add authentication token validation`).
4. **Write Mode 2 commit bodies**: State plain facts about what changed and why in Mode 2 (see `my-writing-docs`).
5. **Match repository conventions**: Match the repository commit prefix style (such as `feat:`, `fix:`, or Conventional Commits) and language.
6. **Preserve user authorship**: Commit with the configured Git user name and email. Append `Co-authored-by:` for the agent when the environment supports it.

---

## 5. Troubleshooting and Operational Safety Gate

### 5.1 Anti-Spiral Debugging Protocol

When a build, test, or runtime command fails, obey this sequence:
1. **Fail fast**: Read full error logs, stack traces, and exact failure lines before you propose a code change.
2. **Stop after 2 to 3 failed attempts**: If an error persists after 2 to 3 fix attempts, stop iterating on code.
3. **List assumptions**: State the exact assumptions that failed or remain unverified.
4. **Request direction**: Show the exact error output and ask the user one targeted diagnostic question.

### 5.2 Destructive Action Gate

Ask the user for explicit approval before you run a destructive or irreversible command:
- Deleting files or directories (`rm`, `rm -rf`)
- Destructive Git commands (`git reset --hard`, `git push --force`, `git clean -fd`, branch deletion)
- Database mutations (`DROP`, `TRUNCATE`, irreversible schema migrations, or production data scripts)
- Secret handling (never stage or commit `.env` files, private keys, or credentials)
