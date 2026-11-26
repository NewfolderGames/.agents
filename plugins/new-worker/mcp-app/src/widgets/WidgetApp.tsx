import { useCallback, useEffect, useRef, useState } from "react";
import { type QuestionAnswerValue, resolveWidgetDisplayMode, type WidgetPayload, WidgetPayloadSchema, type WidgetRoute, WidgetRouteSchema } from "@/shared/contracts.js";
import { createSampleWidgetPayload } from "@/shared/sampleData.js";
import { useMcpApp } from "@/ui/hooks/useMcpApp.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { HandoffWidget } from "./HandoffWidget.js";
import { PlanWidget } from "./PlanWidget.js";
import { QuestionsWidget } from "./QuestionsWidget.js";
import { ReportWidget } from "./ReportWidget.js";
import { TaskStepWidget } from "./TaskStepWidget.js";
import { TaskWidget } from "./TaskWidget.js";
import { WidgetShell } from "./WidgetShell.js";

declare global {
	interface Window {
		__NEW_WORKER_ROUTE__?: string;
	}
}

function resolveInitialWidgetRoute(): WidgetRoute {
	const raw = window.__NEW_WORKER_ROUTE__ ?? window.location.pathname;
	const clean = raw.replace(/^\/widget\/?/, "").replace(/\/+$/, "");
	const parsed = WidgetRouteSchema.safeParse(clean);
	return parsed.success ? parsed.data : "task";
}

/**
 * Root router for standalone inline widget HTML bundles (`/widget/<name>`),
 * reading `window.__NEW_WORKER_ROUTE__` injected by MCP resource serving.
 */
