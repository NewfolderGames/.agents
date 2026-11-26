import { type SubmitEvent, useRef, useState } from "react";
import type { SessionGroup } from "@/shared/contracts.js";
import { useFormAriaSync } from "@/ui/hooks/useFormAriaSync.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ModalDialog } from "@/ui/primitives/ModalDialog.js";
import { TextAreaInput } from "@/ui/primitives/TextAreaInput.js";
import { TextInput } from "@/ui/primitives/TextInput.js";
import styles from "./DialogForm.module.css";

export interface SessionGroupDialogProps {
	open: boolean;
	mode: "create" | "edit";
	group: SessionGroup | null;
	isBusy: boolean;
	onSave: (input: {
		groupId?: string;
		name: string;
		description?: string;
		notes?: string;
	}) => Promise<void>;
	onRequestDelete?: () => void;
	onClose: () => void;
}

/** Modal dialog for creating or editing a 1:N session group and its shared context notes. */
export function SessionGroupDialog({
	open,
	mode,
	group,
	isBusy,
	onSave,
	onRequestDelete,
	onClose,
}: SessionGroupDialogProps) {
	const formRef = useRef<HTMLFormElement>(null);
	const initial = mode === "edit" ? group : null;
	const [name, setName] = useState(initial?.name ?? "");
	const [description, setDescription] = useState(initial?.description ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");

	useFormAriaSync(formRef, open);

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!name.trim()) {
			return;
		}
		await onSave({
			groupId: initial?.id,
			name: name.trim(),
			description: description.trim() || undefined,
			notes: notes.trim() || undefined,
		});
		onClose();
	};

	return (
		<ModalDialog
			open={open}
			title={mode === "edit" ? "Edit Session Group" : "Create Session Group"}
			onClose={onClose}
		>
			<form
				ref={formRef}
				className={styles["dialog-form"]}
				onSubmit={e => void handleSubmit(e)}
			>
				<label className={styles.field}>
					<span className={styles.label}>Group Name</span>
					<TextInput
						value={name}
						required
						disabled={isBusy}
						placeholder="e.g. MCP App SQLite Rewrite"
						onChange={setName}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>Description</span>
					<TextInput
						value={description}
						disabled={isBusy}
						placeholder="Short purpose of grouped sessions"
						onChange={setDescription}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>Shared Agent Context Notes</span>
					<TextAreaInput
						value={notes}
						disabled={isBusy}
						rows={4}
						placeholder="Cross-session architecture notes or constraints..."
						onChange={setNotes}
					/>
				</label>

				<div className={`${styles.actions} ${styles["-split"]}`}>
					<div>
						{mode === "edit" && initial && onRequestDelete && (
							<ActionButton
								variant="danger"
								disabled={isBusy}
								onClick={onRequestDelete}
							>
								Delete Group
							</ActionButton>
						)}
					</div>
					<div className={styles.right}>
						<ActionButton variant="subtle" onClick={onClose}>
							Cancel
						</ActionButton>
						<ActionButton
							type="submit"
							variant="primary"
							disabled={isBusy || !name.trim()}
						>
							Save Group
						</ActionButton>
					</div>
				</div>
			</form>
		</ModalDialog>
	);
}
