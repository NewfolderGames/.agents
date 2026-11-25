import { cx } from "@/shared/format.js";
import styles from "./StatusBadge.module.css";

export interface StatusBadgeProps {
	label: string;
	tone?: "neutral" | "success" | "warning" | "danger";
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
	return (
		<span
			className={cx(
				styles["status-badge"],
				tone !== "neutral" && styles[`-${tone}`],
			)}
		>
			{label}
		</span>
	);
}
