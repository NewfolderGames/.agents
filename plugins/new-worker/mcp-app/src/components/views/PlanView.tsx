import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { SectionBlock } from "@/components/common/display/SectionBlock.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { PlanSectionList } from "@/components/prefabs/PlanSectionList.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatTaskFilename } from "@/shared/format.js";
import type { PlanRecord, WidgetDisplayMode } from "@/shared/schema.js";
import { selectActivePlan } from "./PlanView.util.js";
import styles from "./PlanView.module.css";

export interface PlanViewProps {
	plans: PlanRecord[];
	activeTaskNumber?: string;
	workspacePath?: string;
	defaultDisplayMode?: WidgetDisplayMode;
	onSelectPlan: (taskNumber: string) => void;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function PlanView({
	plans,
	activeTaskNumber,
	workspacePath,
	defaultDisplayMode = "full",
	onSelectPlan,
	onOpenFile,
}: PlanViewProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);
	const activePlan = selectActivePlan(plans, activeTaskNumber);
	if (!activePlan) {
		return (
			<EmptyState
				title="No plans recorded in this session."
				detail="Plans written via write_plan appear here."
			/>
		);
	}

	if (displayMode === "minimized") {
		return (
			<div className={styles["plan-view"]}>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>
						{`Plan ${activePlan.taskNumber}: ${activePlan.title}`}
					</span>
					<div className={styles.minmeta}>
						<StatusBadge label={`Files: ${activePlan.fileStructure.length}`} />
						<StatusBadge
							label={`Checks: ${activePlan.testing.validationCommands.length}`}
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

	return (
		<div className={styles["plan-view"]}>
			{plans.length > 1 && (
				<div className={styles.selector}>
					{plans.map(plan => (
						<ActionButton
							key={plan.taskNumber}
							variant="subtle"
							active={plan.taskNumber === activePlan.taskNumber}
							onClick={() => onSelectPlan(plan.taskNumber)}
						>
							Plan
							{" "}
							{plan.taskNumber}
						</ActionButton>
					))}
				</div>
			)}

			<div className={styles.meta}>
				<div className={styles.heading}>
					<h2 className={styles.title}>
						Plan
						{" "}
						{activePlan.taskNumber}
						:
						{" "}
						{activePlan.title}
					</h2>
					<ActionButton variant="subtle" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</div>
				<div className={styles.sub}>
					<code>{formatTaskFilename(activePlan.taskNumber, activePlan.slug, "plan")}</code>
					<span>
						{activePlan.target.repo}
						{" "}
						@
						{activePlan.target.branch}
						{" "}
						(
						{activePlan.target.commit}
						)
					</span>
					{activePlan.generatedPlanPath && (
						<code>{activePlan.generatedPlanPath}</code>
					)}
				</div>
			</div>

			{isCompact
				? (
						<SectionBlock
							title="Overview"
							actions={(
								<div className={styles.summarybadges}>
									<StatusBadge
										label={`Outcomes: ${activePlan.expectedOutcomes.length}`}
									/>
									<StatusBadge label={`Files: ${activePlan.fileStructure.length}`} />
									<StatusBadge
										label={`Checks: ${activePlan.testing.validationCommands.length}`}
									/>
								</div>
							)}
						>
							<MarkdownText content={activePlan.overview} />
						</SectionBlock>
					)
				: (
						<PlanSectionList
							plan={activePlan}
							workspacePath={workspacePath}
							onOpenFile={onOpenFile}
						/>
					)}
		</div>
	);
}
