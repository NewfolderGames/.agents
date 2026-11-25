import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { ChecklistItem } from "@/components/common/display/ChecklistItem.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatDuration, formatTimestampTooltip } from "@/shared/format.js";
import type { QuestionSetRecord, TaskRecord, TaskStepSnapshot, WidgetDisplayMode } from "@/shared/schema.js";
import { countStepProgress, getStepPendingQuestions, resolveActiveStepIndex } from "./TaskStepList.util.js";
import styles from "./TaskStepCard.module.css";

export interface TaskStepCardProps {
	snapshot?: TaskStepSnapshot;
	task?: TaskRecord;
	stepIndex?: number;
	highlightItemId?: string;
	questionSets?: QuestionSetRecord[];
	defaultDisplayMode?: WidgetDisplayMode;
}

export function TaskStepCard({
	snapshot,
	task,
	stepIndex,
	highlightItemId,
	questionSets = [],
	defaultDisplayMode = "full",
}: TaskStepCardProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	const taskNumber = snapshot?.taskNumber ?? task?.taskNumber;
	const taskTitle = snapshot?.taskTitle ?? task?.title;
	const resolvedIndex = snapshot
		? snapshot.stepIndex
		: task
			? resolveActiveStepIndex(task, stepIndex)
			: 0;
	const totalSteps = snapshot?.totalSteps ?? task?.steps.length ?? 0;
	const step = snapshot?.step ?? task?.steps[resolvedIndex];
	const activeHighlightId = snapshot?.itemId ?? highlightItemId;
	const refTime = snapshot?.capturedAt;

	if (!taskNumber || !taskTitle || !step) {
		return (
			<EmptyState
				title="Step details unavailable."
				detail="No matching task step was found in this session."
			/>
		);
	}

	const progress = countStepProgress(step);
	const isStepDone = progress.done === progress.total;
	const pendingStepQuestions = getStepPendingQuestions(
		questionSets,
		taskNumber,
		resolvedIndex + 1,
	);
	const stepDuration = formatDuration(step.startedAt, step.completedAt, refTime);
	const stepTooltip = formatTimestampTooltip(step.createdAt, step.startedAt, step.completedAt);

	if (displayMode === "minimized") {
		return (
			<section
				className={styles["task-step-card"]}
				aria-label={`Task ${taskNumber} Step ${resolvedIndex + 1}`}
			>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>
						{`Task ${taskNumber} · Step ${resolvedIndex + 1}/${totalSteps}: ${step.title}`}
					</span>
					<div className={styles.minmeta}>
						{stepDuration && (
							<span className={styles.duration} title={stepTooltip}>
								<StatusBadge label={stepDuration} tone="neutral" />
							</span>
						)}
						<StatusBadge
							label={`${progress.done}/${progress.total}`}
							tone={isStepDone ? "success" : "warning"}
						/>
						<ActionButton variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</section>
		);
	}

	const isCompact = displayMode === "compact";
	const focusedItem
		= (activeHighlightId ? step.items.find(i => i.id === activeHighlightId) : undefined)
			?? step.items.find(i => i.status === "in_progress")
			?? step.items[step.items.length - 1];
	const visibleItems = isCompact ? (focusedItem ? [focusedItem] : []) : step.items;

	return (
		<section
			className={styles["task-step-card"]}
			aria-label={`Task ${taskNumber} Step ${resolvedIndex + 1}`}
		>
			<header className={styles.header}>
				<div className={styles.titlegroup}>
					<span className={styles.taskref}>
						Task
						{" "}
						{taskNumber}
						{" - "}
						{taskTitle}
					</span>
					<strong className={styles.steptitle}>
						Step
						{" "}
						{resolvedIndex + 1}
						{" of "}
						{totalSteps}
						{": "}
						{step.title}
					</strong>
				</div>
				<div className={styles.badges}>
					{stepDuration && (
						<span className={styles.duration} title={stepTooltip}>
							<StatusBadge label={stepDuration} tone="neutral" />
						</span>
					)}
					{pendingStepQuestions > 0 && (
						<StatusBadge
							label={`${pendingStepQuestions} deferred Q before finish`}
							tone="warning"
						/>
					)}
					<StatusBadge
						label={
							isStepDone
								? `Step complete (${progress.done}/${progress.total})`
								: `${progress.done}/${progress.total} done`
						}
						tone={isStepDone ? "success" : "warning"}
					/>
					<ActionButton variant="subtle" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</div>
			</header>
			{!isCompact && <p className={styles.outcome}>{step.outcome}</p>}
			{visibleItems.length > 0 && (
				<ul className={styles.items}>
					{visibleItems.map(item => (
						<li key={item.id} className={styles.item}>
							<ChecklistItem
								label={item.text}
								status={item.status}
								highlighted={item.id === activeHighlightId}
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
