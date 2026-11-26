import type { PlanRecord } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import shellStyles from "./WidgetShell.module.css";

export interface PlanWidgetProps {
	plan?: PlanRecord;
	rootDir?: string;
	exportDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Single-row inline summary for a technical plan with an exported file link. */
export function PlanWidget({
	plan,
	rootDir,
	exportDir,
	onOpenFile,
}: PlanWidgetProps) {
	if (!plan) {
		return <EmptyState title="Plan unavailable." />;
	}

	const fileName = formatTaskFilename(plan.taskId, plan.slug, "plan");
	const planFilePath = plan.generatedPlanPath
		?? (exportDir
			? `${exportDir.replace(/\/$/, "")}/${fileName}`
			: undefined);
	const titleText = `Plan ${formatTaskId(plan.taskId)}: ${plan.title}`;

	return (
		<div className={shellStyles.minrow}>
			<span className={shellStyles.mintitle}>{titleText}</span>
			<div className={shellStyles.minmeta}>
				{planFilePath && (
					<FileLink
						path={planFilePath}
						label={fileName}
						rootDir={rootDir}
						onOpenFile={onOpenFile}
					/>
				)}
				{plan.reviewStatus && <StatusBadge label={plan.reviewStatus} />}
			</div>
		</div>
	);
}
