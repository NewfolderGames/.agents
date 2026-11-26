import type { DashboardScope, ReportRecord, SessionSummary } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { DataTable } from "@/ui/primitives/DataTable.js";
import { DiffBlock } from "@/ui/primitives/DiffBlock.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { MarkdownBlock } from "@/ui/primitives/MarkdownBlock.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactPanel.module.css";

export interface ReportsPanelProps {
	scope: DashboardScope;
	reports: ReportRecord[];
	sessions: SessionSummary[];
	activeTaskId?: string;
	rootDir?: string;
	onSelectReport: (taskId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Dashboard panel inspecting implementation and audit reports, diffs, verification rows, and findings. */
export function ReportsPanel({
	scope,
	reports,
	sessions,
	activeTaskId,
	rootDir,
	onSelectReport,
	onSelectSession,
	onOpenFile,
}: ReportsPanelProps) {
	if (reports.length === 0) {
		return (
			<EmptyState
				title="No reports delivered yet."
				detail="Reports delivered via write_report appear here."
			/>
		);
	}

	const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));
	const activeReport = reports.find(r => String(r.taskId) === activeTaskId) ?? reports[0]!;
	const resolvedRoot = sessionMap.get(activeReport.sessionId)?.rootDir ?? rootDir;
	const tone = activeReport.outcome.toLowerCase().includes("block") ? "danger" : "success";

	return (
		<div className={styles["artifact-panel"]}>
			{reports.length > 1 && (
				<div className={styles.selector}>
					{reports.map(r => (
						<ActionButton
							key={r.taskId}
							variant="subtle"
							size="compact"
							active={r.taskId === activeReport.taskId}
							onClick={() => onSelectReport(String(r.taskId))}
						>
							{`Report ${formatTaskId(r.taskId)}`}
						</ActionButton>
					))}
				</div>
			)}

			<div className={styles.meta}>
				<code>{formatTaskFilename(activeReport.taskId, activeReport.slug, "report")}</code>
				<StatusBadge label={activeReport.mode} />
				<StatusBadge label={activeReport.outcome} tone={tone} />
				{scope === "group" && (
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={() => onSelectSession(activeReport.sessionId)}
					>
						{sessionMap.get(activeReport.sessionId)?.title ?? activeReport.sessionId}
					</ActionButton>
				)}
			</div>

			<SectionCard
				title={`Report ${formatTaskId(activeReport.taskId)}: ${activeReport.title}`}
			>
				<MarkdownBlock content={activeReport.summary} />
			</SectionCard>

			{activeReport.filesChanged.length > 0 && (
				<SectionCard title="Files Changed">
					<DataTable
						caption="Changed files"
						hideCaption
						rows={activeReport.filesChanged}
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
										rootDir={resolvedRoot}
										onOpenFile={onOpenFile}
									/>
								),
							},
							{ key: "action", header: "Action", render: row => row.action },
							{ key: "summary", header: "Summary", render: row => row.summary },
						]}
					/>
					{activeReport.filesChanged.some(f => f.beforeText && f.afterText) && (
						<div className={styles.diffs}>
							{activeReport.filesChanged
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

			{activeReport.verification.length > 0 && (
				<SectionCard title="Verification">
					<DataTable
						caption="Verification checks"
						hideCaption
						rows={activeReport.verification}
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
										tone={row.result === "PASS" ? "success" : row.result === "FAIL" ? "danger" : "warning"}
									/>
								),
							},
							{ key: "notes", header: "Notes", render: row => row.notes },
						]}
					/>
				</SectionCard>
			)}

			{activeReport.findings.length > 0 && (
				<SectionCard title={`Audit Findings (${activeReport.findings.length})`}>
					<ul className={styles.list}>
						{activeReport.findings.map(finding => (
							<li key={finding.id}>
								<StatusBadge
									label={finding.severity}
									tone={finding.severity === "critical" || finding.severity === "high" ? "danger" : "warning"}
								/>
								{" "}
								<strong>{`${finding.id}: ${finding.title}`}</strong>
								{" — "}
								<FileLink
									path={finding.location}
									lineStart={finding.lineStart}
									lineEnd={finding.lineEnd}
									rootDir={resolvedRoot}
									onOpenFile={onOpenFile}
								/>
								{`: ${finding.detail}`}
							</li>
						))}
					</ul>
				</SectionCard>
			)}
		</div>
	);
}
