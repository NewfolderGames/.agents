import { EmptyState } from "@/components/common/display/EmptyState.js";
import { FileLink } from "@/components/common/display/FileLink.js";
import { FilterBar } from "@/components/common/display/FilterBar.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import type { AuditFinding } from "@/shared/schema.js";
import {
	filterFindingsBySeverity,
	type SeverityFilter,
	severityTone,
} from "./ReportFindingList.util.js";
import styles from "./ReportFindingList.module.css";

export interface ReportFindingListProps {
	findings: AuditFinding[];
	severityFilter: SeverityFilter;
	onFilterChange: (next: SeverityFilter) => void;
	workspacePath?: string;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function ReportFindingList({
	findings,
	severityFilter,
	onFilterChange,
	workspacePath,
	onOpenFile,
}: ReportFindingListProps) {
	const visible = filterFindingsBySeverity(findings, severityFilter);

	const filterOptions = [
		{ value: "all", label: `All (${findings.length})` },
		{
			value: "critical",
			label: `Critical (${findings.filter(f => f.severity === "critical").length})`,
		},
		{
			value: "high",
			label: `High (${findings.filter(f => f.severity === "high").length})`,
		},
		{
			value: "medium",
			label: `Medium (${findings.filter(f => f.severity === "medium").length})`,
		},
		{
			value: "low",
			label: `Low (${findings.filter(f => f.severity === "low").length})`,
		},
	];

	return (
		<div className={styles["report-finding-list"]}>
			<FilterBar
				options={filterOptions}
				value={severityFilter}
				onChange={val => onFilterChange(val as SeverityFilter)}
			/>
			{visible.length === 0
				? (
						<EmptyState title="No findings match the selected severity." />
					)
				: (
						<div className={styles.items}>
							{visible.map(finding => (
								<article key={finding.id} className={styles.card}>
									<div className={styles.top}>
										<strong>
											<code>{finding.id}</code>
											{" "}
											-
											{finding.title}
										</strong>
										<StatusBadge
											label={finding.severity}
											tone={severityTone(finding.severity)}
										/>
									</div>
									<div className={styles.loc}>
										<FileLink
											path={finding.location}
											lineStart={finding.lineStart}
											lineEnd={finding.lineEnd}
											workspacePath={workspacePath}
											onOpenFile={onOpenFile}
										/>
									</div>
									<MarkdownText content={finding.detail} />
								</article>
							))}
						</div>
					)}
		</div>
	);
}
