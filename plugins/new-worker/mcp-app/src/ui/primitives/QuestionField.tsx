import type { QuestionAnswerValue, QuestionItem, ResolvedQuestionPolicy } from "@/shared/contracts.js";
import { formatBlockingModeLabel } from "@/shared/format.js";
import { ActionButton } from "./ActionButton.js";
import { ChoiceGroup } from "./ChoiceGroup.js";
import { FileLink } from "./FileLink.js";
import { StatusBadge } from "./StatusBadge.js";
import { TextAreaInput } from "./TextAreaInput.js";
import { TextInput } from "./TextInput.js";
import styles from "./QuestionField.module.css";

/** Props accepted by {@link QuestionField}. */
export interface QuestionFieldProps {
	question: QuestionItem;
	policy: ResolvedQuestionPolicy;
	value: QuestionAnswerValue | undefined;
	otherText: string;
	rootDir?: string;
	disabled: boolean;
	onChange: (value: QuestionAnswerValue) => void;
	onOtherTextChange: (text: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/**
 * Render an interactive prompt control (choice, text, textarea, or boolean) with
 * blocking-policy badge, optional rationale hint, and context file links.
 */
export function QuestionField({
	question,
	policy,
	value,
	otherText,
	rootDir,
	disabled,
	onChange,
	onOtherTextChange,
	onOpenFile,
}: QuestionFieldProps) {
	const choiceValue = typeof value === "string" || Array.isArray(value) ? value : undefined;

	return (
		<div className={styles["question-field"]}>
			<div className={styles.head}>
				<strong>{question.prompt}</strong>
				<StatusBadge
					label={formatBlockingModeLabel(policy.blockingMode, policy.taskId, policy.stepNumber)}
					tone={policy.blockingMode === "immediate" ? "danger" : "neutral"}
				/>
			</div>
			{question.hint && <p className={styles.hint}>{question.hint}</p>}
			{question.contextRefs.length > 0 && (
				<div className={styles.refs}>
					{question.contextRefs.map((ref, idx) => (
						<FileLink
							key={`${ref.path}-${idx}`}
							path={ref.path}
							lineStart={ref.lineStart}
							lineEnd={ref.lineEnd}
							label={ref.label}
							rootDir={rootDir}
							onOpenFile={onOpenFile}
						/>
					))}
				</div>
			)}
			{(question.kind === "single_select" || question.kind === "multi_select") && (
				<ChoiceGroup
					mode={question.kind === "single_select" ? "single" : "multi"}
					options={question.options ?? []}
					value={choiceValue}
					allowOther={question.allowOther}
					otherText={otherText}
					required={question.required}
					disabled={disabled}
					onChange={onChange}
					onOtherTextChange={onOtherTextChange}
				/>
			)}
			{question.kind === "text" && (
				<TextInput
					value={typeof value === "string" ? value : ""}
					placeholder={question.placeholder}
					required={question.required}
					disabled={disabled}
					onChange={onChange}
				/>
			)}
			{question.kind === "textarea" && (
				<TextAreaInput
					value={typeof value === "string" ? value : ""}
					placeholder={question.placeholder}
					required={question.required}
					disabled={disabled}
					onChange={onChange}
				/>
			)}
			{question.kind === "boolean" && (
				<div className={styles.booleans}>
					<ActionButton
						variant="subtle"
						active={value === true}
						disabled={disabled}
						onClick={() => onChange(true)}
					>
						Yes
					</ActionButton>
					<ActionButton
						variant="subtle"
						active={value === false}
						disabled={disabled}
						onClick={() => onChange(false)}
					>
						No
					</ActionButton>
				</div>
			)}
		</div>
	);
}
