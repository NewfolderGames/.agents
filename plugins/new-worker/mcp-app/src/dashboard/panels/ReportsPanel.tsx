import type { DashboardScope, ReportRecord, SessionSummary } from "@/shared/contracts.js";
import { resolveFileReference } from "@/shared/fileRefs.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { ReportDocumentView } from "@/ui/artifacts/ReportDocumentView.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactPanel.module.css";

export interface ReportsPanelProps {
	scope: DashboardScope;
	reports: ReportRecord[];
	sessions: SessionSummary[];
	activeTaskId?: string;
	rootDir?: string;
	exportDir?: string;
	onSelectReport: (taskId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onOpenPlan?: (taskId: number) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Dashboard panel inspecting complete implementation and audit reports, diffs, verification rows, and findings. */
export function ReportsPanel({
	scope,
	reports,
	sessions,
	activeTaskId,
	rootDir,
	exportDir,
	onSelectReport,
	onSelectSession,
	onOpenPlan,
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
	const activeSession = sessionMap.get(activeReport.sessionId);
	const resolvedRoot = activeSession?.rootDir ?? rootDir;
	const resolvedExportDir = activeSession?.exportDir ?? exportDir;
	const tone = activeReport.outcome.toLowerCase().includes("block") ? "danger" : "success";
	const fileName = formatTaskFilename(activeReport.taskId, activeReport.slug, "report");
	const reportFilePath = resolvedExportDir
		? `${resolvedExportDir.replace(/\/$/, "")}/${fileName}`
		: undefined;
	const planRefResolved = activeReport.planRef
		? resolveFileReference(activeReport.planRef, {
				rootDir: resolvedRoot,
				exportDir: resolvedExportDir,
			})
		: null;

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
				{reportFilePath
					? (
							<FileLink
								path={reportFilePath}
								label={fileName}
								rootDir={resolvedRoot}
								onOpenFile={onOpenFile}
							/>
						)
					: <code>{fileName}</code>}
				<span>{`${activeReport.target.repo} @ ${activeReport.target.branch} (${activeReport.target.commit})`}</span>
				<StatusBadge label={activeReport.mode} />
				<StatusBadge label={activeReport.outcome} tone={tone} />
				{activeReport.planRef && (
					<>
						{planRefResolved && onOpenFile
							? (
									<span>
										{"Plan: "}
										<FileLink
											path={planRefResolved.path}
											lineStart={planRefResolved.lineStart}
											lineEnd={planRefResolved.lineEnd}
											label={planRefResolved.label}
											rootDir={resolvedRoot}
											onOpenFile={onOpenFile}
										/>
									</span>
								)
							: <code>{`Plan: ${activeReport.planRef}`}</code>}
						{onOpenPlan && (
							<ActionButton
								variant="subtle"
								size="compact"
								onClick={() => onOpenPlan(activeReport.taskId)}
							>
								View Plan
							</ActionButton>
						)}
					</>
				)}
				{scope === "group" && (
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={() => onSelectSession(activeReport.sessionId)}
					>
						{activeSession?.title ?? activeReport.sessionId}
					</ActionButton>
				)}
			</div>

			<ReportDocumentView
				report={activeReport}
				summaryTitle={`Report ${formatTaskId(activeReport.taskId)}: ${activeReport.title}`}
				rootDir={resolvedRoot}
				exportDir={resolvedExportDir}
				onOpenFile={onOpenFile}
			/>
		</div>
	);
}
