import type { ReportRecord } from "@/shared/schema.js";

export function selectActiveReport(
	reports: ReportRecord[],
	selectedTaskNumber?: string,
): ReportRecord | undefined {
	if (reports.length === 0) {
		return undefined;
	}
	if (selectedTaskNumber) {
		const exact = reports.find(r => r.taskNumber === selectedTaskNumber);
		if (exact) {
			return exact;
		}
	}
	return [...reports].sort((a, b) => b.taskNumber.localeCompare(a.taskNumber))[0];
}
