import { DataTable } from "@/components/common/display/DataTable.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { FileLink } from "@/components/common/display/FileLink.js";
import { FilterBar } from "@/components/common/display/FilterBar.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import type { ReportFollowUp } from "@/shared/schema.js";
import {
	filterFollowUpsByPriority,
	type PriorityFilter,
	priorityTone,
} from "./FollowUpTable.util.js";
import styles from "./FollowUpTable.module.css";

export interface FollowUpTableProps {
	followUps: ReportFollowUp[];
	priorityFilter: PriorityFilter;
	onFilterChange: (next: PriorityFilter) => void;
	workspacePath?: string;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function FollowUpTable({
	followUps,
	priorityFilter,
	onFilterChange,
	workspacePath,
	onOpenFile,
}: FollowUpTableProps) {
	const visible = filterFollowUpsByPriority(followUps, priorityFilter);

	const options = [
		{ value: "all", label: `All (${followUps.length})` },
		{ value: "MUST", label: `MUST (${followUps.filter(f => f.priority === "MUST").length})` },
		{
			value: "SHOULD",
			label: `SHOULD (${followUps.filter(f => f.priority === "SHOULD").length})`,
		},
		{
			value: "COULD",
			label: `COULD (${followUps.filter(f => f.priority === "COULD").length})`,
		},
	];

	return (
		<div className={styles["follow-up-table"]}>
			<FilterBar
				options={options}
				value={priorityFilter}
				onChange={val => onFilterChange(val as PriorityFilter)}
			/>
			{visible.length === 0
				? (
						<EmptyState title="No follow-up items match the selected priority." />
					)
				: (
						<DataTable
							headers={["ID", "Priority", "Location", "Action"]}
							rows={visible.map(item => [
								<code key="id">{item.id}</code>,
								<StatusBadge
									key="prio"
									label={item.priority}
									tone={priorityTone(item.priority)}
								/>,
								<FileLink
									key="loc"
									path={item.location}
									lineStart={item.lineStart}
									lineEnd={item.lineEnd}
									workspacePath={workspacePath}
									onOpenFile={onOpenFile}
								/>,
								<span key="action">{item.action}</span>,
							])}
						/>
					)}
		</div>
	);
}
