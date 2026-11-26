import type { PlanRecord, WidgetDisplayMode } from "@/shared/contracts.js";
import { resolveFileReference } from "@/shared/fileRefs.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { PlanDocumentView } from "@/ui/artifacts/PlanDocumentView.js";
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
	exportDir?: string;
	defaultDisplayMode: WidgetDisplayMode;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Standalone inline widget displaying a technical plan in minimized, compact, or full parity mode. */
export function PlanWidget({
	plan,
	rootDir,
	exportDir,
	defaultDisplayMode,
	onOpenFile,
}: PlanWidgetProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (!plan) {
		return <EmptyState title="Plan unavailable." />;
	}

	const fileName = formatTaskFilename(plan.taskId, plan.slug, "plan");
	const planFilePath = plan.generatedPlanPath
		?? (exportDir
			? `${exportDir.replace(/\/$/, "")}/${fileName}`
			: undefined);
	const followsRef = plan.follows
		? resolveFileReference(plan.follows, { rootDir, exportDir })
		: null;

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
					{planFilePath
						? (
								<FileLink
									path={planFilePath}
									label={fileName}
									rootDir={rootDir}
									onOpenFile={onOpenFile}
								/>
							)
						: <code>{fileName}</code>}
					<span>{`${plan.target.repo} @ ${plan.target.branch} (${plan.target.commit})`}</span>
					{plan.reviewStatus && <StatusBadge label={plan.reviewStatus} />}
					{plan.follows && (
						followsRef
							? (
									<span>
										{"Follows: "}
										<FileLink
											path={followsRef.path}
											lineStart={followsRef.lineStart}
											lineEnd={followsRef.lineEnd}
											label={followsRef.label}
											rootDir={rootDir}
											onOpenFile={onOpenFile}
										/>
									</span>
								)
							: <StatusBadge label={`Follows: ${plan.follows}`} tone="info" />
					)}
				</div>
				{isCompact
					? (
							<MarkdownBlock
								content={plan.overview}
								rootDir={rootDir}
								exportDir={exportDir}
								onOpenFile={onOpenFile}
							/>
						)
					: (
							<PlanDocumentView
								plan={plan}
								rootDir={rootDir}
								exportDir={exportDir}
								onOpenFile={onOpenFile}
							/>
						)}
			</div>
		</SectionCard>
	);
}
