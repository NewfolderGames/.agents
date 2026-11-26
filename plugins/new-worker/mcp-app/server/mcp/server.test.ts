import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../config.js";
import { openDatabase } from "../db/client.js";
import { sessions, tasks, timelineEvents, toolCalls } from "../db/schema.js";
import { injectWidgetRoute } from "./resources.js";
import { registerNewWorkerServer } from "./server.js";

async function createConnectedServer() {
	const handle = openDatabase(":memory:");
	const server = new McpServer(
		{ name: "new-worker-ui-test", version: "2.0.0" },
		{ capabilities: { resources: {}, tools: {} } },
	);

	registerNewWorkerServer(server, {
		db: handle.db,
		loadDashboardHtml: async () => "<!doctype html><html lang=\"en\"><head></head><body>DASHBOARD</body></html>",
		loadWidgetHtml: async () => "<!doctype html><html lang=\"en\"><head><script type=\"module\">const tpl=\"<head></head>\";</script></head><body>WIDGET</body></html>",
	});

	const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
	const client = new Client({ name: "test-client", version: "1.0.0" });
	await Promise.all([
		server.connect(serverTransport),
		client.connect(clientTransport),
	]);

	return {
		handle,
		client,
		close: async () => {
			await client.close();
			await server.close();
			handle.close();
		},
	};
}

