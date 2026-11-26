import type { DashboardScope, DashboardTab, SessionGroup, SessionGroupSummary, SessionRecord, SessionSummary } from "@/shared/contracts.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { CopyButton } from "@/ui/primitives/CopyButton.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { TabBar, type TabBarItem } from "@/ui/primitives/TabBar.js";
import styles from "./DashboardHeader.module.css";

export interface DashboardHeaderProps {
	scope: DashboardScope;
	session: SessionRecord | null;
	group: SessionGroup | null;
	sessions: SessionSummary[];
	groups: SessionGroupSummary[];
	rootDirFilter: string;
	activeTab: DashboardTab;
	tabCounts: Record<DashboardTab, number>;
	isBusy: boolean;
	onChangeScope: (scope: DashboardScope) => void;
	onSelectSession: (sessionId: string) => void;
	onSelectGroup: (groupId: string) => void;
	onChangeRootDirFilter: (rootDir: string) => void;
	onSelectTab: (tab: DashboardTab) => void;
	onOpenGroupDialog: (mode: "create" | "edit") => void;
	onOpenSessionDialog: () => void;
	onOpenSettings: () => void;
	onRefresh: () => void;
}

/** Dashboard top bar hosting scope switchers, session/group selectors, `rootDir` filter, and tabs. */
export function DashboardHeader({
	scope,
	session,
	group,
	sessions,
	groups,
	rootDirFilter,
	activeTab,
	tabCounts,
	isBusy,
	onChangeScope,
	onSelectSession,
	onSelectGroup,
	onChangeRootDirFilter,
	onSelectTab,
	onOpenGroupDialog,
	onOpenSessionDialog,
	onOpenSettings,
	onRefresh,
}: DashboardHeaderProps) {
	const uniqueRoots = Array.from(
		new Set(sessions.map(s => s.rootDir).filter((r): r is string => Boolean(r))),
	).sort();

	const tabs: Array<TabBarItem<DashboardTab>> = [
		{ id: "tasks", label: "Tasks", count: tabCounts.tasks },
		{ id: "plans", label: "Plans", count: tabCounts.plans },
		{ id: "reports", label: "Reports", count: tabCounts.reports },
		{ id: "handoffs", label: "Handoffs", count: tabCounts.handoffs },
		{ id: "questions", label: "Questions", count: tabCounts.questions },
		{ id: "timeline", label: "Timeline", count: tabCounts.timeline },
		{ id: "calls", label: "Tool Calls", count: tabCounts.calls },
	];

	return (
		<header className={styles["dashboard-header"]}>
			<div className={styles.top}>
				<div className={styles.brand}>
					<span className={styles.title}>new-worker</span>
					<div className={styles.scope} role="group" aria-label="Workspace scope">
						<ActionButton
							variant="subtle"
							size="compact"
							active={scope === "session"}
							disabled={isBusy}
							onClick={() => onChangeScope("session")}
						>
							Session
						</ActionButton>
						<ActionButton
							variant="subtle"
							size="compact"
							active={scope === "group"}
							disabled={isBusy || groups.length === 0}
							onClick={() => onChangeScope("group")}
						>
							Group
						</ActionButton>
					</div>
				</div>

				<div className={styles.controls}>
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={() => onOpenGroupDialog("create")}
					>
						+ Group
					</ActionButton>
					<ActionButton variant="subtle" size="compact" onClick={onOpenSettings}>
						Settings
					</ActionButton>
					<ActionButton
						variant="subtle"
						size="compact"
						disabled={isBusy}
						onClick={onRefresh}
					>
						{isBusy ? "Syncing..." : "Refresh"}
					</ActionButton>
				</div>
			</div>

			<div className={styles.selectors}>
				<label className={styles.picker}>
					<span className={styles.label}>Session</span>
					<select
						className={styles.select}
						value={session?.sessionId ?? ""}
						disabled={isBusy || sessions.length === 0}
						onChange={(e) => {
							if (e.target.value) {
								onSelectSession(e.target.value);
							}
						}}
					>
						{sessions.length === 0 && <option value="">No sessions</option>}
						{sessions.map(s => (
							<option key={s.sessionId} value={s.sessionId}>
								{`${s.title ?? s.sessionId} (${s.taskCount})`}
							</option>
						))}
					</select>
				</label>

				{groups.length > 0 && (
					<label className={styles.picker}>
						<span className={styles.label}>Group</span>
						<select
							className={styles.select}
							value={group?.id ?? ""}
							disabled={isBusy}
							onChange={(e) => {
								if (e.target.value) {
									onSelectGroup(e.target.value);
								}
							}}
						>
							{!group && <option value="">Select group...</option>}
							{groups.map(g => (
								<option key={g.id} value={g.id}>
									{`${g.name} (${g.sessionCount}s / ${g.taskCount}t)`}
								</option>
							))}
						</select>
					</label>
				)}

				{uniqueRoots.length > 0 && (
					<label className={styles.picker}>
						<span className={styles.label}>Root Dir</span>
						<select
							className={styles.select}
							value={rootDirFilter}
							disabled={isBusy}
							onChange={e => onChangeRootDirFilter(e.target.value)}
						>
							<option value="">All directories</option>
							{uniqueRoots.map(dir => (
								<option key={dir} value={dir}>
									{dir}
								</option>
							))}
						</select>
					</label>
				)}
			</div>

			{(session || group) && (
				<div className={styles.meta}>
					<div className={styles.info}>
						{scope === "group" && group
							? (
									<>
										<StatusBadge label={`Group: ${group.name}`} tone="info" />
										{group.description
											&& <span className={styles.label}>{group.description}</span>}
									</>
								)
							: session && (
								<>
									<span className={styles.label}>Root:</span>
									<code>{session.rootDir ?? "(unset)"}</code>
									{session.rootDir
										&& <CopyButton text={session.rootDir} label="Copy Path" />}
									{group && <StatusBadge label={`Group: ${group.name}`} tone="info" />}
								</>
							)}
					</div>
					<div className={styles.actions}>
						{session && (
							<ActionButton
								variant="subtle"
								size="compact"
								onClick={onOpenSessionDialog}
							>
								Edit Session
							</ActionButton>
						)}
						{group && (
							<ActionButton
								variant="subtle"
								size="compact"
								onClick={() => onOpenGroupDialog("edit")}
							>
								Edit Group
							</ActionButton>
						)}
					</div>
				</div>
			)}

			<TabBar
				ariaLabel="Dashboard sections"
				tabs={tabs}
				activeTab={activeTab}
				onSelectTab={onSelectTab}
			/>
		</header>
	);
}
