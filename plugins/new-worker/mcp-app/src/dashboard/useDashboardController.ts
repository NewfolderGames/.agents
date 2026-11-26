import { useCallback, useEffect, useRef } from "react";
import { z } from "zod";
import { DashboardPayloadSchema, type DashboardScope, type DashboardTab, type QuestionAnswerValue, type StepDisplayOverride, type TimelineLink, type WidgetDisplayMode } from "@/shared/contracts.js";
import { type CallServerToolResult, type McpAppBridge, useMcpApp } from "@/ui/hooks/useMcpApp.js";
import { useDashboardStore } from "./store.js";

const DASHBOARD_POLL_MS = 2500;
const INITIAL_FALLBACK_MS = 1200;

const UnchangedSchema = z.looseObject({
	unchanged: z.literal(true),
	revision: z.string().optional(),
});

/** Overrides passed to {@link useDashboardController}'s `fetchDashboard` helper. */
export interface FetchDashboardOverrides {
	scope?: DashboardScope;
	sessionId?: string | null;
	groupId?: string | null;
	rootDirFilter?: string;
	activeTab?: DashboardTab;
	activeItemId?: string;
	background?: boolean;
	sinceRevision?: string;
}

/** Command handlers and MCP bridge exposed to `DashboardApp`. */
export interface DashboardController {
	bridge: McpAppBridge;
	fetchDashboard: (overrides?: FetchDashboardOverrides) => Promise<void>;
	invokeWorkspaceAction: (args: Record<string, unknown>) => Promise<void>;
	handleUpdateSettings: (patch: {
		displayType?: WidgetDisplayMode;
		stepDisplayType?: StepDisplayOverride;
	}) => Promise<void>;
	handleClearToolCalls: () => Promise<void>;
	handleSaveDraft: (
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => void;
	handleSubmitQuestions: (
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => Promise<{ ok: boolean; sentToChat: boolean }>;
	handleNavigateLink: (link: TimelineLink) => void;
}

/**
 * Connect {@link useDashboardStore} to the SEP-1865 host bridge, managing initial
 * state hydration, background revision polling, debounced question drafts, and
 * dashboard mutations.
 *
 * @param hasLoaded - Whether an initial payload has arrived yet.
 * @returns Action callbacks and host bridge state for `DashboardApp`.
 */
export function useDashboardController(hasLoaded: boolean): DashboardController {
	const pollInFlightRef = useRef(false);
	const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const handleStructured = useCallback((raw: unknown, background = false) => {
		const unchanged = UnchangedSchema.safeParse(raw);
		if (unchanged.success) {
			return;
		}
		const parsed = DashboardPayloadSchema.safeParse(raw);
		if (!parsed.success) {
			return;
		}
		const store = useDashboardStore.getState();
		if (background) {
			store.applyBackgroundRefresh(parsed.data);
		}
		else {
			store.applyPayload(parsed.data);
		}
	}, []);

	const onToolError = useCallback((msg: string) => {
		useDashboardStore.getState().setErrorMessage(msg);
	}, []);

	const bridge = useMcpApp({
		appName: "new-worker-dashboard",
		onToolResult: raw => handleStructured(raw, false),
		onToolError,
	});

	const runDashboardTool = useCallback(
		async (
			toolName: string,
			args: Record<string, unknown>,
			fallbackError: string,
		): Promise<CallServerToolResult | null> => {
			if (!bridge.isConnected || !bridge.capabilities.canCallServerTools) {
				return null;
			}
			const store = useDashboardStore.getState();
			store.setBusy(true);
			const res = await bridge.callTool(toolName, args);
			useDashboardStore.getState().setBusy(false);

			if (!res.ok) {
				useDashboardStore.getState().setErrorMessage(res.error ?? fallbackError);
				return res;
			}
			if (res.structuredContent !== undefined) {
				handleStructured(res.structuredContent, false);
			}
			return res;
		},
		[bridge, handleStructured],
	);

	const fetchDashboard = useCallback(
		async (overrides?: FetchDashboardOverrides) => {
			if (!bridge.isConnected || !bridge.capabilities.canCallServerTools) {
				return;
			}
			const cur = useDashboardStore.getState();
			if (!overrides?.background) {
				cur.setBusy(true);
			}
			const res = await bridge.callTool("app_get_dashboard_state", {
				scope: overrides?.scope ?? cur.scope,
				sessionId: (overrides?.sessionId === null ? undefined : overrides?.sessionId) ?? cur.sessionId ?? undefined,
				groupId: (overrides?.groupId === null ? undefined : overrides?.groupId) ?? cur.groupId ?? undefined,
				rootDirFilter: (overrides?.rootDirFilter ?? cur.rootDirFilter) || undefined,
				activeTab: overrides?.activeTab ?? cur.activeTab,
				activeItemId: overrides?.activeItemId ?? cur.activeItemId,
				sinceRevision: overrides?.sinceRevision,
			});
			if (!overrides?.background) {
				useDashboardStore.getState().setBusy(false);
			}
			if (!res.ok) {
				if (res.error) {
					useDashboardStore.getState().setErrorMessage(res.error);
				}
				return;
			}
			if (res.structuredContent !== undefined) {
				handleStructured(res.structuredContent, Boolean(overrides?.background));
			}
		},
		[bridge, handleStructured],
	);

	// Fallback initial fetch if host does not push ontoolresult immediately.
	useEffect(() => {
		if (
			!bridge.isConnected
			|| !bridge.capabilities.canCallServerTools
			|| hasLoaded
			|| bridge.isToolStreaming
		) {
			return;
		}
		const timer = setTimeout(() => {
			if (!useDashboardStore.getState().hasLoaded) {
				void fetchDashboard();
			}
		}, INITIAL_FALLBACK_MS);
		return () => clearTimeout(timer);
	}, [
		bridge.isConnected,
		bridge.capabilities.canCallServerTools,
		bridge.isToolStreaming,
		hasLoaded,
		fetchDashboard,
	]);

	// Periodic background revision polling while dashboard is visible.
	useEffect(() => {
		if (!hasLoaded || !bridge.isConnected || !bridge.capabilities.canCallServerTools) {
			return;
		}
		const runPoll = async () => {
			if (document.hidden || pollInFlightRef.current) {
				return;
			}
			pollInFlightRef.current = true;
			try {
				await fetchDashboard({
					background: true,
					sinceRevision: useDashboardStore.getState().revision,
				});
			}
			finally {
				pollInFlightRef.current = false;
			}
		};

		const intervalId = setInterval(() => void runPoll(), DASHBOARD_POLL_MS);
		const onFocus = () => void runPoll();
		const onVisibility = () => {
			if (!document.hidden) {
				void runPoll();
			}
		};
		window.addEventListener("focus", onFocus);
		document.addEventListener("visibilitychange", onVisibility);
		return () => {
			clearInterval(intervalId);
			window.removeEventListener("focus", onFocus);
			document.removeEventListener("visibilitychange", onVisibility);
		};
	}, [hasLoaded, bridge.isConnected, bridge.capabilities.canCallServerTools, fetchDashboard]);

	useEffect(() => {
		return () => {
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
		};
	}, []);

	const invokeWorkspaceAction = useCallback(
		async (args: Record<string, unknown>) => {
			const cur = useDashboardStore.getState();
			await runDashboardTool(
				"app_manage_workspace",
				{
					scope: cur.scope,
					activeTab: cur.activeTab,
					...args,
				},
				"Workspace update failed.",
			);
		},
		[runDashboardTool],
	);

	const handleUpdateSettings = useCallback(
		async (patch: {
			displayType?: WidgetDisplayMode;
			stepDisplayType?: StepDisplayOverride;
		}) => {
			const cur = useDashboardStore.getState();
			await runDashboardTool(
				"app_update_settings",
				{
					...patch,
					scope: cur.scope,
					sessionId: cur.sessionId ?? undefined,
					groupId: cur.groupId ?? undefined,
					activeTab: cur.activeTab,
					activeItemId: cur.activeItemId,
				},
				"Failed to update settings.",
			);
		},
		[runDashboardTool],
	);

	const handleClearToolCalls = useCallback(async () => {
		const cur = useDashboardStore.getState();
		if (!cur.sessionId) {
			return;
		}
		await runDashboardTool(
			"app_clear_tool_calls",
			{
				sessionId: cur.sessionId,
				scope: cur.scope,
				groupId: cur.groupId ?? undefined,
			},
			"Failed to clear tool calls.",
		);
	}, [runDashboardTool]);

	const handleSaveDraft = useCallback(
		(
			sessionId: string,
			questionSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
		) => {
			if (!bridge.capabilities.canCallServerTools) {
				return;
			}
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			draftTimerRef.current = setTimeout(() => {
				const cur = useDashboardStore.getState();
				void bridge.callTool("app_question_action", {
					action: "save_draft",
					source: "dashboard",
					sessionId,
					questionSetId,
					answers,
					otherTexts,
					dashboardScope: cur.scope,
					groupId: cur.groupId ?? undefined,
				});
			}, 300);
		},
		[bridge],
	);

	const handleSubmitQuestions = useCallback(
		async (
			sessionId: string,
			questionSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
		) => {
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			const cur = useDashboardStore.getState();
			const res = await runDashboardTool(
				"app_question_action",
				{
					action: "submit",
					source: "dashboard",
					sessionId,
					questionSetId,
					answers,
					otherTexts,
					scope: "all",
					dashboardScope: cur.scope,
					groupId: cur.groupId ?? undefined,
				},
				"Failed to submit answers.",
			);
			if (!res || !res.ok) {
				return { ok: false, sentToChat: false };
			}
			let sentToChat = false;
			if (res.text && bridge.capabilities.canSendMessage) {
				sentToChat = await bridge.sendMessage(res.text);
			}
			return { ok: true, sentToChat };
		},
		[bridge, runDashboardTool],
	);

	const handleNavigateLink = useCallback(
		(link: TimelineLink) => {
			const store = useDashboardStore.getState();
			switch (link.entityType) {
				case "task":
					store.setActiveItemId(link.entityId);
					store.setActiveTab("tasks");
					break;
				case "task_step":
				case "task_item":
					store.setActiveTab("tasks");
					break;
				case "plan":
					store.setActiveItemId(link.entityId);
					store.setActiveTab("plans");
					break;
				case "report":
					store.setActiveItemId(link.entityId);
					store.setActiveTab("reports");
					break;
				case "handoff":
					store.setActiveItemId(link.entityId);
					store.setActiveTab("handoffs");
					break;
				case "question_set":
					store.setActiveItemId(link.entityId);
					store.setActiveTab("questions");
					break;
				case "session":
					void fetchDashboard({ scope: "session", sessionId: link.entityId });
					break;
				case "session_group":
					void fetchDashboard({ scope: "group", groupId: link.entityId });
					break;
				case "note":
					store.setActiveTab("timeline");
					break;
				default: {
					const _exhaustive: never = link.entityType;
					void _exhaustive;
				}
			}
		},
		[fetchDashboard],
	);

	return {
		bridge,
		fetchDashboard,
		invokeWorkspaceAction,
		handleUpdateSettings,
		handleClearToolCalls,
		handleSaveDraft,
		handleSubmitQuestions,
		handleNavigateLink,
	};
}
