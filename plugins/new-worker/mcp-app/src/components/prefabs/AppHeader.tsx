import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import type { SessionSummary, WorkspaceTab } from "@/shared/schema.js";
import styles from "./AppHeader.module.css";

export interface AppHeaderProps {
	sessionId: string | null;
	sessions: SessionSummary[];
	activeTab: WorkspaceTab;
	tabCounts: Record<WorkspaceTab, number>;
	isBusy: boolean;
	settingsOpen: boolean;
	onToggleSettings: () => void;
	onSelectSession: (sessionId: string) => void;
	onSelectTab: (tab: WorkspaceTab) => void;
	onRefresh: () => void;
}

const TAB_LABELS: Array<{ id: WorkspaceTab; label: string }> = [
	{ id: "tasks", label: "Tasks" },
	{ id: "plans", label: "Plans" },
	{ id: "reports", label: "Reports" },
	{ id: "handoffs", label: "Handoffs" },
	{ id: "questions", label: "Questions" },
	{ id: "calls", label: "Tool Calls" },
];

export function AppHeader({
	sessionId,
	sessions,
	activeTab,
	tabCounts,
	isBusy,
	settingsOpen,
	onToggleSettings,
	onSelectSession,
	onSelectTab,
	onRefresh,
}: AppHeaderProps) {
	const hasCurrent = sessionId ? sessions.some(s => s.sessionId === sessionId) : false;

	return (
		<header className={styles["app-header"]}>
			<div className={styles.top}>
				<div className={styles.brand}>
					<strong className={styles.title}>new-worker</strong>
					<label className={styles.picker}>
						<span className={styles.label}>Session</span>
						<select
							className={styles.select}
							value={sessionId ?? ""}
							onChange={(e) => {
								if (e.target.value) {
									onSelectSession(e.target.value);
								}
							}}
							disabled={isBusy || (sessions.length === 0 && !sessionId)}
						>
							{!sessionId && sessions.length === 0 && (
								<option value="">No sessions yet</option>
							)}
							{sessionId && !hasCurrent && (
								<option value={sessionId}>{sessionId}</option>
							)}
							{sessions.map(s => (
								<option key={s.sessionId} value={s.sessionId}>
									{s.sessionId}
									{" "}
									(
									{s.taskCount}
									)
								</option>
							))}
						</select>
					</label>
				</div>
				<div className={styles.controls}>
					<ActionButton
						variant="subtle"
						active={settingsOpen}
						onClick={onToggleSettings}
					>
						Settings
					</ActionButton>
					<ActionButton variant="subtle" onClick={onRefresh} disabled={isBusy}>
						{isBusy ? "Syncing..." : "Refresh"}
					</ActionButton>
				</div>
			</div>
			<nav className={styles.tabs} aria-label="Workspace views">
				{TAB_LABELS.map(tab => (
					<ActionButton
						key={tab.id}
						variant="subtle"
						active={activeTab === tab.id}
						aria-current={activeTab === tab.id ? "page" : undefined}
						onClick={() => onSelectTab(tab.id)}
					>
						{tab.label}
						{" "}
						(
						{tabCounts[tab.id]}
						)
					</ActionButton>
				))}
			</nav>
		</header>
	);
}
