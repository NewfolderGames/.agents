import { DataTable } from "@/components/common/display/DataTable.js";
import { FileLink } from "@/components/common/display/FileLink.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { SectionBlock } from "@/components/common/display/SectionBlock.js";
import type { PlanRecord } from "@/shared/schema.js";
import styles from "./PlanSectionList.module.css";

export interface PlanSectionListProps {
	plan: PlanRecord;
	workspacePath?: string;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function PlanSectionList({
	plan,
	workspacePath,
	onOpenFile,
}: PlanSectionListProps) {
	return (
		<div className={styles["plan-section-list"]}>
			<SectionBlock title="Overview & Goals">
				<MarkdownText content={plan.overview} />
				<ul className={styles.list}>
					{plan.expectedOutcomes.map((outcome, idx) => (
						<li key={idx}>{outcome}</li>
					))}
				</ul>
			</SectionBlock>

			<SectionBlock title="Scope">
				<div className={styles.columns}>
					<div className={styles.col}>
						<strong>In Scope</strong>
						<ul className={styles.list}>
							{plan.scope.inScope.map((item, idx) => (
								<li key={idx}>{item}</li>
							))}
						</ul>
					</div>
					<div className={styles.col}>
						<strong>Out of Scope</strong>
						<ul className={styles.list}>
							{plan.scope.outOfScope.map((item, idx) => (
								<li key={idx}>{item}</li>
							))}
						</ul>
					</div>
				</div>
			</SectionBlock>

			{plan.openQuestions && plan.openQuestions.length > 0 && (
				<SectionBlock title="Open Questions & Assumptions">
					<ol className={styles.list}>
						{plan.openQuestions.map((item, idx) => (
							<li key={idx}>{item}</li>
						))}
					</ol>
				</SectionBlock>
			)}

			<SectionBlock title="Current Implementation & Key Decisions">
				<strong>Current Implementation</strong>
				<ul className={styles.list}>
					{plan.currentImplementation.map((item, idx) => (
						<li key={idx}>{item}</li>
					))}
				</ul>
				<strong>Key Decisions</strong>
				<ol className={styles.list}>
					{plan.keyDecisions.map((item, idx) => (
						<li key={idx}>{item}</li>
					))}
				</ol>
				<strong>Proposed Changes</strong>
				<ol className={styles.list}>
					{plan.proposedChanges.map((item, idx) => (
						<li key={idx}>{item}</li>
					))}
				</ol>
			</SectionBlock>

			{plan.components && plan.components.length > 0 && (
				<SectionBlock title="Components">
					<DataTable
						headers={["Component", "Path", "Responsibility"]}
						rows={plan.components.map(c => [
							<code key="comp">{c.component}</code>,
							<FileLink
								key="path"
								path={c.path}
								workspacePath={workspacePath}
								onOpenFile={onOpenFile}
							/>,
							<span key="resp">{c.responsibility}</span>,
						])}
					/>
				</SectionBlock>
			)}

			<SectionBlock title="File Structure">
				<DataTable
					headers={["Path", "Action", "Reason"]}
					rows={plan.fileStructure.map(f => [
						<FileLink
							key="path"
							path={f.path}
							workspacePath={workspacePath}
							onOpenFile={onOpenFile}
						/>,
						<code key="act">{f.action}</code>,
						<span key="reason">{f.reason}</span>,
					])}
				/>
			</SectionBlock>

			{plan.risks && plan.risks.length > 0 && (
				<SectionBlock title="Risks">
					<DataTable
						headers={["Risk", "Impact", "Mitigation"]}
						rows={plan.risks.map(r => [r.risk, r.impact, r.mitigation])}
					/>
				</SectionBlock>
			)}

			<SectionBlock title="Testing & Validation">
				<strong>Validation Commands</strong>
				<ol className={styles.list}>
					{plan.testing.validationCommands.map((cmd, idx) => (
						<li key={idx}>
							<code>{cmd}</code>
						</li>
					))}
				</ol>
				<strong>Key Scenarios</strong>
				<ul className={styles.list}>
					{plan.testing.keyScenarios.map((item, idx) => (
						<li key={idx}>{item}</li>
					))}
				</ul>
			</SectionBlock>
		</div>
	);
}
