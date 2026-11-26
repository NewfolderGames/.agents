import type { ReactNode } from "react";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
	title: string;
	detail?: string;
	actions?: ReactNode;
}

/** Centered placeholder card shown when a panel or widget has no active data. */
export function EmptyState({ title, detail, actions }: EmptyStateProps) {
	return (
		<div className={styles["empty-state"]}>
			<p className={styles.title}>{title}</p>
			{detail && <p className={styles.detail}>{detail}</p>}
			{actions && <div className={styles.actions}>{actions}</div>}
		</div>
	);
}
