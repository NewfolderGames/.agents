import type { AppDrizzleDb } from "../db/client.js";
import type { DashboardPayload, DashboardScope, DashboardTab, TaskStepSnapshot, WidgetPayload, WidgetRoute } from "@/shared/contracts.js";
import { getPlanByTaskId, getReportByTaskId, listHandoffs, listPlans, listReports } from "./artifacts.js";
import { listQuestionSets } from "./questions.js";
import { getLatestSession, getSession, getSessionGroup, listSessionGroups, listSessions } from "./sessions.js";
import { computeRevision, getUiSettings, listToolCalls } from "./settings.js";
import { getCurrentTaskForSession, getTaskById, listTasks } from "./tasks.js";
import { queryTimelineEvents } from "./timeline.js";

export interface BuildDashboardOptions {
	scope?: DashboardScope;
	sessionId?: string;
	groupId?: string;
	rootDirFilter?: string;
	activeTab?: DashboardTab;
	activeItemId?: string;
}

export interface BuildWidgetOptions {
	widget: WidgetRoute;
	sessionId: string;
	taskId?: number;
	stepSnapshot?: TaskStepSnapshot;
	handoffId?: string;
	questionSetId?: string;
}

/**
 * Build a strictly read-only DashboardPayload supporting single-Session scope or
 * whole-Group merged scope.
 */
export function buildDashboardPayload(
	db: AppDrizzleDb,
	options: BuildDashboardOptions = {},
): DashboardPayload {
	const settings = getUiSettings(db);
	const groups = listSessionGroups(db);
	const sessions = listSessions(db, {
		rootDir: options.rootDirFilter?.trim() || undefined,
	});

	const activeSession
		= (options.sessionId ? getSession(db, options.sessionId) : null)
			?? (sessions[0] ? getSession(db, sessions[0].sessionId) : null)
			?? getLatestSession(db);

	const requestedGroupId
		= options.groupId
			?? activeSession?.groupId
			?? groups[0]?.id
			?? null;
	const activeGroup = requestedGroupId ? getSessionGroup(db, requestedGroupId) : null;

	const scope: DashboardScope
		= options.scope === "group" && activeGroup
			? "group"
			: "session";

	const filter = scope === "group" && activeGroup
		? { groupId: activeGroup.id }
		: activeSession
			? { sessionId: activeSession.sessionId }
			: undefined;

	const taskList = filter ? listTasks(db, filter) : [];
	const planList = filter ? listPlans(db, filter) : [];
	const reportList = filter ? listReports(db, filter) : [];
	const handoffList = filter ? listHandoffs(db, filter) : [];
	const questionSetList = filter ? listQuestionSets(db, filter) : [];
	const timeline = filter ? queryTimelineEvents(db, { ...filter, limit: 150 }) : [];
	const toolCallList = filter ? listToolCalls(db, { ...filter, limit: 200 }) : [];

	const revision = computeRevision({
		scope,
		sessionId: activeSession?.sessionId ?? null,
		groupId: activeGroup?.id ?? null,
		sessionUpdatedAt: activeSession?.updatedAt ?? null,
		groupUpdatedAt: activeGroup?.updatedAt ?? null,
		settingsUpdatedAt: settings.updatedAt ?? null,
		sessions: sessions.map(s => `${s.sessionId}:${s.updatedAt}:${s.groupId ?? ""}`),
		groups: groups.map(g => `${g.id}:${g.updatedAt}`),
		latestTimelineId: timeline[0]?.id ?? 0,
		latestToolCallId: toolCallList[0]?.id ?? "",
		taskCount: taskList.length,
	});

	return {
		kind: "dashboard",
		scope,
		sessionId: activeSession?.sessionId ?? null,
		groupId: activeGroup?.id ?? null,
		activeTab: options.activeTab ?? "tasks",
		activeItemId: options.activeItemId,
		revision,
		settings,
		session: activeSession,
		group: activeGroup,
		sessions,
		groups,
		tasks: taskList,
		plans: planList,
		reports: reportList,
		handoffs: handoffList,
		questionSets: questionSetList,
		timeline,
		toolCalls: toolCallList,
	};
}

/** Build an isolated WidgetPayload for a specific `/widget/<route>` inline UI view. */
export function buildWidgetPayload(
	db: AppDrizzleDb,
	options: BuildWidgetOptions,
): WidgetPayload {
	const session = getSession(db, options.sessionId);
	const settings = getUiSettings(db);
	const questionSetList = listQuestionSets(db, { sessionId: options.sessionId });

	const task
		= options.taskId !== undefined
			? (getTaskById(db, options.taskId) ?? undefined)
			: (getCurrentTaskForSession(db, options.sessionId) ?? undefined);

	const plan
		= options.widget === "plan" && options.taskId !== undefined
			? (getPlanByTaskId(db, options.taskId) ?? undefined)
			: undefined;

	const report
		= options.widget === "report" && options.taskId !== undefined
			? (getReportByTaskId(db, options.taskId) ?? undefined)
			: undefined;

	const handoff
		= options.widget === "handoff"
			? (listHandoffs(db, { sessionId: options.sessionId }).find(h => h.id === options.handoffId)
				?? listHandoffs(db, { sessionId: options.sessionId, limit: 1 })[0])
			: undefined;

	const questionSet
		= options.widget === "questions"
			? (questionSetList.find(q => q.id === options.questionSetId) ?? questionSetList[0])
			: undefined;

	return {
		kind: "widget",
		widget: options.widget,
		sessionId: options.sessionId,
		rootDir: session?.rootDir,
		exportDir: session?.exportDir,
		sessionTitle: session?.title,
		settings,
		task,
		stepSnapshot: options.stepSnapshot,
		plan,
		report,
		handoff,
		questionSet,
		questionSets: questionSetList,
	};
}
