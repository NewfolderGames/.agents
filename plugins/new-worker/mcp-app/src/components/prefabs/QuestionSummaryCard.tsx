import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { CopyButton } from "@/components/common/buttons/CopyButton.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { getHighestPolicyBadge } from "@/components/views/QuestionsView.util.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatAnswerValue, formatQuestionReply, formatShortTimestamp } from "@/shared/format.js";
import type { QuestionSetRecord, WidgetDisplayMode } from "@/shared/schema.js";
import styles from "./QuestionSummaryCard.module.css";

export interface QuestionSummaryCardProps {
	questionSet: QuestionSetRecord;
	defaultDisplayMode?: WidgetDisplayMode;
}

export function QuestionSummaryCard({
	questionSet,
	defaultDisplayMode = "full",
}: QuestionSummaryCardProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);
	const replyText = formatQuestionReply(
		questionSet,
		questionSet.answers,
		questionSet.otherTexts,
	);
	const policyBadge = getHighestPolicyBadge(questionSet);

	if (displayMode === "minimized") {
		return (
			<article className={styles["question-summary-card"]}>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>{questionSet.title}</span>
					<div className={styles.minmeta}>
						<StatusBadge label={policyBadge.label} tone="neutral" />
						<StatusBadge label="submitted" tone="success" />
						<ActionButton variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</article>
		);
	}

	const isCompact = displayMode === "compact";

	return (
		<article className={styles["question-summary-card"]}>
			<div className={styles.header}>
				<div className={styles.title}>
					<strong className={styles.heading}>{questionSet.title}</strong>
					<StatusBadge label={policyBadge.label} tone="neutral" />
					<StatusBadge label="submitted" tone="success" />
				</div>
				<div className={styles.actions}>
					{questionSet.submittedAt && (
						<span className={styles.time}>
							{formatShortTimestamp(questionSet.submittedAt)}
						</span>
					)}
					<CopyButton text={replyText} label="Copy Answers" />
					<ActionButton variant="subtle" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</div>
			</div>
			{isCompact
				? (
						<p className={styles.collapsednote}>
							{questionSet.questions.length}
							{" "}
							question(s) answered.
						</p>
					)
				: (
						<dl className={styles.list}>
							{questionSet.questions.map(q => (
								<div key={q.id} className={styles.row}>
									<dt className={styles.prompt}>{q.prompt}</dt>
									<dd className={styles.answer}>
										{formatAnswerValue(q, questionSet.answers[q.id], questionSet.otherTexts[q.id])}
									</dd>
								</div>
							))}
						</dl>
					)}
		</article>
	);
}