export function WidgetApp() {
	const route = resolveInitialWidgetRoute();
	const [payload, setPayload] = useState<WidgetPayload | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isBusy, setIsBusy] = useState(false);
	const draftTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const syncedQuestionKeyRef = useRef<string | undefined>(undefined);

	const applyStructured = useCallback((raw: unknown) => {
		const parsed = WidgetPayloadSchema.safeParse(raw);
		if (parsed.success) {
			setPayload(parsed.data);
			setErrorMessage(null);
		}
	}, []);

	const bridge = useMcpApp({
		appName: `new-worker-widget-${route}`,
		onToolResult: applyStructured,
		onToolError: setErrorMessage,
	});

	const sessionId = payload?.sessionId;
	const questionSetId = payload?.questionSet?.id;

	useEffect(() => {
		if (
			route !== "questions"
			|| !sessionId
			|| !questionSetId
			|| !bridge.isConnected
			|| !bridge.capabilities.canCallServerTools
		) {
			return;
		}
		const syncKey = `${sessionId}:${questionSetId}`;
		if (syncedQuestionKeyRef.current === syncKey) {
			return;
		}
		syncedQuestionKeyRef.current = syncKey;
		void bridge.callTool("app_get_widget_state", {
			widget: "questions",
			sessionId,
			questionSetId,
		}).then((res) => {
			if (res.ok && res.structuredContent) {
				applyStructured(res.structuredContent);
			}
		});
	}, [
		route,
		sessionId,
		questionSetId,
		bridge,
		bridge.isConnected,
		bridge.capabilities.canCallServerTools,
		applyStructured,
	]);

	useEffect(() => {
		return () => {
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
		};
	}, []);

	const handleSaveDraft = useCallback(
		(
			targetSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
		) => {
			if (!sessionId || !bridge.capabilities.canCallServerTools) {
				return;
			}
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			draftTimerRef.current = setTimeout(() => {
				void bridge.callTool("app_question_action", {
					action: "save_draft",
					source: "widget",
					sessionId,
					questionSetId: targetSetId,
					answers,
					otherTexts,
				});
			}, 300);
		},
		[bridge, sessionId],
	);

	const handleSubmitQuestions = useCallback(
		async (
			targetSetId: string,
			answers: Record<string, QuestionAnswerValue>,
			otherTexts: Record<string, string>,
		) => {
			if (!sessionId) {
				return { ok: false, sentToChat: false };
			}
			if (draftTimerRef.current) {
				clearTimeout(draftTimerRef.current);
			}
			setIsBusy(true);
			const res = await bridge.callTool("app_question_action", {
				action: "submit",
				source: "widget",
				sessionId,
				questionSetId: targetSetId,
				answers,
				otherTexts,
				scope: "all",
			});
			setIsBusy(false);
			if (!res.ok) {
				setErrorMessage(res.error ?? "Failed to submit answers.");
				return { ok: false, sentToChat: false };
			}
			if (res.structuredContent) {
				applyStructured(res.structuredContent);
			}
			let sentToChat = false;
			if (res.text && bridge.capabilities.canSendMessage) {
				sentToChat = await bridge.sendMessage(res.text);
			}
			return { ok: true, sentToChat, replyText: res.text };
		},
		[bridge, sessionId, applyStructured],
	);

	if (!payload) {
		if (bridge.connectionError) {
			return (
				<WidgetShell
					displayMode="full"
					errorMessage={null}
					onDismissError={() => setErrorMessage(null)}
				>
					<EmptyState
						title={`Widget /widget/${route} opened outside MCP host.`}
						detail={bridge.connectionError}
						actions={(
							<ActionButton
								onClick={() => setPayload(createSampleWidgetPayload(route))}
							>
								Load Sample Widget
							</ActionButton>
						)}
					/>
				</WidgetShell>
			);
		}
		return (
			<WidgetShell
				displayMode="full"
				errorMessage={errorMessage}
				onDismissError={() => setErrorMessage(null)}
			>
				<EmptyState
					title={bridge.isToolStreaming ? "Receiving widget payload..." : "Connecting to MCP host..."}
					detail={`Route: /widget/${route}`}
				/>
			</WidgetShell>
		);
	}

	const activeRoute = payload.widget ?? route;
	const defaultMode = resolveWidgetDisplayMode(
		payload.settings,
		activeRoute === "task-step" ? "step" : "widget",
	);

	return (
		<WidgetShell
			sessionId={payload.sessionId}
			sessionTitle={payload.sessionTitle}
			displayMode={defaultMode}
			errorMessage={errorMessage}
			onDismissError={() => setErrorMessage(null)}
		>
			{activeRoute === "task" && (
				<TaskWidget task={payload.task} defaultDisplayMode={defaultMode} />
			)}
			{activeRoute === "task-step" && (
				<TaskStepWidget
					snapshot={payload.stepSnapshot}
					task={payload.task}
					questionSets={payload.questionSets}
					defaultDisplayMode={defaultMode}
				/>
			)}
			{activeRoute === "plan" && (
				<PlanWidget
					plan={payload.plan}
					rootDir={payload.rootDir}
					exportDir={payload.exportDir}
					defaultDisplayMode={defaultMode}
					onOpenFile={bridge.openWorkspaceFile}
				/>
			)}
			{activeRoute === "report" && (
				<ReportWidget
					report={payload.report}
					rootDir={payload.rootDir}
					exportDir={payload.exportDir}
					defaultDisplayMode={defaultMode}
					onOpenFile={bridge.openWorkspaceFile}
				/>
			)}
			{activeRoute === "handoff" && (
				<HandoffWidget
					handoff={payload.handoff}
					rootDir={payload.rootDir}
					defaultDisplayMode={defaultMode}
					onOpenFile={bridge.openWorkspaceFile}
				/>
			)}
			{activeRoute === "questions" && (
				<QuestionsWidget
					key={`${payload.questionSet?.id ?? "none"}-${payload.questionSet?.status ?? "pending"}`}
					questionSet={payload.questionSet}
					rootDir={payload.rootDir}
					defaultDisplayMode={defaultMode}
					isBusy={isBusy}
					canSendMessage={bridge.capabilities.canSendMessage}
					onOpenFile={bridge.openWorkspaceFile}
					onSaveDraft={handleSaveDraft}
					onSubmit={handleSubmitQuestions}
				/>
			)}
		</WidgetShell>
	);
}
