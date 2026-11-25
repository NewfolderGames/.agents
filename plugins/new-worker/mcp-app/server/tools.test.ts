import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import type { TaskStepSnapshot } from "../src/shared/schema.js";
import { parseCliArgs } from "./index.js";
import { createSessionStore } from "./store.js";
import { APP_RESOURCE_URI, registerNewWorkerServer } from "./tools.js";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
	const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
	tempDirs.push(dir);
	return dir;
}

function makeTestPlanInput(overrides?: Record<string, unknown>) {
	return {
		taskNumber: "01",
		slug: "first-task",
		title: "First Task",
		target: { repo: "my-agents", branch: "main", commit: "abc1234" },
		overview: "Implement structured session store.",
		expectedOutcomes: ["Atomic JSON", "Synced Markdown"],
		scope: { inScope: ["server/store.ts"], outOfScope: ["UI"] },
		currentImplementation: ["plugins/new-worker/plugin.json:1"],
		keyDecisions: ["Use temp file rename"],
		proposedChanges: ["Add SessionStore"],
		fileStructure: [{ path: "server/store.ts", action: "added" as const, reason: "Store" }],
		testing: {
			validationCommands: ["pnpm test"],
			keyScenarios: ["Immutability"],
			testChanges: ["Added server/tools.test.ts"],
		},
		language: "en" as const,
		...overrides,
	};
}

function makeTestReportInput(overrides?: Record<string, unknown>) {
	return {
		taskNumber: "01",
		slug: "first-task",
		title: "First Task",
		mode: "implementation" as const,
		outcome: "Completed",
		target: { repo: "my-agents", branch: "main", commit: "abc1234 -> def5678" },
		summary: "Completed store.",
		actionsCompleted: ["Implemented store.ts."],
		filesChanged: [{ path: "server/store.ts", action: "Added" as const, summary: "Store" }],
		planDeviations: [],
		verification: [{
			check: "Tests",
			command: "pnpm test",
			result: "PASS" as const,
			notes: "OK",
		}],
		operationalNotes: [],
		verificationMatrix: [],
		findings: [],
		followUps: [],
		language: "en" as const,
		...overrides,
	};
}

afterEach(async () => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			await fs.rm(dir, { recursive: true, force: true });
		}
	}
});

