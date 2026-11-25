import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { AppHeader } from "@/components/prefabs/AppHeader.js";
import { SettingsPanel } from "@/components/prefabs/SettingsPanel.js";
import { TaskStepCard } from "@/components/prefabs/TaskStepCard.js";
import { useMcpBridge } from "@/hooks/useMcpBridge.js";
import { useWorkspaceState } from "@/hooks/useWorkspaceState.js";
import { createSampleSession } from "@/shared/sampleSession.js";
import { resolveWidgetDisplayMode, type WorkspaceTab } from "@/shared/schema.js";
import { useWorkspaceStore } from "@/shared/workspaceStore.js";
import { HandoffsView } from "./HandoffsView.js";
import { PlanView } from "./PlanView.js";
import { QuestionsView } from "./QuestionsView.js";
import { ReportView } from "./ReportView.js";
import { TasksView } from "./TasksView.js";
import styles from "./WorkspaceView.module.css";

export function WorkspaceView() {
	const bridge = useMcpBridge();
	const ws = useWorkspaceState(bridge);

	const loadSampleSession = () => {
		const sample = createSampleSession();
		useWorkspaceStore.getState().applyPayload({
			mode: "dashboard",
			sessionId: sample.sessionId,
			activeTab: "tasks",
			session: sample,
			sessions: [
				{
					sessionId: sample.sessionId,
					workspacePath: sample.workspacePath,
					updatedAt: sample.updatedAt,
					taskCount: sample.tasks.length,
					pendingQuestionCount: 1,
				},
			],
		});
	};

	if (!ws.hasLoaded && !ws.session) {
		return (
			<main className={styles["workspace-view"]}>
				{bridge.connectionError
					? (
							<div className={styles.offline}>
								<EmptyState
									title="Opened outside an active MCP App host."
									detail={bridge.connectionError}
								/>
								<ActionButton onClick={loadSampleSession}>
									Load Sample Session
								</ActionButton>
							</div>
						)
					: (
							<EmptyState
								title={bridge.isToolStreaming ? "Receiving tool payload..." : "Connecting to MCP host..."}
								detail="Waiting for new-worker session state."
							/>
						)}
			</main>
		);
	}

	if (!ws.session) {
		const emptyCounts: Record<WorkspaceTab, number> = {
			tasks: 0,
			plans: 0,
			reports: 0,
			handoffs: 0,
			questions: 0,
			calls: 0,
		};
		return (
			<main className={styles["workspace-view"]}>
				{ws.mode === "dashboard" && (
					<>
						<AppHeader
							sessionId={null}
							sessions={ws.sessions}
							activeTab={ws.activeTab}
							tabCounts={emptyCounts}
							isBusy={ws.isBusy}
							settingsOpen={ws.settingsOpen}
							onToggleSettings={() => ws.setSettingsOpen(!ws.settingsOpen)}
							onSelectSession={nextId => void ws.refreshState(nextId, ws.activeTab)}
							onSelectTab={tab => ws.setActiveTab(tab)}
							onRefresh={() => void ws.refreshState(undefined, ws.activeTab)}
						/>
						{ws.settingsOpen && (
							<SettingsPanel
								settings={ws.settings}
								isBusy={ws.isBusy}
								onUpdateSettings={patch => void ws.updateSettings(patch)}
								onClose={() => ws.setSettingsOpen(false)}
							/>
						)}
					</>
				)}
				<EmptyState
					title="No sessions recorded yet."
					detail="Sessions appear here once a task, plan, report, handoff, or question set is created."
				/>
			</main>
		);
	}

	const session = ws.session;
	const showTabs = ws.mode === "dashboard";
	const widgetDisplayMode = resolveWidgetDisplayMode(ws.settings, "widget");
	const stepDisplayMode = resolveWidgetDisplayMode(ws.settings, "step");
	const inlineDisplayMode = ws.mode === "task_step" ? stepDisplayMode : widgetDisplayMode;

	const tabCounts: Record<WorkspaceTab, number> = {
		tasks: session.tasks.length,
		plans: session.plans.length,
		reports: session.reports.length,
		handoffs: session.handoffs.length,
		questions: session.questionSets.length,
		calls: session.toolCalls.length,
	};

	const renderActiveView = () => {
		if (ws.mode === "task_step") {
			const targetTask
				= session.tasks.find(t => t.taskNumber === ws.activeItemId)
					?? session.tasks.find(t => t.status === "in_progress")
					?? session.tasks[session.tasks.length - 1];
			return (
				<TaskStepCard
					snapshot={ws.stepSnapshot}
					task={targetTask}
					stepIndex={ws.activeStepIndex}
					highlightItemId={ws.activeTaskItemId}
					questionSets={session.questionSets}
					defaultDisplayMode={stepDisplayMode}
				/>
			);
		}

		switch (ws.activeTab) {
			case "tasks":
				return (
					<TasksView
						tasks={session.tasks}
						questionSets={session.questionSets}
						defaultDisplayMode={widgetDisplayMode}
						onOpenPlan={showTabs
							? (taskNumber) => {
									ws.setActiveItemId(taskNumber);
									ws.setActiveTab("plans");
								}
							: undefined}
						onOpenReport={showTabs
							? (taskNumber) => {
									ws.setActiveItemId(taskNumber);
									ws.setActiveTab("reports");
								}
							: undefined}
					/>
				);
			case "plans":
				return (
					<PlanView
						plans={session.plans}
						activeTaskNumber={ws.activeItemId}
						workspacePath={session.workspacePath}
						defaultDisplayMode={widgetDisplayMode}
						onSelectPlan={taskNumber => ws.setActiveItemId(taskNumber)}
						onOpenFile={bridge.openWorkspaceFile}
					/>
				);
			case "reports":
				return (
					<ReportView
						reports={session.reports}
						activeTaskNumber={ws.activeItemId}
						workspacePath={session.workspacePath}
						defaultDisplayMode={widgetDisplayMode}
						onSelectReport={taskNumber => ws.setActiveItemId(taskNumber)}
						onOpenFile={bridge.openWorkspaceFile}
					/>
				);
			case "handoffs":
				return (
					<HandoffsView
						tab="handoffs"
						handoffs={session.handoffs}
						toolCalls={session.toolCalls}
						workspacePath={session.workspacePath}
						defaultDisplayMode={widgetDisplayMode}
						isBusy={ws.isBusy}
						onOpenFile={bridge.openWorkspaceFile}
					/>
				);
			case "calls":
				return (
					<HandoffsView
						tab="calls"
						handoffs={session.handoffs}
						toolCalls={session.toolCalls}
						workspacePath={session.workspacePath}
						defaultDisplayMode={widgetDisplayMode}
						isBusy={ws.isBusy}
						onOpenFile={bridge.openWorkspaceFile}
						onClearToolCalls={showTabs ? () => void ws.clearToolCalls() : undefined}
					/>
				);
			case "questions":
				return (
					<QuestionsView
						questionSets={session.questionSets}
						activeQuestionSetId={ws.activeItemId}
						allowSetSwitch={showTabs}
						workspacePath={session.workspacePath}
						defaultDisplayMode={widgetDisplayMode}
						isBusy={ws.isBusy}
						canSendMessage={bridge.capabilities.canSendMessage}
						onSelectQuestionSet={id => ws.setActiveItemId(id)}
						onOpenFile={bridge.openWorkspaceFile}
						onSaveDraft={ws.saveQuestionDraft}
						onSubmit={ws.submitQuestionAnswers}
					/>
				);
		}
	};

	return (
		<main className={styles["workspace-view"]}>
			{showTabs
				? (
						<>
							<AppHeader
								sessionId={session.sessionId}
								sessions={ws.sessions}
								activeTab={ws.activeTab}
								tabCounts={tabCounts}
								isBusy={ws.isBusy}
								settingsOpen={ws.settingsOpen}
								onToggleSettings={() => ws.setSettingsOpen(!ws.settingsOpen)}
								onSelectSession={nextId => void ws.refreshState(nextId, ws.activeTab)}
								onSelectTab={tab => ws.setActiveTab(tab)}
								onRefresh={() => void ws.refreshState(session.sessionId, ws.activeTab)}
							/>
							{ws.settingsOpen && (
								<SettingsPanel
									settings={ws.settings}
									isBusy={ws.isBusy}
									onUpdateSettings={patch => void ws.updateSettings(patch)}
									onClose={() => ws.setSettingsOpen(false)}
								/>
							)}
						</>
					)
				: (
						inlineDisplayMode !== "minimized" && (
							<div className={styles.inlinebar}>
								<span className={styles.session}>
									Session:
									{" "}
									<code>{session.sessionId}</code>
								</span>
							</div>
						)
					)}

			{ws.errorMessage && (
				<div className={styles.error} role="alert">
					<span>{ws.errorMessage}</span>
					<ActionButton variant="subtle" onClick={() => ws.setErrorMessage(null)}>
						Dismiss
					</ActionButton>
				</div>
			)}

			<div className={styles.content}>{renderActiveView()}</div>
		</main>
	);
}
