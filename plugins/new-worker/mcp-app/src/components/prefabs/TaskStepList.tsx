import { ChecklistItem } from "@/components/common/display/ChecklistItem.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { formatDuration, formatTimestampTooltip } from "@/shared/format.js";
import type { QuestionSetRecord, TaskRecord } from "@/shared/schema.js";
import { countStepProgress, getStepPendingQuestions } from "./TaskStepList.util.js";
import styles from "./TaskStepList.module.css";

export interface TaskStepListProps {
	task: TaskRecord;
	questionSets?: QuestionSetRecord[];
	highlightItemId?: string;
}

export function TaskStepList({
	task,
	questionSets = [],
	highlightItemId,
}: TaskStepListProps) {
	return (
		<div className={styles["task-step-list"]}>
			{task.steps.map((step, idx) => {
				const progress = countStepProgress(step);
				const pendingStepQuestions = getStepPendingQuestions(
					questionSets,
					task.taskNumber,
					idx + 1,
				);
				const stepDuration = formatDuration(step.startedAt, step.completedAt);
				const stepTooltip = formatTimestampTooltip(
					step.createdAt,
					step.startedAt,
					step.completedAt,
				);
				return (
					<div key={`${task.taskNumber}-step-${idx}`} className={styles.step}>
						<div className={styles.heading}>
							<strong className={styles.title}>
								Step
								{" "}
								{idx + 1}
								:
								{" "}
								{step.title}
							</strong>
							<div className={styles.badges}>
								{stepDuration && (
									<span className={styles.duration} title={stepTooltip}>
										{stepDuration}
									</span>
								)}
								{pendingStepQuestions > 0 && (
									<StatusBadge
										label={`${pendingStepQuestions} step Q`}
										tone="warning"
									/>
								)}
								<span className={styles.progress}>
									{progress.done}
									/
									{progress.total}
								</span>
							</div>
						</div>
						<p className={styles.outcome}>{step.outcome}</p>
						<ul className={styles.items}>
							{step.items.map(item => (
								<li key={item.id} className={styles.item}>
									<ChecklistItem
										label={item.text}
										status={item.status}
										highlighted={item.id === highlightItemId}
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
	);
}
