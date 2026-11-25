import { describe, expect, it } from "vitest";
import { renderPlanMarkdown, renderReportMarkdown, renderTasksMarkdown } from "./markdown.js";
import type { PlanRecord, ReportRecord, SessionData } from "./schema.js";

describe("markdown renderers", () => {
	it("renders tasks.md with overview table, collapsed done tasks, and active checklist", () => {
		const session: SessionData = {
			schemaVersion: 1,
			sessionId: "sess-1",
			createdAt: "2026-11-25T00:00:00.000Z",
			updatedAt: "2026-11-25T00:00:00.000Z",
			tasks: [
				{
					taskNumber: "01",
					slug: "audit-auth",
					title: "Audit Auth",
					status: "done",
					summary: "Audited auth token flow.",
					reportFile: "01-audit-auth.report.md",
					updatedAt: "2026-11-25T00:00:00.000Z",
					steps: [
						{
							title: "Inspect handlers",
							outcome: "All handlers checked.",
							items: [{ id: "1.1", text: "Read token verifier", status: "done" }],
						},
					],
				},
				{
					taskNumber: "02",
					slug: "build-ui",
					title: "Build Web UI",
					status: "in_progress",
					summary: "Add MCP App viewer.",
					planFile: "02-build-ui.plan.md",
					updatedAt: "2026-11-25T00:00:00.000Z",
					steps: [
						{
							title: "Scaffold store",
							outcome: "Store compiles.",
							items: [
								{ id: "2.1", text: "Create schema.ts", status: "done" },
								{ id: "2.2", text: "Implement store.ts", status: "in_progress" },
							],
						},
					],
				},
			],
			plans: [],
			reports: [],
			handoffs: [],
			questionSets: [],
			toolCalls: [],
		};

		const md = renderTasksMarkdown(session);
		const firstTenLines = md.split("\n").slice(0, 10).join("\n");
		expect(firstTenLines).toContain("# Session Tasks");
		expect(firstTenLines).toContain("| 01 | Done | Audit Auth |");
		expect(firstTenLines).toContain("| 02 | In Progress (Step 1/1) | Build Web UI |");
		expect(md).toContain("<summary>[x] Task 01 - Audit Auth</summary>");
		expect(md).not.toMatch(/<summary>.*\[.*\]\(.*\).*<\/summary>/);
		expect(md).toContain("- [x] Create schema.ts");
		expect(md).toContain("- [ ] **(in progress)** Implement store.ts");
	});

	it("renders NN-<slug>.plan.md with monotonic headings and zero checklists", () => {
		const plan: PlanRecord = {
			taskNumber: "02",
			slug: "build-ui",
			title: "Build Web UI",
			target: { repo: "my-agents", branch: "main", commit: "abc1234" },
			overview: "Build an MCP App Web UI.",
			expectedOutcomes: ["Structured JSON store", "Orbit UI"],
			scope: {
				inScope: ["plugins/new-worker/mcp-app"],
				outOfScope: ["Sibling plugins"],
			},
			currentImplementation: ["plugins/new-worker/plugin.json:1"],
			keyDecisions: ["Use Vite 8 and React 19"],
			proposedChanges: ["Add MCP server and UI"],
			fileStructure: [
				{ path: "server/tools.ts", action: "added", reason: "MCP tools" },
			],
			testing: {
				validationCommands: ["pnpm test"],
				keyScenarios: ["Plan immutability enforced"],
				testChanges: ["Added server/tools.test.ts"],
			},
			language: "en",
			createdAt: "2026-11-25T00:00:00.000Z",
		};

		const md = renderPlanMarkdown(plan);
		expect(md).toContain("# Plan 02: Build Web UI");
		expect(md).toContain("#### In Scope");
		expect(md).toContain("#### Out of Scope");
		expect(md).not.toContain("- [ ]");
		expect(md).not.toContain("- [x]");
	});

	it("renders both Implementation and Audit NN-<slug>.report.md templates", () => {
		const implReport: ReportRecord = {
			taskNumber: "02",
			slug: "build-ui",
			title: "Build Web UI",
			mode: "implementation",
			outcome: "Completed",
			target: { repo: "my-agents", branch: "main", commit: "abc1234 -> def5678" },
			planRef: "02-build-ui.plan.md",
			summary: "Implemented MCP App server and React UI.",
			actionsCompleted: ["Added MCP server tools."],
			filesChanged: [
				{
					path: "server/tools.ts",
					action: "Added",
					summary: "Registered MCP tools",
					lineStart: 10,
				},
			],
			planDeviations: [],
			verification: [
				{ check: "Unit Tests", command: "pnpm test", result: "PASS", notes: "All passed" },
			],
			tryCommand: "pnpm --dir plugins/new-worker/mcp-app test",
			operationalNotes: [],
			verificationMatrix: [],
			findings: [],
			followUps: [
				{
					id: "F1",
					priority: "SHOULD",
					location: "README.md",
					lineStart: 12,
					action: "Add screenshot",
				},
			],
			language: "en",
			createdAt: "2026-11-25T00:00:00.000Z",
		};

		const implMd = renderReportMarkdown(implReport);
		expect(implMd).toContain("# Report 02: Build Web UI");
		expect(implMd).toContain("## Summary & Outcome");
		expect(implMd).toContain("| `F1` | `SHOULD` | `README.md:12` | Add screenshot |");

		const auditReport: ReportRecord = {
			...implReport,
			taskNumber: "03",
			slug: "audit-ui",
			title: "Audit UI",
			mode: "audit",
			outcome: "Audit Complete",
			verificationMatrix: [
				{ target: "pnpm lint", status: "PASS", observed: "0 errors" },
			],
			findings: [
				{
					id: "C1",
					severity: "critical",
					title: "Missing CSP domain",
					location: "server/tools.ts",
					lineStart: 42,
					detail: "Add fonts.gstatic.com to resourceDomains.",
				},
			],
		};

		const auditMd = renderReportMarkdown(auditReport);
		expect(auditMd).toContain("## Scope & Verification Matrix");
		expect(auditMd).toContain("### Critical");
		expect(auditMd).toContain("**`C1` - Missing CSP domain**");
	});
});
