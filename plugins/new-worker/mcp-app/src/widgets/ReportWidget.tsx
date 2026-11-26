import type { ReportRecord } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import shellStyles from "./WidgetShell.module.css";

export interface ReportWidgetProps {
	report?: ReportRecord;
	rootDir?: string;
	exportDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Single-row inline summary for a report with an exported file link. */
export function ReportWidget({
	report,
	rootDir,
	exportDir,
	onOpenFile,
}: ReportWidgetProps) {
	if (!report) {
		return <EmptyState title="Report unavailable." />;
	}

	const tone = report.outcome.toLowerCase().includes("block") ? "danger" : "success";
	const fileName = formatTaskFilename(report.taskId, report.slug, "report");
	const reportFilePath = exportDir
		? `${exportDir.replace(/\/$/, "")}/${fileName}`
		: undefined;
	const titleText = `Report ${formatTaskId(report.taskId)}: ${report.title}`;

	return (
		<div className={shellStyles.minrow}>
			<span className={shellStyles.mintitle}>{titleText}</span>
			<div className={shellStyles.minmeta}>
				{reportFilePath && (
					<FileLink
						path={reportFilePath}
						label={fileName}
						rootDir={rootDir}
						onOpenFile={onOpenFile}
					/>
				)}
				<StatusBadge label={report.outcome} tone={tone} />
			</div>
		</div>
	);
}
