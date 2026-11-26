import type { ReportRecord, WidgetDisplayMode } from "@/shared/contracts.js";
import { resolveFileReference } from "@/shared/fileRefs.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { ReportDocumentView } from "@/ui/artifacts/ReportDocumentView.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { MarkdownBlock } from "@/ui/primitives/MarkdownBlock.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { useDisplayMode } from "./useDisplayMode.js";
import shellStyles from "./WidgetShell.module.css";
import styles from "./ArtifactWidget.module.css";

export interface ReportWidgetProps {
	report?: ReportRecord;
	rootDir?: string;
	exportDir?: string;
	defaultDisplayMode: WidgetDisplayMode;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Standalone inline widget displaying an implementation or audit report in minimized, compact, or full parity mode. */
export function ReportWidget({
	report,
	rootDir,
	exportDir,
	defaultDisplayMode,
	onOpenFile,
}: ReportWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!report) {
		return <EmptyState title="Report unavailable." />;
	}

	const tone = report.outcome.toLowerCase().includes("block") ? "danger" : "success";
	const fileName = formatTaskFilename(report.taskId, report.slug, "report");
	const reportFilePath = exportDir
		? `${exportDir.replace(/\/$/, "")}/${fileName}`
		: undefined;
	const planRefResolved = report.planRef
		? resolveFileReference(report.planRef, { rootDir, exportDir })
		: null;

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>
					{`Report ${formatTaskId(report.taskId)}: ${report.title}`}
				</span>
				<div className={shellStyles.minmeta}>
					<StatusBadge label={report.mode} />
					<StatusBadge label={report.outcome} tone={tone} />
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						Expand
					</ActionButton>
				</div>
			</div>
		);
	}

	const isCompact = displayMode === "compact";

	return (
		<SectionCard
			title={`Report ${formatTaskId(report.taskId)}: ${report.title}`}
			actions={(
				<>
					<StatusBadge label={report.mode} />
					<StatusBadge label={report.outcome} tone={tone} />
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</>
			)}
		>
			<div className={styles["artifact-widget"]}>
				<div className={styles.meta}>
					{reportFilePath
						? (
								<FileLink
									path={reportFilePath}
									label={fileName}
									rootDir={rootDir}
									onOpenFile={onOpenFile}
								/>
							)
						: <code>{fileName}</code>}
					<span>{`${report.target.repo} @ ${report.target.branch} (${report.target.commit})`}</span>
					{report.planRef && (
						planRefResolved && onOpenFile
							? (
									<span>
										{"Plan: "}
										<FileLink
											path={planRefResolved.path}
											lineStart={planRefResolved.lineStart}
											lineEnd={planRefResolved.lineEnd}
											label={planRefResolved.label}
											rootDir={rootDir}
											onOpenFile={onOpenFile}
										/>
									</span>
								)
							: <code>{`Plan: ${report.planRef}`}</code>
					)}
				</div>
				{isCompact
					? (
							<MarkdownBlock
								content={report.summary}
								rootDir={rootDir}
								exportDir={exportDir}
								onOpenFile={onOpenFile}
							/>
						)
					: (
							<ReportDocumentView
								report={report}
								rootDir={rootDir}
								exportDir={exportDir}
								onOpenFile={onOpenFile}
							/>
						)}
			</div>
		</SectionCard>
	);
}
