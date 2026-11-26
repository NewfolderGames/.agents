import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ModalDialog } from "@/ui/primitives/ModalDialog.js";
import styles from "./ConfirmDialog.module.css";

export interface ConfirmDialogProps {
	open: boolean;
	title: string;
	message: string;
	confirmLabel: string;
	isBusy?: boolean;
	onConfirm: () => Promise<void>;
	onClose: () => void;
}

/** Modal confirmation dialog guarding destructive workspace actions without light-dismiss. */
export function ConfirmDialog({
	open,
	title,
	message,
	confirmLabel,
	isBusy = false,
	onConfirm,
	onClose,
}: ConfirmDialogProps) {
	return (
		<ModalDialog open={open} title={title} allowLightDismiss={false} onClose={onClose}>
			<div className={styles["confirm-dialog"]}>
				<p className={styles.message}>{message}</p>
				<div className={styles.actions}>
					<ActionButton
						variant="danger"
						disabled={isBusy}
						onClick={() => {
							void onConfirm().then(onClose);
						}}
					>
						{confirmLabel}
					</ActionButton>
					<ActionButton variant="subtle" autoFocus onClick={onClose}>
						Cancel
					</ActionButton>
				</div>
			</div>
		</ModalDialog>
	);
}
