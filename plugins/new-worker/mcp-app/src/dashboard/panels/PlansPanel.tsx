import type { DashboardScope, PlanRecord, SessionSummary } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { DataTable } from "@/ui/primitives/DataTable.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { MarkdownBlock } from "@/ui/primitives/MarkdownBlock.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactPanel.module.css";

export interface PlansPanelProps {
	scope: DashboardScope;
	plans: PlanRecord[];
	sessions: SessionSummary[];
	activeTaskId?: string;
	rootDir?: string;
	onSelectPlan: (taskId: string) => void;
	onSelectSession: (sessionId: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Dashboard panel browsing technical plans, scope boundaries, decisions, and planned file changes. */
export function PlansPanel({
	scope,
	plans,
	sessions,
	activeTaskId,
	rootDir,
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
	const resolvedRoot = sessionMap.get(activePlan.sessionId)?.rootDir ?? rootDir;

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
				<code>{formatTaskFilename(activePlan.taskId, activePlan.slug, "plan")}</code>
				<span>{`${activePlan.target.repo} @ ${activePlan.target.branch} (${activePlan.target.commit})`}</span>
				{activePlan.reviewStatus && <StatusBadge label={activePlan.reviewStatus} />}
				{scope === "group" && (
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={() => onSelectSession(activePlan.sessionId)}
					>
						{sessionMap.get(activePlan.sessionId)?.title ?? activePlan.sessionId}
					</ActionButton>
				)}
			</div>

			<SectionCard title={`Plan ${formatTaskId(activePlan.taskId)}: ${activePlan.title}`}>
				<MarkdownBlock content={activePlan.overview} />
			</SectionCard>

			<SectionCard title="Scope">
				<strong>In Scope</strong>
				<ul className={styles.list}>
					{activePlan.scope.inScope.map((item, idx) => (
						<li key={idx}>
							<MarkdownBlock content={item} />
						</li>
					))}
				</ul>
				<strong>Out of Scope</strong>
				<ul className={styles.list}>
					{activePlan.scope.outOfScope.map((item, idx) => (
						<li key={idx}>
							<MarkdownBlock content={item} />
						</li>
					))}
				</ul>
			</SectionCard>

			<SectionCard title="Key Decisions & Proposed Changes">
				<ol className={styles.list}>
					{activePlan.keyDecisions.map((dec, idx) => (
						<li key={idx}>
							<MarkdownBlock content={dec} />
						</li>
					))}
				</ol>
				<ol className={styles.list}>
					{activePlan.proposedChanges.map((chg, idx) => (
						<li key={idx}>
							<MarkdownBlock content={chg} />
						</li>
					))}
				</ol>
			</SectionCard>

			<SectionCard title="File Structure">
				<DataTable
					caption="Planned files"
					hideCaption
					rows={activePlan.fileStructure}
					getRowKey={(row, idx) => `${row.path}-${idx}`}
					columns={[
						{
							key: "path",
							header: "Path",
							isRowHeader: true,
							render: row => (
								<FileLink
									path={row.path}
									rootDir={resolvedRoot}
									onOpenFile={onOpenFile}
								/>
							),
						},
						{
							key: "action",
							header: "Action",
							render: row => <StatusBadge label={row.action} />,
						},
						{ key: "reason", header: "Reason", render: row => row.reason },
					]}
				/>
			</SectionCard>

			<SectionCard title="Validation Commands">
				<ul className={styles.list}>
					{activePlan.testing.validationCommands.map((cmd, idx) => (
						<li key={idx}>
							<code>{cmd}</code>
						</li>
					))}
				</ul>
			</SectionCard>
		</div>
	);
}
