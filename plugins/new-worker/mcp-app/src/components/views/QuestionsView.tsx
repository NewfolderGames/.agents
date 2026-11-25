import { type FormEvent, useRef, useState } from "react";
import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { CopyButton } from "@/components/common/buttons/CopyButton.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { SectionBlock } from "@/components/common/display/SectionBlock.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { QuestionField } from "@/components/prefabs/QuestionField.js";
import { QuestionSummaryCard } from "@/components/prefabs/QuestionSummaryCard.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { useFormAriaSync } from "@/hooks/useFormAriaSync.js";
import type { SubmitQuestionClientOptions } from "@/hooks/useWorkspaceState.js";
import { formatQuestionReply } from "@/shared/format.js";
import { type QuestionAnswerValue, type QuestionItem, type QuestionSetRecord, resolveQuestionPolicy, type WidgetDisplayMode } from "@/shared/schema.js";
import { getHighestPolicyBadge, groupQuestionsBySection, isQuestionAnswered, sortOpenQuestionSets, validateQuestionsSubset } from "./QuestionsView.util.js";
import styles from "./QuestionsView.module.css";

export interface QuestionsViewProps {
	questionSets: QuestionSetRecord[];
	activeQuestionSetId?: string;
	allowSetSwitch?: boolean;
	workspacePath?: string;
	defaultDisplayMode?: WidgetDisplayMode;
	isBusy?: boolean;
	canSendMessage?: boolean;
	onSelectQuestionSet?: (questionSetId: string) => void;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
	onSaveDraft: (
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => void;
	onSubmit: (
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
		options?: SubmitQuestionClientOptions,
	) => Promise<{ ok: boolean; sentToChat: boolean; replyText?: string; error?: string }>;
}

interface PendingQuestionFormProps {
	questionSet: QuestionSetRecord;
	workspacePath?: string;
	defaultDisplayMode: WidgetDisplayMode;
	isBusy: boolean;
	canSendMessage: boolean;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
	onSaveDraft: QuestionsViewProps["onSaveDraft"];
	onSubmit: QuestionsViewProps["onSubmit"];
}

function PendingQuestionForm({
	questionSet,
	workspacePath,
	defaultDisplayMode,
	isBusy,
	canSendMessage,
	onOpenFile,
	onSaveDraft,
	onSubmit,
}: PendingQuestionFormProps) {
	const formRef = useRef<HTMLFormElement | null>(null);
	const [answers, setAnswers] = useState<Record<string, QuestionAnswerValue>>(
		questionSet.answers,
	);
	const [otherTexts, setOtherTexts] = useState<Record<string, string>>(
		questionSet.otherTexts,
	);
	const [invalidIds, setInvalidIds] = useState<string[]>([]);
	const [submitNote, setSubmitNote] = useState<string | null>(null);
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	useFormAriaSync(formRef, displayMode === "full");

	const answeredSet = new Set(questionSet.answeredQuestionIds);
	const openQuestions = questionSet.questions.filter(q => !answeredSet.has(q.id));
	const immediateQuestions = openQuestions.filter(
		q => resolveQuestionPolicy(questionSet, q).blockingMode === "immediate",
	);
	const stepQuestions = openQuestions.filter(
		q => resolveQuestionPolicy(questionSet, q).blockingMode === "before_step_finish",
	);
	const anytimeQuestions = openQuestions.filter(
		q => resolveQuestionPolicy(questionSet, q).blockingMode === "anytime",
	);
	const filledOpenQuestions = openQuestions.filter(q =>
		isQuestionAnswered(q, answers[q.id], otherTexts[q.id]));

	const groups = groupQuestionsBySection(questionSet);
	const highestBadge = getHighestPolicyBadge(questionSet);
	const previewReply = formatQuestionReply(questionSet, answers, otherTexts);

	const handleAnswerChange = (questionId: string, nextValue: QuestionAnswerValue) => {
		const nextAnswers = { ...answers, [questionId]: nextValue };
		setAnswers(nextAnswers);
		setInvalidIds(prev => prev.filter(id => id !== questionId));
		onSaveDraft(questionSet.id, nextAnswers, otherTexts);
	};

	const handleOtherTextChange = (questionId: string, nextText: string) => {
		const nextOthers = { ...otherTexts, [questionId]: nextText };
		setOtherTexts(nextOthers);
		setInvalidIds(prev => prev.filter(id => id !== questionId));
		onSaveDraft(questionSet.id, answers, nextOthers);
	};

	const submitSubset = async (
		scope: SubmitQuestionClientOptions["scope"],
		targetQuestions: QuestionItem[],
	) => {
		const missing = validateQuestionsSubset(targetQuestions, answers, otherTexts);
		if (missing.length > 0) {
			setInvalidIds(missing);
			const firstMissingId = missing[0];
			if (firstMissingId && formRef.current) {
				const container = formRef.current.querySelector<HTMLElement>(
					`[data-question-id="${firstMissingId}"] input, [data-question-id="${firstMissingId}"] textarea`,
				);
				container?.focus();
			}
			return;
		}
		setInvalidIds([]);
		const res = await onSubmit(questionSet.id, answers, otherTexts, { scope });
		if (res.ok) {
			setSubmitNote(
				res.sentToChat
					? "Answers saved and sent to chat."
					: "Answers saved. Copy the summary below to share in chat.",
			);
		}
		else if (res.error) {
			setSubmitNote(res.error);
		}
	};

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		await submitSubset("all", openQuestions);
	};

