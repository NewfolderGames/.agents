import { DataTable } from "@/components/common/display/DataTable.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { formatDuration, formatTimestampTooltip } from "@/shared/format.js";
import type { TaskRecord } from "@/shared/schema.js";
import styles from "./TaskOverviewTable.module.css";

export interface TaskOverviewTableProps {
	tasks: TaskRecord[];
	onOpenPlan?: (taskNumber: string) => void;
	onOpenReport?: (taskNumber: string) => void;
}

function getStatusTone(
	status: TaskRecord["status"],
): "neutral" | "success" | "warning" | "danger" {
	switch (status) {
		case "done":
			return "success";
		case "in_progress":
			return "warning";
		case "cancelled":
		case "superseded":
			return "danger";
		default:
			return "neutral";
	}
}

export function TaskOverviewTable({
	tasks,
	onOpenPlan,
	onOpenReport,
}: TaskOverviewTableProps) {
	const rows = tasks.map((task) => {
		const doneItems = task.steps.reduce(
			(sum, step) => sum + step.items.filter(i => i.status === "done").length,
			0,
		);
		const totalItems = task.steps.reduce((sum, step) => sum + step.items.length, 0);
		const duration = formatDuration(task.startedAt, task.completedAt);
		const tooltip = formatTimestampTooltip(task.createdAt, task.startedAt, task.completedAt);

		return [
			<code key="num">{task.taskNumber}</code>,
			<StatusBadge
				key="status"
				label={`${task.status} (${doneItems}/${totalItems})`}
				tone={getStatusTone(task.status)}
			/>,
			<span key="title" className={styles.title}>{task.title}</span>,
			<span key="dur" className={styles.duration} title={tooltip}>
				{duration ?? "-"}
			</span>,
			<span key="docs" className={styles.docs}>
				{task.planFile && onOpenPlan
					? (
							<button
								type="button"
								className={styles.link}
								onClick={() => onOpenPlan(task.taskNumber)}
							>
								plan
							</button>
						)
					: task.planFile ?? "-"}
				{" | "}
				{task.reportFile && onOpenReport
					? (
							<button
								type="button"
								className={styles.link}
								onClick={() => onOpenReport(task.taskNumber)}
							>
								report
							</button>
						)
					: task.reportFile ?? "-"}
			</span>,
		];
	});

	return (
		<div className={styles["task-overview-table"]}>
			<DataTable headers={["#", "Status", "Task", "Time", "Docs"]} rows={rows} />
		</div>
	);
}
