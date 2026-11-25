import { create } from "zustand";
import { type AppToolPayload, type AppViewMode, DEFAULT_UI_SETTINGS, type SessionData, type SessionSummary, type TaskStepSnapshot, type UiSettings, type WorkspaceTab } from "./schema.js";

export interface WorkspaceStoreState {
	mode: AppViewMode;
	activeTab: WorkspaceTab;
	activeItemId: string | undefined;
	activeStepIndex: number | undefined;
	activeTaskItemId: string | undefined;
	stepSnapshot: TaskStepSnapshot | undefined;
	revision: string | undefined;
	settings: UiSettings;
	settingsOpen: boolean;
	session: SessionData | null;
	sessions: SessionSummary[];
	hasLoaded: boolean;
	isBusy: boolean;
	errorMessage: string | null;
	applyPayload: (payload: AppToolPayload) => void;
	applyBackgroundRefresh: (payload: AppToolPayload) => void;
	setActiveTab: (tab: WorkspaceTab) => void;
	setActiveItemId: (itemId: string | undefined) => void;
	setSettings: (settings: UiSettings) => void;
	setSettingsOpen: (open: boolean) => void;
	setBusy: (busy: boolean) => void;
	setErrorMessage: (message: string | null) => void;
}

export const useWorkspaceStore = create<WorkspaceStoreState>(set => ({
	mode: "dashboard",
	activeTab: "tasks",
	activeItemId: undefined,
	activeStepIndex: undefined,
	activeTaskItemId: undefined,
	stepSnapshot: undefined,
	revision: undefined,
	settings: DEFAULT_UI_SETTINGS,
	settingsOpen: false,
	session: null,
	sessions: [],
	hasLoaded: false,
	isBusy: false,
	errorMessage: null,
	applyPayload: payload =>
		set(prev => ({
			mode: payload.mode,
			activeTab: payload.activeTab,
			activeItemId: payload.activeItemId,
			activeStepIndex: payload.activeStepIndex,
			activeTaskItemId: payload.activeTaskItemId,
			stepSnapshot: payload.stepSnapshot,
			revision: payload.revision ?? prev.revision,
			settings: payload.settings ?? prev.settings,
			session: payload.session,
			sessions: payload.sessions ?? prev.sessions,
			hasLoaded: true,
			errorMessage: null,
		})),
	applyBackgroundRefresh: payload =>
		set(prev => ({
			activeItemId: prev.activeItemId ?? payload.activeItemId,
			revision: payload.revision ?? prev.revision,
			settings: payload.settings ?? prev.settings,
			session: payload.session,
			sessions: payload.sessions ?? prev.sessions,
			hasLoaded: true,
			errorMessage: null,
		})),
	setActiveTab: activeTab => set({ activeTab }),
	setActiveItemId: activeItemId => set({ activeItemId }),
	setSettings: settings => set({ settings }),
	setSettingsOpen: settingsOpen => set({ settingsOpen }),
	setBusy: isBusy => set({ isBusy }),
	setErrorMessage: errorMessage => set({ errorMessage }),
}));
