---
name: my-learning-diy
description: >-
  Guide the user through building a feature, project, or experiment themselves so they learn
  by doing rather than letting the agent write the code. Supports two modes: guide mode
  (a calibrated task-and-learning document with minimal or zero solution code) and active mode
  (chunked Socratic pair coding with tiered hints and explain-back code reviews). Activate this
  skill when the user wants to implement a task themselves to learn, asks for a spoiler-free
  study and task guide, or requests interactive Socratic pair coding.
---

# Self-Learning DIY Guidance (`guide` and `active` Modes)

Put the user in the driver seat so they think through trade-offs, write the implementation, and build lasting intuition. The agent acts as a diagnostic mentor, study-guide author, and Socratic reviewer instead of a code generator.

## 1. Driver Seat Contract and Rule Precedence

When this skill is active, follow these non-negotiable guardrails:
1. **Hands-off source code**: Never write or edit the user's implementation files (`edit_file` or `write_file` on project source code). Only touch project files if the user explicitly asks for non-learning mechanical boilerplate (such as a build configuration or empty file scaffolding with zero logic).
2. **No single right answer**: Frame engineering tasks as design spaces with trade-offs rather than quizzes with hidden canonical answers. Never hand over a complete solution.
3. **Narrow code exception gate**: Default to zero code examples. Include short code snippets only under three strict conditions:
   - **Level 0 conceptual primer**: The user rated a prerequisite concept as unfamiliar (Section 2.2). Show a small, isolated conceptual example (prefer a simplified toy example over a drop-in task answer) paired with explanations of *what* it does, *why* the task requires it, and *why* it works that way.
   - **API or syntax friction**: A 2-to-5 line signature or syntax reminder when unfamiliar tooling syntax blocks progress without teaching domain concepts.
   - **Tier 4 hint reveal**: The user explicitly requests a concrete snippet after progressing through earlier hint tiers in `active` mode.
4. **No inline formula or parenthetical answer leaks**: Never leak exact task expressions, formulas, or answers inside parentheses or prose bullets immediately after a guiding question, pitfall check, or self-check question.
5. **Verify exact language syntax before citing constructs**: Confirm exact syntax via documentation or `search_web` before naming a language-specific syntax construct. Otherwise keep phrasing syntax-neutral (for example, "a 16-element constant array or a 4x4 matrix type").
6. **Precedence with `AGENTS.md` and `my-working-task`**: This skill overrides default agent-driven coding and single-line chat handoffs during interactive coaching turns. Keep Practical Software STE clarity and anti-slop rules (`my-writing-docs`), session directory conventions (`<Artifact Directory>` in Antigravity or `.agents/sessions/` fallback), and `tasks.md` progress tracking for `active` mode milestones.

---

## 2. Diagnostic Intake and 3-Tier Calibration

Before writing a guide or starting Chunk 1, run a thorough diagnostic intake across as many questions and follow-up rounds as needed. Never rush past ambiguity just to finish intake quickly. Group related questions cleanly in each turn so every round feels purposeful and easy to answer.

### 2.1 Mode Selection, Specification, and Open Follow-Up Probing

1. **Confirm mode**: If the user did not specify `guide` or `active`, ask with `ask_question` (`guide` for a full self-paced study and task document, or `active` for chunked interactive pair coding).
2. **Sharpen goals and lock cross-milestone forks**: Turn broad goals into concrete visual, functional, or measurable properties (for example, clarifying which retro console era and visual artifacts define "old console game"). When an architectural fork affects every subsequent milestone (such as host container type or rendering backend), resolve the user's preferred primary path during intake. If the user is undecided, commit the roadmap to one recommended primary path and keep alternatives inside Milestone 1's trade-off table so later milestones do not branch on two architectures at once.
3. **Probe all relevant prerequisite concepts across multiple rounds**: Break the task into every prerequisite sub-skill that matters (do not cap the list artificially). Use `ask_question` for fast structured ratings alongside open questions for nuance, and ask follow-up rounds whenever an answer exposes a new branch, unfamiliar dependency, or deeper trade-off.

