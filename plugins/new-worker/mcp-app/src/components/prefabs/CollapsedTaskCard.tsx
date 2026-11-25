import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { formatDuration, formatTimestampTooltip } from "@/shared/format.js";
import type { TaskRecord } from "@/shared/schema.js";
import styles from "./CollapsedTaskCard.module.css";

export interface CollapsedTaskCardProps {
	task: TaskRecord;
}

export function CollapsedTaskCard({ task }: CollapsedTaskCardProps) {
	const mark = task.status === "done" ? "[x]" : "[-]";
	const duration = formatDuration(task.startedAt, task.completedAt);
	const tooltip = formatTimestampTooltip(task.createdAt, task.startedAt, task.completedAt);

	return (
		<details className={styles["collapsed-task-card"]}>
			<summary className={styles.summary}>
				<span className={styles.title}>
					{mark}
					{" Task "}
					{task.taskNumber}
					{" - "}
					{task.title}
				</span>
				<span className={styles.badges}>
					{duration && (
						<span className={styles.duration} title={tooltip}>
							{duration}
						</span>
					)}
					<StatusBadge
						label={task.status}
						tone={task.status === "done" ? "success" : "danger"}
					/>
				</span>
			</summary>
			<div className={styles.body}>
				<p className={styles.text}>{task.summary}</p>
				<ul className={styles.steps}>
					{task.steps.map((step, idx) => {
						const stepDur = formatDuration(step.startedAt, step.completedAt);
						return (
							<li key={`${task.taskNumber}-hist-${idx}`}>
								{step.title}
								{stepDur ? ` (${stepDur})` : ""}
							</li>
						);
					})}
				</ul>
			</div>
		</details>
	);
}
