import { type SubmitEvent, useRef, useState } from "react";
import type { SessionGroupSummary, SessionRecord } from "@/shared/contracts.js";
import { useFormAriaSync } from "@/ui/hooks/useFormAriaSync.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ModalDialog } from "@/ui/primitives/ModalDialog.js";
import { TextInput } from "@/ui/primitives/TextInput.js";
import styles from "./DialogForm.module.css";

export interface SessionMetaDialogProps {
	open: boolean;
	session: SessionRecord | null;
	groups: SessionGroupSummary[];
	isBusy: boolean;
	onSave: (input: {
		sessionId: string;
		title?: string;
		rootDir?: string;
		groupId: string | null;
	}) => Promise<void>;
	onClose: () => void;
}

/** Modal dialog for editing a session's title, workspace `rootDir`, and 1:N group assignment. */
export function SessionMetaDialog({
	open,
	session,
	groups,
	isBusy,
	onSave,
	onClose,
}: SessionMetaDialogProps) {
	const formRef = useRef<HTMLFormElement>(null);
	const [title, setTitle] = useState(session?.title ?? "");
	const [rootDir, setRootDir] = useState(session?.rootDir ?? "");
	const [groupId, setGroupId] = useState<string>(session?.groupId ?? "");

	useFormAriaSync(formRef, open);

	if (!session) {
		return null;
	}

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		await onSave({
			sessionId: session.sessionId,
			title: title.trim(),
			rootDir: rootDir.trim(),
			groupId: groupId ? groupId : null,
		});
		onClose();
	};

	return (
		<ModalDialog open={open} title={`Edit Session (${session.sessionId})`} onClose={onClose}>
			<form
				ref={formRef}
				className={styles["dialog-form"]}
				onSubmit={e => void handleSubmit(e)}
			>
				<label className={styles.field}>
					<span className={styles.label}>Session Title</span>
					<TextInput
						value={title}
						disabled={isBusy}
						placeholder="Human-readable session label"
						onChange={setTitle}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>Root Directory (Absolute Path)</span>
					<TextInput
						value={rootDir}
						disabled={isBusy}
						placeholder="/home/user/projects/my-repo"
						onChange={setRootDir}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>Session Group (1:N)</span>
					<select
						className={styles.select}
						value={groupId}
						disabled={isBusy}
						onChange={e => setGroupId(e.target.value)}
					>
						<option value="">Ungrouped</option>
						{groups.map(g => (
							<option key={g.id} value={g.id}>
								{g.name}
							</option>
						))}
					</select>
				</label>

				<div className={styles.actions}>
					<ActionButton variant="subtle" onClick={onClose}>
						Cancel
					</ActionButton>
					<ActionButton type="submit" variant="primary" disabled={isBusy}>
						Save Session
					</ActionButton>
				</div>
			</form>
		</ModalDialog>
	);
}