	const hasDeferredSplit
		= (immediateQuestions.length > 0 && (stepQuestions.length > 0 || anytimeQuestions.length > 0))
			|| (stepQuestions.length > 0 && anytimeQuestions.length > 0);

	if (displayMode === "minimized") {
		return (
			<form
				ref={formRef}
				className={styles.form}
				noValidate
				onSubmit={e => void handleSubmit(e)}
			>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>{questionSet.title}</span>
					<div className={styles.minmeta}>
						<StatusBadge label={highestBadge.label} tone={highestBadge.tone} />
						<StatusBadge
							label={questionSet.status === "partial" ? "partial" : "pending"}
							tone="warning"
						/>
						<ActionButton type="button" variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</form>
		);
	}

	const isCompact = displayMode === "compact";

	return (
		<form ref={formRef} className={styles.form} noValidate onSubmit={e => void handleSubmit(e)}>
			<div className={styles.header}>
				<div className={styles.title}>
					<h2 className={styles.heading}>{questionSet.title}</h2>
					<div className={styles.badges}>
						<StatusBadge label={highestBadge.label} tone={highestBadge.tone} />
						<StatusBadge
							label={questionSet.status === "partial" ? "partial" : "pending"}
							tone="warning"
						/>
						<ActionButton type="button" variant="subtle" onClick={toggleExpand}>
							{isCompact ? "Expand" : "Minimize"}
						</ActionButton>
					</div>
				</div>
				{!isCompact && questionSet.description && (
					<MarkdownText content={questionSet.description} />
				)}
			</div>

			{isCompact
				? (
						<p className={styles.minimized}>
							{`${immediateQuestions.length} immediate · ${stepQuestions.length} step-deferred · ${anytimeQuestions.length} anytime open. Click Expand to answer.`}
						</p>
					)
				: (
						<>
							{groups.map((group, idx) => {
								const body = (
									<div className={styles.fields}>
										{group.questions.map(q => (
											<div key={q.id} data-question-id={q.id}>
												<QuestionField
													question={q}
													policy={resolveQuestionPolicy(questionSet, q)}
													alreadyAnswered={answeredSet.has(q.id)}
													value={answers[q.id]}
													otherText={otherTexts[q.id] ?? ""}
													disabled={isBusy}
													forceInvalid={invalidIds.includes(q.id)}
													workspacePath={workspacePath}
													onOpenFile={onOpenFile}
													onChange={nextVal => handleAnswerChange(q.id, nextVal)}
													onOtherTextChange={text => handleOtherTextChange(q.id, text)}
												/>
											</div>
										))}
									</div>
								);

								if (group.section) {
									return (
										<SectionBlock
											key={group.section.id}
											title={group.section.title}
										>
											{group.section.description && (
												<MarkdownText content={group.section.description} />
											)}
											{body}
										</SectionBlock>
									);
								}

								return (
									<div key={`ungrouped-${idx}`} className={styles.ungrouped}>
										{body}
									</div>
								);
							})}

							{invalidIds.length > 0 && (
								<div className={styles.errorsummary} role="alert">
									Complete required fields before submitting:
									{" "}
									{invalidIds.join(", ")}
									.
								</div>
							)}

							{submitNote && <p className={styles.note}>{submitNote}</p>}

							<div className={styles.footer}>
								<ActionButton type="submit" variant="primary" disabled={isBusy}>
									{isBusy
										? "Submitting..."
										: hasDeferredSplit || questionSet.status === "partial"
											? "Submit All Remaining"
											: questionSet.submitLabel}
								</ActionButton>
								{immediateQuestions.length > 0
									&& (stepQuestions.length > 0 || anytimeQuestions.length > 0) && (
									<ActionButton
										type="button"
										variant="subtle"
										disabled={isBusy}
										onClick={() => void submitSubset("immediate", immediateQuestions)}
									>
										Submit Immediate Only (
										{immediateQuestions.length}
										)
									</ActionButton>
								)}
								{immediateQuestions.length === 0
									&& stepQuestions.length > 0
									&& anytimeQuestions.length > 0 && (
									<ActionButton
										type="button"
										variant="subtle"
										disabled={isBusy}
										onClick={() => void submitSubset("before_step_finish", stepQuestions)}
									>
										Submit Step Questions (
										{stepQuestions.length}
										)
									</ActionButton>
								)}
								{immediateQuestions.length === 0
									&& stepQuestions.length === 0
									&& filledOpenQuestions.length > 0
									&& filledOpenQuestions.length < openQuestions.length && (
									<ActionButton
										type="button"
										variant="subtle"
										disabled={isBusy}
										onClick={() => void submitSubset("answered", filledOpenQuestions)}
									>
										Submit Answered (
										{filledOpenQuestions.length}
										)
									</ActionButton>
								)}
								{!canSendMessage
									&& <CopyButton text={previewReply} label="Copy Answers" />}
							</div>
						</>
					)}
		</form>
	);
}

