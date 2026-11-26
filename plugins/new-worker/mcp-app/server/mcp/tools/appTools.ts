import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DashboardScopeSchema, DashboardTabSchema, GroupIdSchema, QuestionAnswerValueSchema, SessionIdSchema, StepDisplayOverrideSchema, TaskIdSchema, WidgetDisplayModeSchema, WidgetRouteSchema } from "@/shared/contracts.js";
import { formatQuestionReply } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { ValidationError } from "../../repositories/errors.js";
import { saveQuestionDraft, submitQuestionAnswers } from "../../repositories/questions.js";
import { assignSessionGroup, deleteSessionGroup, upsertSession, upsertSessionGroup } from "../../repositories/sessions.js";
import { clearToolCalls, updateUiSettings } from "../../repositories/settings.js";
import { recordTimelineEvent } from "../../repositories/timeline.js";
import { buildDashboardPayload, buildWidgetPayload } from "../../repositories/workspace.js";
import { APP_ONLY_META, runSafeTool, TimelineNoteLinkInputSchema } from "./shared.js";

/**
 * Register the 6 `app_*` tools restricted to UI webviews (`visibility: ["app"]`).
 *
 * @param server - Target MCP server instance.
 * @param db - Active Drizzle SQLite database connection.
 */
export function registerAppOnlyTools(server: McpServer, db: AppDrizzleDb): void {
	// app_get_dashboard_state (strictly read-only)
	registerAppTool(
		server,
		"app_get_dashboard_state",
		{
			title: "App Get Dashboard State",
			description: "Read-only fetch of dashboard state for a session or group with revision short-circuit.",
			inputSchema: z.object({
				scope: DashboardScopeSchema.optional(),
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.optional(),
				rootDirFilter: z.string().optional(),
				activeTab: DashboardTabSchema.optional(),
				activeItemId: z.string().optional(),
				sinceRevision: z.string().optional(),
			}),
			_meta: APP_ONLY_META,
		},
		async (args) => {
			const payload = buildDashboardPayload(db, {
				scope: args.scope,
				sessionId: args.sessionId,
				groupId: args.groupId,
				rootDirFilter: args.rootDirFilter,
				activeTab: args.activeTab,
				activeItemId: args.activeItemId,
			});

			if (args.sinceRevision && args.sinceRevision === payload.revision) {
				return {
					content: [{ type: "text", text: "Unchanged" }],
					structuredContent: { unchanged: true, revision: payload.revision },
				};
			}

			return {
				content: [{ type: "text", text: "Dashboard state loaded." }],
				structuredContent: payload,
			};
		},
	);

	// app_get_widget_state (strictly read-only)
	registerAppTool(
		server,
		"app_get_widget_state",
		{
			title: "App Get Widget State",
			description: "Read-only refresh of an isolated inline widget route payload.",
			inputSchema: z.object({
				widget: WidgetRouteSchema,
				sessionId: SessionIdSchema,
				taskId: TaskIdSchema.optional(),
				handoffId: z.string().optional(),
				questionSetId: z.string().optional(),
			}),
			_meta: APP_ONLY_META,
		},
		async (args) => {
			const payload = buildWidgetPayload(db, {
				widget: args.widget,
				sessionId: args.sessionId,
				taskId: args.taskId,
				handoffId: args.handoffId,
				questionSetId: args.questionSetId,
			});
			return {
				content: [{ type: "text", text: `Widget ${args.widget} loaded.` }],
				structuredContent: payload,
			};
		},
	);

	// app_question_action (save_draft | submit)
	registerAppTool(
		server,
		"app_question_action",
		{
			title: "App Question Action",
			description: "Save draft answers or submit scoped/full question answers from the UI.",
			inputSchema: z.object({
				action: z.enum(["save_draft", "submit"]),
				sessionId: SessionIdSchema,
				questionSetId: z.string().min(1),
				answers: z.record(z.string(), QuestionAnswerValueSchema),
				otherTexts: z.record(z.string(), z.string()).default({}),
				scope: z.enum(["all", "immediate", "before_step_finish", "answered"]).optional(),
				questionIds: z.array(z.string().min(1)).optional(),
				source: z.enum(["dashboard", "widget"]).optional(),
				dashboardScope: DashboardScopeSchema.optional(),
				groupId: GroupIdSchema.optional(),
			}),
			_meta: APP_ONLY_META,
		},
		args => runSafeTool(() => {
			if (args.action === "save_draft") {
				const questionSet = saveQuestionDraft(
					db,
					args.sessionId,
					args.questionSetId,
					args.answers,
					args.otherTexts,
				);
				const structuredContent = args.source === "widget"
					? buildWidgetPayload(db, {
							widget: "questions",
							sessionId: args.sessionId,
							taskId: questionSet.taskId,
							questionSetId: questionSet.id,
						})
					: buildDashboardPayload(db, {
							scope: args.dashboardScope,
							sessionId: args.sessionId,
							groupId: args.groupId,
							activeTab: "questions",
							activeItemId: questionSet.id,
						});
				return {
					content: [{ type: "text", text: "Draft saved." }],
					structuredContent,
				};
			}

			const { questionSet, submittedQuestionIds } = submitQuestionAnswers(
				db,
				args.sessionId,
				args.questionSetId,
				args.answers,
				args.otherTexts,
				{
					scope: args.scope,
					questionIds: args.questionIds,
				},
			);
			const replyText = formatQuestionReply(
				questionSet,
				questionSet.answers,
				questionSet.otherTexts,
				submittedQuestionIds,
			);
			const structuredContent = args.source === "widget"
				? buildWidgetPayload(db, {
						widget: "questions",
						sessionId: args.sessionId,
						taskId: questionSet.taskId,
						questionSetId: questionSet.id,
					})
				: buildDashboardPayload(db, {
						scope: args.dashboardScope,
						sessionId: args.sessionId,
						groupId: args.groupId,
						activeTab: "questions",
						activeItemId: questionSet.id,
					});
			return {
				content: [{ type: "text", text: replyText }],
				structuredContent,
			};
		}),
	);

	// app_update_settings
	registerAppTool(
		server,
		"app_update_settings",
		{
			title: "App Update Settings",
			description: "Persist inline widget display settings (widget and step default display modes).",
			inputSchema: z.object({
				displayType: WidgetDisplayModeSchema.optional(),
				stepDisplayType: StepDisplayOverrideSchema.optional(),
				scope: DashboardScopeSchema.optional(),
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.optional(),
				activeTab: DashboardTabSchema.optional(),
				activeItemId: z.string().optional(),
			}),
			_meta: APP_ONLY_META,
		},
		async (args) => {
			const settings = updateUiSettings(db, {
				displayType: args.displayType,
				stepDisplayType: args.stepDisplayType,
			});
			const payload = buildDashboardPayload(db, {
				scope: args.scope,
				sessionId: args.sessionId,
				groupId: args.groupId,
				activeTab: args.activeTab,
				activeItemId: args.activeItemId,
			});
			return {
				content: [
					{
						type: "text",
						text: `Settings saved (displayType=${settings.displayType}, stepDisplayType=${settings.stepDisplayType}).`,
					},
				],
				structuredContent: payload,
			};
		},
	);

	// app_clear_tool_calls
	registerAppTool(
		server,
		"app_clear_tool_calls",
		{
			title: "App Clear Tool Calls",
			description: "Clear stored tool call audit history for a session.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				scope: DashboardScopeSchema.optional(),
				groupId: GroupIdSchema.optional(),
			}),
			_meta: APP_ONLY_META,
		},
		async (args) => {
			clearToolCalls(db, args.sessionId);
			const payload = buildDashboardPayload(db, {
				scope: args.scope,
				sessionId: args.sessionId,
				groupId: args.groupId,
				activeTab: "calls",
			});
			return {
				content: [{
					type: "text",
					text: `Cleared tool call history for "${args.sessionId}".`,
				}],
				structuredContent: payload,
			};
		},
	);

	// app_manage_workspace — Dashboard UI actions for groups, session meta, and manual timeline notes
	registerAppTool(
		server,
		"app_manage_workspace",
		{
			title: "App Manage Workspace",
			description: "Dashboard-only management for 1:N session groups, session title/rootDir, and user timeline notes.",
			inputSchema: z.object({
				action: z.enum([
					"upsert_group",
					"delete_group",
					"assign_group",
					"update_session",
					"add_timeline_note",
				]),
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.nullable().optional(),
				name: z.string().optional(),
				description: z.string().optional(),
				notes: z.string().optional(),
				title: z.string().optional(),
				rootDir: z.string().optional(),
				summary: z.string().optional(),
				links: z.array(TimelineNoteLinkInputSchema).optional(),
				scope: DashboardScopeSchema.optional(),
				activeTab: DashboardTabSchema.optional(),
			}),
			_meta: APP_ONLY_META,
		},
		args => runSafeTool(() => {
			let nextSessionId = args.sessionId;
			let nextGroupId = args.groupId ?? undefined;

			switch (args.action) {
				case "upsert_group": {
					if (!args.name?.trim()) {
						throw new ValidationError("Group name cannot be empty.");
					}
					const group = upsertSessionGroup(db, {
						id: args.groupId ?? undefined,
						name: args.name,
						description: args.description,
						notes: args.notes,
					});
					nextGroupId = group.id;
					break;
				}
				case "delete_group": {
					if (!args.groupId) {
						throw new ValidationError("delete_group requires groupId.");
					}
					deleteSessionGroup(db, args.groupId);
					nextGroupId = undefined;
					break;
				}
				case "assign_group": {
					if (!args.sessionId || args.groupId === undefined) {
						throw new ValidationError("assign_group requires sessionId and groupId.");
					}
					const session = assignSessionGroup(db, args.sessionId, args.groupId);
					nextSessionId = session.sessionId;
					nextGroupId = session.groupId ?? undefined;
					break;
				}
				case "update_session": {
					if (!args.sessionId) {
						throw new ValidationError("update_session requires sessionId.");
					}
					const session = upsertSession(db, args.sessionId, {
						title: args.title,
						rootDir: args.rootDir,
						groupId: args.groupId,
					});
					nextSessionId = session.sessionId;
					nextGroupId = session.groupId ?? undefined;
					break;
				}
				case "add_timeline_note": {
					if (!args.title?.trim()) {
						throw new ValidationError("Note title cannot be empty.");
					}
					recordTimelineEvent(db, {
						sessionId: args.sessionId ?? null,
						groupId: args.groupId ?? null,
						eventType: "note",
						actor: "user",
						title: args.title.trim(),
						summary: args.summary?.trim() || undefined,
						links: args.links ?? [],
					});
					break;
				}
			}

			const payload = buildDashboardPayload(db, {
				scope: args.scope,
				sessionId: nextSessionId,
				groupId: nextGroupId,
				activeTab: args.activeTab,
			});
			return {
				content: [{ type: "text", text: `Workspace updated (${args.action}).` }],
				structuredContent: payload,
			};
		}),
	);
}
