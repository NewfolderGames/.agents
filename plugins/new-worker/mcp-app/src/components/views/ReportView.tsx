import { useState } from "react";
import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { CopyButton } from "@/components/common/buttons/CopyButton.js";
import { DataTable } from "@/components/common/display/DataTable.js";
import { DiffBlock } from "@/components/common/display/DiffBlock.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { FileLink } from "@/components/common/display/FileLink.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { SectionBlock } from "@/components/common/display/SectionBlock.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { FollowUpTable } from "@/components/prefabs/FollowUpTable.js";
import type { PriorityFilter } from "@/components/prefabs/FollowUpTable.util.js";
import { ReportFindingList } from "@/components/prefabs/ReportFindingList.js";
import type { SeverityFilter } from "@/components/prefabs/ReportFindingList.util.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatTaskFilename } from "@/shared/format.js";
import type { ReportRecord, WidgetDisplayMode } from "@/shared/schema.js";
import { selectActiveReport } from "./ReportView.util.js";
import styles from "./ReportView.module.css";

export interface ReportViewProps {
	reports: ReportRecord[];
	activeTaskNumber?: string;
	workspacePath?: string;
	defaultDisplayMode?: WidgetDisplayMode;
	onSelectReport: (taskNumber: string) => void;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function ReportView({
	reports,
	activeTaskNumber,
	workspacePath,
	defaultDisplayMode = "full",
	onSelectReport,
	onOpenFile,
}: ReportViewProps) {
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
	const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	const activeReport = selectActiveReport(reports, activeTaskNumber);
	if (!activeReport) {
		return (
			<EmptyState
				title="No reports delivered in this session."
				detail="Implementation and Audit reports delivered via write_report appear here."
			/>
		);
	}

	if (displayMode === "minimized") {
		return (
			<div className={styles["report-view"]}>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>
						{`Report ${activeReport.taskNumber}: ${activeReport.title}`}
					</span>
					<div className={styles.minmeta}>
						<StatusBadge label={activeReport.mode} />
						<StatusBadge
							label={activeReport.outcome}
							tone={
								activeReport.outcome.toLowerCase().includes("block")
									? "danger"
									: "success"
							}
						/>
						<ActionButton variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</div>
		);
	}

	const isCompact = displayMode === "compact";
	const passedChecks = activeReport.verification.filter(v => v.result === "PASS").length;

	return (
		<div className={styles["report-view"]}>
			{reports.length > 1 && (
				<div className={styles.selector}>
					{reports.map(report => (
						<ActionButton
							key={report.taskNumber}
							variant="subtle"
							active={report.taskNumber === activeReport.taskNumber}
							onClick={() => onSelectReport(report.taskNumber)}
						>
							Report
							{" "}
							{report.taskNumber}
						</ActionButton>
					))}
				</div>
			)}

			<div className={styles.meta}>
				<div className={styles.heading}>
					<h2 className={styles.title}>
						Report
						{" "}
						{activeReport.taskNumber}
						:
						{" "}
						{activeReport.title}
					</h2>
					<div className={styles.badges}>
						<StatusBadge label={activeReport.mode} />
						<StatusBadge
							label={activeReport.outcome}
							tone={
								activeReport.outcome.toLowerCase().includes("block")
									? "danger"
									: "success"
							}
						/>
						<ActionButton variant="subtle" onClick={toggleExpand}>
							{isCompact ? "Expand" : "Minimize"}
						</ActionButton>
					</div>
				</div>
				<div className={styles.sub}>
					<code>
						{formatTaskFilename(activeReport.taskNumber, activeReport.slug, "report")}
					</code>
					<span>
						{activeReport.target.repo}
						{" "}
						@
						{activeReport.target.branch}
						{" "}
						(
						{activeReport.target.commit}
						)
					</span>
				</div>
			</div>

			<SectionBlock
				title={activeReport.mode === "audit" ? "Summary & Verdict" : "Summary & Outcome"}
				actions={isCompact
					? (
							<div className={styles.summarybadges}>
								{activeReport.mode === "audit"
									? (
											<>
												<StatusBadge
													label={`Matrix: ${activeReport.verificationMatrix.length}`}
												/>
												<StatusBadge
													label={`Findings: ${activeReport.findings.length}`}
												/>
											</>
										)
									: (
											<>
												<StatusBadge
													label={`Files: ${activeReport.filesChanged.length}`}
												/>
												<StatusBadge
													label={`Checks: ${passedChecks}/${activeReport.verification.length} PASS`}
												/>
											</>
										)}
								<StatusBadge label={`Follow-ups: ${activeReport.followUps.length}`} />
							</div>
						)
					: undefined}
			>
				<MarkdownText content={activeReport.summary} />
			</SectionBlock>

			{!isCompact && activeReport.mode === "audit" && (
				<>
					{activeReport.verificationMatrix.length > 0 && (
						<SectionBlock title="Scope & Verification Matrix">
							<DataTable
								headers={["Check / Spec", "Status", "Observed Result"]}
								rows={activeReport.verificationMatrix.map(row => [
									<code key="target">{row.target}</code>,
									<StatusBadge
										key="status"
										label={row.status}
										tone={
											row.status === "PASS"
												? "success"
												: row.status === "FAIL"
													? "danger"
													: "warning"
										}
									/>,
									<span key="obs">{row.observed}</span>,
								])}
							/>
						</SectionBlock>
					)}

					<SectionBlock title="Findings">
						<ReportFindingList
							findings={activeReport.findings}
							severityFilter={severityFilter}
							onFilterChange={setSeverityFilter}
							workspacePath={workspacePath}
							onOpenFile={onOpenFile}
						/>
					</SectionBlock>
				</>
			)}

			{!isCompact && activeReport.mode !== "audit" && (
				<>
					{activeReport.actionsCompleted.length > 0 && (
						<SectionBlock title="Actions Completed">
							<ul className={styles.list}>
								{activeReport.actionsCompleted.map((item, idx) => (
									<li key={idx}>{item}</li>
								))}
							</ul>
						</SectionBlock>
					)}

					{activeReport.filesChanged.length > 0 && (
						<SectionBlock
							title="Files Changed"
							actions={
								activeReport.diffStat
									? <code>{activeReport.diffStat}</code>
									: undefined
							}
						>
							<DataTable
								headers={["File", "Action", "Summary"]}
								rows={activeReport.filesChanged.map(file => [
									<FileLink
										key="path"
										path={file.path}
										lineStart={file.lineStart}
										lineEnd={file.lineEnd}
										workspacePath={workspacePath}
										onOpenFile={onOpenFile}
									/>,
									<code key="act">{file.action}</code>,
									<div key="sum" className={styles.filesummary}>
										<span>{file.summary}</span>
										{file.beforeText !== undefined && file.afterText !== undefined && (
											<details className={styles.diffdisclosure}>
												<summary>View diff</summary>
												<DiffBlock
													beforeText={file.beforeText}
													afterText={file.afterText}
												/>
											</details>
										)}
									</div>,
								])}
							/>
						</SectionBlock>
					)}

					{activeReport.planDeviations.length > 0 && (
						<SectionBlock title="Plan Deviations">
							<ul className={styles.list}>
								{activeReport.planDeviations.map((dev, idx) => (
									<li key={idx}>{dev}</li>
								))}
							</ul>
						</SectionBlock>
					)}

					{activeReport.verification.length > 0 && (
						<SectionBlock title="Verification & How to Run">
							<DataTable
								headers={["Check", "Command", "Result", "Notes"]}
								rows={activeReport.verification.map(row => [
									<span key="check">{row.check}</span>,
									<code key="cmd">{row.command}</code>,
									<StatusBadge
										key="res"
										label={row.result}
										tone={
											row.result === "PASS"
												? "success"
												: row.result === "FAIL"
													? "danger"
													: "warning"
										}
									/>,
									<span key="notes">{row.notes}</span>,
								])}
							/>
							{activeReport.tryCommand && (
								<div className={styles.tryrow}>
									<strong>Try:</strong>
									<code>{activeReport.tryCommand}</code>
									<CopyButton text={activeReport.tryCommand} label="Copy" />
								</div>
							)}
							{activeReport.unverifiedLimitations && (
								<p className={styles.note}>
									<strong>Unverified / Limitations:</strong>
									{" "}
									{activeReport.unverifiedLimitations}
								</p>
							)}
						</SectionBlock>
					)}
				</>
			)}

			{!isCompact && activeReport.followUps.length > 0 && (
				<SectionBlock
					title={
						activeReport.mode === "audit"
							? "Recommended Next Tasks"
							: "Follow-Up & Future Work"
					}
				>
					<FollowUpTable
						followUps={activeReport.followUps}
						priorityFilter={priorityFilter}
						onFilterChange={setPriorityFilter}
						workspacePath={workspacePath}
						onOpenFile={onOpenFile}
					/>
				</SectionBlock>
			)}
		</div>
	);
}
