import type { FollowUpPriority, ReportFollowUp } from "@/shared/schema.js";

export type PriorityFilter = "all" | FollowUpPriority;

export function filterFollowUpsByPriority(
	followUps: ReportFollowUp[],
	priority: PriorityFilter,
): ReportFollowUp[] {
	if (priority === "all") {
		return followUps;
	}
	return followUps.filter(item => item.priority === priority);
}

export function priorityTone(
	priority: FollowUpPriority,
): "neutral" | "success" | "warning" | "danger" {
	switch (priority) {
		case "MUST":
			return "danger";
		case "SHOULD":
			return "warning";
		default:
			return "neutral";
	}
}
