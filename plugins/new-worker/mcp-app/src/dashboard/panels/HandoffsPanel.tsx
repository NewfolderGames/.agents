import type { DashboardScope, HandoffRecord, SessionSummary } from "@/shared/contracts.js";
import { formatShortTimestamp, formatTaskId } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./HandoffsPanel.module.css";

export interface HandoffsPanelProps {
	scope: DashboardScope;
	handoffs: HandoffRecord[];
	sessions: SessionSummary[];
	rootDir?: string;
	onSelectSession: (sessionId: string) => void;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Dashboard panel listing structured session handoffs, verification commands, and artifact links. */
export function HandoffsPanel({
	scope,
	handoffs,
	sessions,
	rootDir,
	onSelectSession,
	onOpenFile,
}: HandoffsPanelProps) {
	if (handoffs.length === 0) {
		return (
			<EmptyState
				title="No handoffs recorded yet."
				detail="Structured handoffs from record_handoff appear here."
			/>
		);
	}

	const sessionMap = new Map(sessions.map(s => [s.sessionId, s]));

	return (
		<div className={styles["handoffs-panel"]}>
			{handoffs.map((h) => {
				const resolvedRoot = sessionMap.get(h.sessionId)?.rootDir ?? rootDir;
				return (
					<SectionCard
						key={h.id}
						title={h.title}
						actions={(
							<>
								<StatusBadge label={h.kind} />
								{h.taskId
									&& <StatusBadge label={`Task ${formatTaskId(h.taskId)}`} />}
								{scope === "group" && (
									<ActionButton
										variant="subtle"
										size="compact"
										onClick={() => onSelectSession(h.sessionId)}
									>
										{sessionMap.get(h.sessionId)?.title ?? h.sessionId}
									</ActionButton>
								)}
								<StatusBadge label={formatShortTimestamp(h.createdAt)} />
							</>
						)}
					>
						<div className={styles.cardbody}>
							<div>{h.summary}</div>
							{h.workingNow && (
								<div>
									<strong>Working now:</strong>
									{" "}
									{h.workingNow}
								</div>
							)}
							{h.verifyCommand && (
								<div>
									<strong>Verify:</strong>
									{" "}
									<code>{h.verifyCommand}</code>
								</div>
							)}
							{h.entryPoint && (
								<div>
									<strong>Entry point:</strong>
									{" "}
									<code>{h.entryPoint}</code>
								</div>
							)}
							{h.nextStep && (
								<div>
									<strong>Next step:</strong>
									{" "}
									{h.nextStep}
								</div>
							)}
							{h.artifactLinks.length > 0 && (
								<div className={styles.links}>
									{h.artifactLinks.map((ref, idx) => (
										<FileLink
											key={`${ref.path}-${idx}`}
											path={ref.path}
											lineStart={ref.lineStart}
											lineEnd={ref.lineEnd}
											label={ref.label}
											rootDir={resolvedRoot}
											onOpenFile={onOpenFile}
										/>
									))}
								</div>
							)}
						</div>
					</SectionCard>
				);
			})}
		</div>
	);
}
