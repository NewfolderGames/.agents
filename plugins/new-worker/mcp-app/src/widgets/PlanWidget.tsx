import type { PlanRecord, WidgetDisplayMode } from "@/shared/contracts.js";
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

export interface PlanWidgetProps {
	plan?: PlanRecord;
	rootDir?: string;
	defaultDisplayMode: WidgetDisplayMode;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Standalone inline widget displaying a technical plan summary, key decisions, and planned files. */
export function PlanWidget({
	plan,
	rootDir,
	defaultDisplayMode,
	onOpenFile,
}: PlanWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!plan) {
		return <EmptyState title="Plan unavailable." />;
	}

	const fileName = formatTaskFilename(plan.taskId, plan.slug, "plan");

	if (displayMode === "minimized") {
		return (
			<div className={shellStyles.minrow}>
				<span className={shellStyles.mintitle}>
					{`Plan ${formatTaskId(plan.taskId)}: ${plan.title}`}
				</span>
				<div className={shellStyles.minmeta}>
					<StatusBadge label={`Files: ${plan.fileStructure.length}`} />
					<StatusBadge label={`Checks: ${plan.testing.validationCommands.length}`} />
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
			title={`Plan ${formatTaskId(plan.taskId)}: ${plan.title}`}
			actions={(
				<>
					<StatusBadge label={`Files: ${plan.fileStructure.length}`} />
					<StatusBadge label={`Checks: ${plan.testing.validationCommands.length}`} />
					<ActionButton variant="subtle" size="compact" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</>
			)}
		>
			<div className={styles["artifact-widget"]}>
				<div className={styles.meta}>
					<code>{fileName}</code>
					<span>{`${plan.target.repo} @ ${plan.target.branch} (${plan.target.commit})`}</span>
				</div>
				<MarkdownBlock content={plan.overview} />
				{!isCompact && (
					<>
						<strong>Key Decisions</strong>
						<ol className={styles.list}>
							{plan.keyDecisions.map((dec, idx) => (
								<li key={idx}>
									<MarkdownBlock content={dec} />
								</li>
							))}
						</ol>
						<strong>Files</strong>
						<ul className={styles.list}>
							{plan.fileStructure.map((entry, idx) => (
								<li key={idx}>
									<FileLink
										path={entry.path}
										rootDir={rootDir}
										onOpenFile={onOpenFile}
									/>
									{` (${entry.action}: ${entry.reason})`}
								</li>
							))}
						</ul>
					</>
				)}
			</div>
		</SectionCard>
	);
}
