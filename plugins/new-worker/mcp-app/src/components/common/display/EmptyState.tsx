import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
	title: string;
	detail?: string;
}

export function EmptyState({ title, detail }: EmptyStateProps) {
	return (
		<div className={styles["empty-state"]}>
			<p className={styles.title}>{title}</p>
			{detail && <p className={styles.detail}>{detail}</p>}
		</div>
	);
}
