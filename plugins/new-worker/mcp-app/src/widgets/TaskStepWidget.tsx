import type { QuestionSetRecord, TaskRecord, TaskStepSnapshot, WidgetDisplayMode } from "@/shared/contracts.js";
import { resolveQuestionPolicy } from "@/shared/contracts.js";
import { formatDuration, formatTaskId, formatTimestampTooltip } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ChecklistRow } from "@/ui/primitives/ChecklistRow.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { useDisplayMode } from "./useDisplayMode.js";
import shellStyles from "./WidgetShell.module.css";
import styles from "./TaskStepWidget.module.css";

export interface TaskStepWidgetProps {
	snapshot?: TaskStepSnapshot;
	task?: TaskRecord;
	questionSets?: QuestionSetRecord[];
	defaultDisplayMode: WidgetDisplayMode;
}

/** Standalone inline widget rendering an immutable single-step checklist snapshot and blocking status. */
export function TaskStepWidget({
	snapshot,
	task,
	questionSets = [],
	defaultDisplayMode,
}: TaskStepWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	const taskId = snapshot?.taskId ?? task?.taskId;
	const taskTitle = snapshot?.taskTitle ?? task?.title;
	const stepIndex = snapshot?.stepIndex ?? 0;
	const totalSteps = snapshot?.totalSteps ?? task?.steps.length ?? 0;
	const step = snapshot?.step ?? task?.steps[stepIndex];
	const activeItemKey = snapshot?.itemKey;
	const refTime = snapshot?.capturedAt;

	if (!taskId || !taskTitle || !step) {
		return <EmptyState title="Step snapshot unavailable." />;
	}

	const doneCount = step.items.filter(i => i.status === "done").length;
	const isStepDone = doneCount === step.items.length;
	const stepDuration = formatDuration(step.startedAt, step.completedAt, refTime);
	const stepTooltip = formatTimestampTooltip(step.createdAt, step.startedAt, step.completedAt);

	const pendingStepQ = questionSets.reduce((acc, qs) => {
		if (qs.status === "submitted") {
			return acc;
		}
		const answered = new Set(qs.answeredQuestionIds);
		const matches = qs.questions.filter((q) => {
			if (answered.has(q.id)) {
				return false;
			}
			const p = resolveQuestionPolicy(qs, q);
			return p.blockingMode === "before_step_finish" && p.taskId === taskId && p.stepNumber === stepIndex + 1;
		}).length;
		return acc + matches;
	}, 0);

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>
					{`Task ${formatTaskId(taskId)} · Step ${stepIndex + 1}/${totalSteps}: ${step.title}`}
				</span>
				<div className={shellStyles.minmeta}>
					{stepDuration && <StatusBadge label={stepDuration} title={stepTooltip} />}
					<StatusBadge
						label={`${doneCount}/${step.items.length}`}
						tone={isStepDone ? "success" : "warning"}
					/>
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						Expand
					</ActionButton>
				</div>
			</div>
		);
	}

	const isCompact = displayMode === "compact";
	const focusedItem
		= (activeItemKey ? step.items.find(i => i.itemKey === activeItemKey) : undefined)
			?? step.items.find(i => i.status === "in_progress")
			?? step.items[step.items.length - 1];
	const visibleItems = isCompact ? (focusedItem ? [focusedItem] : []) : step.items;

	return (
		<section
			className={styles["task-step-widget"]}
			aria-label={`Task ${taskId} Step ${stepIndex + 1}`}
		>
			<header className={styles.header}>
				<div className={styles.titlegroup}>
					<span className={styles.taskref}>
						{`Task ${formatTaskId(taskId)} - ${taskTitle}`}
					</span>
					<strong>
						{`Step ${stepIndex + 1} of ${totalSteps}: ${step.title}`}
					</strong>
				</div>
				<div className={styles.badges}>
					{stepDuration && <StatusBadge label={stepDuration} title={stepTooltip} />}
					{pendingStepQ > 0 && (
						<StatusBadge label={`${pendingStepQ} deferred Q`} tone="warning" />
					)}
					<StatusBadge
						label={isStepDone ? `Complete (${doneCount}/${step.items.length})` : `${doneCount}/${step.items.length} done`}
						tone={isStepDone ? "success" : "warning"}
					/>
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</div>
			</header>
			{!isCompact && <p className={styles.outcome}>{step.outcome}</p>}
			{visibleItems.length > 0 && (
				<ul className={styles.items}>
					{visibleItems.map(item => (
						<li key={item.itemKey}>
							<ChecklistRow
								label={item.text}
								status={item.status}
								highlighted={item.itemKey === activeItemKey}
								duration={formatDuration(item.startedAt, item.completedAt, refTime)}
								timestampTooltip={formatTimestampTooltip(
									item.createdAt,
									item.startedAt,
									item.completedAt,
								)}
							/>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
