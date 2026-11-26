import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { SessionIdSchema, SlugSchema, TaskIdSchema, TaskItemStatusSchema, TaskLifecycleStatusSchema } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { hasSession } from "../../repositories/sessions.js";
import { recordToolCall } from "../../repositories/settings.js";
import { updateTaskItem, upsertTask } from "../../repositories/tasks.js";
import { buildWidgetPayload } from "../../repositories/workspace.js";
import { WIDGET_RESOURCE_URIS } from "../resources.js";
import { buildSessionMeta, optionalInput, runLoggedTool, SessionMetaZodFields } from "./shared.js";

const ToolStepInputSchema = z.object({
	title: z.string().min(1),
	outcome: z.string().min(1),
	items: z
		.array(
			z.object({
				id: z.string().min(1).describe("Stable checklist item key within the task."),
				text: z.string().min(1),
				status: TaskItemStatusSchema,
			}),
		)
		.min(1),
});

/**
 * Register `upsert_task` (single-row task link widget) and `update_task_item` (data-only)
 * backed by SQLite task storage.
 *
 * @param server - Target MCP server instance.
 * @param db - Active Drizzle SQLite database connection.
 */
export function registerTaskTools(server: McpServer, db: AppDrizzleDb): void {
	// upsert_task -> /widget/task
	registerAppTool(
		server,
		"upsert_task",
		{
			title: "Upsert Task",
			description:
				"Create a new global task (auto-incremented integer taskId starting at 1 across all sessions when taskId is omitted) or replace/update an existing task's title, status, summary, and step checklists. Automatically records timeline events and exports tasks.md when exportDir is configured.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: optionalInput(TaskIdSchema).describe("Existing global task ID to update; omit to allocate the next global task ID."),
				slug: SlugSchema,
				title: z.string().min(1),
				status: TaskLifecycleStatusSchema,
				summary: z.string().min(1),
				steps: z.array(ToolStepInputSchema).min(1),
				planFile: optionalInput(z.string()),
				reportFile: optionalInput(z.string()),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.task },
			},
		},
		args => runLoggedTool(db, {
			sessionId: args.sessionId,
			toolName: "upsert_task",
		}, async () => {
			const isNewSession = !hasSession(db, args.sessionId);
			const { task } = await upsertTask(
				db,
				args.sessionId,
				{
					taskId: args.taskId,
					slug: args.slug,
					title: args.title,
					status: args.status,
					summary: args.summary,
					steps: args.steps.map(step => ({
						title: step.title,
						outcome: step.outcome,
						items: step.items.map(item => ({
							itemKey: item.id,
							text: item.text,
							status: item.status,
						})),
					})),
					planFile: args.planFile,
					reportFile: args.reportFile,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"upsert_task",
				"ok",
				`Task ${formatTaskId(task.taskId)} (${task.status}) — ${task.title}`,
				`taskId=${task.taskId}, steps=${task.steps.length}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "task",
				sessionId: args.sessionId,
				taskId: task.taskId,
			});

			const sessionHint = isNewSession
				? ` New session "${args.sessionId}" created — call open_workspace({ sessionId: "${args.sessionId}" }) to open the Dashboard UI.`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `Saved Task ${formatTaskId(task.taskId)} "${task.title}" (${task.status}, ${task.steps.length} steps).${sessionHint}`,
					},
				],
				structuredContent: payload,
			};
		}),
	);

	// update_task_item — data-only (step progress widget intentionally omitted from chat)
	server.registerTool(
		"update_task_item",
		{
			title: "Update Task Item",
			description:
				"Update one checklist item's status (pending, in_progress, done) by global taskId and itemId. Enforces single in-progress item and immediate/before_step_finish question blockers, emits step transition timeline events, and updates Dashboard state without rendering an inline step widget.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: TaskIdSchema,
				itemId: z.string().min(1).describe("Checklist itemKey defined in upsert_task."),
				status: TaskItemStatusSchema,
				taskStatus: optionalInput(TaskLifecycleStatusSchema),
			}),
		},
		args => runLoggedTool(db, {
			sessionId: args.sessionId,
			toolName: "update_task_item",
		}, async () => {
			const { task, updatedStepIndex, stepSnapshot } = await updateTaskItem(
				db,
				args.sessionId,
				args.taskId,
				args.itemId,
				args.status,
				args.taskStatus,
			);

			recordToolCall(
				db,
				args.sessionId,
				"update_task_item",
				"ok",
				`Task ${formatTaskId(task.taskId)} item ${args.itemId} -> ${args.status}`,
				`taskId=${task.taskId}, step=${updatedStepIndex + 1}`,
			);

			return {
				content: [
					{
						type: "text",
						text: `Task ${formatTaskId(task.taskId)} Step ${updatedStepIndex + 1} item "${args.itemId}" -> ${args.status} (task status: ${task.status}).`,
					},
				],
				structuredContent: {
					taskId: task.taskId,
					stepIndex: updatedStepIndex,
					totalSteps: task.steps.length,
					stepSnapshot,
					task,
				},
			};
		}),
	);
}