describe("MCP server resources, CLI parsing, and consolidated 11+6 tools", () => {
	it("guards parseCliArgs against blank or unexpanded ${...} template values", () => {
		const parsed = parseCliArgs([
			"--data-dir=${PLUGIN_DATA}",
			"--dashboard-html=",
			"--widget-html",
			"${UNEXPANDED}",
		]);
		expect(parsed.dataDir).not.toContain("${");
		expect(parsed.dashboardHtmlPath).toBeUndefined();
		expect(parsed.widgetHtmlPath).toBeUndefined();

		const custom = parseCliArgs([
			"--data-dir=/tmp/nw-data",
			"--dashboard-html=/tmp/dash.html",
			"--widget-html",
			"/tmp/widget.html",
		]);
		expect(custom.dataDir).toBe("/tmp/nw-data");
		expect(custom.dashboardHtmlPath).toBe("/tmp/dash.html");
		expect(custom.widgetHtmlPath).toBe("/tmp/widget.html");
	});

	it("injects widget route right after <head> without corrupting </head> literals inside bundled JS", () => {
		const html = "<!doctype html><html><head><script type=\"module\">const s=\"<head></head>\";</script></head><body></body></html>";
		const injected = injectWidgetRoute(html, "questions");
		expect(injected).toBe(
			"<!doctype html><html><head><script>window.__NEW_WORKER_ROUTE__=\"/widget/questions\";</script><script type=\"module\">const s=\"<head></head>\";</script></head><body></body></html>",
		);
	});

	it("exposes 11 model-visible tools, 6 app-only tools, and 6 route-tagged UI resources", async () => {
		const ctx = await createConnectedServer();
		try {
			const { tools } = await ctx.client.listTools();
			expect(tools).toHaveLength(17);

			const appOnly = tools.filter(t =>
				((t._meta as {
					ui?: { visibility?: string[] };
				} | undefined)?.ui?.visibility ?? []).includes("app"));
			const modelVisible = tools.filter(t => !appOnly.includes(t));
			expect(modelVisible.map(t => t.name).sort()).toEqual([
				"ask_questions",
				"manage_context",
				"open_workspace",
				"query_timeline",
				"query_workspace",
				"record_handoff",
				"update_plan",
				"update_task_item",
				"upsert_task",
				"write_plan",
				"write_report",
			]);
			expect(appOnly.map(t => t.name).sort()).toEqual([
				"app_clear_tool_calls",
				"app_get_dashboard_state",
				"app_get_widget_state",
				"app_manage_workspace",
				"app_question_action",
				"app_update_settings",
			]);

			// update_task_item must stay data-only (no step progress widget).
			const updateItemTool = tools.find(t => t.name === "update_task_item");
			expect((updateItemTool?._meta as {
				ui?: { resourceUri?: string };
			} | undefined)?.ui?.resourceUri).toBeUndefined();

			const { resources } = await ctx.client.listResources();
			expect(resources.map(r => r.uri).sort()).toEqual([
				"ui://new-worker/dashboard",
				"ui://new-worker/widget/handoff",
				"ui://new-worker/widget/plan",
				"ui://new-worker/widget/questions",
				"ui://new-worker/widget/report",
				"ui://new-worker/widget/task",
			]);

			const dashRes = await ctx.client.readResource({ uri: "ui://new-worker/dashboard" });
			expect(dashRes.contents[0]?.mimeType).toBe("text/html;profile=mcp-app");
			expect((dashRes.contents[0] as { text?: string }).text).toContain("DASHBOARD");

			const planRes = await ctx.client.readResource({ uri: "ui://new-worker/widget/plan" });
			const planText = (planRes.contents[0] as { text?: string }).text ?? "";
			expect(planText).toContain("<head><script>window.__NEW_WORKER_ROUTE__=\"/widget/plan\";</script><script type=\"module\">");
			expect(planText).toContain("const tpl=\"<head></head>\";");
		}
		finally {
			await ctx.close();
		}
	});

	it("keeps open_workspace, query_workspace, query_timeline, and app read tools strictly zero-write", async () => {
		const ctx = await createConnectedServer();
		try {
			await ctx.client.callTool({ name: "open_workspace", arguments: {} });
			await ctx.client.callTool({
				name: "query_workspace",
				arguments: { target: "session_context" },
			});
			await ctx.client.callTool({ name: "query_workspace", arguments: { target: "groups" } });
			await ctx.client.callTool({ name: "query_workspace", arguments: { target: "tasks" } });
			await ctx.client.callTool({ name: "query_timeline", arguments: {} });
			await ctx.client.callTool({ name: "app_get_dashboard_state", arguments: {} });

			expect(ctx.handle.db.select().from(sessions).all()).toHaveLength(0);
			expect(ctx.handle.db.select().from(tasks).all()).toHaveLength(0);
			expect(ctx.handle.db.select().from(timelineEvents).all()).toHaveLength(0);
			expect(ctx.handle.db.select().from(toolCalls).all()).toHaveLength(0);
		}
		finally {
			await ctx.close();
		}
	});

	it("runs full multi-session group, global task ID, timeline, query, and widget flow over MCP", async () => {
		const ctx = await createConnectedServer();
		try {
			// Create group + two sessions with rootDir
			await ctx.client.callTool({
				name: "manage_context",
				arguments: {
					action: "upsert_group",
					groupId: "grp-1",
					name: "SQLite Rewrite",
					description: "Grouped sessions",
					notes: "Shared agent context",
				},
			});
			await ctx.client.callTool({
				name: "manage_context",
				arguments: {
					action: "upsert_session",
					sessionId: "sess-1",
					title: "Server Session",
					rootDir: "/work/repo",
					groupId: "grp-1",
				},
			});

			// write_plan allocates global taskId #1
			const planCall = await ctx.client.callTool({
				name: "write_plan",
				arguments: {
					sessionId: "sess-1",
					slug: "mcp-rewrite",
					title: "MCP Rewrite",
					target: { repo: "my-agents", branch: "main", commit: "abc1234" },
					overview: "Rewrite on SQLite.",
					expectedOutcomes: ["SQLite stores everything."],
					scope: { inScope: ["server"], outOfScope: ["legacy"] },
					currentImplementation: ["Old JSON."],
					keyDecisions: ["Use Drizzle + node:sqlite."],
					proposedChanges: ["Add repos."],
					fileStructure: [{
						path: "server/index.ts",
						action: "modified",
						reason: "Entrypoint",
					}],
					testing: {
						validationCommands: ["pnpm test"],
						keyScenarios: ["MCP flow"],
						testChanges: ["server.test.ts"],
					},
				},
			});
			expect(planCall.isError, JSON.stringify(planCall)).toBeFalsy();
			const planStructured = planCall.structuredContent as {
				taskId: number;
				kind: string;
				widget: string;
			};
			expect(planStructured.kind).toBe("widget");
			expect(planStructured.widget).toBe("plan");
			expect(planStructured.taskId).toBe(1);

			// upsert_task updates task #1 with steps, then creates global task #2 on sess-2
			await ctx.client.callTool({
				name: "upsert_task",
				arguments: {
					sessionId: "sess-1",
					taskId: 1,
					slug: "mcp-rewrite",
					title: "MCP Rewrite",
					status: "in_progress",
					summary: "Executing rewrite.",
					steps: [
						{
							title: "Implement server",
							outcome: "Server passes tests.",
							items: [
								{ id: "1", text: "Write registerTools.ts", status: "in_progress" },
								{ id: "2", text: "Run vitest", status: "pending" },
							],
						},
					],
				},
			});
			const task2Call = await ctx.client.callTool({
				name: "upsert_task",
				arguments: {
					sessionId: "sess-2",
					groupId: "grp-1",
					sessionTitle: "UI Session",
					rootDir: "/work/repo",
					slug: "ui-split",
					title: "UI Split",
					status: "planned",
					summary: "Split widgets.",
					steps: [
						{
							title: "Build primitives",
							outcome: "Primitives compile.",
							items: [{ id: "1", text: "Create ModalDialog", status: "pending" }],
						},
					],
				},
			});
			expect((task2Call.structuredContent as {
				task: { taskId: number };
			}).task.taskId).toBe(2);

			// update_task_item is data-only and returns stepSnapshot without a widget route
			const itemCall = await ctx.client.callTool({
				name: "update_task_item",
				arguments: {
					sessionId: "sess-1",
					taskId: 1,
					itemId: "1",
					status: "done",
				},
			});
			const itemStructured = itemCall.structuredContent as {
				taskId: number;
				stepSnapshot?: { taskId: number };
			};
			expect(itemStructured.taskId).toBe(1);
			expect(itemStructured.stepSnapshot?.taskId).toBe(1);

			// update_plan partially patches task #1 and emits plan_updated
			const updatePlanCall = await ctx.client.callTool({
				name: "update_plan",
				arguments: {
					sessionId: "sess-1",
					taskId: 1,
					overview: "Rewrite on SQLite (updated after Plan Mode sync).",
					reviewStatus: "approved",
					changeSummary: "Synced Plan Mode overview edits",
				},
			});
			expect(updatePlanCall.isError, JSON.stringify(updatePlanCall)).toBeFalsy();

			// query_workspace: plan with and without includeMarkdown
			const planQueryCompact = await ctx.client.callTool({
				name: "query_workspace",
				arguments: { target: "plan", taskId: 1 },
			});
			expect((planQueryCompact.structuredContent as {
				planMarkdown?: string;
			}).planMarkdown).toBeUndefined();

			const planQueryFull = await ctx.client.callTool({
				name: "query_workspace",
				arguments: { target: "plan", taskId: 1, includeMarkdown: true },
			});
			const planFullText = (planQueryFull.structuredContent as {
				planMarkdown?: string;
			}).planMarkdown;
			expect(planFullText).toContain("# Plan 001: MCP Rewrite");
			expect(planFullText).toContain("Rewrite on SQLite (updated after Plan Mode sync).");

			// query_workspace: session_context exposes group & sibling sessions
			const ctxQuery = await ctx.client.callTool({
				name: "query_workspace",
				arguments: { target: "session_context", sessionId: "sess-1" },
			});
			const ctxData = ctxQuery.structuredContent as {
				session: { rootDir?: string };
				group: { name: string };
				siblingSessions: Array<{ sessionId: string }>;
			};
			expect(ctxData.session.rootDir).toBe("/work/repo");
			expect(ctxData.group.name).toBe("SQLite Rewrite");
			expect(ctxData.siblingSessions).toHaveLength(2);

			// add_timeline_note + query_timeline polymorphic lookup
			await ctx.client.callTool({
				name: "manage_context",
				arguments: {
					action: "add_timeline_note",
					sessionId: "sess-1",
					title: "Architecture locked",
					links: [{ entityType: "task", entityId: "1", role: "related" }],
				},
			});

			const tlCall = await ctx.client.callTool({
				name: "query_timeline",
				arguments: { entityType: "task", entityId: "1" },
			});
			const tlEvents = (tlCall.structuredContent as {
				events: Array<{ eventType: string }>;
			}).events;
			expect(tlEvents.some(e => e.eventType === "note")).toBe(true);
			expect(tlEvents.some(e => e.eventType === "plan_written")).toBe(true);
			expect(tlEvents.some(e => e.eventType === "plan_updated")).toBe(true);

			// app_get_dashboard_state revision short-circuit
			const dash1 = await ctx.client.callTool({
				name: "app_get_dashboard_state",
				arguments: { scope: "group", groupId: "grp-1" },
			});
			const rev = (dash1.structuredContent as { revision: string }).revision;
			const dash2 = await ctx.client.callTool({
				name: "app_get_dashboard_state",
				arguments: { scope: "group", groupId: "grp-1", sinceRevision: rev },
			});
			expect((dash2.structuredContent as { unchanged?: boolean }).unchanged).toBe(true);

			// Clear tool calls on sess-1
			const cleared = await ctx.client.callTool({
				name: "app_clear_tool_calls",
				arguments: { sessionId: "sess-1" },
			});
			expect((cleared.structuredContent as {
				toolCalls: unknown[];
			}).toolCalls).toHaveLength(0);

			// Lazy-MCP null and [null] placeholders on optional fields are normalized instead of failing validation
			const nullishPlanCall = await ctx.client.callTool({
				name: "write_plan",
				arguments: {
					sessionId: "sess-1",
					slug: "nullish-plan",
					title: "Nullish Plan",
					target: { repo: "my-agents", branch: "main", commit: "abc1234" },
					follows: null,
					overview: "Ensure null optional placeholders succeed.",
					expectedOutcomes: ["Validation tolerates null optional placeholders."],
					scope: { inScope: ["tools"], outOfScope: ["none"] },
					openQuestions: [null],
					currentImplementation: ["Strict optional fields."],
					keyDecisions: ["Strip null optional placeholders."],
					proposedChanges: ["Add optionalInput helpers."],
					calibration: null,
					fileStructure: [{ path: "shared.ts", action: "modified", reason: "Helpers" }],
					testing: {
						validationCommands: ["pnpm test"],
						keyScenarios: ["Null placeholder normalization"],
						edgeCases: [null],
						testChanges: ["server.test.ts"],
					},
				},
			});
			expect(nullishPlanCall.isError, JSON.stringify(nullishPlanCall)).toBeFalsy();
			const nullishTaskId = (nullishPlanCall.structuredContent as { taskId: number }).taskId;

			const nullishReportCall = await ctx.client.callTool({
				name: "write_report",
				arguments: {
					sessionId: "sess-1",
					taskId: nullishTaskId,
					slug: "nullish-plan",
					title: "Nullish Report",
					mode: "implementation",
					outcome: "Completed",
					target: { repo: "my-agents", branch: "main", commit: "abc1234" },
					summary: "Delivered null normalization.",
					planDeviations: [null],
					operationalNotes: [null],
					followUps: [null],
					tryCommand: null,
				},
			});
			expect(nullishReportCall.isError, JSON.stringify(nullishReportCall)).toBeFalsy();
		}
		finally {
			await ctx.close();
		}
	});
});
