import { useMemo } from "react";
import type { AuditFinding, AuditVerificationRow, FindingSeverity, FollowUpPriority, ReportFileChange, ReportRecord, VerificationStatus } from "@/shared/contracts.js";
import { collectReportPaths } from "@/shared/fileRefs.js";
import { CopyButton } from "@/ui/primitives/CopyButton.js";
import { DataTable } from "@/ui/primitives/DataTable.js";
import { DiffBlock } from "@/ui/primitives/DiffBlock.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { MarkdownBlock } from "@/ui/primitives/MarkdownBlock.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { type BadgeTone, StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactDocument.module.css";

export interface ReportDocumentViewProps {
	report: ReportRecord;
	summaryTitle?: string;
	rootDir?: string;
	exportDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

const SEVERITY_ORDER: Array<{ key: FindingSeverity; heading: string; tone: BadgeTone }> = [
	{ key: "critical", heading: "Critical", tone: "danger" },
	{ key: "high", heading: "High", tone: "danger" },
	{ key: "medium", heading: "Medium", tone: "warning" },
	{ key: "low", heading: "Low", tone: "info" },
];

function getFileActionTone(action: ReportFileChange["action"]): BadgeTone {
	switch (action) {
		case "Added":
			return "success";
		case "Deleted":
			return "danger";
		case "Modified":
			return "info";
	}
}

function getVerificationTone(status: VerificationStatus | AuditVerificationRow["status"]): BadgeTone {
	switch (status) {
		case "PASS":
			return "success";
		case "FAIL":
			return "danger";
		case "PARTIAL":
		case "SKIPPED":
		case "NOT RUN":
			return "warning";
	}
}

function getPriorityTone(priority: FollowUpPriority): BadgeTone {
	switch (priority) {
		case "MUST":
			return "danger";
		case "SHOULD":
			return "warning";
		case "COULD":
			return "info";
	}
}

function groupFindingsBySeverity(
	findings: AuditFinding[],
): Record<FindingSeverity, AuditFinding[]> {
	const grouped: Record<FindingSeverity, AuditFinding[]> = {
		critical: [],
		high: [],
		medium: [],
		low: [],
	};
	for (const finding of findings) {
		grouped[finding.severity].push(finding);
	}
	return grouped;
}

/**
 * Full-parity renderer for all implementation and audit `ReportRecord` sections
 * matching `session-templates.md`, shared between `ReportsPanel` and full-mode `ReportWidget`.
 */
export function ReportDocumentView({
	report,
	summaryTitle,
	rootDir,
	exportDir,
	onOpenFile,
}: ReportDocumentViewProps) {
	const isAudit = report.mode === "audit";
	const resolvedSummaryTitle = summaryTitle ?? (isAudit ? "Summary & Verdict" : "Summary & Outcome");
	const followUpsTitle = isAudit ? "Recommended Next Tasks" : "Follow-Up & Future Work";
	const groupedFindings = groupFindingsBySeverity(report.findings);
	const knownPaths = useMemo(() => collectReportPaths(report), [report]);
	const hasFilesSection = report.filesChanged.length > 0 || Boolean(report.diffStat?.trim());
	const hasVerificationSection = report.verification.length > 0
		|| Boolean(report.tryCommand?.trim())
		|| Boolean(report.unverifiedLimitations?.trim());

	const renderMarkdown = (content: string) => (
		<MarkdownBlock
			content={content}
			rootDir={rootDir}
			exportDir={exportDir}
			knownPaths={knownPaths}
			onOpenFile={onOpenFile}
		/>
	);

	return (
		<div className={styles["artifact-document"]}>
			<SectionCard title={resolvedSummaryTitle}>
				{renderMarkdown(report.summary)}
			</SectionCard>

			{report.verificationMatrix.length > 0 && (
				<SectionCard title="Scope & Verification Matrix">
					<DataTable
						caption="Audit scope and verification matrix"
						hideCaption
						rows={report.verificationMatrix}
						getRowKey={(row, idx) => `${row.target}-${idx}`}
						columns={[
							{
								key: "target",
								header: "Check / Spec",
								isRowHeader: true,
								render: row => renderMarkdown(row.target),
							},
							{
								key: "status",
								header: "Status",
								render: row => (
									<StatusBadge
										label={row.status}
										tone={getVerificationTone(row.status)}
									/>
								),
							},
							{
								key: "observed",
								header: "Observed Result",
								render: row => renderMarkdown(row.observed),
							},
						]}
					/>
				</SectionCard>
			)}

			{report.findings.length > 0 && (
				<SectionCard title={`Findings (${report.findings.length})`}>
					{SEVERITY_ORDER.map(({ key, heading, tone }) => {
						const bucket = groupedFindings[key];
						if (bucket.length === 0) {
							return null;
						}

						return (
							<div key={key} className={styles["severity-group"]}>
								<h3 className={styles.subheading}>{`${heading} (${bucket.length})`}</h3>
								{bucket.map(finding => (
									<div key={finding.id} className={styles["finding-item"]}>
										<div className={styles["finding-head"]}>
											<StatusBadge label={finding.severity} tone={tone} />
											<strong>{`${finding.id} - ${finding.title}`}</strong>
											<FileLink
												path={finding.location}
												lineStart={finding.lineStart}
												lineEnd={finding.lineEnd}
												rootDir={rootDir}
												onOpenFile={finding.location.endsWith("/") ? undefined : onOpenFile}
											/>
										</div>
										{renderMarkdown(finding.detail)}
									</div>
								))}
							</div>
						);
					})}
				</SectionCard>
			)}

			{report.actionsCompleted.length > 0 && (
				<SectionCard title="Actions Completed">
					<ul className={styles.list}>
						{report.actionsCompleted.map((action, idx) => (
							<li key={idx}>
								{renderMarkdown(action)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			{hasFilesSection && (
				<SectionCard title="Files Changed">
					{report.diffStat?.trim() && (
						<div className={styles.subsection}>
							<div className={styles["meta-row"]}>
								<strong>Diff stat:</strong>
								<code>{report.diffStat}</code>
							</div>
						</div>
					)}

					{report.filesChanged.length > 0 && (
						<div className={styles.subsection}>
							<DataTable
								caption="Changed files"
								hideCaption
								rows={report.filesChanged}
								getRowKey={(row, idx) => `${row.path}-${idx}`}
								columns={[
									{
										key: "path",
										header: "File",
										isRowHeader: true,
										render: row => (
											<FileLink
												path={row.path}
												lineStart={row.lineStart}
												lineEnd={row.lineEnd}
												rootDir={rootDir}
												onOpenFile={row.path.endsWith("/") ? undefined : onOpenFile}
											/>
										),
									},
									{
										key: "action",
										header: "Action",
										render: row => (
											<StatusBadge
												label={row.action}
												tone={getFileActionTone(row.action)}
											/>
										),
									},
									{
										key: "summary",
										header: "Summary",
										render: row => renderMarkdown(row.summary),
									},
								]}
							/>
						</div>
					)}

					{report.filesChanged.some(f => f.beforeText && f.afterText) && (
						<div className={styles.diffs}>
							{report.filesChanged
								.filter(f => f.beforeText && f.afterText)
								.map((f, idx) => (
									<DiffBlock
										key={idx}
										filePath={f.path}
										beforeText={f.beforeText!}
										afterText={f.afterText!}
									/>
								))}
						</div>
					)}
				</SectionCard>
			)}

			{report.planDeviations.length > 0 && (
				<SectionCard title="Plan Deviations">
					<ul className={styles.list}>
						{report.planDeviations.map((deviation, idx) => (
							<li key={idx}>
								{renderMarkdown(deviation)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			{hasVerificationSection && (
				<SectionCard title="Verification & How to Run">
					{report.verification.length > 0 && (
						<div className={styles.subsection}>
							<DataTable
								caption="Verification checks"
								hideCaption
								rows={report.verification}
								getRowKey={(row, idx) => `${row.check}-${idx}`}
								columns={[
									{
										key: "check",
										header: "Check",
										isRowHeader: true,
										render: row => row.check,
									},
									{
										key: "command",
										header: "Command",
										render: row => <code>{row.command}</code>,
									},
									{
										key: "result",
										header: "Result",
										render: row => (
											<StatusBadge
												label={row.result}
												tone={getVerificationTone(row.result)}
											/>
										),
									},
									{
										key: "notes",
										header: "Notes",
										render: row => renderMarkdown(row.notes),
									},
								]}
							/>
						</div>
					)}

					{report.tryCommand?.trim() && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Try</h3>
							<div className={styles["command-row"]}>
								<code>{report.tryCommand}</code>
								<CopyButton text={report.tryCommand} label="Copy" />
							</div>
						</div>
					)}

					{report.unverifiedLimitations?.trim() && (
						<div className={styles.subsection}>
							<div className={styles.callout}>
								<h3 className={styles.subheading}>Unverified / Limitations</h3>
								{renderMarkdown(report.unverifiedLimitations)}
							</div>
						</div>
					)}
				</SectionCard>
			)}

			{report.operationalNotes.length > 0 && (
				<SectionCard title="Operational Notes & Rollback">
					<ul className={styles.list}>
						{report.operationalNotes.map((note, idx) => (
							<li key={idx}>
								{renderMarkdown(note)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			<SectionCard title={followUpsTitle}>
				{report.followUps.length === 0
					? <p className={styles.muted}>No follow-up items identified.</p>
					: (
							<DataTable
								caption={followUpsTitle}
								hideCaption
								rows={report.followUps}
								getRowKey={(row, idx) => `${row.id}-${idx}`}
								columns={[
									{
										key: "id",
										header: "ID",
										isRowHeader: true,
										render: row => <code>{row.id}</code>,
									},
									{
										key: "priority",
										header: "Priority",
										render: row => (
											<StatusBadge
												label={row.priority}
												tone={getPriorityTone(row.priority)}
											/>
										),
									},
									{
										key: "location",
										header: "Location",
										render: row => (
											<FileLink
												path={row.location}
												lineStart={row.lineStart}
												lineEnd={row.lineEnd}
												rootDir={rootDir}
												onOpenFile={row.location.endsWith("/") ? undefined : onOpenFile}
											/>
										),
									},
									{
										key: "action",
										header: "Follow-Up Action",
										render: row => renderMarkdown(row.action),
									},
								]}
							/>
						)}
			</SectionCard>
		</div>
	);
}
