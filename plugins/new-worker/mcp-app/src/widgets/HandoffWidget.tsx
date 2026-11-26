import type { HandoffRecord, WidgetDisplayMode } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import { useDisplayMode } from "./useDisplayMode.js";
import shellStyles from "./WidgetShell.module.css";
import styles from "./HandoffWidget.module.css";

export interface HandoffWidgetProps {
	handoff?: HandoffRecord;
	rootDir?: string;
	defaultDisplayMode: WidgetDisplayMode;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Standalone inline widget displaying a session handoff summary, entry point, and verification command. */
export function HandoffWidget({
	handoff,
	rootDir,
	defaultDisplayMode,
	onOpenFile,
}: HandoffWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!handoff) {
		return <EmptyState title="Handoff unavailable." />;
	}

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>{handoff.title}</span>
				<div className={shellStyles.minmeta}>
					<StatusBadge label={handoff.kind} />
					{handoff.taskId
						&& <StatusBadge label={`Task ${formatTaskId(handoff.taskId)}`} />}
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
			title={handoff.title}
			actions={(
				<>
					<StatusBadge label={handoff.kind} />
					{handoff.taskId
						&& <StatusBadge label={`Task ${formatTaskId(handoff.taskId)}`} />}
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</>
			)}
		>
			<div className={styles["handoff-widget"]}>
				<p className={styles.summary}>{handoff.summary}</p>
				{!isCompact && (
					<>
						<div className={styles.rows}>
							{handoff.workingNow && (
								<div>
									<strong>Working now:</strong>
									{" "}
									{handoff.workingNow}
								</div>
							)}
							{handoff.verifyCommand && (
								<div>
									<strong>Verify:</strong>
									{" "}
									<code>{handoff.verifyCommand}</code>
								</div>
							)}
							{handoff.entryPoint && (
								<div>
									<strong>Entry point:</strong>
									{" "}
									<code>{handoff.entryPoint}</code>
								</div>
							)}
							{handoff.nextStep && (
								<div>
									<strong>Next step:</strong>
									{" "}
									{handoff.nextStep}
								</div>
							)}
						</div>
						{handoff.artifactLinks.length > 0 && (
							<div className={styles.links}>
								{handoff.artifactLinks.map((ref, idx) => (
									<FileLink
										key={`${ref.path}-${idx}`}
										path={ref.path}
										lineStart={ref.lineStart}
										lineEnd={ref.lineEnd}
										label={ref.label}
										rootDir={rootDir}
										onOpenFile={onOpenFile}
									/>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</SectionCard>
	);
}
