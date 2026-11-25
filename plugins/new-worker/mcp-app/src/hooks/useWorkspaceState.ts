import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import type { QuestionAnswerValue, StepDisplayOverride, WidgetDisplayMode, WorkspaceTab } from "@/shared/schema.js";
import { useWorkspaceStore } from "@/shared/workspaceStore.js";
import type { McpBridgeState } from "./useMcpBridge.js";

const DASHBOARD_POLL_INTERVAL_MS = 2500;
const INITIAL_FALLBACK_DELAY_MS = 1500;

export interface SubmitQuestionClientOptions {
	scope?: "all" | "immediate" | "before_step_finish" | "answered";
	questionIds?: string[];
}

export function useWorkspaceState(bridge: McpBridgeState) {
	const store = useWorkspaceStore(
		useShallow(state => ({
			mode: state.mode,
			activeTab: state.activeTab,
			activeItemId: state.activeItemId,
			activeStepIndex: state.activeStepIndex,
			activeTaskItemId: state.activeTaskItemId,
			stepSnapshot: state.stepSnapshot,
			revision: state.revision,
			settings: state.settings,
			settingsOpen: state.settingsOpen,
			session: state.session,
			sessions: state.sessions,
			hasLoaded: state.hasLoaded,
			isBusy: state.isBusy,
			errorMessage: state.errorMessage,
			setActiveTab: state.setActiveTab,
			setActiveItemId: state.setActiveItemId,
			setSettings: state.setSettings,
			setSettingsOpen: state.setSettingsOpen,
			setBusy: state.setBusy,
			setErrorMessage: state.setErrorMessage,
		})),
	);

	const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pollInFlightRef = useRef(false);
	const questionSyncedKeyRef = useRef<string | undefined>(undefined);

	const refreshState = useCallback(
		async (sessionId?: string, nextTab?: WorkspaceTab) => {
			if (!bridge.isConnected || !bridge.capabilities.canCallServerTools) {
				return;
			}
			store.setBusy(true);
			const res = await bridge.callAppTool("app_get_state", {
				sessionId,
				mode: store.mode,
				activeTab: nextTab ?? store.activeTab,
				activeItemId: store.activeItemId,
				activeStepIndex: store.activeStepIndex,
				activeTaskItemId: store.activeTaskItemId,
			});
			store.setBusy(false);
			if (!res.ok && res.error) {
				store.setErrorMessage(res.error);
			}
		},
		[bridge, store],
	);

	// Fallback initial fetch only if the host does not deliver ontoolresult within 1.5s.
	useEffect(() => {
		if (
			!bridge.isConnected
			|| !bridge.capabilities.canCallServerTools
			|| store.hasLoaded
			|| bridge.isToolStreaming
		) {
			return;
		}
		const timer = setTimeout(() => {
			const cur = useWorkspaceStore.getState();
			if (!cur.hasLoaded) {
				void bridge.callAppTool("app_get_state", {
					sessionId: cur.session?.sessionId,
					mode: cur.mode,
					activeTab: cur.activeTab,
					activeItemId: cur.activeItemId,
					activeStepIndex: cur.activeStepIndex,
					activeTaskItemId: cur.activeTaskItemId,
				});
			}
		}, INITIAL_FALLBACK_DELAY_MS);
		return () => clearTimeout(timer);
	}, [
		bridge,
		bridge.isConnected,
		bridge.capabilities.canCallServerTools,
		bridge.isToolStreaming,
		store.hasLoaded,
	]);

	// One-time background sync for reloaded inline question cards to show submitted/partial state.
	useEffect(() => {
		if (
			!store.hasLoaded
			|| store.mode !== "questions"
			|| !store.session?.sessionId
			|| !bridge.isConnected
			|| !bridge.capabilities.canCallServerTools
		) {
			return;
		}
		const syncKey = `${store.session.sessionId}:${store.activeItemId ?? ""}`;
		if (questionSyncedKeyRef.current === syncKey) {
			return;
		}
		questionSyncedKeyRef.current = syncKey;
		void bridge.callAppTool(
			"app_get_state",
			{
				sessionId: store.session.sessionId,
				mode: "questions",
				activeTab: "questions",
				activeItemId: store.activeItemId,
			},
			{ background: true },
		);
	}, [
		bridge,
		bridge.isConnected,
		bridge.capabilities.canCallServerTools,
		store.hasLoaded,
		store.mode,
		store.session?.sessionId,
		store.activeItemId,
	]);

	// Auto-refresh side panel and global dashboard views when session data or settings change.
	useEffect(() => {
		if (
			!store.hasLoaded
			|| store.mode !== "dashboard"
			|| !bridge.isConnected
			|| !bridge.capabilities.canCallServerTools
		) {
			return;
		}

		const pollForUpdates = async () => {
			if (document.hidden || pollInFlightRef.current) {
				return;
			}
			pollInFlightRef.current = true;
			try {
				const cur = useWorkspaceStore.getState();
				await bridge.callAppTool(
					"app_get_state",
					{
						sessionId: cur.session?.sessionId,
						mode: "dashboard",
						activeTab: cur.activeTab,
						activeItemId: cur.activeItemId,
						sinceRevision: cur.revision,
					},
					{ background: true },
				);
			}
			finally {
				pollInFlightRef.current = false;
			}
		};

		const intervalId = setInterval(() => {
			void pollForUpdates();
		}, DASHBOARD_POLL_INTERVAL_MS);

		const handleVisibilityChange = () => {
			if (!document.hidden) {
				void pollForUpdates();
			}
		};
		const handleFocus = () => {
			void pollForUpdates();
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("focus", handleFocus);

		return () => {
			clearInterval(intervalId);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("focus", handleFocus);
		};
	}, [
		bridge,
		bridge.isConnected,
		bridge.capabilities.canCallServerTools,
		store.hasLoaded,
		store.mode,
	]);

	useEffect(() => {
		return () => {
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
		};
	}, []);

	const updateSettings = useCallback(
		async (patch: {
			displayType?: WidgetDisplayMode;
			stepDisplayType?: StepDisplayOverride;
		}) => {
			const nextLocal = {
				...store.settings,
				...patch,
			};
			store.setSettings(nextLocal);
			if (!bridge.isConnected || !bridge.capabilities.canCallServerTools) {
				return;
			}
			store.setBusy(true);
			const res = await bridge.callAppTool("app_update_settings", {
				sessionId: store.session?.sessionId,
				mode: store.mode,
				activeTab: store.activeTab,
				activeItemId: store.activeItemId,
				...patch,
			});
			store.setBusy(false);
			if (!res.ok && res.error) {
				store.setErrorMessage(res.error);
			}
		},
		[bridge, store],
	);

	const clearToolCalls = useCallback(async () => {
		const sessionId = store.session?.sessionId;
		if (!sessionId || !bridge.isConnected || !bridge.capabilities.canCallServerTools) {
			return;
		}
		store.setBusy(true);
		const res = await bridge.callAppTool("app_clear_tool_calls", {
			sessionId,
		});
		store.setBusy(false);
		if (!res.ok && res.error) {
			store.setErrorMessage(res.error);
		}
	}, [bridge, store]);

	const saveQuestionDraft = useCallback(
		(
			questionSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
		) => {
			const sessionId = store.session?.sessionId;
			if (!sessionId || !bridge.capabilities.canCallServerTools) {
				return;
			}
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			draftTimerRef.current = setTimeout(() => {
				void bridge.callAppTool("app_save_question_draft", {
					sessionId,
					questionSetId,
					answers,
					otherTexts,
				});
			}, 300);
		},
		[bridge, store.session?.sessionId],
	);

	const submitQuestionAnswers = useCallback(
		async (
			questionSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
			options?: SubmitQuestionClientOptions,
		) => {
			const sessionId = store.session?.sessionId;
			if (!sessionId) {
				return { ok: false, sentToChat: false };
			}
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			store.setBusy(true);
			const res = await bridge.callAppTool("app_submit_question_answers", {
				sessionId,
				questionSetId,
				answers,
				otherTexts,
				scope: options?.scope,
				questionIds: options?.questionIds,
			});
			store.setBusy(false);
			if (!res.ok) {
				if (res.error) {
					store.setErrorMessage(res.error);
				}
				return { ok: false, sentToChat: false, error: res.error };
			}
			let sentToChat = false;
			if (res.text && bridge.capabilities.canSendMessage) {
				sentToChat = await bridge.sendMessage(res.text);
			}
			return { ok: true, sentToChat, replyText: res.text };
		},
		[bridge, store],
	);

	return {
		...store,
		refreshState,
		updateSettings,
		clearToolCalls,
		saveQuestionDraft,
		submitQuestionAnswers,
	};
}
