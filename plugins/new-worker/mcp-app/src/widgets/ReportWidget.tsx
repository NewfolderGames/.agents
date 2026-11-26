import type { ReportRecord, WidgetDisplayMode } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
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
	defaultDisplayMode: WidgetDisplayMode;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Standalone inline widget displaying an implementation or audit report and changed file links. */
export function ReportWidget({
	report,
	rootDir,
	defaultDisplayMode,
	onOpenFile,
}: ReportWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!report) {
		return <EmptyState title="Report unavailable." />;
	}

	const tone = report.outcome.toLowerCase().includes("block") ? "danger" : "success";
	const fileName = formatTaskFilename(report.taskId, report.slug, "report");

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
					<code>{fileName}</code>
					<span>{`${report.target.repo} @ ${report.target.branch} (${report.target.commit})`}</span>
				</div>
				<MarkdownBlock content={report.summary} />
				{!isCompact && report.filesChanged.length > 0 && (
					<>
						<strong>Files Changed</strong>
						<ul className={styles.list}>
							{report.filesChanged.map((f, idx) => (
								<li key={idx}>
									<FileLink
										path={f.path}
										lineStart={f.lineStart}
										lineEnd={f.lineEnd}
										rootDir={rootDir}
										onOpenFile={onOpenFile}
									/>
									{` (${f.action}): ${f.summary}`}
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</SectionCard>
	);
}
