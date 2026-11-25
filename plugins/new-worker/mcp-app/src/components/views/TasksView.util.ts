import type { TaskRecord } from "@/shared/schema.js";

export function partitionTasks(tasks: TaskRecord[]): {
	activeTasks: TaskRecord[];
	collapsedTasks: TaskRecord[];
} {
	const sorted = [...tasks].sort((a, b) => a.taskNumber.localeCompare(b.taskNumber));
	const activeTasks: TaskRecord[] = [];
	const collapsedTasks: TaskRecord[] = [];
	for (const task of sorted) {
		if (task.status === "done" || task.status === "cancelled" || task.status === "superseded") {
			collapsedTasks.push(task);
		}
		else {
			activeTasks.push(task);
		}
	}
	return { activeTasks, collapsedTasks };
}
