import { cx } from "@/shared/format.js";
import type { TaskItemStatus } from "@/shared/schema.js";
import styles from "./ChecklistItem.module.css";

export interface ChecklistItemProps {
	label: string;
	status: TaskItemStatus;
	highlighted?: boolean;
	duration?: string | null;
	timestampTooltip?: string;
}

function statusMarker(status: TaskItemStatus): { symbol: string; label: string } {
	switch (status) {
		case "done":
			return { symbol: "[x]", label: "Completed" };
		case "in_progress":
			return { symbol: "[~]", label: "In progress" };
		case "pending":
			return { symbol: "[ ]", label: "Pending" };
	}
}

export function ChecklistItem({
	label,
	status,
	highlighted = false,
	duration,
	timestampTooltip,
}: ChecklistItemProps) {
	const marker = statusMarker(status);
	return (
		<div
			className={cx(
				styles["checklist-item"],
				status === "done" && styles["-done"],
				status === "in_progress" && styles["-active"],
				highlighted && styles["-highlighted"],
			)}
		>
			<code className={styles.marker} aria-label={marker.label}>
				{marker.symbol}
			</code>
			<span className={styles.text}>
				{status === "in_progress" && (
					<strong className={styles.tag}>(in progress) </strong>
				)}
				{label}
			</span>
			{duration && (
				<span className={styles.meta} title={timestampTooltip}>
					{duration}
				</span>
			)}
		</div>
	);
}