describe("SessionStore, CLI safety, snapshots, polling, and MCP server tools", () => {
	it("guards parseCliArgs against blank or unexpanded variables and respects explicit --data-dir", () => {
		const defaultConfig = parseCliArgs([]);
		expect(defaultConfig.dataDir).toMatch(/mcp-app[\\/]data$/);

		const blankArg = parseCliArgs(["--data-dir="]);
		expect(blankArg.dataDir).toBe(defaultConfig.dataDir);

		const unexpanded = parseCliArgs(["--data-dir=${PLUGIN_DATA}"]);
		expect(unexpanded.dataDir).toBe(defaultConfig.dataDir);

		const explicit = parseCliArgs(["--data-dir=/tmp/custom-nw-data"]);
		expect(explicit.dataDir).toBe(path.resolve("/tmp/custom-nw-data"));
	});

	it("migrates v0 session and index JSON to v1 and rejects unsupported future versions", async () => {
		const dataDir = await makeTempDir("nw-migrate-");
		const sessionsDir = path.join(dataDir, "sessions");
		await fs.mkdir(sessionsDir, { recursive: true });

		await fs.writeFile(
			path.join(dataDir, "index.json"),
			JSON.stringify([
				{
					sessionId: "legacy-sess",
					updatedAt: "2026-11-24T00:00:00.000Z",
					taskCount: 1,
					pendingQuestionCount: 0,
				},
			]),
			"utf8",
		);

		await fs.writeFile(
			path.join(sessionsDir, "legacy-sess.json"),
			JSON.stringify({
				sessionId: "legacy-sess",
				createdAt: "2026-11-24T00:00:00.000Z",
				updatedAt: "2026-11-24T00:00:00.000Z",
				tasks: [],
				plans: [],
				reports: [],
				handoffs: [],
				questionSets: [
					{
						id: "qs-old",
						title: "Legacy Questions",
						questions: [
							{ id: "q1", prompt: "Pick", kind: "text", required: true },
						],
						status: "submitted",
						answers: { q1: "done" },
						otherTexts: {},
						createdAt: "2026-11-24T00:00:00.000Z",
					},
				],
				toolCalls: [],
			}),
			"utf8",
		);

		const store = createSessionStore(dataDir);
		const summaries = await store.listSessions();
		expect(summaries).toHaveLength(1);
		expect(summaries[0]?.sessionId).toBe("legacy-sess");

		const migrated = await store.getSession("legacy-sess");
		expect(migrated?.schemaVersion).toBe(1);
		expect(migrated?.questionSets[0]?.blockingMode).toBe("immediate");
		expect(migrated?.questionSets[0]?.answeredQuestionIds).toEqual(["q1"]);

		await fs.writeFile(
			path.join(sessionsDir, "future-sess.json"),
			JSON.stringify({
				schemaVersion: 99,
				sessionId: "future-sess",
				createdAt: "2026-11-24T00:00:00.000Z",
				updatedAt: "2026-11-24T00:00:00.000Z",
			}),
			"utf8",
		);
		await expect(store.getSession("future-sess")).rejects.toThrow(/Unsupported session schema version 99/);
	});

	it("enforces path safety, generated plan Markdown, and report immutability without MCP plan approval gate", async () => {
		const dataDir = await makeTempDir("nw-data-");
		const exportDir = await makeTempDir("nw-export-");
		const store = createSessionStore(dataDir);

		await expect(store.getSession("../escape")).rejects.toThrow();

		const { task: t1 } = await store.upsertTask(
			"sess-alpha",
			{
				slug: "first-task",
				title: "First Task",
				status: "planned",
				summary: "Build initial store.",
				steps: [
					{
						title: "Scaffold",
						outcome: "Files exist.",
						items: [
							{ id: "1.1", text: "Create schema", status: "pending" },
							{ id: "1.2", text: "Create store", status: "pending" },
						],
					},
				],
			},
			{ exportDir },
		);
		expect(t1.taskNumber).toBe("01");

		const { planFilePath } = await store.writePlan(
			"sess-alpha",
			makeTestPlanInput(),
			{ exportDir },
		);
		expect(planFilePath).toBe(path.join(exportDir, "01-first-task.plan.md"));

		// Progression works directly when no blocking questions exist (plan approval is handled by harness UI).
		const { updatedStepIndex } = await store.updateTaskItem(
			"sess-alpha",
			"01",
			"1.1",
			"in_progress",
		);
		expect(updatedStepIndex).toBe(0);

		const tasksMd = await fs.readFile(path.join(exportDir, "tasks.md"), "utf8");
		const planMd = await fs.readFile(path.join(exportDir, "01-first-task.plan.md"), "utf8");
		expect(tasksMd).toContain("01-first-task.plan.md");
		expect(planMd).toContain("# Plan 01: First Task");
		expect(planMd).not.toContain("Review Status");

		await store.writeReport("sess-alpha", makeTestReportInput());
		await expect(
			store.writeReport("sess-alpha", makeTestReportInput({ title: "Second Write" })),
		).rejects.toThrow(/immutable/i);

		const reportMd = await fs.readFile(
			path.join(exportDir, "01-first-task.report.md"),
			"utf8",
		);
		expect(reportMd).toContain("# Report 01: First Task");
	});

	it("keeps open_workspace and app_get_state read-only, snapshots step updates, supports sinceRevision polling, and enforces per-question blocking", async () => {
		const dataDir = await makeTempDir("nw-mcp-data-");
		const store = createSessionStore(dataDir);
		const server = new McpServer(
			{ name: "new-worker-ui", version: "1.3.0" },
			{ capabilities: { resources: {}, tools: {} } },
		);
		registerNewWorkerServer(server, {
			store,
			loadAppHtml: async () => "<!doctype html><html><body>ok</body></html>",
		});

		const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
		const client = new Client({ name: "test-client", version: "1.0.0" });
		await Promise.all([
			server.connect(serverTransport),
			client.connect(clientTransport),
		]);

		const toolsResult = await client.listTools();
		expect(toolsResult.tools.some(t => t.name === "app_toggle_task_item")).toBe(false);
		expect(toolsResult.tools.some(t => t.name === "review_plan")).toBe(false);
		expect(toolsResult.tools.some(t => t.name === "app_review_plan")).toBe(false);

		const openTool = toolsResult.tools.find(t => t.name === "open_workspace");
		expect(openTool?._meta?.ui).toEqual({ resourceUri: APP_RESOURCE_URI });
		expect(openTool?._meta?.["com.google.antigravity/ui"]).toEqual({
			entrypoints: [
				{ type: "aux_pane", title: "New Worker" },
				{ type: "global", title: "New Worker" },
			],
		});

		const resResult = await client.readResource({ uri: APP_RESOURCE_URI });
		const firstContent = resResult.contents[0];
		expect(firstContent?.mimeType).toBe(RESOURCE_MIME_TYPE);

		// Read-only open_workspace({}) and app_get_state({}) create zero files on empty store.
		const emptyOpen = await client.callTool({ name: "open_workspace", arguments: {} });
		expect(emptyOpen.isError).not.toBe(true);
		expect((emptyOpen.structuredContent as { session: unknown }).session).toBeNull();

		const emptyAppState = await client.callTool({ name: "app_get_state", arguments: {} });
		expect(emptyAppState.isError).not.toBe(true);
		expect((emptyAppState.structuredContent as { session: unknown }).session).toBeNull();
		expect(await fs.readdir(dataDir)).toEqual([]);

		// Create a 3-step task and write a plan.
		await client.callTool({
			name: "upsert_task",
			arguments: {
				sessionId: "sess-q",
				slug: "gated-task",
				title: "Gated Task",
				status: "planned",
				summary: "Test mixed per-question blocking modes and step snapshots.",
				steps: [
					{
						title: "Step 1",
						outcome: "Step 1 complete.",
						items: [
							{ id: "1.1", text: "First item", status: "pending" },
							{ id: "1.2", text: "Second item", status: "pending" },
						],
					},
					{
						title: "Step 2",
						outcome: "Step 2 complete.",
						items: [
							{ id: "2.1", text: "Third item", status: "pending" },
						],
					},
					{
						title: "Step 3",
						outcome: "Step 3 complete.",
						items: [
							{ id: "3.1", text: "Fourth item", status: "pending" },
						],
					},
				],
			},
		});

		const planRes = await client.callTool({
			name: "write_plan",
			arguments: {
				sessionId: "sess-q",
				...makeTestPlanInput({ slug: "gated-task", title: "Gated Task" }),
			},
		});
		const planStructured = planRes.structuredContent as { planFilePath?: string };
		expect(planStructured.planFilePath).toBeTruthy();
		expect(await fs.readFile(planStructured.planFilePath!, "utf8")).toContain("# Plan 01: Gated Task");

		// Ask mixed per-question blocking modes in one question set.
		const askResult = await client.callTool({
			name: "ask_questions",
			arguments: {
				sessionId: "sess-q",
				id: "qs-mixed",
				title: "Mixed Blocking Modes",
				questions: [
					{
						id: "q_now",
						prompt: "Immediate decision",
						kind: "single_select",
						required: true,
						blockingMode: "immediate",
						options: [{ value: "fast", label: "Fast", recommended: true }],
					},
					{
						id: "q_step1",
						prompt: "Confirm before finishing Step 1",
						kind: "boolean",
						required: true,
						blockingMode: "before_step_finish",
						taskNumber: "01",
						stepNumber: 1,
					},
					{
						id: "q_any",
						prompt: "Optional anytime note",
						kind: "text",
						required: false,
						blockingMode: "anytime",
					},
				],
			},
		});
		expect(askResult.isError).not.toBe(true);

		// Immediate question blocks even starting item 1.1.
		const blockedImmediate = await client.callTool({
			name: "update_task_item",
			arguments: {
				sessionId: "sess-q",
				taskNumber: "01",
				itemId: "1.1",
				status: "in_progress",
			},
		});
		expect(blockedImmediate.isError).toBe(true);

		// Submit only immediate question -> status becomes "partial".
		const submitImmediate = await client.callTool({
			name: "app_submit_question_answers",
			arguments: {
				sessionId: "sess-q",
				questionSetId: "qs-mixed",
				scope: "immediate",
				answers: { q_now: "fast" },
				otherTexts: {},
			},
		});
		expect(submitImmediate.isError).not.toBe(true);
		const partialSession = (submitImmediate.structuredContent as {
			session: { questionSets: Array<{ status: string; answeredQuestionIds: string[] }> };
		}).session;
		expect(partialSession.questionSets[0]?.status).toBe("partial");
		expect(partialSession.questionSets[0]?.answeredQuestionIds).toEqual(["q_now"]);

		// Completing 1.1 succeeds and embeds an immutable stepSnapshot for Step 1!
		const step1Item1 = await client.callTool({
			name: "update_task_item",
			arguments: {
				sessionId: "sess-q",
				taskNumber: "01",
				itemId: "1.1",
				status: "done",
			},
		});
		expect(step1Item1.isError).not.toBe(true);
		const step1Payload = step1Item1.structuredContent as {
			mode: string;
			activeStepIndex?: number;
			activeTaskItemId?: string;
			stepSnapshot?: TaskStepSnapshot;
		};
		expect(step1Payload.mode).toBe("task_step");
		expect(step1Payload.activeStepIndex).toBe(0);
		expect(step1Payload.activeTaskItemId).toBe("1.1");
		expect(step1Payload.stepSnapshot?.stepIndex).toBe(0);
		expect(step1Payload.stepSnapshot?.totalSteps).toBe(3);
		expect(step1Payload.stepSnapshot?.capturedAt).toBeTruthy();
		expect(step1Payload.stepSnapshot?.step.startedAt).toBeTruthy();
		expect(step1Payload.stepSnapshot?.step.items).toEqual([
			expect.objectContaining({ id: "1.1", text: "First item", status: "done" }),
			expect.objectContaining({ id: "1.2", text: "Second item", status: "pending" }),
		]);
		expect(step1Payload.stepSnapshot?.step.items[0]?.completedAt).toBeTruthy();

		// Finishing Step 1 or starting Step 2 is blocked by q_step1.
		const blockedStepFinish = await client.callTool({
			name: "update_task_item",
			arguments: {
				sessionId: "sess-q",
				taskNumber: "01",
				itemId: "1.2",
				status: "done",
			},
		});
		expect(blockedStepFinish.isError).toBe(true);

		const blockedStep2 = await client.callTool({
			name: "update_task_item",
			arguments: {
				sessionId: "sess-q",
				taskNumber: "01",
				itemId: "2.1",
				status: "in_progress",
			},
		});
		expect(blockedStep2.isError).toBe(true);

		// Submit q_step1 -> finish Step 1, Step 2, and Step 3.
		await client.callTool({
			name: "app_submit_question_answers",
			arguments: {
				sessionId: "sess-q",
				questionSetId: "qs-mixed",
				scope: "before_step_finish",
				answers: { q_step1: true },
				otherTexts: {},
			},
		});

		await client.callTool({
			name: "update_task_item",
			arguments: { sessionId: "sess-q", taskNumber: "01", itemId: "1.2", status: "done" },
		});
		await client.callTool({
			name: "update_task_item",
			arguments: { sessionId: "sess-q", taskNumber: "01", itemId: "2.1", status: "done" },
		});
		await client.callTool({
			name: "update_task_item",
			arguments: { sessionId: "sess-q", taskNumber: "01", itemId: "3.1", status: "done" },
		});

		// Historical step1Payload.stepSnapshot stays locked at Step 1 (item 1.1 done, 1.2 pending).
		expect(step1Payload.stepSnapshot?.stepIndex).toBe(0);
		expect(step1Payload.stepSnapshot?.step.items[1]?.status).toBe("pending");

		// Verify app_get_state sinceRevision polling short-circuit and change detection.
		const initialDash = await client.callTool({
			name: "app_get_state",
			arguments: { sessionId: "sess-q", mode: "dashboard" },
		});
		const rev1 = (initialDash.structuredContent as { revision?: string }).revision;
		expect(rev1).toBeTruthy();

		const unchangedPoll = await client.callTool({
			name: "app_get_state",
			arguments: { sessionId: "sess-q", mode: "dashboard", sinceRevision: rev1 },
		});
		expect(unchangedPoll.structuredContent).toEqual({
			unchanged: true,
			revision: rev1,
		});

		await client.callTool({
			name: "record_handoff",
			arguments: {
				sessionId: "sess-q",
				kind: "completion",
				title: "All done",
				summary: "Completed all steps.",
			},
		});

		const updatedPoll = await client.callTool({
			name: "app_get_state",
			arguments: { sessionId: "sess-q", mode: "dashboard", sinceRevision: rev1 },
		});
		const updatedStructured = updatedPoll.structuredContent as {
			revision?: string;
			unchanged?: boolean;
			session?: { handoffs: unknown[] };
		};
		expect(updatedStructured.unchanged).toBeUndefined();
		expect(updatedStructured.revision).not.toBe(rev1);
		expect(updatedStructured.session?.handoffs).toHaveLength(1);

		const stateRead = await client.callTool({
			name: "get_session_state",
			arguments: { sessionId: "sess-q" },
		});
		const stateText
			= stateRead.content[0]?.type === "text" ? stateRead.content[0].text : "";
		expect(stateText).toContain("Open questions: q_any [Answer anytime]");
		expect(stateText).toContain("Submitted partial answers");

		// Verify task/step/item timestamps on final task state.
		const finalSession = await store.getSession("sess-q");
		const finalTask = finalSession?.tasks[0];
		expect(finalTask?.createdAt).toBeTruthy();
		expect(finalTask?.startedAt).toBeTruthy();
		expect(finalTask?.completedAt).toBeTruthy();
		expect(finalTask?.steps[0]?.completedAt).toBeTruthy();

		// Verify UI settings persistence (read-only until updated) and revision bump.
		expect(await store.getSettings()).toEqual({
			schemaVersion: 1,
			displayType: "minimized",
			stepDisplayType: "inherit",
		});
		const compactRes = await client.callTool({
			name: "app_update_settings",
			arguments: {
				sessionId: "sess-q",
				displayType: "compact",
				stepDisplayType: "full",
			},
		});
		expect(compactRes.isError).not.toBe(true);
		expect((compactRes.structuredContent as { settings?: unknown }).settings).toEqual({
			schemaVersion: 1,
			displayType: "compact",
			stepDisplayType: "full",
		});

		const settingsRes = await client.callTool({
			name: "app_update_settings",
			arguments: {
				sessionId: "sess-q",
				displayType: "full",
				stepDisplayType: "minimized",
			},
		});
		expect(settingsRes.isError).not.toBe(true);
		const settingsPayload = settingsRes.structuredContent as {
			settings?: { displayType: string; stepDisplayType: string };
			revision?: string;
		};
		expect(settingsPayload.settings).toEqual({
			schemaVersion: 1,
			displayType: "full",
			stepDisplayType: "minimized",
		});
		expect(settingsPayload.revision).not.toBe(updatedStructured.revision);

		// Verify app_clear_tool_calls clears session tool call history.
		expect((finalSession?.toolCalls.length ?? 0) > 0).toBe(true);
		const clearCallsRes = await client.callTool({
			name: "app_clear_tool_calls",
			arguments: { sessionId: "sess-q" },
		});
		expect(clearCallsRes.isError).not.toBe(true);
		const clearedSession = (clearCallsRes.structuredContent as {
			session?: { toolCalls: unknown[] };
		}).session;
		expect(clearedSession?.toolCalls).toEqual([]);

		await client.close();
		await server.close();
	});
});
