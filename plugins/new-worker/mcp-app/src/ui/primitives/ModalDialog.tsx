import { type ReactNode, useId, useRef } from "react";
import { useDialog } from "@/ui/hooks/useDialog.js";
import { ActionButton } from "./ActionButton.js";
import styles from "./ModalDialog.module.css";

export interface ModalDialogProps {
	open: boolean;
	title: string;
	allowLightDismiss?: boolean;
	onClose: (returnValue: string) => void;
	children: ReactNode;
}

/** Accessible native top-layer `<dialog>` wrapper with optional light-dismiss fallback. */
export function ModalDialog({
	open,
	title,
	allowLightDismiss = true,
	onClose,
	children,
}: ModalDialogProps) {
	const dialogRef = useRef<HTMLDialogElement>(null);
	const titleId = useId();

	useDialog({
		dialogRef,
		open,
		allowLightDismiss,
		onClose,
	});

	return (
		<dialog
			ref={dialogRef}
			className={styles["modal-dialog"]}
			aria-labelledby={titleId}
			{...({ closedby: allowLightDismiss ? "any" : "closerequest" } as Record<string, string>)}
		>
			<div className={styles.header}>
				<h1 id={titleId} className={styles.title}>
					{title}
				</h1>
				<ActionButton
					variant="subtle"
					size="compact"
					onClick={() => dialogRef.current?.close("cancel")}
				>
					Close
				</ActionButton>
			</div>
			<div className={styles.body}>{children}</div>
		</dialog>
	);
}
