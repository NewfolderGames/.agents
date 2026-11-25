import type { ReactNode } from "react";
import styles from "./SectionBlock.module.css";

export interface SectionBlockProps {
	title: string;
	actions?: ReactNode;
	children: ReactNode;
}

export function SectionBlock({ title, actions, children }: SectionBlockProps) {
	return (
		<section className={styles["section-block"]}>
			<div className={styles.header}>
				<h3 className={styles.title}>{title}</h3>
				{actions && <div className={styles.actions}>{actions}</div>}
			</div>
			<div className={styles.body}>{children}</div>
		</section>
	);
}
