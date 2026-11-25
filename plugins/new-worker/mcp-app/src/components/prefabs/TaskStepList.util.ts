import { type QuestionSetRecord, resolveQuestionPolicy, type TaskRecord, type TaskStep } from "@/shared/schema.js";

export function countStepProgress(step: TaskStep): { done: number; total: number } {
	const total = step.items.length;
	const done = step.items.filter(item => item.status === "done").length;
	return { done, total };
}

export function countTaskProgress(task: TaskRecord): { done: number; total: number } {
	let done = 0;
	let total = 0;
	for (const step of task.steps) {
		const counts = countStepProgress(step);
		done += counts.done;
		total += counts.total;
	}
	return { done, total };
}

export function getStepPendingQuestions(
	questionSets: QuestionSetRecord[],
	taskNumber: string,
	stepNumber: number,
): number {
	let count = 0;
	for (const qs of questionSets) {
		if (qs.status === "submitted") {
			continue;
		}
		const answered = new Set(qs.answeredQuestionIds);
		for (const q of qs.questions) {
			if (answered.has(q.id)) {
				continue;
			}
			const policy = resolveQuestionPolicy(qs, q);
			if (
				policy.blockingMode === "before_step_finish"
				&& policy.taskNumber === taskNumber
				&& policy.stepNumber === stepNumber
			) {
				count += 1;
			}
		}
	}
	return count;
}

export function resolveActiveStepIndex(
	task: TaskRecord,
	preferredStepIndex?: number,
): number {
	if (
		preferredStepIndex !== undefined
		&& preferredStepIndex >= 0
		&& preferredStepIndex < task.steps.length
	) {
		return preferredStepIndex;
	}
	const inProgressIdx = task.steps.findIndex(step =>
		step.items.some(item => item.status === "in_progress"));
	if (inProgressIdx !== -1) {
		return inProgressIdx;
	}
	const pendingIdx = task.steps.findIndex(step =>
		step.items.some(item => item.status !== "done"));
	return pendingIdx === -1 ? Math.max(0, task.steps.length - 1) : pendingIdx;
}
