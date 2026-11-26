import { cx } from "@/shared/format.js";
import styles from "./StatusBadge.module.css";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusBadgeProps {
	label: string;
	tone?: BadgeTone;
	title?: string;
}

/** Compact semantic pill displaying status text with color-contrast tone variants. */
export function StatusBadge({ label, tone = "neutral", title }: StatusBadgeProps) {
	return (
		<span
			title={title}
			className={cx(
				styles["status-badge"],
				tone !== "neutral" && styles[`-${tone}`],
			)}
		>
			{label}
		</span>
	);
}
