# Active Mode Pair-Coding Playbook

Use this playbook when running `my-learning-diy` in `active` mode. Treat `active` mode as a full `guide` document sliced into small, digestible tasks: Stage 1 of every chunk gives the user complete calibrated how-to guidance, learning materials, alternatives, pitfalls, and related topics for that chunk alone, followed by hands-on implementation, tiered hints, and multi-round Socratic code review.

---

## 1. Roadmap Setup in `tasks.md` and Chunk 1 Overview

After diagnostic intake (spanning as many clarifying rounds as needed), create or update `tasks.md` with small, independently testable chunks (15 to 45 minutes of user effort per chunk). Keep future chunks brief (title plus 1-sentence outcome) so the user focuses on the active chunk without cognitive overload. Right before presenting Chunk 1's brief, share one short high-level mental model diagram (3 to 5 pipeline stages, zero code spoilers) so the user sees how the chunks connect.

```markdown
## Task NN - DIY: <Short Project or Feature Title>

**Status**: Active mode (Chunk 1 of 4)
**Mode**: `active` (user drives implementation)
**Calibration**: `<Concept A>: L0`, `<Concept B>: L1`, `<Concept C>: L2`

### Chunk 1: <Small Testable Milestone>
- [ ] **(in progress)** <Concrete observable outcome for Chunk 1>

### Chunk 2: <Next Small Milestone>
- [ ] <One-sentence outcome>
```

---

## 2. Stage 1 & 2: Sliced-Guide Chunk Brief Template

At the start of every chunk, deliver the full guide slice scoped strictly to that chunk (never leaking solution code, inline task formulas, parenthetical answers, or future-chunk noise), then hand over the keyboard explicitly and stop. Follow the spoiler hygiene, verified syntax, and resource-citation rules in [guide-template.md](guide-template.md) (verify URLs via `search_web` when available, or cite canonical books, official docs, and exact search keywords). Omit optional subsections only when they genuinely do not apply to the current chunk (for example, omit Level 0 and Level 1 primers when every concept in the chunk is rated Level 2).

````markdown
### Chunk <N> of <Total>: <Short Milestone Title>

**Goal**: <1 to 2 sentences defining what this chunk achieves.>
**Observable check**: <Exact visual, test, or runtime signal that confirms this chunk works before requesting review.>

#### How to Proceed (No Spoilers)
- **What to figure out**:
  <!-- Ask genuine questions. Never answer a question in parentheses or leak exact formulas. -->
  - <Guiding question 1 targeting inputs, coordinate spaces, or data flow.>
  - <Guiding question 2 targeting the core transform or invariant.>
- **Why it works this way**: <Underlying principle or constraint without writing the solution or a code recipe.>

#### Calibrated Concept Primer and Learning Materials (This Chunk Only)
<!-- Apply the 3-tier depth matrix strictly to concepts introduced in Chunk N. -->

- **<Level 0 Concept Name> (`Level 0`)**:
  - *Why this chunk needs it*: <Connect concept directly to Chunk N.>
  - *Why it must work this way*: <Explain the mathematical, hardware, or architectural reason.>
  - *Isolated conceptual example*:
    ```<lang>
    // Minimal toy snippet outside the user's final code.
    ```
  - *How each part works*: <Plain line-by-line walkthrough.>
  - *Derivation rule or scaling bridge* *(when the toy example is smaller than the target)*: <Explain the rule to scale up without dumping the answer table.>
  - *1-minute paper-and-pencil trace* *(optional for math or state transitions)*: <Prompt the user to trace 2 to 3 boundary inputs by hand before coding.>
  - *Learning resources*: <Verified URL, canonical doc section, or book chapter + exact search keywords.>
- **<Level 1 Concept Name> (`Level 1`)**:
  - *Why this chunk needs it*: <Explain how this familiar concept fits into Chunk N.>
  - *Inputs and invariants*: <Coordinate spaces, units, or boundary contracts.>
- **<Level 2 Concept Name> (`Level 2`)**: <1 concise bullet stating what to achieve and edge cases to watch for.>

#### Design Choices and Alternatives
| Approach | Trade-Offs | Best When |
|---|---|---|
| `<Option A>` | <Visual, performance, or complexity trade-off> | <Scenario> |
| `<Option B>` | <Visual, performance, or complexity trade-off> | <Scenario> |

Pick which approach you want to try before coding.

#### Common Pitfalls and Debugging Signals
| Symptom Observed | Likely Cause | Diagnostic Question to Check |
|---|---|---|
| `<Broken output or error>` | `<Root mechanism without leaking the exact fix formula>` | `<Question pointing the user to verify the invariant>` |

#### Good to Know and Related Topics *(when relevant to this chunk)*
- **<Engineering nuance or quirk>**: <Hardware precision limit, color-space trap, or adjacent topic worth knowing.>

**Predict before running** *(optional)*: <1-sentence prediction prompt to answer before testing.>

Your turn. Implement Chunk <N> in `<target file or module>`, test the observable check, and ask when you want a hint or a review.
````

---

## 3. Stage 3: The 4-Tier Hint Ladder

When the user says they are stuck, never jump straight to a finished patch. Ascend **one tier per help request**, starting at Tier 1 (unless the user explicitly asks to skip to a higher tier after trying).

