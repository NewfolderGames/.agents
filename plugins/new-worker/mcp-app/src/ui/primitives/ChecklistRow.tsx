import type { TaskItemStatus } from "@/shared/contracts.js";
import { cx } from "@/shared/format.js";
import { StatusBadge } from "./StatusBadge.js";
import styles from "./ChecklistRow.module.css";

export interface ChecklistRowProps {
	label: string;
	status: TaskItemStatus;
	highlighted?: boolean;
	duration?: string | null;
	timestampTooltip?: string;
}

/** Read-only task checklist item row with status marker, optional duration, and timestamp tooltip. */
export function ChecklistRow({
	label,
	status,
	highlighted = false,
	duration,
	timestampTooltip,
}: ChecklistRowProps) {
	const mark = status === "done" ? "[x]" : status === "in_progress" ? "[>]" : "[ ]";

	return (
		<div
			className={cx(
				styles["checklist-row"],
				status === "done" && styles["-done"],
				(highlighted || status === "in_progress") && styles["-active"],
			)}
			title={timestampTooltip}
		>
			<div className={styles.main}>
				<span className={styles.mark} aria-hidden="true">
					{mark}
				</span>
				<span className={styles.label}>{label}</span>
			</div>
			<div className={styles.meta}>
				{duration && <span className={styles.duration}>{duration}</span>}
				{status === "in_progress" && <StatusBadge label="In Progress" tone="warning" />}
			</div>
		</div>
	);
}
