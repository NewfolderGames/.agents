---
name: new::ask
description: >-
  Run deep, multi-round questioning across planning and execution to uncover project unknowns,
  ambiguous patterns, unclear instructions, and implementation preferences, calibrated to the
  user's project familiarity, structure stance, and chosen execution check-in cadence. Activate
  this skill ONLY when the user explicitly requests it (for example, naming `new::ask` or
  explicitly asking the agent to ask lots of questions or check in throughout execution).
---

# Explicit Multi-Round Questioning (`new::ask`)

Interview the user thoroughly during planning and check in at the user's chosen cadence during execution so assumptions,
project unknowns, conflicting codebase patterns, and design trade-offs are resolved explicitly rather than guessed.

## 1. Explicit Activation Gate, Precedence, and Exit Boundary

1. **Explicit activation only**: Activate this skill only when the user explicitly names `new::ask` or explicitly asks
   you to ask many questions, clarify ambiguities thoroughly, or check in across planning and execution. Never
   auto-activate on routine requests.
2. **Mode 1 questioning override**: While `new::ask` is active, suspend the `rules/AGENTS.md` Section 2.1 Mode 1
   single-question and brevity limits during questioning rounds so you can ask multi-round grouped questions freely.
3. **Unconditional safety and prose invariants**: Keep `rules/AGENTS.md` Section 1.2 Operational Safety Gates active at
   all times (never read or print secrets, and always ask before destructive actions even when execution cadence is
   `None`). Write all questions and summaries in literal, anti-slop prose matching `rules/AGENTS.md` Section 3.
4. **Exit boundary**: Deactivate this override automatically when the active task finishes or when the user asks you to
   stop questioning and proceed autonomously.

---

## 2. Kickoff Calibration (Round 1 — Mandatory Before Deep Planning or Edits)

Before asking deep technical questions or editing files, ask these three calibration questions in one grouped round
using
the host's structured user prompt tool (see [../../harnesses/README.md](../../harnesses/README.md), or numbered options
in chat):

1. **Execution-Phase Question Cadence**: How often should the agent pause to ask questions during execution?
    - **Frequent**: Pause and ask at meaningful implementation choices, edge cases, minor plan-vs-code mismatches, and
      slice transitions during execution.
    - **Less frequent**: Continue through routine details and ask only at major milestones, architectural forks,
      unexpected codebase discoveries, or scope changes.
    - **None (Plan-only)**: Front-load all questions during the planning phase, then execute autonomously without
      stopping except for hard blockers, anti-spiral triggers, or Section 1.2 safety gates.
2. **Project Familiarity**: How familiar are you with this repository?
    - **Unfamiliar / New**: Provide brief, concrete codebase context (`file:line`, existing pattern, and trade-off
      summary) before each question so you can decide without inspecting files first.
    - **Moderately familiar**: Cite relevant modules and files briefly and focus questions on non-obvious behavior, edge
      cases, and design trade-offs.
    - **Deeply familiar**: Skip introductory codebase explanations and ask direct, high-density questions focused on
      intent, constraints, and architecture.
3. **Implementation Structure and Style Stance**: How should this task shape code structure and style?
    - **Strictly follow existing structure and style**: Match current directory layout, patterns, abstractions, and
      conventions strictly, even where older idioms exist.
    - **Follow existing style, improve local structure**: Stay compatible with repository conventions while improving
      local modularity, naming, or clarity inside touched areas.
    - **New structure for future extension**: Design a cleaner, extensible module or architecture boundary for this
      feature and confirm migration scope and coexistence with legacy code.

---

## 3. Plan-Phase Deep Interrogation (Multi-Round)

1. **Inspect before asking**: Read relevant code, guides, and configs first (or run `new::project-scout` for unfamiliar
   repositories) so you never ask questions that files already answer. When code is ambiguous or contradictory, cite
   exact `file:line` evidence.
2. **Probe all four question dimensions** across as many rounds as needed until no material ambiguity remains:
    - **Unknowns about the project**: Undocumented business rules, implicit invariants, external systems or APIs,
      runtime or deployment constraints, and backward-compatibility requirements.
    - **Uncertainties observed in the project**: Conflicting patterns (`fileA:line` versus `fileB:line`), dead-looking
      code, unclear ownership boundaries, missing tests or configs, and risky side effects.
    - **Unclear or underspecified instructions**: Ambiguous boundaries (`In Scope` versus `Out of Scope`), acceptance
      criteria, edge cases, error or failure behavior, and non-goals.
    - **Implementation choices**: Module placement, API or interface contracts, data flow, dependencies, test depth, and
      migration or extensibility trade-offs calibrated to the selected **Implementation Structure and Style Stance**.
3. **Questioning mechanics**:
    - When `new-worker-ui` is connected, call `ask_questions` with grouped `sections`, `questions` (`single_select`,
      `multi_select`, `text`, `textarea`, `boolean`, `allowOther`, `hint`, `contextRefs`, plus optional per-question
      `blockingMode`: `"immediate"` | `"before_step_finish"` | `"anytime"` with `taskNumber` and `stepNumber`), and
      `sessionId`. Stop and wait when `"immediate"` questions are present; for `"before_step_finish"` or `"anytime"`,
      continue allowed work and read submitted answers from chat messages or `get_session_state`.
    - When `new-worker-ui` is unavailable, group 2 to 5 related questions per round using the host's structured user
      prompt tool (putting a recommended option first with a 1-line rationale whenever feasible) alongside short open
      questions in chat.
    - Calibrate explanation depth strictly to the user's selected **Project Familiarity**.
    - Follow up in additional rounds whenever an answer uncovers a new fork, dependency, or trade-off.
    - Before leaving planning, summarize the locked calibration (`Cadence`, `Familiarity`, `Structure Stance`) and
      confirmed decisions.

---

## 4. Execution-Phase Questioning Protocol

Apply the locked **Execution-Phase Question Cadence** throughout implementation:

- **`Frequent`**: Ask at natural checkpoints (after scaffolding contracts, before non-trivial modules or slices, and
  whenever naming, error contracts, edge cases, helper extraction, or plan-vs-code friction arise). Bundle closely
  related micro-questions into one concise prompt rather than interrupting on every line.
- **`Less frequent`**: Resolve routine details using the approved plan and structure stance. Pause and ask only at major
  milestones, unexpected coupling or legacy conflicts, API or data-model shifts, or scope expansion.
- **`None`**: Do not ask preference or design-refinement questions during execution. Follow the approved plan and
  structure stance, record minor assumptions for the final summary or report, and stop only for hard blockers, Section
  1.2 safety gates, or anti-spiral limits (2 to 3 failed fix attempts).
- **Live cadence adjustment**: Honor mid-execution user overrides immediately (for example, switching from `Frequent` to
  `Less frequent` or `None`, or requesting closer check-ins on a specific module).

---

## 5. Coordination with `new-worker` Skills

- **With `new::task`**: Record confirmed answers in `NN-<slug>.plan.md` (`### Key Decisions` and
  `### Open Questions & Assumptions`), keep `tasks.md` synced to live state when pausing for execution questions, and
  list any remaining assumptions in `NN-<slug>.report.md`.
- **With `new::project-scout`**: Run repository scouting before Round 2 planning questions when neither agent nor user
  has a fresh map of a large codebase.