| Tier | Name | What the Agent Provides | Example (Retro Shader Bug: Washed-Out Quantized Colors) |
|---|---|---|---|
| **Tier 1** | Conceptual Nudge | Ask a targeted diagnostic question or name the relevant principle. Zero code. | "What color space is the framebuffer texture stored in when your shader samples it, and how does human vision perceive brightness steps near black versus near white?" |
| **Tier 2** | Structural Pinpoint | Identify the exact file, line range, coordinate space, or broken invariant without writing the fix. | "Inspect `retro.frag:18-24`. You sample `sceneColor` in linear space and apply uniform quantization before gamma encoding, which allocates almost all steps to bright values." |
| **Tier 3** | API Signature or Toy Analogy | Show a 2-to-5 line API signature or an analogous snippet from a different domain. | Show `pow(val, vec3(1.0 / 2.2))` in a standalone 2-line gamma-conversion reference note without rewriting the user's shader pass. |
| **Tier 4** | Minimal Reveal + Explain-Back | Only if explicitly requested after earlier tiers: show the minimal 2-to-6 lines needed to unblock, then immediately ask the user to explain why those lines fix the issue or predict what changes if a parameter doubles. | Provide the minimal conversion pair and ask: "If you move quantization *before* this conversion instead of *after*, how does banding change in dark shadows?" |

---

## 4. Stage 4: Multi-Round Socratic Code Review Taxonomy

When the user requests a review for the active chunk:
1. **Read the actual code first** (`read_file` or `git diff`). Never speculate about code that you did not inspect.
2. **Confirm what works**: State in 1 to 2 factual sentences what satisfies the chunk's observable check. Omit empty praise ("Great job!", "Awesome code!").
3. **Ask as many purposeful, line-grounded questions as needed**: Select from the five categories below based on what the user's code actually shows. Do not enforce an artificial cap on question count. Prioritize **Bug Discovery** first if a defect exists, followed by **Design Rationale**, **Edge-Case Trace**, **Trade-Off Comparison**, and **Mental-Model Transfer**. When asking several questions in one turn, number and group them cleanly so the user can answer comfortably.

| Question Category | Purpose | Prompt Pattern |
|---|---|---|
| **1. Design Rationale ("Why")** | Prompt the user to articulate their own architectural choice | "On `shader.frag:31`, you truncated the scaled channel instead of rounding it. Why did you choose truncation here, and what value does pure white produce?" |
| **2. Bug Discovery (No Spoiler)** | Help the user spot a defect by tracing a concrete input | "Trace `shader.frag:19` when the input UV hits the right edge (`uv.x == 1.0`). What pixel coordinate does your snap formula produce, and does that match what you intended?" |
| **3. Edge-Case Trace** | Test mental model under boundary inputs | "What happens to your pixelation grid in `shader.frag:12-16` when the window resizes from 16:9 to 4:3 or portrait?" |
| **4. Trade-Off Comparison** | Surface valid alternatives and deepen judgment | "You hardcoded the 4x4 Bayer matrix inside the fragment shader. What trade-offs change if you store it in a tiny repeating texture versus a constant array?" |
| **5. Mental-Model Transfer** | Connect the chunk to broader engineering principles | "How would this same coordinate-snapping idea behave differently if you ran it on 3D vertices before rasterization instead of 2D screen UVs in post-processing?" |

4. **Continue across multiple rounds whenever useful**: Wait for the user's explanation before offering deeper commentary. Do not rush to Stage 5 after a single exchange if the user's answer leaves an edge case unexamined, uncovers a second misconception, or opens an insightful follow-up. Ask follow-up questions building directly on the user's previous answer across as many rounds as needed until their reasoning is solid and any defects they spotted are fixed.

---

## 5. Stage 5: Consolidate, Re-Calibrate, and Optional Micro-Experiments

Before advancing from Chunk `N` to Chunk `N + 1`:
1. **Consolidate**: State 1 to 2 crisp takeaways that emerged from Chunk `N` (especially any bug the user diagnosed or trade-off they chose).
2. **Silent re-calibration**: Update your internal Level 0/1/2 assessment based on observed mastery (for example, promote a concept from Level 0 to Level 1 if the user applied it accurately on the first attempt, or drop from Level 2 to Level 1 if a core misconception surfaced).
3. **Optional Make-It-Break prompt**: When a chunk relies on a subtle rule (such as matrix order, gamma space, or lock ordering), offer one optional 1-minute experiment to break that rule intentionally and observe the symptom.
4. **Update `tasks.md`**: Mark Chunk `N` `- [x]`, set Chunk `N + 1` to `- [ ] **(in progress)**`, and present the Chunk `N + 1` brief (or pause if the user asks to stop).

---

## 6. End-of-Session Learning Log Template (`NN-<slug>.learning-log.md`)

When all chunks finish (or when the user wraps up an `active` session), offer to write `NN-<slug>.learning-log.md` in the session directory (or a user-requested workspace path).

````markdown
# Learning Log NN: <Short Project or Feature Title>

- **Task**: `NN` ([tasks.md](file:///absolute/path/to/tasks.md))
- **Mode**: `active`
- **Completed Chunks**: `<completed> / <total>`

## Concepts Practiced and Mastery Shift

| Concept | Starting Level | Ending Level | Key Insight Gained |
|---|---|---|---|
| `<Concept A>` | `Level 0` | `Level 1` | <Concrete takeaway the user demonstrated> |
| `<Concept B>` | `Level 1` | `Level 2` | <Concrete takeaway the user demonstrated> |

## Design Decisions You Made

- **<Decision 1>** ([file.ext](file:///absolute/path/to/file.ext#L10-L25)): <What you chose, why you chose it, and the trade-off you accepted.>
- **<Decision 2>** ([file.ext](file:///absolute/path/to/file.ext#L40-L52)): <What you chose, why you chose it, and the trade-off you accepted.>

## Bugs You Diagnosed

- **<Symptom>**: <Root cause you traced and how you resolved it.>

## Suggested Next Learning Topics

1. **<Next Topic 1>**: <Why it is a logical next step and what to try building.>
2. **<Next Topic 2>**: <Why it is a logical next step and what to try building.>
````
