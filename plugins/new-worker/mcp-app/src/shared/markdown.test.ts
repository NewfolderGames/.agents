import { describe, expect, it } from "vitest";
import type { PlanRecord, ReportRecord, TaskRecord } from "./contracts.js";
import { formatTaskFilename, formatTaskId, padTaskId, toFileUri } from "./format.js";
import { renderPlanMarkdown, renderReportMarkdown, renderTasksMarkdown } from "./markdown.js";

describe("format & markdown rendering with global task IDs", () => {
	it("formats global task IDs and 3-digit padded filenames", () => {
		expect(formatTaskId(1)).toBe("#1");
		expect(padTaskId(7)).toBe("007");
		expect(padTaskId(1024)).toBe("1024");
		expect(formatTaskFilename(1, "sqlite-rewrite", "plan")).toBe("001-sqlite-rewrite.plan.md");
		expect(formatTaskFilename(42, "audit-check", "report")).toBe("042-audit-check.report.md");
		expect(toFileUri("src/index.ts", "/repo/app")).toBe("file:///repo/app/src/index.ts");
	});

	it("renders tasks.md with global #N IDs, collapsed finished tasks, and active progress", () => {
		const now = "2026-11-26T00:00:00.000Z";
		const tasks: TaskRecord[] = [
			{
				taskId: 1,
				sessionId: "s-1",
				slug: "done-task",
				title: "Initial Schema",
				status: "done",
				summary: "Created SQLite schema.",
				planFile: "001-done-task.plan.md",
				reportFile: "001-done-task.report.md",
				steps: [
					{
						title: "Create schema",
						outcome: "Schema exists.",
						items: [{ itemKey: "1", text: "Write schema.ts", status: "done" }],
					},
				],
				createdAt: now,
				updatedAt: now,
			},
			{
				taskId: 12,
				sessionId: "s-1",
				slug: "active-task",
				title: "Build Repositories",
				status: "in_progress",
				summary: "Implementing SQLite repos.",
				planFile: "012-active-task.plan.md",
				steps: [
					{
						title: "Implement sessions",
						outcome: "Groups and sessions persist.",
						items: [
							{ itemKey: "1", text: "Write sessions.ts", status: "in_progress" },
							{ itemKey: "2", text: "Write tests", status: "pending" },
						],
					},
				],
				createdAt: now,
				updatedAt: now,
			},
		];

		const md = renderTasksMarkdown(tasks);
		expect(md).toContain("| #1 | Done | Initial Schema |");
		expect(md).toContain("| #12 | In Progress (Step 1/1) | Build Repositories |");
		expect(md).toContain("<summary>[x] Task #1 - Initial Schema</summary>");
		expect(md).toContain("## Task #12 - Build Repositories");
		expect(md).toContain("- [ ] **(in progress)** Write sessions.ts");
	});

	it("renders Plan and Report Markdown with padded header numbers and global #N links", () => {
		const plan: PlanRecord = {
			taskId: 3,
			sessionId: "s-1",
			slug: "timeline-feature",
			title: "Polymorphic Timeline",
			target: { repo: "my-agents", branch: "main", commit: "abc1234" },
			overview: "Track events across entities.",
			expectedOutcomes: ["Events link to tasks and notes."],
			scope: {
				inScope: ["timeline_events", "timeline_links"],
				outOfScope: ["External webhooks"],
			},
			currentImplementation: ["No timeline exists."],
			keyDecisions: ["Two-table polymorphic link model."],
			proposedChanges: ["Add timeline repository."],
			fileStructure: [{
				path: "server/repositories/timeline.ts",
				action: "added",
				reason: "Timeline repo",
			}],
			testing: {
				validationCommands: ["pnpm test"],
				keyScenarios: ["Link event to task and session"],
				testChanges: ["Added timeline tests"],
			},
			language: "en",
			createdAt: "2026-11-26T00:00:00.000Z",
		};

		const planMd = renderPlanMarkdown(plan);
		expect(planMd).toContain("# Plan 003: Polymorphic Timeline");
		expect(planMd).toContain("- **Task**: `#3` ([tasks.md](./tasks.md))");

		const report: ReportRecord = {
			taskId: 3,
			sessionId: "s-1",
			slug: "timeline-feature",
			title: "Polymorphic Timeline",
			mode: "implementation",
			outcome: "Completed",
			target: { repo: "my-agents", branch: "main", commit: "abc1234" },
			planRef: "003-timeline-feature.plan.md",
			summary: "Implemented timeline.",
			actionsCompleted: ["Created timeline repository."],
			filesChanged: [{
				path: "server/repositories/timeline.ts",
				action: "Added",
				summary: "Timeline repo",
			}],
			planDeviations: [],
			verification: [{
				check: "Tests",
				command: "pnpm test",
				result: "PASS",
				notes: "All green",
			}],
			operationalNotes: [],
			verificationMatrix: [],
			findings: [],
			followUps: [],
			language: "en",
			createdAt: "2026-11-26T00:00:00.000Z",
		};

		const reportMd = renderReportMarkdown(report);
		expect(reportMd).toContain("# Report 003: Polymorphic Timeline");
		expect(reportMd).toContain("- **Task**: `#3` ([tasks.md](./tasks.md))");
		expect(reportMd).toContain("- **Plan**: [003-timeline-feature.plan.md](./003-timeline-feature.plan.md)");
	});

	it("renders all optional Plan sections including API Reference, Migration Plan, and normalized Mermaid", () => {
		const plan: PlanRecord = {
			taskId: 4,
			sessionId: "s-1",
			slug: "full-plan",
			title: "Full Parity Plan",
			target: { repo: "my-agents", branch: "main", commit: "def5678" },
			follows: "003-timeline-feature.report.md",
			overview: "Verify every Plan section exports cleanly.",
			expectedOutcomes: ["All optional sections render in template order."],
			scope: {
				inScope: ["Plan export"],
				outOfScope: ["Unrelated panels"],
			},
			openQuestions: ["Confirm cache TTL."],
			userStories: ["As a reviewer, I want diagrams inline."],
			functionalRequirements: ["Normalize pre-fenced Mermaid blocks."],
			nonFunctionalRequirements: ["Render under 100ms."],
			currentImplementation: ["Legacy renderer skipped apiReference."],
			keyDecisions: ["Use rehype-mermaid inline-svg."],
			proposedChanges: ["Add apiReference and migrationPlan."],
			dataModels: "```ts\ninterface Demo { id: string; }\n```",
			components: [{
				component: "MarkdownBlock",
				path: "src/ui/primitives/MarkdownBlock.tsx",
				responsibility: "Render GFM and Mermaid",
			}],
			fileStructure: [{
				path: "src/shared/markdown.ts",
				action: "modified",
				reason: "Export API Reference and Migration Plan",
			}],
			architectureDiagram: "```mermaid\nflowchart TD\n  A --> B\n```",
			risks: [{
				risk: "Invalid diagram syntax",
				impact: "Blank diagram",
				mitigation: "Configure errorFallback",
			}],
			apiReference: "### Endpoints\n| Tool | Action |\n|---|---|\n| `write_plan` | Persist plan |",
			migrationPlan: "### Rollout & Rollback\n1. Deploy bundle.\n2. Revert commit.",
			alternatives: "| Option | Trade-off |\n|---|---|\n| inline-svg | Works with react-markdown |",
			calibration: {
				cadence: "Less frequent",
				familiarity: "Medium",
				structureStance: "Balanced",
			},
			testing: {
				validationCommands: ["pnpm test"],
				keyScenarios: ["All sections emitted"],
				edgeCases: ["Pre-fenced architectureDiagram is not double-fenced"],
				testChanges: ["Updated markdown.test.ts"],
			},
			language: "en",
			createdAt: "2026-11-26T00:00:00.000Z",
		};

		const md = renderPlanMarkdown(plan);
		expect(md).toContain("- **Follows**: 003-timeline-feature.report.md");
		expect(md).toContain("- **Calibration**: Cadence `Less frequent`, Familiarity `Medium`, Structure `Balanced`");
		expect(md).toContain("### Open Questions & Assumptions");
		expect(md).toContain("### User Stories");
		expect(md).toContain("### Functional Requirements");
		expect(md).toContain("### Non-Functional Requirements");
		expect(md).toContain("### Data Models / Contracts");
		expect(md).toContain("### Components");
		expect(md).toContain("### Architecture Diagram\n\n```mermaid\nflowchart TD\n  A --> B\n```");
		expect(md).not.toContain("```mermaid\n```mermaid");
		expect(md).toContain("### Risks");
		expect(md).toContain("## API Reference\n\n### Endpoints");
		expect(md).toContain("## Migration Plan\n\n### Rollout & Rollback");
		expect(md).toContain("## Alternatives Considered");
		expect(md).toContain("### Edge Cases");
	});

	it("renders complete Implementation and Audit Report sections", () => {
		const implReport: ReportRecord = {
			taskId: 5,
			sessionId: "s-1",
			slug: "impl-full",
			title: "Full Implementation Report",
			mode: "implementation",
			outcome: "Completed",
			target: { repo: "my-agents", branch: "main", commit: "abc1234" },
			planRef: "005-impl-full.plan.md",
			summary: "Implemented all sections.",
			actionsCompleted: ["Updated PlanDocumentView."],
			filesChanged: [{
				path: "src/ui/artifacts/PlanDocumentView.tsx",
				action: "Added",
				summary: "Shared plan renderer",
			}],
			diffStat: "3 files changed, +200 / -40",
			planDeviations: ["Extracted shared CSS module."],
			verification: [{
				check: "Tests",
				command: "pnpm test",
				result: "PASS",
				notes: "All green",
			}],
			tryCommand: "pnpm --dir plugins/new-worker/mcp-app dev",
			unverifiedLimitations: "Manual browser check deferred.",
			operationalNotes: ["Rebuild dist/ bundles before refreshing MCP server."],
			verificationMatrix: [],
			findings: [],
			followUps: [{
				id: "F1",
				priority: "SHOULD",
				location: "src/dashboard/panels/TimelinePanel.tsx",
				lineStart: 88,
				action: "Fix pre-existing lint indentation.",
			}],
			language: "en",
			createdAt: "2026-11-26T00:00:00.000Z",
		};

		const implMd = renderReportMarkdown(implReport);
		expect(implMd).toContain("Diff stat: `3 files changed, +200 / -40`");
		expect(implMd).toContain("### Plan Deviations");
		expect(implMd).toContain("- **Try**: `pnpm --dir plugins/new-worker/mcp-app dev`");
		expect(implMd).toContain("- **Unverified / Limitations**: Manual browser check deferred.");
		expect(implMd).toContain("## Operational Notes & Rollback");
		expect(implMd).toContain("## Follow-Up & Future Work");
		expect(implMd).toContain("| `F1` | `SHOULD` |");

		const auditReport: ReportRecord = {
			taskId: 6,
			sessionId: "s-1",
			slug: "audit-full",
			title: "Full Audit Report",
			mode: "audit",
			outcome: "Audit Complete",
			target: { repo: "my-agents", branch: "main", commit: "abc1234" },
			summary: "Found 2 issues across UI panels.",
			actionsCompleted: [],
			filesChanged: [],
			planDeviations: [],
			verification: [],
			operationalNotes: [],
			verificationMatrix: [{
				target: "PlansPanel parity",
				status: "PARTIAL",
				observed: "Missing optional sections",
			}],
			findings: [
				{
					id: "C1",
					severity: "critical",
					title: "Missing diagram render",
					location: "src/ui/primitives/MarkdownBlock.tsx",
					lineStart: 12,
					detail: "Mermaid blocks rendered as raw text.",
				},
				{
					id: "L1",
					severity: "low",
					title: "Missing target metadata",
					location: "src/dashboard/panels/ReportsPanel.tsx",
					detail: "Report header omitted branch/commit.",
				},
			],
			followUps: [{
				id: "C1",
				priority: "MUST",
				location: "src/ui/primitives/MarkdownBlock.tsx",
				lineStart: 12,
				action: "Wire rehype-mermaid inline-svg.",
			}],
			language: "en",
			createdAt: "2026-11-26T00:00:00.000Z",
		};

		const auditMd = renderReportMarkdown(auditReport);
		expect(auditMd).toContain("## Summary & Verdict");
		expect(auditMd).toContain("## Scope & Verification Matrix");
		expect(auditMd).toContain("### Critical");
		expect(auditMd).toContain("### Low");
		expect(auditMd).not.toContain("### High");
		expect(auditMd).toContain("## Recommended Next Tasks");
	});
});
