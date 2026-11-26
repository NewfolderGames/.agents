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
});
