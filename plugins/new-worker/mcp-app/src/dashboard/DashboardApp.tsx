import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import type { DashboardTab, TimelineEntityType } from "@/shared/contracts.js";
import { createSampleDashboardPayload } from "@/shared/sampleData.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { ConfirmDialog } from "./components/ConfirmDialog.js";
import { DashboardHeader } from "./components/DashboardHeader.js";
import { LogFooter } from "./components/LogFooter.js";
import { SessionGroupDialog } from "./components/SessionGroupDialog.js";
import { SessionMetaDialog } from "./components/SessionMetaDialog.js";
import { SettingsDialog } from "./components/SettingsDialog.js";
import { TimelineNoteDialog } from "./components/TimelineNoteDialog.js";
import { HandoffsPanel } from "./panels/HandoffsPanel.js";
import { PlansPanel } from "./panels/PlansPanel.js";
import { QuestionsPanel } from "./panels/QuestionsPanel.js";
import { ReportsPanel } from "./panels/ReportsPanel.js";
import { TasksPanel } from "./panels/TasksPanel.js";
import { TimelinePanel } from "./panels/TimelinePanel.js";
import { useDashboardStore } from "./store.js";
import { useDashboardController } from "./useDashboardController.js";
import styles from "./DashboardApp.module.css";

function TabPanel({
	id,
	active,
	children,
}: {
	id: DashboardTab;
	active: DashboardTab;
	children: ReactNode;
}) {
	const isSelected = active === id;
	return (
		<div
			role="tabpanel"
			aria-labelledby={`tab-${id}`}
			className={styles.panel}
			hidden={!isSelected}
			tabIndex={isSelected ? 0 : undefined}
		>
			<div className={styles.inner}>{children}</div>
		</div>
	);
}

/**
 * Root view for the isolated New Worker Dashboard (`ui://new-worker/dashboard`),
 * structured as a 3-row CSS Grid with a sticky header, scrollable panel body, and
 * toggleable scrollable Log footer.
 */
