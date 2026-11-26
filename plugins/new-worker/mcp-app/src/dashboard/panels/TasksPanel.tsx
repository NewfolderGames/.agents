import { useState } from "react";
import type { DashboardScope, SessionSummary, TaskRecord } from "@/shared/contracts.js";
import { formatDuration, formatTaskId, formatTimestampTooltip } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ChecklistRow } from "@/ui/primitives/ChecklistRow.js";
import { DataTable, type DataTableColumn } from "@/ui/primitives/DataTable.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FilterPills } from "@/ui/primitives/FilterPills.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./TasksPanel.module.css";

export interface TasksPanelProps {
	scope: DashboardScope;
	tasks: TaskRecord[];
	sessions: SessionSummary[];
	activeTaskId?: string;
	onSelectSession: (sessionId: string) => void;
	onOpenPlan: (taskId: number) => void;
	onOpenReport: (taskId: number) => void;
}

type TaskFilter = "all" | "active" | "done";

function isArchivedStatus(status: TaskRecord["status"]): boolean {
	return status === "done" || status === "cancelled" || status === "superseded";
}

/** Dashboard panel summarizing global tasks with active/done filters and expandable step checklists. */
export function TasksPanel({
	scope,
	tasks,
	sessions,
	activeTaskId,
	onSelectSession,
	onOpenPlan,
	onOpenReport,
}: TasksPanelProps) {
	const [filter, setFilter] = useState<TaskFilter>("all");

	if (tasks.length === 0) {
		return (
			<EmptyState
				title="No tasks recorded in this scope."
				detail="Tasks created via upsert_task or write_plan appear here with global #IDs."
			/>
		);
	}

	const sessionNames = new Map(sessions.map(s => [s.sessionId, s.title ?? s.sessionId]));

	const filteredTasks = tasks.filter((t) => {
		if (filter === "active") {
			return !isArchivedStatus(t.status);
		}
		if (filter === "done") {
			return isArchivedStatus(t.status);
		}
		return true;
	});

	const activeTasks = filteredTasks.filter(t => !isArchivedStatus(t.status));
	const archivedTasks = filteredTasks.filter(t => isArchivedStatus(t.status));

	const columns: Array<DataTableColumn<TaskRecord>> = [
		{
			key: "id",
			header: "ID",
			isRowHeader: true,
			render: row => <code>{formatTaskId(row.taskId)}</code>,
		},
		{
			key: "status",
			header: "Status",
			render: row => (
				<StatusBadge
					label={row.status}
					tone={row.status === "done" ? "success" : row.status === "in_progress" ? "warning" : "neutral"}
				/>
			),
		},
		{
			key: "title",
			header: "Title",
			render: row => (
				<div>
					<strong>{row.title}</strong>
					{scope === "group" && (
						<div>
							<ActionButton
								variant="subtle"
								size="compact"
								onClick={() => onSelectSession(row.sessionId)}
							>
								{sessionNames.get(row.sessionId) ?? row.sessionId}
							</ActionButton>
						</div>
					)}
				</div>
			),
		},
		{
			key: "docs",
			header: "Docs",
			render: row => (
				<div className={styles.rowactions}>
					{row.planFile && (
						<ActionButton
							variant="subtle"
							size="compact"
							onClick={() => onOpenPlan(row.taskId)}
						>
							Plan
						</ActionButton>
					)}
					{row.reportFile && (
						<ActionButton
							variant="subtle"
							size="compact"
							onClick={() => onOpenReport(row.taskId)}
						>
							Report
						</ActionButton>
					)}
					{!row.planFile && !row.reportFile && "-"}
				</div>
			),
		},
	];

	return (
		<div className={styles["tasks-panel"]}>
			<div className={styles.toolbar}>
				<FilterPills
					ariaLabel="Filter tasks by status"
					value={filter}
					onChange={setFilter}
					options={[
						{ value: "all", label: `All (${tasks.length})` },
						{
							value: "active",
							label: `Active (${tasks.filter(t => !isArchivedStatus(t.status)).length})`,
						},
						{
							value: "done",
							label: `Done (${tasks.filter(t => isArchivedStatus(t.status)).length})`,
						},
					]}
				/>
			</div>

			<DataTable
				caption="Tasks Overview"
				rows={filteredTasks}
				columns={columns}
				getRowKey={row => String(row.taskId)}
			/>

			{activeTasks.length > 0 && (
				<div className={styles.list}>
					{activeTasks.map((task) => {
						const items = task.steps.flatMap(s => s.items);
						const done = items.filter(i => i.status === "done").length;
						const duration = formatDuration(task.startedAt, task.completedAt);
						const tooltip = formatTimestampTooltip(task.createdAt, task.startedAt, task.completedAt);
						const isHighlighted = activeTaskId === String(task.taskId);

						return (
							<SectionCard
								key={task.taskId}
								title={`Task ${formatTaskId(task.taskId)} - ${task.title}${isHighlighted ? " (Selected)" : ""}`}
								actions={(
									<>
										{scope === "group" && (
											<ActionButton
												variant="subtle"
												size="compact"
												onClick={() => onSelectSession(task.sessionId)}
											>
												{sessionNames.get(task.sessionId) ?? task.sessionId}
											</ActionButton>
										)}
										{duration
											&& <StatusBadge label={duration} title={tooltip} />}
										<StatusBadge
											label={`${done}/${items.length} done`}
											tone={task.status === "in_progress" ? "warning" : "neutral"}
										/>
									</>
								)}
							>
								<p className={styles.summary}>{task.summary}</p>
								<div className={styles.steps}>
									{task.steps.map((step, idx) => (
										<div key={step.id ?? idx} className={styles.step}>
											<div className={styles.head}>
												<strong>{`Step ${idx + 1}: ${step.title}`}</strong>
												<StatusBadge
													label={`${step.items.filter(i => i.status === "done").length}/${step.items.length}`}
												/>
											</div>
											<p className={styles.outcome}>{step.outcome}</p>
											<ul className={styles.items}>
												{step.items.map(item => (
													<li key={item.itemKey}>
														<ChecklistRow
															label={item.text}
															status={item.status}
															duration={formatDuration(item.startedAt, item.completedAt)}
															timestampTooltip={formatTimestampTooltip(
																item.createdAt,
																item.startedAt,
																item.completedAt,
															)}
														/>
													</li>
												))}
											</ul>
										</div>
									))}
								</div>
							</SectionCard>
						);
					})}
				</div>
			)}

			{archivedTasks.length > 0 && (
				<SectionCard title={`Completed & Archived (${archivedTasks.length})`}>
					<div className={styles.archive}>
						{archivedTasks.map(task => (
							<details
								key={task.taskId}
								className={styles.item}
								open={activeTaskId === String(task.taskId)}
							>
								<summary>
									{`Task ${formatTaskId(task.taskId)} - ${task.title} (${task.status})`}
								</summary>
								<div className={styles.body}>
									<p className={styles.summary}>{task.summary}</p>
									<div className={styles.rowactions}>
										{scope === "group" && (
											<ActionButton
												variant="subtle"
												size="compact"
												onClick={() => onSelectSession(task.sessionId)}
											>
												{sessionNames.get(task.sessionId) ?? task.sessionId}
											</ActionButton>
										)}
										{task.planFile && (
											<ActionButton
												variant="subtle"
												size="compact"
												onClick={() => onOpenPlan(task.taskId)}
											>
												Open Plan
											</ActionButton>
										)}
										{task.reportFile && (
											<ActionButton
												variant="subtle"
												size="compact"
												onClick={() => onOpenReport(task.taskId)}
											>
												Open Report
											</ActionButton>
										)}
									</div>
								</div>
							</details>
						))}
					</div>
				</SectionCard>
			)}
		</div>
	);
}