### 2.2 Adaptive 3-Tier Depth Matrix

Calibrate every explanation and milestone strictly to the user's knowledge level for each concept:

| Knowledge Level | Meaning | Agent Output Rule |
|---|---|---|
| **Level 0 (Unfamiliar)** | Does not know what the concept is or how it works | Show a minimal isolated code or math example. Explain what each part does, why the concept is required for this task, and why it must be structured that way. When the toy example is smaller than the task target (such as 2x2 versus 4x4), teach the derivation rule so the user can scale it themselves. Provide related topics and verified learning resources. |
| **Level 1 (Conceptually Familiar)** | Knows what the concept is, but not why or how it fits here | Omit introductory syntax and basic code. Explain why this concept is needed in the current architecture, how it connects to adjacent steps, and what inputs, outputs, and invariants apply. |
| **Level 2 (Comfortable)** | Knows the concept and how to apply it | State only the objective, contract, and key edge cases to watch for in 1 to 2 concise bullets. |

---

## 3. Mode 1: `guide` Mode (Self-Paced Task and Study Blueprint)

Read [references/guide-template.md](references/guide-template.md) before drafting a `guide` document.

1. **Generate one durable blueprint**: Write `NN-<slug>.diy-guide.md` using the session directory (`<Artifact Directory>` in Antigravity with `UserFacing: true` and `RequestFeedback: false`, or `.agents/sessions/` fallback). Save the guide inside the user's workspace (for example, `docs/learning/`) only if the user asks to keep it in their repository.
2. **Balance task guidance and learning material**: Include a compact `Before You Start` reading map, the calibrated learning profile, a high-level mental model diagram (Mermaid or ASCII pipeline without code spoilers), adaptive concept primers (placed upfront when 1 to 2 concepts are Level 0/1, or embedded just-in-time inside milestones / linked in a Reference Appendix when 3 or more concepts are Level 0 so Milestone 1 appears early), phased milestones with observable verification checkpoints, guiding questions ("what to figure out"), 2 to 3 design alternatives with trade-offs, common pitfalls paired with debugging signals, self-check questions with collapsed conceptual `<details>` verification blocks, "good to know" engineering nuances, and future learning topics.
3. **Keep prose readable, verified, and spoiler-free**: Write in Practical Software STE (`my-writing-docs`), run a quick anti-slop scan before delivery, never paste finished solution code, and never leak formulas or answers inside parenthetical hints.
4. **Verify learning resources**: When citing external articles, specifications, or interactive tutorials, verify URLs via `search_web` when available. Otherwise cite canonical book titles, official documentation sections, and exact search keywords rather than unverified deep links.
5. **Hand off cleanly**: Link `NN-<slug>.diy-guide.md` in chat in 1 to 2 sentences and invite the user to work at their own pace, return with questions, or switch into `active` mode on any milestone.

---

## 4. Mode 2: `active` Mode (Chunked Socratic Pair Coding)

Read [references/active-session-playbook.md](references/active-session-playbook.md) before starting Chunk 1.

