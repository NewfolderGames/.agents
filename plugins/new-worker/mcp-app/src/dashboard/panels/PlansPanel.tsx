import type { DashboardScope, PlanRecord, SessionSummary } from "@/shared/contracts.js";
import { resolveFileReference } from "@/shared/fileRefs.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { PlanDocumentView } from "@/ui/artifacts/PlanDocumentView.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactPanel.module.css";

export interface PlansPanelProps {
	scope: DashboardScope;
	plans: PlanRecord[];
	sessions: SessionSummary[];
	activeTaskId?: string;
	rootDir?: string;
	exportDir?: string;
	onSelectPlan: (taskId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Dashboard panel browsing complete technical plans, diagrams, decisions, risks, and testing details. */
export function PlansPanel({
	scope,
	plans,
	sessions,
	activeTaskId,
	rootDir,
	exportDir,
	onSelectPlan,
	onSelectSession,
	onOpenFile,
}: PlansPanelProps) {
	if (plans.length === 0) {
		return (
			<EmptyState
				title="No plans recorded yet."
				detail="Plans created via write_plan appear here."
			/>
		);
	}

	const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));
	const activePlan = plans.find(p => String(p.taskId) === activeTaskId) ?? plans[0]!;
	const activeSession = sessionMap.get(activePlan.sessionId);
	const resolvedRoot = activeSession?.rootDir ?? rootDir;
	const resolvedExportDir = activeSession?.exportDir ?? exportDir;
	const fileName = formatTaskFilename(activePlan.taskId, activePlan.slug, "plan");
	const planFilePath = activePlan.generatedPlanPath
		?? (resolvedExportDir
			? `${resolvedExportDir.replace(/\/$/, "")}/${fileName}`
			: undefined);
	const followsRef = activePlan.follows
		? resolveFileReference(activePlan.follows, {
				rootDir: resolvedRoot,
				exportDir: resolvedExportDir,
			})
		: null;

	return (
		<div className={styles["artifact-panel"]}>
			{plans.length > 1 && (
				<div className={styles.selector}>
					{plans.map(plan => (
						<ActionButton
							key={plan.taskId}
							variant="subtle"
							size="compact"
							active={plan.taskId === activePlan.taskId}
							onClick={() => onSelectPlan(String(plan.taskId))}
						>
							{`Plan ${formatTaskId(plan.taskId)}`}
						</ActionButton>
					))}
				</div>
			)}

			<div className={styles.meta}>
				{planFilePath
					? (
							<FileLink
								path={planFilePath}
								label={fileName}
								rootDir={resolvedRoot}
								onOpenFile={onOpenFile}
							/>
						)
					: <code>{fileName}</code>}
				<span>{`${activePlan.target.repo} @ ${activePlan.target.branch} (${activePlan.target.commit})`}</span>
				{activePlan.reviewStatus && <StatusBadge label={activePlan.reviewStatus} />}
				{activePlan.follows && (
					followsRef
						? (
								<span>
									{"Follows: "}
									<FileLink
										path={followsRef.path}
										lineStart={followsRef.lineStart}
										lineEnd={followsRef.lineEnd}
										label={followsRef.label}
										rootDir={resolvedRoot}
										onOpenFile={onOpenFile}
									/>
								</span>
							)
						: <StatusBadge label={`Follows: ${activePlan.follows}`} tone="info" />
				)}
				{scope === "group" && (
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={() => onSelectSession(activePlan.sessionId)}
					>
						{activeSession?.title ?? activePlan.sessionId}
					</ActionButton>
				)}
			</div>

			<PlanDocumentView
				plan={activePlan}
				overviewTitle={`Plan ${formatTaskId(activePlan.taskId)}: ${activePlan.title}`}
				rootDir={resolvedRoot}
				exportDir={resolvedExportDir}
				onOpenFile={onOpenFile}
			/>
		</div>
	);
}
