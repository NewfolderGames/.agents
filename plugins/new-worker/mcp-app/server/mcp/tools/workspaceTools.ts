import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { DashboardScopeSchema, DashboardTabSchema, GroupIdSchema, SessionIdSchema, TaskIdSchema, TaskLifecycleStatusSchema, TimelineEntityTypeSchema } from "@/shared/contracts.js";
import { formatBlockingModeLabel, formatQuestionReply, formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { renderPlanMarkdown, renderReportMarkdown } from "@/shared/markdown.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { getPlanByTaskId, getReportByTaskId, listHandoffs, listPlans, listReports } from "../../repositories/artifacts.js";
import { ValidationError } from "../../repositories/errors.js";
import { getUnresolvedQuestions, listQuestionSets } from "../../repositories/questions.js";
import { assignSessionGroup, deleteSessionGroup, getLatestSession, getSession, getSessionGroup, listSessionGroups, listSessions, upsertSession, upsertSessionGroup } from "../../repositories/sessions.js";
import { recordToolCall } from "../../repositories/settings.js";
import { getCurrentTaskForSession, getTaskById, listTasks } from "../../repositories/tasks.js";
import { queryTimelineEvents, recordTimelineEvent } from "../../repositories/timeline.js";
import { buildDashboardPayload } from "../../repositories/workspace.js";
import { DASHBOARD_RESOURCE_URI } from "../resources.js";
import { runLoggedTool, runSafeTool, TimelineNoteLinkInputSchema } from "./shared.js";

type QueryWorkspaceTarget =
	| "session_context"
	| "groups"
	| "tasks"
	| "task_detail"
	| "plan"
	| "report"
	| "handoffs"
	| "questions";

interface QueryWorkspaceArgs {
	target: QueryWorkspaceTarget;
	sessionId?: string;
	groupId?: string;
	taskId?: number;
	rootDir?: string;
	status?: string;
	currentStepOnly?: boolean;
	unresolvedOnly?: boolean;
	includeMarkdown?: boolean;
	limit?: number;
}

function queryGroups(db: AppDrizzleDb, rootDir?: string) {
	const groups = listSessionGroups(db);
	const allSessions = listSessions(db, {
		rootDir: rootDir?.trim() || undefined,
	});
	const ungroupedCount = allSessions.filter(s => !s.groupId).length;
	return {
		content: [
			{
				type: "text" as const,
				text: `${groups.length} group(s), ${allSessions.length} session(s) (${ungroupedCount} ungrouped).`,
			},
		],
		structuredContent: {
			groups,
			totalSessions: allSessions.length,
			ungroupedSessionCount: ungroupedCount,
		},
	};
}

function resolveSessionForContext(db: AppDrizzleDb, args: QueryWorkspaceArgs) {
	if (args.sessionId) {
		return getSession(db, args.sessionId);
	}
	if (args.groupId) {
		return null;
	}
	if (!args.rootDir) {
		return getLatestSession(db);
	}
	const firstMatch = listSessions(db, { rootDir: args.rootDir })[0];
	return firstMatch ? getSession(db, firstMatch.sessionId) : null;
}

function querySessionContext(db: AppDrizzleDb, args: QueryWorkspaceArgs) {
	const session = resolveSessionForContext(db, args);
	const resolvedGroupId = args.groupId ?? session?.groupId ?? null;
	const group = resolvedGroupId ? getSessionGroup(db, resolvedGroupId) : null;

	if (!session && !group) {
		return {
			content: [{ type: "text" as const, text: "No matching session or group found." }],
			structuredContent: { session: null, group: null },
		};
	}

	const siblingSessions = resolvedGroupId ? listSessions(db, { groupId: resolvedGroupId }) : [];
	const activeTask = session ? getCurrentTaskForSession(db, session.sessionId) : null;
	const scopeFilter = resolvedGroupId && !session
		? { groupId: resolvedGroupId }
		: session
			? { sessionId: session.sessionId }
			: undefined;
	const questionSets = scopeFilter ? listQuestionSets(db, scopeFilter) : [];
	const unresolved = getUnresolvedQuestions(questionSets).map(u => ({
		questionSetId: u.questionSet.id,
		questionId: u.question.id,
		prompt: u.question.prompt,
		blockingMode: u.policy.blockingMode,
		taskId: u.policy.taskId,
		stepNumber: u.policy.stepNumber,
	}));

	const summaryParts: string[] = [];
	if (session) {
		summaryParts.push(
			`Session "${session.sessionId}"${session.title ? ` (${session.title})` : ""}, rootDir: ${session.rootDir ?? "unset"}`,
		);
	}
	if (group) {
		summaryParts.push(`Group "${group.name}" (${group.id}, ${siblingSessions.length} session(s))`);
	}
	if (activeTask) {
		summaryParts.push(`Active task: ${formatTaskId(activeTask.taskId)} "${activeTask.title}" (${activeTask.status})`);
	}
	if (unresolved.length > 0) {
		summaryParts.push(`${unresolved.length} unresolved question(s)`);
	}

	return {
		content: [{ type: "text" as const, text: summaryParts.join(" | ") }],
		structuredContent: {
			session,
			group,
			siblingSessions,
			activeTaskSummary: activeTask
				? {
						taskId: activeTask.taskId,
						title: activeTask.title,
						status: activeTask.status,
						stepCount: activeTask.steps.length,
					}
				: null,
			unresolvedQuestions: unresolved,
		},
	};
}

function queryTaskSummaries(db: AppDrizzleDb, args: QueryWorkspaceArgs, limit: number) {
	const parsedStatus = args.status ? TaskLifecycleStatusSchema.parse(args.status) : undefined;
	const rows = listTasks(db, {
		sessionId: args.sessionId,
		groupId: args.groupId,
		status: parsedStatus,
		limit,
	});
	const summaries = rows.map((t) => {
		const allItems = t.steps.flatMap(s => s.items);
		return {
			taskId: t.taskId,
			sessionId: t.sessionId,
			slug: t.slug,
			title: t.title,
			status: t.status,
			summary: t.summary,
			stepCount: t.steps.length,
			doneItems: allItems.filter(i => i.status === "done").length,
			totalItems: allItems.length,
			hasPlan: Boolean(t.planFile),
			hasReport: Boolean(t.reportFile),
			updatedAt: t.updatedAt,
		};
	});
	return {
		content: [
			{
				type: "text" as const,
				text: summaries.length === 0
					? "No matching tasks found."
					: summaries.map(s => `${formatTaskId(s.taskId)} [${s.status}] ${s.title} (${s.doneItems}/${s.totalItems} items)`).join("\n"),
			},
		],
		structuredContent: { tasks: summaries },
	};
}

function queryTaskDetail(db: AppDrizzleDb, args: QueryWorkspaceArgs) {
	const task = args.taskId !== undefined
		? getTaskById(db, args.taskId)
		: args.sessionId
			? getCurrentTaskForSession(db, args.sessionId)
			: (() => {
					const latest = getLatestSession(db);
					return latest ? getCurrentTaskForSession(db, latest.sessionId) : null;
				})();

	if (!task) {
		return {
			content: [{ type: "text" as const, text: "No matching task found." }],
			structuredContent: { task: null },
		};
	}

	const activeIdx = task.steps.findIndex(s => s.items.some(i => i.status !== "done"));
	const resolvedIdx = activeIdx === -1 ? Math.max(0, task.steps.length - 1) : activeIdx;
	const activeStep = task.steps[resolvedIdx];
	const stepsToReturn = args.currentStepOnly && activeStep ? [activeStep] : task.steps;
	const taskQuestions = listQuestionSets(db, { sessionId: task.sessionId, taskId: task.taskId });

	return {
		content: [
			{
				type: "text" as const,
				text: `Task ${formatTaskId(task.taskId)} "${task.title}" (${task.status}, ${task.steps.length} steps, active step ${resolvedIdx + 1}).`,
			},
		],
		structuredContent: {
			task: { ...task, steps: stepsToReturn },
			activeStepIndex: resolvedIdx,
			totalSteps: task.steps.length,
			questionSets: taskQuestions,
		},
	};
}

function queryPlans(db: AppDrizzleDb, args: QueryWorkspaceArgs, limit: number) {
	if (args.taskId !== undefined) {
		const plan = getPlanByTaskId(db, args.taskId);
		if (!plan) {
			return {
				content: [{
					type: "text" as const,
					text: `No plan found for Task ${formatTaskId(args.taskId)}.`,
				}],
				structuredContent: { plan: null },
			};
		}
		const planMarkdown = args.includeMarkdown ? renderPlanMarkdown(plan) : undefined;
		return {
			content: [
				{
					type: "text" as const,
					text: `Plan ${formatTaskId(plan.taskId)} "${plan.title}" (${formatTaskFilename(plan.taskId, plan.slug, "plan")}, reviewStatus: ${plan.reviewStatus ?? "pending_review"}).`,
				},
			],
			structuredContent: planMarkdown ? { plan, planMarkdown } : { plan },
		};
	}

	const summaries = listPlans(db, {
		sessionId: args.sessionId,
		groupId: args.groupId,
		limit,
	}).map(p => ({
		taskId: p.taskId,
		sessionId: p.sessionId,
		slug: p.slug,
		title: p.title,
		reviewStatus: p.reviewStatus ?? "pending_review",
		fileName: formatTaskFilename(p.taskId, p.slug, "plan"),
		createdAt: p.createdAt,
	}));
	return {
		content: [
			{
				type: "text" as const,
				text: summaries.length === 0
					? "No plans found."
					: summaries.map(p => `${formatTaskId(p.taskId)} ${p.title} (${p.fileName})`).join("\n"),
			},
		],
		structuredContent: { plans: summaries },
	};
}

function queryReports(db: AppDrizzleDb, args: QueryWorkspaceArgs, limit: number) {
	if (args.taskId !== undefined) {
		const report = getReportByTaskId(db, args.taskId);
		if (!report) {
			return {
				content: [{
					type: "text" as const,
					text: `No report found for Task ${formatTaskId(args.taskId)}.`,
				}],
				structuredContent: { report: null },
			};
		}
		const reportMarkdown = args.includeMarkdown ? renderReportMarkdown(report) : undefined;
		return {
			content: [
				{
					type: "text" as const,
					text: `Report ${formatTaskId(report.taskId)} "${report.title}" (${report.mode}, outcome: ${report.outcome}).`,
				},
			],
			structuredContent: reportMarkdown ? { report, reportMarkdown } : { report },
		};
	}

	const summaries = listReports(db, {
		sessionId: args.sessionId,
		groupId: args.groupId,
		limit,
	}).map(r => ({
		taskId: r.taskId,
		sessionId: r.sessionId,
		slug: r.slug,
		title: r.title,
		mode: r.mode,
		outcome: r.outcome,
		fileName: formatTaskFilename(r.taskId, r.slug, "report"),
		createdAt: r.createdAt,
	}));
	return {
		content: [
			{
				type: "text" as const,
				text: summaries.length === 0
					? "No reports found."
					: summaries.map(r => `${formatTaskId(r.taskId)} [${r.mode}] ${r.title} (${r.outcome})`).join("\n"),
			},
		],
		structuredContent: { reports: summaries },
	};
}

function queryHandoffs(db: AppDrizzleDb, args: QueryWorkspaceArgs, limit: number) {
	const handoffs = listHandoffs(db, {
		sessionId: args.sessionId,
		groupId: args.groupId,
		taskId: args.taskId,
		limit,
	});
	return {
		content: [
			{
				type: "text" as const,
				text: handoffs.length === 0
					? "No handoffs found."
					: handoffs.map(h => `[${h.kind}] ${h.title}: ${h.summary}`).join("\n"),
			},
		],
		structuredContent: { handoffs },
	};
}

function queryQuestions(db: AppDrizzleDb, args: QueryWorkspaceArgs, limit: number) {
	const statusFilter = args.status
		? z.enum(["pending", "partial", "submitted"]).parse(args.status)
		: undefined;
	const questionSets = listQuestionSets(db, {
		sessionId: args.sessionId,
		groupId: args.groupId,
		taskId: args.taskId,
		status: statusFilter,
	}).slice(0, limit);

	const unresolved = getUnresolvedQuestions(questionSets).map(u => ({
		questionSetId: u.questionSet.id,
		questionId: u.question.id,
		prompt: u.question.prompt,
		label: formatBlockingModeLabel(
			u.policy.blockingMode,
			u.policy.taskId,
			u.policy.stepNumber,
		),
	}));

	if (args.unresolvedOnly) {
		return {
			content: [
				{
					type: "text" as const,
					text: unresolved.length === 0
						? "No unresolved questions."
						: unresolved.map(u => `${u.questionId} [${u.label}]: ${u.prompt}`).join("\n"),
				},
			],
			structuredContent: { unresolved },
		};
	}

	const lines: string[] = [
		`${questionSets.length} question set(s), ${unresolved.length} unresolved question(s).`,
	];
	for (const qs of questionSets.filter(s => s.status !== "pending").slice(0, 3)) {
		const answeredIds = qs.status === "partial" ? qs.answeredQuestionIds : undefined;
		lines.push("", formatQuestionReply(qs, qs.answers, qs.otherTexts, answeredIds));
	}

	return {
		content: [{ type: "text" as const, text: lines.join("\n") }],
		structuredContent: { questionSets, unresolved },
	};
}

/**
 * Register the workspace dashboard entrypoint (`open_workspace`), context mutator
 * (`manage_context`), and read-only query tools (`query_workspace`, `query_timeline`).
 *
 * @param server - Target MCP server instance.
 * @param db - Active Drizzle SQLite database connection.
 */
export function registerWorkspaceTools(server: McpServer, db: AppDrizzleDb): void {
	// open_workspace — strictly read-only dashboard entrypoint ({} safe)
	registerAppTool(
		server,
		"open_workspace",
		{
			title: "New Worker Workspace",
			description:
				"Open the New Worker Dashboard in the side pane or global sidebar. Strictly read-only: accepts empty `{}` and never creates sessions or writes database rows. Supports switching between single-session and multi-session group views.",
			inputSchema: z.object({
				scope: DashboardScopeSchema.optional().describe("View scope: 'session' (default) or 'group'."),
				sessionId: SessionIdSchema.optional().describe("Target session ID; defaults to the most recently updated session."),
				groupId: GroupIdSchema.optional().describe("Target group ID when viewing group scope."),
				activeTab: DashboardTabSchema.optional().describe("Initial dashboard tab: tasks, plans, reports, handoffs, questions, timeline, or calls."),
				activeItemId: z.string().min(1).optional().describe("Optional task ID, handoff ID, or question set ID to focus."),
			}),
			_meta: {
				"ui": {
					resourceUri: DASHBOARD_RESOURCE_URI,
				},
				"com.google.antigravity/ui": {
					entrypoints: [
						{ type: "aux_pane", title: "New Worker" },
						{ type: "global", title: "New Worker" },
					],
				},
			},
		},
		async (args) => {
			const payload = buildDashboardPayload(db, {
				scope: args.scope,
				sessionId: args.sessionId,
				groupId: args.groupId,
				activeTab: args.activeTab,
				activeItemId: args.activeItemId,
			});

			if (!payload.session && !payload.group) {
				return {
					content: [{ type: "text", text: "No sessions or groups recorded yet." }],
					structuredContent: payload,
				};
			}

			const openQuestions = payload.questionSets.filter(q => q.status !== "submitted").length;
			const targetLabel
				= payload.scope === "group" && payload.group
					? `Group "${payload.group.name}"`
					: `Session "${payload.session?.sessionId ?? "none"}"`;
			return {
				content: [
					{
						type: "text",
						text: `${targetLabel} ready (${payload.tasks.length} tasks, ${payload.plans.length} plans, ${payload.reports.length} reports, ${openQuestions} open question sets, ${payload.timeline.length} timeline events).`,
					},
				],
				structuredContent: payload,
			};
		},
	);

	// manage_context — data-only tool for sessions, 1:N groups, and timeline notes
	server.registerTool(
		"manage_context",
		{
			title: "Manage Session, Group & Timeline Context",
			description: [
				"Create or update session metadata, 1:N session groups, group membership, or manual timeline notes (data-only, no widget).",
				"Actions:",
				"- 'upsert_session': requires sessionId; updates optional title, rootDir (absolute path), exportDir, and groupId (or null).",
				"- 'upsert_group': requires name; creates or updates a group (optional groupId, description, notes).",
				"- 'delete_group': requires groupId; removes group while keeping member sessions intact (groupId = null).",
				"- 'assign_group': requires sessionId and groupId (string to assign, null to detach).",
				"- 'add_timeline_note': requires title; appends a timeline note with optional sessionId, groupId, summary, and polymorphic links[].",
			].join("\n"),
			inputSchema: z.object({
				action: z.enum([
					"upsert_session",
					"upsert_group",
					"delete_group",
					"assign_group",
					"add_timeline_note",
				]),
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.nullable().optional(),
				title: z.string().optional().describe("Session title (upsert_session) or timeline note title (add_timeline_note)."),
				rootDir: z.string().optional().describe("Absolute root directory path associated with a session."),
				exportDir: z.string().optional().describe("Optional absolute directory path for Markdown artifact export."),
				name: z.string().optional().describe("Group display name (required for upsert_group)."),
				description: z.string().optional().describe("Group description (for upsert_group)."),
				notes: z.string().optional().describe("Shared context notes stored on a group (for upsert_group)."),
				summary: z.string().optional().describe("Timeline note body/summary (for add_timeline_note)."),
				links: z
					.array(TimelineNoteLinkInputSchema)
					.optional()
					.describe("Polymorphic entity associations for add_timeline_note."),
			}),
		},
		args => runLoggedTool(db, { sessionId: args.sessionId, toolName: "manage_context" }, () => {
			switch (args.action) {
				case "upsert_session": {
					if (!args.sessionId) {
						throw new ValidationError("upsert_session requires sessionId.");
					}
					const session = upsertSession(db, args.sessionId, {
						title: args.title,
						rootDir: args.rootDir,
						exportDir: args.exportDir,
						groupId: args.groupId,
					});
					recordToolCall(
						db,
						session.sessionId,
						"manage_context",
						"ok",
						`Updated session "${session.title ?? session.sessionId}"`,
						"action=upsert_session",
					);
					return {
						content: [
							{
								type: "text",
								text: `Session "${session.sessionId}" saved (title: ${session.title ?? "-"}, rootDir: ${session.rootDir ?? "-"}, groupId: ${session.groupId ?? "none"}).`,
							},
						],
						structuredContent: { action: args.action, session },
					};
				}

				case "upsert_group": {
					if (!args.name?.trim()) {
						throw new ValidationError("upsert_group requires a non-empty name.");
					}
					const group = upsertSessionGroup(db, {
						id: args.groupId ?? undefined,
						name: args.name,
						description: args.description,
						notes: args.notes,
					});
					if (args.sessionId) {
						recordToolCall(
							db,
							args.sessionId,
							"manage_context",
							"ok",
							`Saved group "${group.name}" (${group.id})`,
							"action=upsert_group",
						);
					}
					return {
						content: [
							{
								type: "text",
								text: `Saved session group "${group.name}" (groupId: ${group.id}).`,
							},
						],
						structuredContent: { action: args.action, group },
					};
				}

				case "delete_group": {
					if (!args.groupId) {
						throw new ValidationError("delete_group requires groupId.");
					}
					deleteSessionGroup(db, args.groupId);
					if (args.sessionId) {
						recordToolCall(
							db,
							args.sessionId,
							"manage_context",
							"ok",
							`Deleted group ${args.groupId}`,
							"action=delete_group",
						);
					}
					return {
						content: [{
							type: "text",
							text: `Deleted session group "${args.groupId}".`,
						}],
						structuredContent: { action: args.action, deletedGroupId: args.groupId },
					};
				}

				case "assign_group": {
					if (!args.sessionId || args.groupId === undefined) {
						throw new ValidationError("assign_group requires sessionId and groupId (string or null).");
					}
					const session = assignSessionGroup(db, args.sessionId, args.groupId);
					recordToolCall(
						db,
						session.sessionId,
						"manage_context",
						"ok",
						session.groupId
							? `Assigned session to group ${session.groupId}`
							: "Detached session from group",
						"action=assign_group",
					);
					return {
						content: [
							{
								type: "text",
								text: session.groupId
									? `Assigned session "${session.sessionId}" to group "${session.groupId}".`
									: `Detached session "${session.sessionId}" from its group.`,
							},
						],
						structuredContent: { action: args.action, session },
					};
				}

				case "add_timeline_note": {
					if (!args.title?.trim()) {
						throw new ValidationError("add_timeline_note requires title.");
					}
					const event = recordTimelineEvent(db, {
						sessionId: args.sessionId ?? null,
						groupId: args.groupId ?? null,
						eventType: "note",
						actor: "agent",
						title: args.title.trim(),
						summary: args.summary?.trim() || undefined,
						links: args.links ?? [],
					});
					if (args.sessionId) {
						recordToolCall(
							db,
							args.sessionId,
							"manage_context",
							"ok",
							`Timeline note: ${event.title}`,
							"action=add_timeline_note",
						);
					}
					return {
						content: [
							{
								type: "text",
								text: `Recorded timeline note #${event.id}: "${event.title}" (${event.links.length} link(s)).`,
							},
						],
						structuredContent: { action: args.action, event },
					};
				}
			}
		}),
	);

	// query_workspace — consolidated strictly read-only agent query tool
	server.registerTool(
		"query_workspace",
		{
			title: "Query Workspace State",
			description: [
				"Strictly read-only query tool for agents to fetch focused slices of session, group, task, plan, report, handoff, or question state without loading full session blobs.",
				"Targets:",
				"- 'session_context': session metadata (title, rootDir, groupId), group metadata + sibling sessions, active task summary, and unresolved blockers.",
				"- 'groups': list all 1:N session groups with session/task/open-question counts.",
				"- 'tasks': list lightweight task summaries filtered by sessionId, groupId, status, or limit.",
				"- 'task_detail': fetch one task by global taskId (or active/latest task for sessionId) with steps & items (set currentStepOnly: true to fetch only the active step).",
				"- 'plan': fetch a PlanRecord by taskId (with planMarkdown when includeMarkdown: true) or list plan summaries for sessionId/groupId.",
				"- 'report': fetch a ReportRecord by taskId (with reportMarkdown when includeMarkdown: true) or list report summaries for sessionId/groupId.",
				"- 'handoffs': list handoffs filtered by sessionId, groupId, or taskId.",
				"- 'questions': list question sets & answers filtered by sessionId, groupId, taskId, status, or unresolvedOnly.",
			].join("\n"),
			inputSchema: z.object({
				target: z.enum([
					"session_context",
					"groups",
					"tasks",
					"task_detail",
					"plan",
					"report",
					"handoffs",
					"questions",
				]),
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.optional(),
				taskId: TaskIdSchema.optional(),
				rootDir: z.string().optional().describe("Filter sessions by exact rootDir when target is 'session_context'."),
				status: z.string().optional().describe("Optional task status or question set status filter."),
				currentStepOnly: z.boolean().optional().describe("For target='task_detail', return only the currently active step."),
				unresolvedOnly: z.boolean().optional().describe("For target='questions', return only unresolved questions."),
				includeMarkdown: z.boolean().optional().describe("For target='plan'|'report' with taskId, include rendered Markdown text."),
				limit: z.number().int().positive().max(200).optional(),
			}),
		},
		args => runSafeTool(() => {
			const limit = args.limit ?? 50;
			switch (args.target) {
				case "groups":
					return queryGroups(db, args.rootDir);
				case "session_context":
					return querySessionContext(db, args);
				case "tasks":
					return queryTaskSummaries(db, args, limit);
				case "task_detail":
					return queryTaskDetail(db, args);
				case "plan":
					return queryPlans(db, args, limit);
				case "report":
					return queryReports(db, args, limit);
				case "handoffs":
					return queryHandoffs(db, args, limit);
				case "questions":
					return queryQuestions(db, args, limit);
			}
		}),
	);

	// query_timeline — strictly read-only polymorphic timeline query
	server.registerTool(
		"query_timeline",
		{
			title: "Query Polymorphic Timeline",
			description:
				"Strictly read-only query over timeline_events and polymorphic timeline_links. Filter by sessionId, groupId, exact (entityType + entityId), entityTypes[], or eventTypes[], with beforeId cursor pagination.",
			inputSchema: z.object({
				sessionId: SessionIdSchema.optional(),
				groupId: GroupIdSchema.optional(),
				entityType: TimelineEntityTypeSchema.optional(),
				entityId: z.string().min(1).optional(),
				entityTypes: z.array(TimelineEntityTypeSchema).optional(),
				eventTypes: z.array(z.string().min(1)).optional(),
				limit: z.number().int().positive().max(200).optional(),
				beforeId: z.number().int().positive().optional(),
			}),
		},
		args => runSafeTool(() => {
			const limit = args.limit ?? 50;
			const events = queryTimelineEvents(db, {
				sessionId: args.sessionId,
				groupId: args.groupId,
				entityType: args.entityType,
				entityId: args.entityId,
				entityTypes: args.entityTypes,
				eventTypes: args.eventTypes,
				limit,
				beforeId: args.beforeId,
			});
			const nextCursor = events.length === limit ? events[events.length - 1]?.id : undefined;
			return {
				content: [
					{
						type: "text",
						text: events.length === 0
							? "No timeline events matched."
							: events.map(e => `#${e.id} [${e.eventType}] ${e.title}`).join("\n"),
					},
				],
				structuredContent: { events, nextCursor },
			};
		}),
	);
}
