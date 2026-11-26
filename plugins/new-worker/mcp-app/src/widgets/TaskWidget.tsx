import type { TaskRecord, WidgetDisplayMode } from "@/shared/contracts.js";
import { formatDuration, formatTaskId, formatTimestampTooltip } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ChecklistRow } from "@/ui/primitives/ChecklistRow.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { useDisplayMode } from "./useDisplayMode.js";
import shellStyles from "./WidgetShell.module.css";
import styles from "./TaskWidget.module.css";

export interface TaskWidgetProps {
	task?: TaskRecord;
	defaultDisplayMode: WidgetDisplayMode;
}

/** Standalone inline widget displaying a task overview with step/item progress and durations. */
export function TaskWidget({ task, defaultDisplayMode }: TaskWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!task) {
		return <EmptyState title="Task unavailable." detail="No task payload was returned." />;
	}

	const allItems = task.steps.flatMap(s => s.items);
	const doneCount = allItems.filter(i => i.status === "done").length;
	const duration = formatDuration(task.startedAt, task.completedAt);
	const tooltip = formatTimestampTooltip(task.createdAt, task.startedAt, task.completedAt);

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>
					{`Task ${formatTaskId(task.taskId)}: ${task.title}`}
				</span>
				<div className={shellStyles.minmeta}>
					{duration && <StatusBadge label={duration} title={tooltip} />}
					<StatusBadge
						label={`${doneCount}/${allItems.length} done`}
						tone={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "neutral"}
					/>
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						Expand
					</ActionButton>
				</div>
			</div>
		);
	}

	const isCompact = displayMode === "compact";

	return (
		<SectionCard
			title={`Task ${formatTaskId(task.taskId)} - ${task.title}`}
			actions={(
				<>
					{duration && <StatusBadge label={duration} title={tooltip} />}
					<StatusBadge
						label={`${doneCount}/${allItems.length} done`}
						tone={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "neutral"}
					/>
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</>
			)}
		>
			<div className={styles["task-widget"]}>
				<p className={styles.summary}>{task.summary}</p>
				{!isCompact && (
					<div className={styles.steps}>
						{task.steps.map((step, idx) => {
							const stepDone = step.items.filter(i => i.status === "done").length;
							return (
								<div key={step.id ?? idx} className={styles.step}>
									<div className={styles.head}>
										<strong>
											{`Step ${idx + 1}: ${step.title}`}
										</strong>
										<StatusBadge
											label={`${stepDone}/${step.items.length}`}
											tone={stepDone === step.items.length ? "success" : "neutral"}
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
							);
						})}
					</div>
				)}
			</div>
		</SectionCard>
	);
}
