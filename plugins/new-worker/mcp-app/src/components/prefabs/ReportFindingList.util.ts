import type { AuditFinding, FindingSeverity } from "@/shared/schema.js";

export type SeverityFilter = "all" | FindingSeverity;

export function filterFindingsBySeverity(
	findings: AuditFinding[],
	severity: SeverityFilter,
): AuditFinding[] {
	if (severity === "all") {
		return findings;
	}
	return findings.filter(item => item.severity === severity);
}

export function severityTone(
	severity: FindingSeverity,
): "neutral" | "success" | "warning" | "danger" {
	switch (severity) {
		case "critical":
		case "high":
			return "danger";
		case "medium":
			return "warning";
		default:
			return "neutral";
	}
}
