import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { SectionBlock } from "@/components/common/display/SectionBlock.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { CollapsedTaskCard } from "@/components/prefabs/CollapsedTaskCard.js";
import { TaskOverviewTable } from "@/components/prefabs/TaskOverviewTable.js";
import { TaskStepList } from "@/components/prefabs/TaskStepList.js";
import { countTaskProgress, resolveActiveStepIndex } from "@/components/prefabs/TaskStepList.util.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatDuration, formatTimestampTooltip } from "@/shared/format.js";
import type { QuestionSetRecord, TaskRecord, WidgetDisplayMode } from "@/shared/schema.js";
import { partitionTasks } from "./TasksView.util.js";
import styles from "./TasksView.module.css";

export interface TasksViewProps {
	tasks: TaskRecord[];
	questionSets?: QuestionSetRecord[];
	defaultDisplayMode?: WidgetDisplayMode;
	onOpenPlan?: (taskNumber: string) => void;
	onOpenReport?: (taskNumber: string) => void;
}

interface ActiveTaskCardProps {
	task: TaskRecord;
	questionSets: QuestionSetRecord[];
	defaultDisplayMode: WidgetDisplayMode;
}

function ActiveTaskCard({
	task,
	questionSets,
	defaultDisplayMode,
}: ActiveTaskCardProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);
	const isCompact = displayMode !== "full";
	const progress = countTaskProgress(task);
	const duration = formatDuration(task.startedAt, task.completedAt);
	const tooltip = formatTimestampTooltip(task.createdAt, task.startedAt, task.completedAt);
	const activeStepIdx = resolveActiveStepIndex(task);
	const activeStep = task.steps[activeStepIdx];

	return (
		<SectionBlock
			title={`Task ${task.taskNumber} - ${task.title}`}
			actions={(
				<>
					{duration && (
						<span title={tooltip}>
							<StatusBadge label={duration} tone="neutral" />
						</span>
					)}
					<StatusBadge
						label={`${progress.done}/${progress.total} done`}
						tone={task.status === "in_progress" ? "warning" : "neutral"}
					/>
					<ActionButton variant="subtle" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</>
			)}
		>
			{isCompact
				? (
						<p className={styles.summary}>
							{activeStep
								? `Step ${activeStepIdx + 1}/${task.steps.length}: ${activeStep.title} — ${task.summary}`
								: task.summary}
						</p>
					)
				: (
						<>
							<p className={styles.summary}>{task.summary}</p>
							<TaskStepList
								task={task}
								questionSets={questionSets}
							/>
						</>
					)}
		</SectionBlock>
	);
}

export function TasksView({
	tasks,
	questionSets = [],
	defaultDisplayMode = "full",
	onOpenPlan,
	onOpenReport,
}: TasksViewProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (tasks.length === 0) {
		return (
			<EmptyState
				title="No tasks in this session yet."
				detail="Tasks created via upsert_task appear here with read-only step checklists."
			/>
		);
	}

	const { activeTasks, collapsedTasks } = partitionTasks(tasks);

	const focusTask = activeTasks[0] ?? tasks[tasks.length - 1];
	if (displayMode === "minimized" && focusTask) {
		const progress = countTaskProgress(focusTask);
		const duration = formatDuration(focusTask.startedAt, focusTask.completedAt);
		return (
			<div className={styles["tasks-view"]}>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>
						{tasks.length > 1
							? `Task ${focusTask.taskNumber}: ${focusTask.title} (${tasks.length} tasks)`
							: `Task ${focusTask.taskNumber}: ${focusTask.title}`}
					</span>
					<div className={styles.minmeta}>
						{duration && <StatusBadge label={duration} tone="neutral" />}
						<StatusBadge
							label={`${progress.done}/${progress.total} done`}
							tone={focusTask.status === "in_progress" ? "warning" : "neutral"}
						/>
						<ActionButton variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles["tasks-view"]}>
			<SectionBlock title="Overview">
				<TaskOverviewTable
					tasks={tasks}
					onOpenPlan={onOpenPlan}
					onOpenReport={onOpenReport}
				/>
			</SectionBlock>

			{activeTasks.map(task => (
				<ActiveTaskCard
					key={task.taskNumber}
					task={task}
					questionSets={questionSets}
					defaultDisplayMode={displayMode}
				/>
			))}

			{collapsedTasks.length > 0 && (
				<SectionBlock title={`Completed & Archived (${collapsedTasks.length})`}>
					<div className={styles.history}>
						{collapsedTasks.map(task => (
							<CollapsedTaskCard key={task.taskNumber} task={task} />
						))}
					</div>
				</SectionBlock>
			)}
		</div>
	);
}