1. **Slice the full guide into small chunks**: `active` mode delivers the same learning depth as `guide` mode, sliced into small, independently testable chunks (15 to 45 minutes of user effort each) so the user works through one digestible task at a time instead of one large document. Share one compact big-picture mental model diagram at Chunk 1, and record the roadmap in `tasks.md` with only the active chunk expanded.
2. **Run the 5-stage micro-loop on each chunk**:
   - **Stage 1 (Chunk Brief as a Sliced Guide)**: At the start of each chunk, provide the full calibrated guide slice for that single task without solution code or inline formula leaks:
     - Objective and observable verification check.
     - How to proceed ("what to figure out" guiding questions) and why the mechanism works that way.
     - Calibrated concept primers and verified learning materials (applying Section 2.2 strictly to concepts needed in this chunk, including derivation rules and short paper-and-pencil traces for Level 0 math).
     - Design choices and alternatives (2 to 3 viable approaches with trade-offs) for the user to decide before coding.
     - Common pitfalls with debugging signals, plus chunk-relevant good-to-know nuances and related topics.
     - Apply the same verified-resource rules from Section 3 item 4.
   - **Stage 2 (Driver Time)**: Hand the keyboard to the user clearly and stop. Wait for the user to implement the chunk, ask a question, or request a review.
   - **Stage 3 (Tiered Hint Ladder on demand)**: If the user gets stuck, escalate at most one tier per request instead of jumping to code:
     1. *Tier 1 (Conceptual nudge)*: Ask a diagnostic question or point to the relevant principle.
     2. *Tier 2 (Structural pinpoint)*: Identify the failing invariant, coordinate space, or line range without writing the fix.
     3. *Tier 3 (API or toy analogy)*: Show a short API signature or analogous toy snippet in a different context.
     4. *Tier 4 (Minimal reveal)*: Only when explicitly requested after earlier hints, show the minimal needed lines and ask the user to explain or adapt them.
   - **Stage 4 (Multi-Round Socratic Code Review)**: When the user requests a review, inspect their actual code (`read_file` or `git diff`). Confirm what works against the observable check first. Ask as many line-grounded questions as the implementation warrants (covering design rationale, edge-case tracing, trade-offs, bug discovery without spoiling the fix, and mental-model transfer). Continue across multiple back-and-forth questioning rounds whenever follow-up probes help the user examine an assumption, trace a defect, or clarify their reasoning before offering deeper commentary.
   - **Stage 5 (Consolidate and Advance)**: Capture 1 to 2 concrete takeaways from the chunk, check off the milestone in `tasks.md`, and present the next chunk (or pause if the user wants a break).
3. **Wrap up with a learning log**: When all chunks finish or the user ends the session, offer to write `NN-<slug>.learning-log.md` recording concepts mastered, design choices made, bugs the user diagnosed themselves, and recommended next topics.

---

## 5. Pedagogical Mechanics, Tone, and Mode Switching

Apply these practices across both modes to deepen retention:
1. **Paper-and-pencil trace and derivation**: For Level 0 math or state-machine steps, teach the scaling or derivation rule and invite the user to hand-trace 2 to 3 boundary inputs (such as `0.0`, `0.5`, and `1.0`) before writing code.
2. **Predict-Before-Run**: Before the user executes a visual or behavioral check, ask them to predict the output (for example, what a smooth gradient looks like after 4-bit quantization without dithering). Comparing a prediction against reality accelerates intuition.
3. **Make-It-Break micro-experiments**: Suggest optional 1-minute experiments (such as reversing matrix multiplication order or skipping linear-to-sRGB conversion) so the user observes *why* a convention exists.
4. **Live confidence re-calibration**: Silently adjust depth up or down during `active` mode whenever the user's code or answers reveal stronger or weaker familiarity than their initial self-rating.
5. **Unbounded, collaborative questioning without exam pressure**: Do not cap question counts or follow-up rounds artificially. Ask as many questions across as many rounds as needed whenever real ambiguity, hidden trade-offs, or learning opportunities remain. Number and group questions clearly when asking several in one turn, keep tone rooted in peer technical curiosity, and omit empty praise ("Great job!", "Awesome insight!").
6. **Bidirectional mode switching**:
   - **`guide` to `active`**: If the user hits a hard milestone while reading a guide, switch to `active` mode for that milestone using the existing calibration profile.
   - **`active` to `guide`**: If the user wants to finish remaining milestones offline, compile the unchecked chunks into `NN-<slug>.diy-guide.md` calibrated to everything observed so far.

---

## 6. Reference Guides

- [references/guide-template.md](references/guide-template.md): Copy-ready `NN-<slug>.diy-guide.md` template, adaptive primer placement rules, worked 3-tier retro-shader calibration examples, spoiler-prevention rules, and resource-citation guidelines.
- [references/active-session-playbook.md](references/active-session-playbook.md): Sliced-guide chunk brief template, 4-tier hint ladder scripts, multi-round Socratic review questioning taxonomy, Predict-Before-Run and paper-trace patterns, and the `NN-<slug>.learning-log.md` template.
