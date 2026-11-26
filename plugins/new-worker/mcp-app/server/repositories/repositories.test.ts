import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { openDatabase } from "../db/client.js";
import { toolCalls } from "../db/schema.js";
import { getPlanByTaskId, recordHandoff, updatePlan, writePlan, writeReport } from "./artifacts.js";
import { NotFoundError, QuestionBlockerError, ReportImmutableError, ValidationError } from "./errors.js";
import { createQuestionSet, saveQuestionDraft, submitQuestionAnswers } from "./questions.js";
import { assignSessionGroup, getSession, listSessionGroups, listSessions, MAX_TOOL_CALL_LOGS, upsertSession, upsertSessionGroup } from "./sessions.js";
import { listToolCalls, recordToolCall } from "./settings.js";
import { updateTaskItem, upsertTask } from "./tasks.js";
import { queryTimelineEvents, recordTimelineEvent } from "./timeline.js";
import { buildDashboardPayload } from "./workspace.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-repos-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

describe("SQLite repositories", () => {
	it("allocates global task IDs across sessions and exports optional Markdown files", async () => {
		const handle = openDatabase(":memory:");
		const exportDirA = makeTempDir();
		const exportDirB = makeTempDir();

		const planRes = await writePlan(
			handle.db,
			"session-a",
			{
				slug: "sqlite-core",
				title: "SQLite Core",
				target: { repo: "my-agents", branch: "main", commit: "111aaaa" },
				overview: "Build SQLite persistence.",
				expectedOutcomes: ["Global task IDs increment from 1."],
				scope: { inScope: ["server/db"], outOfScope: ["legacy json"] },
				currentImplementation: ["JSON files on disk."],
				keyDecisions: ["Use node:sqlite and Drizzle."],
				proposedChanges: ["Add SQLite tables."],
				components: [{
					component: "openDatabase",
					path: "server/db/client.ts",
					responsibility: "Initialize SQLite handle",
				}],
				fileStructure: [{
					path: "server/db/client.ts",
					action: "added",
					reason: "DB client",
				}],
				architectureDiagram: "flowchart TD\n  Tool --> DB",
				risks: [{
					risk: "Schema drift",
					impact: "Query failure",
					mitigation: "Forward-only migrator",
				}],
				apiReference: "| Tool | Purpose |\n|---|---|\n| `write_plan` | Save plan |",
				migrationPlan: "Run migration 0001 on startup.",
				alternatives: "Compared against flat JSON files.",
				testing: {
					validationCommands: ["pnpm test"],
					keyScenarios: ["Global ID allocation"],
					testChanges: ["Added repo tests"],
				},
			},
			{ title: "Session A", rootDir: "/repo/a", exportDir: exportDirA },
		);

		expect(planRes.plan.taskId).toBe(1);
		const reloadedPlan = getPlanByTaskId(handle.db, 1);
		expect(reloadedPlan?.apiReference).toContain("`write_plan`");
		expect(reloadedPlan?.migrationPlan).toBe("Run migration 0001 on startup.");
		expect(reloadedPlan?.architectureDiagram).toBe("flowchart TD\n  Tool --> DB");
		expect(reloadedPlan?.components).toHaveLength(1);
		expect(reloadedPlan?.risks).toHaveLength(1);
		expect(reloadedPlan?.alternatives).toBe("Compared against flat JSON files.");
		const exportedPlanPath = path.join(exportDirA, "001-sqlite-core.plan.md");
		expect(fs.existsSync(exportedPlanPath)).toBe(true);
		const exportedPlanMd = fs.readFileSync(exportedPlanPath, "utf8");
		expect(exportedPlanMd).toContain("## API Reference");
		expect(exportedPlanMd).toContain("## Migration Plan");
		expect(exportedPlanMd).toContain("### Architecture Diagram");
		expect(fs.existsSync(path.join(exportDirA, "tasks.md"))).toBe(true);

		const task2Res = await upsertTask(
			handle.db,
			"session-b",
			{
				slug: "widget-split",
				title: "Widget Split",
				status: "in_progress",
				summary: "Split widgets from dashboard.",
				steps: [
					{
						title: "Implement shell",
						outcome: "Widget shell renders.",
						items: [
							{ itemKey: "1", text: "Create WidgetShell.tsx", status: "in_progress" },
							{ itemKey: "2", text: "Test WidgetShell", status: "pending" },
						],
					},
				],
			},
			{ title: "Session B", rootDir: "/repo/b", exportDir: exportDirB },
		);

		expect(task2Res.task.taskId).toBe(2);

		const step1Done = await updateTaskItem(handle.db, "session-b", 2, "1", "done");
		expect(step1Done.task.steps[0]?.items[0]?.status).toBe("done");

		const reportRes = await writeReport(handle.db, "session-a", {
			taskId: 1,
			slug: "sqlite-core",
			title: "SQLite Core",
			mode: "implementation",
			outcome: "Completed",
			target: { repo: "my-agents", branch: "main", commit: "111aaaa" },
			summary: "Implemented SQLite core.",
			actionsCompleted: ["Added schema and migrator."],
			filesChanged: [{ path: "server/db/client.ts", action: "Added", summary: "DB client" }],
			verification: [{
				check: "Tests",
				command: "pnpm test",
				result: "PASS",
				notes: "Green",
			}],
		});

		expect(reportRes.report.taskId).toBe(1);
		expect(fs.existsSync(path.join(exportDirA, "001-sqlite-core.report.md"))).toBe(true);

		await expect(
			writeReport(handle.db, "session-a", {
				taskId: 1,
				slug: "sqlite-core",
				title: "Overwrite Attempt",
				mode: "implementation",
				outcome: "Completed",
				target: { repo: "my-agents", branch: "main", commit: "111aaaa" },
				summary: "Should fail.",
			}),
		).rejects.toThrow(ReportImmutableError);

		handle.close();
	});

	it("supports 1:N session groups, rootDir metadata, and merged group dashboard/timeline", async () => {
		const handle = openDatabase(":memory:");
		const group = upsertSessionGroup(handle.db, {
			id: "grp-epic",
			name: "Epic Rewrite",
			description: "Coordinated sessions for rewrite",
			notes: "Backend first, UI second",
		});

		upsertSession(handle.db, "s-1", {
			title: "Backend",
			rootDir: "/work/app",
			groupId: group.id,
		});
		upsertSession(handle.db, "s-2", { title: "Frontend", rootDir: "/work/app" });
		assignSessionGroup(handle.db, "s-2", group.id);

		await upsertTask(handle.db, "s-1", {
			slug: "api",
			title: "Build API",
			status: "done",
			summary: "API done",
			steps: [{
				title: "Write API",
				outcome: "Done",
				items: [{ itemKey: "1", text: "Done", status: "done" }],
			}],
		});
		await upsertTask(handle.db, "s-2", {
			slug: "ui",
			title: "Build UI",
			status: "in_progress",
			summary: "UI active",
			steps: [{
				title: "Write UI",
				outcome: "Pending",
				items: [{ itemKey: "1", text: "Active", status: "in_progress" }],
			}],
		});

		recordHandoff(handle.db, "s-1", {
			kind: "completion",
			title: "Backend ready",
			summary: "Frontend can consume new endpoints.",
			taskId: 1,
		});

		const groups = listSessionGroups(handle.db);
		expect(groups[0]?.sessionCount).toBe(2);
		expect(groups[0]?.taskCount).toBe(2);

		const filteredSessions = listSessions(handle.db, { rootDir: "/work/app" });
		expect(filteredSessions).toHaveLength(2);
		expect(getSession(handle.db, "s-2")?.groupId).toBe("grp-epic");

		const groupDashboard = buildDashboardPayload(handle.db, {
			scope: "group",
			groupId: "grp-epic",
			sessionId: "s-1",
		});
		expect(groupDashboard.tasks).toHaveLength(2);
		expect(groupDashboard.handoffs).toHaveLength(1);
		expect(groupDashboard.timeline.length).toBeGreaterThanOrEqual(4);

		handle.close();
	});

	it("records polymorphic timeline links on step transitions and custom notes", async () => {
		const handle = openDatabase(":memory:");
		const { task } = await upsertTask(handle.db, "s-tl", {
			slug: "timeline-test",
			title: "Timeline Verification",
			status: "in_progress",
			summary: "Check step start/finish events",
			steps: [
				{
					title: "First step",
					outcome: "First step done",
					items: [
						{ itemKey: "1", text: "Item 1", status: "pending" },
						{ itemKey: "2", text: "Item 2", status: "pending" },
					],
				},
			],
		});

		// Pending -> in_progress starts step 1 (emits step_started).
		await updateTaskItem(handle.db, "s-tl", task.taskId, "1", "in_progress");
		// Completing item 1 alone does not complete step 1 yet.
		await updateTaskItem(handle.db, "s-tl", task.taskId, "1", "done");
		// Completing item 2 finishes step 1 (emits step_completed + task_status_changed).
		await updateTaskItem(handle.db, "s-tl", task.taskId, "2", "done");

		const note = recordTimelineEvent(handle.db, {
			sessionId: "s-tl",
			eventType: "note",
			actor: "user",
			title: "Reviewed step output",
			summary: "Looks clean",
			links: [
				{
					entityType: "task",
					entityId: String(task.taskId),
					role: "related",
					label: `Task #${task.taskId}`,
				},
				{ entityType: "note", entityId: "manual-1", role: "subject", label: "Review Note" },
			],
		});
		expect(note.links).toHaveLength(2);

		const taskEvents = queryTimelineEvents(handle.db, {
			entityType: "task",
			entityId: String(task.taskId),
		});
		const eventTypes = taskEvents.map(e => e.eventType);
		expect(eventTypes).toContain("task_created");
		expect(eventTypes).toContain("step_started");
		expect(eventTypes).toContain("step_completed");
		expect(eventTypes).toContain("note");

		const itemFiltered = queryTimelineEvents(handle.db, {
			entityType: "task_item",
			entityId: `${task.taskId}:2`,
		});
		expect(itemFiltered.some(e => e.eventType === "step_completed")).toBe(true);

		handle.close();
	});

	it("enforces immediate and before_step_finish question blockers with draft + partial submit", async () => {
		const handle = openDatabase(":memory:");
		const { task } = await upsertTask(handle.db, "s-q", {
			slug: "questions-guard",
			title: "Question Guard",
			status: "in_progress",
			summary: "Verify blocking modes",
			steps: [
				{
					title: "Step 1",
					outcome: "Step 1 done",
					items: [{ itemKey: "1", text: "Work on step 1", status: "in_progress" }],
				},
			],
		});

		const { questionSet } = createQuestionSet(handle.db, "s-q", {
			title: "Design Choices",
			blockingMode: "before_step_finish",
			taskId: task.taskId,
			stepNumber: 1,
			questions: [
				{
					id: "q_imm",
					prompt: "Immediate blocker",
					kind: "single_select",
					required: true,
					contextRefs: [],
					allowOther: false,
					blockingMode: "immediate",
					options: [{ value: "a", label: "Option A" }],
				},
				{
					id: "q_step",
					prompt: "Step finish blocker",
					kind: "text",
					required: true,
					contextRefs: [],
					allowOther: false,
				},
			],
		});

		await expect(
			updateTaskItem(handle.db, "s-q", task.taskId, "1", "done"),
		).rejects.toThrow(QuestionBlockerError);

		saveQuestionDraft(handle.db, "s-q", questionSet.id, { q_imm: "a" }, {});

		const partial = submitQuestionAnswers(
			handle.db,
			"s-q",
			questionSet.id,
			{ q_imm: "a" },
			{},
			{ scope: "immediate" },
		);
		expect(partial.questionSet.status).toBe("partial");
		expect(partial.submittedQuestionIds).toEqual(["q_imm"]);

		await expect(
			updateTaskItem(handle.db, "s-q", task.taskId, "1", "done"),
		).rejects.toThrow(/before_step_finish|Step 1/i);

		const full = submitQuestionAnswers(
			handle.db,
			"s-q",
			questionSet.id,
			{ q_step: "Confirmed" },
			{},
			{ scope: "all" },
		);
		expect(full.questionSet.status).toBe("submitted");

		const doneRes = await updateTaskItem(handle.db, "s-q", task.taskId, "1", "done");
		expect(doneRes.task.status).toBe("done");
		handle.close();
	});

	it("caps viewable tool call logs at 100 and prunes older rows in SQLite when a new session starts", () => {
		const handle = openDatabase(":memory:");
		upsertSession(handle.db, "s-old", { title: "Old Session" });

		for (let i = 1; i <= 125; i++) {
			recordToolCall(handle.db, "s-old", "update_task_item", "ok", `Call #${i}`);
		}

		// Viewable list is capped at 100 even before a new session starts.
		expect(listToolCalls(handle.db, { sessionId: "s-old" })).toHaveLength(MAX_TOOL_CALL_LOGS);
		expect(handle.db.select().from(toolCalls).all()).toHaveLength(125);

		// Starting a new session prunes the global tool_calls table down to the newest 100 rows.
		upsertSession(handle.db, "s-new", { title: "New Session" });
		const remainingRows = handle.db.select().from(toolCalls).all();
		expect(remainingRows).toHaveLength(MAX_TOOL_CALL_LOGS);
		const summaries = remainingRows.map(r => r.summary);
		expect(summaries).toContain("Call #125");
		expect(summaries).not.toContain("Call #1");

		handle.close();
	});

	it("partially updates plans before and after task completion and cleans up renamed exports", async () => {
		const handle = openDatabase(":memory:");
		const exportDir = makeTempDir();

		const created = await writePlan(
			handle.db,
			"s-plan-upd",
			{
				slug: "initial-plan",
				title: "Initial Plan",
				target: { repo: "my-agents", branch: "main", commit: "111aaaa" },
				overview: "Original overview.",
				expectedOutcomes: ["Initial outcome."],
				scope: { inScope: ["server"], outOfScope: ["ui"] },
				currentImplementation: ["Original code."],
				keyDecisions: ["Keep SQLite."],
				proposedChanges: ["Add endpoint."],
				apiReference: "| Endpoint | Purpose |\n|---|---|\n| `old` | Old |",
				fileStructure: [{ path: "server/a.ts", action: "added", reason: "Initial" }],
				testing: {
					validationCommands: ["pnpm test"],
					keyScenarios: ["Initial scenario"],
					edgeCases: ["Empty input"],
					testChanges: ["a.test.ts"],
				},
			},
			{ title: "Plan Update Session", exportDir },
		);

		expect(fs.existsSync(path.join(exportDir, "001-initial-plan.plan.md"))).toBe(true);

		const patched = await updatePlan(handle.db, "s-plan-upd", {
			taskId: created.plan.taskId,
			slug: "reconfigured-plan",
			overview: "Synced Plan Mode edits.",
			scope: { inScope: ["server", "docs"] },
			apiReference: null,
			reviewStatus: "approved",
			changeSummary: "Synced Plan Mode edits and cleared stale API table",
		});

		expect(patched.plan.slug).toBe("reconfigured-plan");
		expect(patched.plan.overview).toBe("Synced Plan Mode edits.");
		expect(patched.plan.scope).toEqual({ inScope: ["server", "docs"], outOfScope: ["ui"] });
		expect(patched.plan.keyDecisions).toEqual(["Keep SQLite."]);
		expect(patched.plan.apiReference).toBeUndefined();
		expect(patched.plan.reviewStatus).toBe("approved");
		expect(patched.plan.reviewedAt).toBeTruthy();
		expect(fs.existsSync(path.join(exportDir, "001-initial-plan.plan.md"))).toBe(false);
		expect(fs.existsSync(path.join(exportDir, "001-reconfigured-plan.plan.md"))).toBe(true);

		// Complete task with immutable report, then verify post-completion plan reconfiguration still works.
		await writeReport(handle.db, "s-plan-upd", {
			taskId: created.plan.taskId,
			slug: "reconfigured-plan",
			title: "Reconfigured Plan",
			mode: "implementation",
			outcome: "Completed",
			target: { repo: "my-agents", branch: "main", commit: "111aaaa" },
			summary: "Delivered initial scope.",
		});

		const postDone = await updatePlan(handle.db, "s-plan-upd", {
			taskId: created.plan.taskId,
			proposedChanges: ["Add endpoint.", "Reconfigured post-completion follow-up."],
			testing: { edgeCases: null },
			changeSummary: "Post-completion reconfiguration",
		});

		expect(postDone.plan.proposedChanges).toEqual([
			"Add endpoint.",
			"Reconfigured post-completion follow-up.",
		]);
		expect(postDone.plan.testing.edgeCases).toBeUndefined();
		expect(postDone.plan.testing.validationCommands).toEqual(["pnpm test"]);

		const tl = queryTimelineEvents(handle.db, {
			entityType: "plan",
			entityId: String(created.plan.taskId),
		});
		expect(tl.some(e => e.eventType === "plan_updated" && e.summary === "Post-completion reconfiguration")).toBe(true);

		await expect(
			updatePlan(handle.db, "s-plan-upd", { taskId: 999, overview: "Missing" }),
		).rejects.toThrow(NotFoundError);
		await expect(
			updatePlan(handle.db, "other-session", {
				taskId: created.plan.taskId,
				overview: "Wrong session",
			}),
		).rejects.toThrow(ValidationError);

		handle.close();
	});
});