export function DashboardApp() {
	const state = useDashboardStore(
		useShallow(s => ({
			scope: s.scope,
			sessionId: s.sessionId,
			groupId: s.groupId,
			rootDirFilter: s.rootDirFilter,
			activeTab: s.activeTab,
			activeItemId: s.activeItemId,
			isLogOpen: s.isLogOpen,
			settings: s.settings,
			session: s.session,
			group: s.group,
			sessions: s.sessions,
			groups: s.groups,
			tasks: s.tasks,
			plans: s.plans,
			reports: s.reports,
			handoffs: s.handoffs,
			questionSets: s.questionSets,
			timeline: s.timeline,
			toolCalls: s.toolCalls,
			hasLoaded: s.hasLoaded,
			isBusy: s.isBusy,
			errorMessage: s.errorMessage,
			activeDialog: s.activeDialog,
			applyPayload: s.applyPayload,
			setActiveTab: s.setActiveTab,
			setActiveItemId: s.setActiveItemId,
			setRootDirFilter: s.setRootDirFilter,
			toggleLogOpen: s.toggleLogOpen,
			setActiveDialog: s.setActiveDialog,
			setErrorMessage: s.setErrorMessage,
		})),
	);

	const {
		bridge,
		fetchDashboard,
		invokeWorkspaceAction,
		handleUpdateSettings,
		handleClearToolCalls,
		handleSaveDraft,
		handleSubmitQuestions,
		handleNavigateLink,
	} = useDashboardController(state.hasLoaded);

	if (!state.hasLoaded && !state.session && !state.group) {
		return (
			<div className={styles["dashboard-app"]}>
				<main className={styles.content}>
					<div className={styles.container}>
						{bridge.connectionError
							? (
									<EmptyState
										title="Dashboard opened outside an active MCP App host."
										detail={bridge.connectionError}
										actions={(
											<ActionButton
												onClick={() => state.applyPayload(createSampleDashboardPayload())}
											>
												Load Sample Workspace
											</ActionButton>
										)}
									/>
								)
							: (
									<EmptyState
										title={bridge.isToolStreaming ? "Loading dashboard state..." : "Connecting to MCP host..."}
										detail="Waiting for SQLite workspace state."
									/>
								)}
					</div>
				</main>
			</div>
		);
	}

	const tabCounts: Record<DashboardTab, number> = {
		tasks: state.tasks.length,
		plans: state.plans.length,
		reports: state.reports.length,
		handoffs: state.handoffs.length,
		questions: state.questionSets.length,
		timeline: state.timeline.length,
	};

	const clearScopeLabel = state.scope === "group" && state.group
		? `group "${state.group.name}"`
		: state.sessionId
			? `session "${state.sessionId}"`
			: "all sessions";

	return (
		<div className={styles["dashboard-app"]}>
			<header className={styles["header-slot"]}>
				<div className={styles.container}>
					<DashboardHeader
						scope={state.scope}
						session={state.session}
						group={state.group}
						sessions={state.sessions}
						groups={state.groups}
						rootDirFilter={state.rootDirFilter}
						activeTab={state.activeTab}
						tabCounts={tabCounts}
						isLogOpen={state.isLogOpen}
						logCount={Math.min(state.toolCalls.length, 100)}
						isBusy={state.isBusy}
						onChangeScope={nextScope => void fetchDashboard({ scope: nextScope })}
						onSelectSession={nextId => void fetchDashboard({
							scope: "session",
							sessionId: nextId,
						})}
						onSelectGroup={nextGroupId => void fetchDashboard({
							scope: "group",
							groupId: nextGroupId,
						})}
						onChangeRootDirFilter={(dir) => {
							state.setRootDirFilter(dir);
							void fetchDashboard({ rootDirFilter: dir });
						}}
						onSelectTab={tab => state.setActiveTab(tab)}
						onToggleLog={state.toggleLogOpen}
						onOpenGroupDialog={mode => state.setActiveDialog(mode === "create" ? "group_create" : "group_edit")}
						onOpenSessionDialog={() => state.setActiveDialog("session_edit")}
						onOpenSettings={() => state.setActiveDialog("settings")}
						onRefresh={() => void fetchDashboard()}
					/>
				</div>
			</header>

			<main className={styles.content}>
				<div className={styles.container}>
					{state.errorMessage && (
						<div className={styles.error} role="alert">
							<span>{state.errorMessage}</span>
							<ActionButton
								variant="subtle"
								size="compact"
								onClick={() => state.setErrorMessage(null)}
							>
								Dismiss
							</ActionButton>
						</div>
					)}

					{!state.session && !state.group
						? (
								<EmptyState
									title="No sessions or groups recorded yet."
									detail="Sessions, tasks, plans, reports, handoffs, and timeline events appear here once created."
								/>
							)
						: (
								<div className={styles.panels}>
									<TabPanel id="tasks" active={state.activeTab}>
										<TasksPanel
											scope={state.scope}
											tasks={state.tasks}
											sessions={state.sessions}
											activeTaskId={state.activeItemId}
											onSelectSession={id => void fetchDashboard({
												scope: "session",
												sessionId: id,
											})}
											onOpenPlan={(taskId) => {
												state.setActiveItemId(String(taskId));
												state.setActiveTab("plans");
											}}
											onOpenReport={(taskId) => {
												state.setActiveItemId(String(taskId));
												state.setActiveTab("reports");
											}}
										/>
									</TabPanel>

									<TabPanel id="plans" active={state.activeTab}>
										<PlansPanel
											scope={state.scope}
											plans={state.plans}
											sessions={state.sessions}
											activeTaskId={state.activeItemId}
											rootDir={state.session?.rootDir}
											exportDir={state.session?.exportDir}
											onSelectPlan={id => state.setActiveItemId(id)}
											onSelectSession={id => void fetchDashboard({
												scope: "session",
												sessionId: id,
											})}
											onOpenFile={bridge.openWorkspaceFile}
										/>
									</TabPanel>

									<TabPanel id="reports" active={state.activeTab}>
										<ReportsPanel
											scope={state.scope}
											reports={state.reports}
											sessions={state.sessions}
											activeTaskId={state.activeItemId}
											rootDir={state.session?.rootDir}
											exportDir={state.session?.exportDir}
											onSelectReport={id => state.setActiveItemId(id)}
											onSelectSession={id => void fetchDashboard({
												scope: "session",
												sessionId: id,
											})}
											onOpenPlan={(taskId) => {
												state.setActiveItemId(String(taskId));
												state.setActiveTab("plans");
											}}
											onOpenFile={bridge.openWorkspaceFile}
										/>
									</TabPanel>

									<TabPanel id="handoffs" active={state.activeTab}>
										<HandoffsPanel
											scope={state.scope}
											handoffs={state.handoffs}
											sessions={state.sessions}
											rootDir={state.session?.rootDir}
											onSelectSession={id => void fetchDashboard({
												scope: "session",
												sessionId: id,
											})}
											onOpenFile={bridge.openWorkspaceFile}
										/>
									</TabPanel>

									<TabPanel id="questions" active={state.activeTab}>
										<QuestionsPanel
											scope={state.scope}
											questionSets={state.questionSets}
											sessions={state.sessions}
											activeQuestionSetId={state.activeItemId}
											isBusy={state.isBusy}
											canSendMessage={bridge.capabilities.canSendMessage}
											onSelectQuestionSet={id => state.setActiveItemId(id)}
											onSelectSession={id => void fetchDashboard({
												scope: "session",
												sessionId: id,
											})}
											onOpenFile={bridge.openWorkspaceFile}
											onSaveDraft={handleSaveDraft}
											onSubmit={handleSubmitQuestions}
										/>
									</TabPanel>

									<TabPanel id="timeline" active={state.activeTab}>
										<TimelinePanel
											scope={state.scope}
											events={state.timeline}
											sessions={state.sessions}
											onOpenNoteDialog={() => state.setActiveDialog("timeline_note")}
											onNavigateLink={handleNavigateLink}
										/>
									</TabPanel>
								</div>
							)}
				</div>
			</main>

			<footer className={styles["footer-slot"]}>
				<LogFooter
					isOpen={state.isLogOpen}
					toolCalls={state.toolCalls}
					isBusy={state.isBusy}
					canClear={Boolean((state.sessionId || state.groupId) && bridge.capabilities.canCallServerTools)}
					onToggle={state.toggleLogOpen}
					onRequestClear={() => state.setActiveDialog("confirm_clear_calls")}
				/>
			</footer>

			<SettingsDialog
				open={state.activeDialog === "settings"}
				settings={state.settings}
				isBusy={state.isBusy}
				onUpdateSettings={patch => void handleUpdateSettings(patch)}
				onClose={() => state.setActiveDialog(null)}
			/>

			<SessionGroupDialog
				key={`${state.activeDialog}-${state.group?.id ?? "new"}`}
				open={state.activeDialog === "group_create" || state.activeDialog === "group_edit"}
				mode={state.activeDialog === "group_edit" ? "edit" : "create"}
				group={state.group}
				isBusy={state.isBusy}
				onSave={async (input) => {
					await invokeWorkspaceAction({
						action: "upsert_group",
						groupId: input.groupId,
						name: input.name,
						description: input.description,
						notes: input.notes,
						sessionId: state.sessionId ?? undefined,
					});
				}}
				onRequestDelete={() => state.setActiveDialog("confirm_delete_group")}
				onClose={() => state.setActiveDialog(null)}
			/>

			<SessionMetaDialog
				key={`session-meta-${state.session?.sessionId ?? "none"}-${state.activeDialog === "session_edit"}`}
				open={state.activeDialog === "session_edit"}
				session={state.session}
				groups={state.groups}
				isBusy={state.isBusy}
				onSave={async (input) => {
					await invokeWorkspaceAction({
						action: "update_session",
						sessionId: input.sessionId,
						title: input.title,
						rootDir: input.rootDir,
						groupId: input.groupId,
					});
				}}
				onClose={() => state.setActiveDialog(null)}
			/>

			<TimelineNoteDialog
				key={`note-${state.activeDialog === "timeline_note"}`}
				open={state.activeDialog === "timeline_note"}
				sessionId={state.sessionId}
				groupId={state.groupId}
				tasks={state.tasks}
				isBusy={state.isBusy}
				onSave={async (input) => {
					const extraLinks: Array<{
						entityType: TimelineEntityType;
						entityId: string;
						role: "related" | "parent";
						label?: string;
					}> = [...input.links];
					if (state.sessionId) {
						extraLinks.push({
							entityType: "session",
							entityId: state.sessionId,
							role: "parent",
							label: state.session?.title ?? state.sessionId,
						});
					}
					await invokeWorkspaceAction({
						action: "add_timeline_note",
						sessionId: state.sessionId ?? undefined,
						groupId: state.groupId ?? undefined,
						title: input.title,
						summary: input.summary,
						links: extraLinks,
					});
				}}
				onClose={() => state.setActiveDialog(null)}
			/>

			<ConfirmDialog
				open={state.activeDialog === "confirm_clear_calls"}
				title="Clear Tool Call Logs?"
				message={`Delete all recorded tool call logs for ${clearScopeLabel}? Timeline events and artifacts are preserved.`}
				confirmLabel="Clear All"
				isBusy={state.isBusy}
				onConfirm={handleClearToolCalls}
				onClose={() => state.setActiveDialog(null)}
			/>

			<ConfirmDialog
				open={state.activeDialog === "confirm_delete_group"}
				title="Delete Session Group?"
				message={`Delete group "${state.group?.name ?? ""}"? Member sessions stay intact as ungrouped sessions.`}
				confirmLabel="Delete Group"
				isBusy={state.isBusy}
				onConfirm={async () => {
					if (state.groupId) {
						await invokeWorkspaceAction({
							action: "delete_group",
							groupId: state.groupId,
							sessionId: state.sessionId ?? undefined,
						});
					}
				}}
				onClose={() => state.setActiveDialog(null)}
			/>
		</div>
	);
}
