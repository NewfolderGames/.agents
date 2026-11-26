import { type SubmitEvent, useRef, useState } from "react";
import type { TaskRecord, TimelineEntityType } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import { useFormAriaSync } from "@/ui/hooks/useFormAriaSync.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ModalDialog } from "@/ui/primitives/ModalDialog.js";
import { TextAreaInput } from "@/ui/primitives/TextAreaInput.js";
import { TextInput } from "@/ui/primitives/TextInput.js";
import styles from "./DialogForm.module.css";

export interface TimelineNoteDialogProps {
	open: boolean;
	sessionId: string | null;
	groupId: string | null;
	tasks: TaskRecord[];
	isBusy: boolean;
	onSave: (input: {
		title: string;
		summary?: string;
		links: Array<{
			entityType: TimelineEntityType;
			entityId: string;
			role: "related";
			label?: string;
		}>;
	}) => Promise<void>;
	onClose: () => void;
}

/** Modal dialog for appending a user note to the timeline with optional polymorphic task links. */
export function TimelineNoteDialog({
	open,
	tasks,
	isBusy,
	onSave,
	onClose,
}: TimelineNoteDialogProps) {
	const formRef = useRef<HTMLFormElement>(null);
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [linkedTaskId, setLinkedTaskId] = useState("");

	useFormAriaSync(formRef, open);

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!title.trim()) {
			return;
		}
		const links: Array<{
			entityType: TimelineEntityType;
			entityId: string;
			role: "related";
			label?: string;
		}> = [];
		if (linkedTaskId) {
			links.push({
				entityType: "task",
				entityId: linkedTaskId,
				role: "related",
				label: `Task #${linkedTaskId}`,
			});
		}
		await onSave({
			title: title.trim(),
			summary: summary.trim() || undefined,
			links,
		});
		onClose();
	};

	return (
		<ModalDialog open={open} title="Add Timeline Note" onClose={onClose}>
			<form
				ref={formRef}
				className={styles["dialog-form"]}
				onSubmit={e => void handleSubmit(e)}
			>
				<label className={styles.field}>
					<span className={styles.label}>Title</span>
					<TextInput
						value={title}
						required
						disabled={isBusy}
						placeholder="Milestone or review note"
						onChange={setTitle}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>Summary</span>
					<TextAreaInput
						value={summary}
						disabled={isBusy}
						rows={3}
						placeholder="Details recorded into polymorphic timeline..."
						onChange={setSummary}
					/>
				</label>

				{tasks.length > 0 && (
					<label className={styles.field}>
						<span className={styles.label}>Link to Global Task (optional)</span>
						<select
							className={styles.select}
							value={linkedTaskId}
							disabled={isBusy}
							onChange={e => setLinkedTaskId(e.target.value)}
						>
							<option value="">No linked task</option>
							{tasks.map(t => (
								<option key={t.taskId} value={String(t.taskId)}>
									{`${formatTaskId(t.taskId)} - ${t.title}`}
								</option>
							))}
						</select>
					</label>
				)}

				<div className={styles.actions}>
					<ActionButton variant="subtle" onClick={onClose}>
						Cancel
					</ActionButton>
					<ActionButton
						type="submit"
						variant="primary"
						disabled={isBusy || !title.trim()}
					>
						Add Note
					</ActionButton>
				</div>
			</form>
		</ModalDialog>
	);
}
