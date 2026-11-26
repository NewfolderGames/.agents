import { type SubmitEvent, useRef, useState } from "react";
import { type QuestionAnswerValue, type QuestionSetRecord, resolveQuestionPolicy, type WidgetDisplayMode } from "@/shared/contracts.js";
import { formatAnswerValue, formatQuestionReply } from "@/shared/format.js";
import { useFormAriaSync } from "@/ui/hooks/useFormAriaSync.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { CopyButton } from "@/ui/primitives/CopyButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { QuestionField } from "@/ui/primitives/QuestionField.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { useDisplayMode } from "./useDisplayMode.js";
import shellStyles from "./WidgetShell.module.css";
import styles from "./QuestionsWidget.module.css";

export interface QuestionsWidgetProps {
	questionSet?: QuestionSetRecord;
	rootDir?: string;
	defaultDisplayMode: WidgetDisplayMode;
	isBusy?: boolean;
	canSendMessage?: boolean;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
	onSaveDraft: (
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => void;
	onSubmit: (
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => Promise<{ ok: boolean; sentToChat: boolean; replyText?: string }>;
}

/** Inline widget rendering an interactive question set with minimized/compact/full modes. */
export function QuestionsWidget({
	questionSet,
	rootDir,
	defaultDisplayMode,
	isBusy = false,
	canSendMessage = false,
	onOpenFile,
	onSaveDraft,
	onSubmit,
}: QuestionsWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);
	const formRef = useRef<HTMLFormElement>(null);
	const [answers, setAnswers] = useState<Record<string, QuestionAnswerValue>>(
		() => ({ ...(questionSet?.answers ?? {}) }),
	);
	const [otherTexts, setOtherTexts] = useState<Record<string, string>>(
		() => ({ ...(questionSet?.otherTexts ?? {}) }),
	);
	const [notice, setNotice] = useState<string | null>(null);

	useFormAriaSync(formRef, Boolean(questionSet && questionSet.status !== "submitted"));

	if (!questionSet) {
		return <EmptyState title="Question set unavailable." />;
	}

	const answeredSet = new Set(questionSet.answeredQuestionIds);
	const openCount = questionSet.questions.filter(q => !answeredSet.has(q.id)).length;

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>{questionSet.title}</span>
				<div className={shellStyles.minmeta}>
					<StatusBadge
						label={questionSet.status === "submitted" ? "Submitted" : `${openCount} open`}
						tone={questionSet.status === "submitted" ? "success" : "warning"}
					/>
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						Expand
					</ActionButton>
				</div>
			</div>
		);
	}

	if (questionSet.status === "submitted") {
		const reply = formatQuestionReply(questionSet, questionSet.answers, questionSet.otherTexts);
		return (
			<SectionCard
				title={questionSet.title}
				actions={(
					<>
						<StatusBadge label="Submitted" tone="success" />
						<CopyButton text={reply} label="Copy Summary" />
						<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
							Minimize
						</ActionButton>
					</>
				)}
			>
				<div className={styles["questions-widget"]}>
					<ul className={styles.answers}>
						{questionSet.questions.map(q => (
							<li key={q.id} className={styles.row}>
								<strong>{q.prompt}</strong>
								<span className={styles.answer}>
									{formatAnswerValue(q, questionSet.answers[q.id], questionSet.otherTexts[q.id])}
								</span>
							</li>
						))}
					</ul>
				</div>
			</SectionCard>
		);
	}

	const handleAnswerChange = (qId: string, val: QuestionAnswerValue) => {
		const next = { ...answers, [qId]: val };
		setAnswers(next);
		onSaveDraft(questionSet.id, next, otherTexts);
	};

	const handleOtherChange = (qId: string, text: string) => {
		const next = { ...otherTexts, [qId]: text };
		setOtherTexts(next);
		onSaveDraft(questionSet.id, answers, next);
	};

	const handleFormSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault();
		const res = await onSubmit(questionSet.id, answers, otherTexts);
		if (res.ok) {
			setNotice(
				res.sentToChat
					? "Submitted and sent to chat."
					: "Answers saved to SQLite.",
			);
		}
	};

	const openQuestions = questionSet.questions.filter(q => !answeredSet.has(q.id));

	return (
		<SectionCard
			title={questionSet.title}
			actions={(
				<>
					<StatusBadge label={`${openCount} open`} tone="warning" />
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						Minimize
					</ActionButton>
				</>
			)}
		>
			<div className={styles["questions-widget"]}>
				{questionSet.description && (
					<p className={styles.description}>{questionSet.description}</p>
				)}
				<form
					ref={formRef}
					className={styles.form}
					onSubmit={e => void handleFormSubmit(e)}
				>
					{openQuestions.map((q) => {
						const policy = resolveQuestionPolicy(questionSet, q);
						return (
							<QuestionField
								key={q.id}
								question={q}
								policy={policy}
								value={answers[q.id]}
								otherText={otherTexts[q.id] ?? ""}
								rootDir={rootDir}
								disabled={isBusy}
								onChange={next => handleAnswerChange(q.id, next)}
								onOtherTextChange={text => handleOtherChange(q.id, text)}
								onOpenFile={onOpenFile}
							/>
						);
					})}
					<div className={styles.footer}>
						<ActionButton type="submit" variant="primary" disabled={isBusy}>
							{isBusy ? "Submitting..." : questionSet.submitLabel}
						</ActionButton>
						{!canSendMessage && (
							<CopyButton
								text={formatQuestionReply(questionSet, answers, otherTexts)}
								label="Copy Reply"
							/>
						)}
					</div>
				</form>
				{notice && <span className={styles.banner}>{notice}</span>}
			</div>
		</SectionCard>
	);
}
