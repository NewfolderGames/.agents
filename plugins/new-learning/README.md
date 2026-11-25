# new-learning

Self-learning DIY coaching plugin for building features, projects, and experiments without agent-generated solution
code. Supports self-paced study blueprints (`guide` mode) and chunked Socratic pair coding (`active` mode).

## Contents

| Path                             | Purpose                                                                                                                    |
|----------------------------------|----------------------------------------------------------------------------------------------------------------------------|
| `plugin.json`                    | Plugin manifest (`new-learning`)                                                                                           |
| `rules/AGENTS.md`                | Driver-seat precedence override and skill router                                                                           |
| `references/session-contract.md` | Self-contained host adapter and session contract for `tasks.md`, `NN-<slug>.diy-guide.md`, and `NN-<slug>.learning-log.md` |
| `skills/learning-diy/`           | `new::learning-diy`: Diagnostic 3-tier calibration, `guide` blueprint template, and `active` Socratic pair-coding playbook |
