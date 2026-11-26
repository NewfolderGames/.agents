import type { TaskRecord } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import shellStyles from "./WidgetShell.module.css";

export interface TaskWidgetProps {
	task?: TaskRecord;
	rootDir?: string;
	exportDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Single-row inline summary for a task with an exported `tasks.md` link. */
export function TaskWidget({
	task,
	rootDir,
	exportDir,
	onOpenFile,
}: TaskWidgetProps) {
	if (!task) {
		return <EmptyState title="Task unavailable." detail="No task payload was returned." />;
	}

	const allItems = task.steps.flatMap(s => s.items);
	const doneCount = allItems.filter(i => i.status === "done").length;
	const tasksFilePath = exportDir
		? `${exportDir.replace(/\/$/, "")}/tasks.md`
		: undefined;
	const titleText = `Task ${formatTaskId(task.taskId)}: ${task.title}`;

	return (
		<div className={shellStyles.minrow}>
			<span className={shellStyles.mintitle}>{titleText}</span>
			<div className={shellStyles.minmeta}>
				{tasksFilePath && (
					<FileLink
						path={tasksFilePath}
						label="tasks.md"
						rootDir={rootDir}
						onOpenFile={onOpenFile}
					/>
				)}
				<StatusBadge
					label={`${doneCount}/${allItems.length} done`}
					tone={task.status === "done" ? "success" : task.status === "in_progress" ? "warning" : "neutral"}
				/>
			</div>
		</div>
	);
}
