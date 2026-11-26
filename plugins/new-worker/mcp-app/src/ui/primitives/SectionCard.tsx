import type { ReactNode } from "react";
import { cx } from "@/shared/format.js";
import styles from "./SectionCard.module.css";

export interface SectionCardProps {
	title: string;
	actions?: ReactNode;
	children: ReactNode;
	className?: string;
}

/** Card container primitive with a title header, optional action slot, and bordered body. */
export function SectionCard({ title, actions, children, className }: SectionCardProps) {
	return (
		<section className={cx(styles["section-card"], className)}>
			<header className={styles.header}>
				<h2 className={styles.title}>{title}</h2>
				{actions && <div className={styles.actions}>{actions}</div>}
			</header>
			<div className={styles.body}>{children}</div>
		</section>
	);
}
