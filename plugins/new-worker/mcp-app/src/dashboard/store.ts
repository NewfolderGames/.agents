import { create } from "zustand";
import { type DashboardPayload, type DashboardScope, type DashboardTab, DEFAULT_UI_SETTINGS, type HandoffRecord, type PlanRecord, type QuestionSetRecord, type ReportRecord, type SessionGroup, type SessionGroupSummary, type SessionRecord, type SessionSummary, type TaskRecord, type TimelineEvent, type ToolCallRecord, type UiSettings } from "@/shared/contracts.js";

export type DashboardDialogKind =
	| null
	| "settings"
	| "group_create"
	| "group_edit"
	| "session_edit"
	| "timeline_note"
	| "confirm_clear_calls"
	| "confirm_delete_group";

export interface DashboardStoreState {
	scope: DashboardScope;
	sessionId: string | null;
	groupId: string | null;
	rootDirFilter: string;
	activeTab: DashboardTab;
	activeItemId: string | undefined;
	revision: string | undefined;
	settings: UiSettings;
	session: SessionRecord | null;
	group: SessionGroup | null;
	sessions: SessionSummary[];
	groups: SessionGroupSummary[];
	tasks: TaskRecord[];
	plans: PlanRecord[];
	reports: ReportRecord[];
	handoffs: HandoffRecord[];
	questionSets: QuestionSetRecord[];
	timeline: TimelineEvent[];
	toolCalls: ToolCallRecord[];
	hasLoaded: boolean;
	isBusy: boolean;
	errorMessage: string | null;
	activeDialog: DashboardDialogKind;
	applyPayload: (payload: DashboardPayload) => void;
	applyBackgroundRefresh: (payload: DashboardPayload) => void;
	setActiveTab: (tab: DashboardTab) => void;
	setActiveItemId: (itemId: string | undefined) => void;
	setRootDirFilter: (rootDir: string) => void;
	setActiveDialog: (dialog: DashboardDialogKind) => void;
	setBusy: (busy: boolean) => void;
	setErrorMessage: (message: string | null) => void;
}

export const useDashboardStore = create<DashboardStoreState>(set => ({
	scope: "session",
	sessionId: null,
	groupId: null,
	rootDirFilter: "",
	activeTab: "tasks",
	activeItemId: undefined,
	revision: undefined,
	settings: DEFAULT_UI_SETTINGS,
	session: null,
	group: null,
	sessions: [],
	groups: [],
	tasks: [],
	plans: [],
	reports: [],
	handoffs: [],
	questionSets: [],
	timeline: [],
	toolCalls: [],
	hasLoaded: false,
	isBusy: false,
	errorMessage: null,
	activeDialog: null,
	applyPayload: payload =>
		set({
			scope: payload.scope,
			sessionId: payload.sessionId,
			groupId: payload.groupId,
			activeTab: payload.activeTab,
			activeItemId: payload.activeItemId,
			revision: payload.revision,
			settings: payload.settings,
			session: payload.session,
			group: payload.group,
			sessions: payload.sessions,
			groups: payload.groups,
			tasks: payload.tasks,
			plans: payload.plans,
			reports: payload.reports,
			handoffs: payload.handoffs,
			questionSets: payload.questionSets,
			timeline: payload.timeline,
			toolCalls: payload.toolCalls,
			hasLoaded: true,
			errorMessage: null,
		}),
	applyBackgroundRefresh: payload =>
		set(prev => ({
			scope: payload.scope,
			sessionId: payload.sessionId,
			groupId: payload.groupId,
			activeItemId: prev.activeItemId ?? payload.activeItemId,
			revision: payload.revision,
			settings: payload.settings,
			session: payload.session,
			group: payload.group,
			sessions: payload.sessions,
			groups: payload.groups,
			tasks: payload.tasks,
			plans: payload.plans,
			reports: payload.reports,
			handoffs: payload.handoffs,
			questionSets: payload.questionSets,
			timeline: payload.timeline,
			toolCalls: payload.toolCalls,
			hasLoaded: true,
			errorMessage: null,
		})),
	setActiveTab: activeTab => set({ activeTab }),
	setActiveItemId: activeItemId => set({ activeItemId }),
	setRootDirFilter: rootDirFilter => set({ rootDirFilter }),
	setActiveDialog: activeDialog => set({ activeDialog }),
	setBusy: isBusy => set({ isBusy }),
	setErrorMessage: errorMessage => set({ errorMessage }),
}));
