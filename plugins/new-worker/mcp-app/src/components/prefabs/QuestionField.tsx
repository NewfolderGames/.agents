import { FileLink } from "@/components/common/display/FileLink.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { ChoiceGroup } from "@/components/common/inputs/ChoiceGroup.js";
import { TextAreaInput } from "@/components/common/inputs/TextAreaInput.js";
import { TextInput } from "@/components/common/inputs/TextInput.js";
import { policyTone } from "@/components/views/QuestionsView.util.js";
import { formatAnswerValue, formatBlockingModeLabel } from "@/shared/format.js";
import type { QuestionAnswerValue, QuestionItem, ResolvedQuestionPolicy } from "@/shared/schema.js";
import styles from "./QuestionField.module.css";

export interface QuestionFieldProps {
	question: QuestionItem;
	policy?: ResolvedQuestionPolicy;
	alreadyAnswered?: boolean;
	value: QuestionAnswerValue | undefined;
	otherText: string;
	disabled?: boolean;
	forceInvalid?: boolean;
	workspacePath?: string;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
	onChange: (value: QuestionAnswerValue) => void;
	onOtherTextChange: (text: string) => void;
}

export function QuestionField({
	question,
	policy,
	alreadyAnswered = false,
	value,
	otherText,
	disabled = false,
	forceInvalid = false,
	workspacePath,
	onOpenFile,
	onChange,
	onOtherTextChange,
}: QuestionFieldProps) {
	const renderControl = () => {
		if (alreadyAnswered) {
			return (
				<div className={styles.answered}>
					<strong className={styles.prompt}>{question.prompt}</strong>
					<span className={styles.value}>
						{formatAnswerValue(question, value, otherText)}
					</span>
				</div>
			);
		}

		if (question.kind === "single_select" || question.kind === "multi_select") {
			const mode = question.kind === "single_select" ? "single" : "multi";
			const normalizedValue
				= mode === "multi"
					? Array.isArray(value)
						? value
						: []
					: typeof value === "string"
						? value
						: "";
			return (
				<ChoiceGroup
					legend={question.prompt}
					mode={mode}
					options={question.options ?? []}
					value={normalizedValue}
					allowOther={question.allowOther}
					otherText={otherText}
					hint={question.hint}
					required={question.required}
					disabled={disabled}
					onChange={next => onChange(next)}
					onOtherTextChange={onOtherTextChange}
				/>
			);
		}

		if (question.kind === "boolean") {
			const boolAsString = typeof value === "boolean" ? String(value) : "";
			return (
				<ChoiceGroup
					legend={question.prompt}
					mode="single"
					options={[
						{ value: "true", label: "Yes" },
						{ value: "false", label: "No" },
					]}
					value={boolAsString}
					hint={question.hint}
					required={question.required}
					disabled={disabled}
					onChange={next => onChange(next === "true")}
				/>
			);
		}

		if (question.kind === "textarea") {
			return (
				<TextAreaInput
					label={question.prompt}
					value={typeof value === "string" ? value : ""}
					hint={question.hint}
					placeholder={question.placeholder}
					required={question.required}
					disabled={disabled}
					forceInvalid={forceInvalid}
					onChange={next => onChange(next)}
				/>
			);
		}

		return (
			<TextInput
				label={question.prompt}
				value={typeof value === "string" ? value : ""}
				hint={question.hint}
				placeholder={question.placeholder}
				required={question.required}
				disabled={disabled}
				forceInvalid={forceInvalid}
				onChange={next => onChange(next)}
			/>
		);
	};

	const effectivePolicy = policy ?? {
		blockingMode: question.blockingMode ?? "immediate",
		taskNumber: question.taskNumber,
		stepNumber: question.stepNumber,
	};

	return (
		<div className={styles["question-field"]}>
			<div className={styles.badges}>
				<StatusBadge
					label={formatBlockingModeLabel(
						effectivePolicy.blockingMode,
						effectivePolicy.taskNumber,
						effectivePolicy.stepNumber,
					)}
					tone={policyTone(effectivePolicy.blockingMode)}
				/>
				{alreadyAnswered && <StatusBadge label="Answered" tone="success" />}
			</div>
			{question.contextRefs.length > 0 && (
				<div className={styles.refs}>
					<span className={styles.reflabel}>Refs:</span>
					{question.contextRefs.map((ref, idx) => (
						<FileLink
							key={`${ref.path}-${idx}`}
							path={ref.path}
							lineStart={ref.lineStart}
							lineEnd={ref.lineEnd}
							label={ref.label}
							workspacePath={workspacePath}
							onOpenFile={onOpenFile}
						/>
					))}
				</div>
			)}
			{renderControl()}
		</div>
	);
}