export function QuestionsView({
	questionSets,
	activeQuestionSetId,
	allowSetSwitch = true,
	workspacePath,
	defaultDisplayMode = "full",
	isBusy = false,
	canSendMessage = false,
	onSelectQuestionSet,
	onOpenFile,
	onSaveDraft,
	onSubmit,
}: QuestionsViewProps) {
	if (questionSets.length === 0) {
		return (
			<EmptyState
				title="No question sets yet."
				detail="Question rounds created via ask_questions render here for immediate, deferred, or anytime answering."
			/>
		);
	}

	const openSets = sortOpenQuestionSets(
		questionSets.filter(q => q.status === "pending" || q.status === "partial"),
	);
	const submitted = questionSets.filter(q => q.status === "submitted");
	const activePending
		= openSets.find(q => q.id === activeQuestionSetId) ?? openSets[0];

	return (
		<div className={styles["questions-view"]}>
			{allowSetSwitch && openSets.length > 1 && activePending && (
				<div className={styles.selector}>
					{openSets.map((qs) => {
						const badge = getHighestPolicyBadge(qs);
						return (
							<ActionButton
								key={qs.id}
								variant="subtle"
								active={qs.id === activePending.id}
								onClick={() => onSelectQuestionSet?.(qs.id)}
							>
								{qs.title}
								{" · "}
								{badge.label}
							</ActionButton>
						);
					})}
				</div>
			)}

			{activePending && (
				<PendingQuestionForm
					key={`${activePending.id}-${activePending.answeredQuestionIds.join(",")}`}
					questionSet={activePending}
					workspacePath={workspacePath}
					defaultDisplayMode={defaultDisplayMode}
					isBusy={isBusy}
					canSendMessage={canSendMessage}
					onOpenFile={onOpenFile}
					onSaveDraft={onSaveDraft}
					onSubmit={onSubmit}
				/>
			)}

			{submitted.length > 0 && (!allowSetSwitch && defaultDisplayMode === "minimized"
				? (
						<div className={styles.history}>
							{submitted.map(qs => (
								<QuestionSummaryCard
									key={qs.id}
									questionSet={qs}
									defaultDisplayMode={defaultDisplayMode}
								/>
							))}
						</div>
					)
				: (
						<SectionBlock title={`Submitted Rounds (${submitted.length})`}>
							<div className={styles.history}>
								{submitted.map(qs => (
									<QuestionSummaryCard
										key={qs.id}
										questionSet={qs}
										defaultDisplayMode={defaultDisplayMode}
									/>
								))}
							</div>
						</SectionBlock>
					))}
		</div>
	);
}
