import type { ReactNode } from "react";
import type { WidgetDisplayMode } from "@/shared/contracts.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import styles from "./WidgetShell.module.css";

export interface WidgetShellProps {
	sessionId?: string;
	sessionTitle?: string;
	displayMode: WidgetDisplayMode;
	errorMessage: string | null;
	onDismissError: () => void;
	children: ReactNode;
}

/** Shared chrome wrapper for inline widgets, showing session context and dismissible errors. */
export function WidgetShell({
	sessionId,
	sessionTitle,
	displayMode,
	errorMessage,
	onDismissError,
	children,
}: WidgetShellProps) {
	return (
		<main className={styles["widget-shell"]}>
			{displayMode !== "minimized" && sessionId && (
				<div className={styles.bar}>
					<span>
						{sessionTitle ? `${sessionTitle} · ` : ""}
						<code>{sessionId}</code>
					</span>
				</div>
			)}

			{errorMessage && (
				<div className={styles.error} role="alert">
					<span>{errorMessage}</span>
					<ActionButton variant="subtle" size="compact" onClick={onDismissError}>
						Dismiss
					</ActionButton>
				</div>
			)}

			<div className={styles.body}>{children}</div>
		</main>
	);
}
