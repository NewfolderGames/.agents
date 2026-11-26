import { useRef, useState } from "react";
import { type DashboardScope, type QuestionAnswerValue, type QuestionSetRecord, resolveQuestionPolicy, type SessionSummary } from "@/shared/contracts.js";
import { formatAnswerValue, formatQuestionReply } from "@/shared/format.js";
import { useFormAriaSync } from "@/ui/hooks/useFormAriaSync.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { CopyButton } from "@/ui/primitives/CopyButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { QuestionField } from "@/ui/primitives/QuestionField.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./QuestionsPanel.module.css";

export interface QuestionsPanelProps {
	scope: DashboardScope;
	questionSets: QuestionSetRecord[];
	sessions: SessionSummary[];
	activeQuestionSetId?: string;
	isBusy: boolean;
	canSendMessage: boolean;
	onSelectQuestionSet: (id: string) => void;
	onSelectSession: (sessionId: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
	onSaveDraft: (
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => void;
	onSubmit: (
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	) => Promise<{ ok: boolean; sentToChat: boolean }>;
}

function ActiveQuestionForm({
	questionSet,
	rootDir,
	isBusy,
	canSendMessage,
	onOpenFile,
	onSaveDraft,
	onSubmit,
}: {
	questionSet: QuestionSetRecord;
	rootDir?: string;
	isBusy: boolean;
	canSendMessage: boolean;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
	onSaveDraft: QuestionsPanelProps["onSaveDraft"];
	onSubmit: QuestionsPanelProps["onSubmit"];
}) {
	const formRef = useRef<HTMLFormElement>(null);
	const [answers, setAnswers] = useState<Record<string, QuestionAnswerValue>>(
		() => ({ ...questionSet.answers }),
	);
	const [otherTexts, setOtherTexts] = useState<Record<string, string>>(
		() => ({ ...questionSet.otherTexts }),
	);

	useFormAriaSync(formRef, true);
	const answeredSet = new Set(questionSet.answeredQuestionIds);
	const openQuestions = questionSet.questions.filter(q => !answeredSet.has(q.id));

	const updateAnswer = (qId: string, val: QuestionAnswerValue) => {
		const next = { ...answers, [qId]: val };
		setAnswers(next);
		onSaveDraft(questionSet.sessionId, questionSet.id, next, otherTexts);
	};

	const updateOther = (qId: string, txt: string) => {
		const next = { ...otherTexts, [qId]: txt };
		setOtherTexts(next);
		onSaveDraft(questionSet.sessionId, questionSet.id, answers, next);
	};

	return (
		<SectionCard
			title={questionSet.title}
			actions={<StatusBadge label={`${openQuestions.length} open`} tone="warning" />}
		>
			<form
				ref={formRef}
				className={styles.form}
				onSubmit={(e) => {
					e.preventDefault();
					void onSubmit(questionSet.sessionId, questionSet.id, answers, otherTexts);
				}}
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
							onChange={next => updateAnswer(q.id, next)}
							onOtherTextChange={txt => updateOther(q.id, txt)}
							onOpenFile={onOpenFile}
						/>
					);
				})}
				<div className={styles.actions}>
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
		</SectionCard>
	);
}

/** Dashboard panel displaying pending interactive question forms and submitted Q&A history. */
export function QuestionsPanel({
	scope,
	questionSets,
	sessions,
	activeQuestionSetId,
	isBusy,
	canSendMessage,
	onSelectQuestionSet,
	onSelectSession,
	onOpenFile,
	onSaveDraft,
	onSubmit,
}: QuestionsPanelProps) {
	if (questionSets.length === 0) {
		return (
			<EmptyState
				title="No question sets yet."
				detail="Questions created via ask_questions appear here."
			/>
		);
	}

	const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));
	const openSets = questionSets.filter(q => q.status !== "submitted");
	const submittedSets = questionSets.filter(q => q.status === "submitted");
	const activePending = openSets.find(q => q.id === activeQuestionSetId) ?? openSets[0];

	return (
		<div className={styles["questions-panel"]}>
			{openSets.length > 1 && activePending && (
				<div className={styles.selector}>
					{openSets.map(qs => (
						<ActionButton
							key={qs.id}
							variant="subtle"
							size="compact"
							active={qs.id === activePending.id}
							onClick={() => onSelectQuestionSet(qs.id)}
						>
							{qs.title}
						</ActionButton>
					))}
				</div>
			)}

			{activePending && (
				<ActiveQuestionForm
					key={`${activePending.id}-${activePending.answeredQuestionIds.join(",")}`}
					questionSet={activePending}
					rootDir={sessionMap.get(activePending.sessionId)?.rootDir}
					isBusy={isBusy}
					canSendMessage={canSendMessage}
					onOpenFile={onOpenFile}
					onSaveDraft={onSaveDraft}
					onSubmit={onSubmit}
				/>
			)}

			{submittedSets.length > 0 && (
				<div className={styles.history}>
					{submittedSets.map((qs) => {
						const summary = formatQuestionReply(qs, qs.answers, qs.otherTexts);
						return (
							<SectionCard
								key={qs.id}
								title={qs.title}
								actions={(
									<>
										<StatusBadge label="Submitted" tone="success" />
										{scope === "group" && (
											<ActionButton
												variant="subtle"
												size="compact"
												onClick={() => onSelectSession(qs.sessionId)}
											>
												{sessionMap.get(qs.sessionId)?.title ?? qs.sessionId}
											</ActionButton>
										)}
										<CopyButton text={summary} label="Copy Summary" />
									</>
								)}
							>
								<ul className={styles.answers}>
									{qs.questions.map(q => (
										<li key={q.id}>
											<strong>
												{q.prompt}
												:
											</strong>
											{" "}
											{formatAnswerValue(q, qs.answers[q.id], qs.otherTexts[q.id])}
										</li>
									))}
								</ul>
							</SectionCard>
						);
					})}
				</div>
			)}
		</div>
	);
}
