import type { PlanRecord } from "@/shared/schema.js";

export function selectActivePlan(
	plans: PlanRecord[],
	selectedTaskNumber?: string,
): PlanRecord | undefined {
	if (plans.length === 0) {
		return undefined;
	}
	if (selectedTaskNumber) {
		const exact = plans.find(p => p.taskNumber === selectedTaskNumber);
		if (exact) {
			return exact;
		}
	}
	return [...plans].sort((a, b) => b.taskNumber.localeCompare(a.taskNumber))[0];
}
