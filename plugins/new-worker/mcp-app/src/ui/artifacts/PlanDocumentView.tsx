import { useMemo } from "react";
import type { PlanFileEntry, PlanRecord } from "@/shared/contracts.js";
import { collectPlanPaths, resolveFileReference } from "@/shared/fileRefs.js";
import { wrapMermaidFence } from "@/shared/mermaid.js";
import { CopyButton } from "@/ui/primitives/CopyButton.js";
import { DataTable } from "@/ui/primitives/DataTable.js";
import { FileLink } from "@/ui/primitives/FileLink.js";
import { MarkdownBlock } from "@/ui/primitives/MarkdownBlock.js";
import { SectionCard } from "@/ui/primitives/SectionCard.js";
import { type BadgeTone, StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ArtifactDocument.module.css";

export interface PlanDocumentViewProps {
	plan: PlanRecord;
	overviewTitle?: string;
	rootDir?: string;
	exportDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

function getFileActionTone(action: PlanFileEntry["action"]): BadgeTone {
	switch (action) {
		case "added":
			return "success";
		case "deleted":
			return "danger";
		case "modified":
			return "info";
	}
}

/**
 * Full-parity renderer for all `PlanRecord` sections matching `session-templates.md`,
 * shared between the Dashboard `PlansPanel` and full-mode `PlanWidget`.
 */
export function PlanDocumentView({
	plan,
	overviewTitle = "Overview & Goals",
	rootDir,
	exportDir,
	onOpenFile,
}: PlanDocumentViewProps) {
	const mermaidFence = plan.architectureDiagram ? wrapMermaidFence(plan.architectureDiagram) : "";
	const knownPaths = useMemo(() => collectPlanPaths(plan), [plan]);
	const followsRef = plan.follows
		? resolveFileReference(plan.follows, { rootDir, exportDir, knownPaths })
		: null;
	const hasScope = plan.scope.inScope.length > 0 || plan.scope.outOfScope.length > 0;
	const hasTesting = plan.testing.validationCommands.length > 0
		|| plan.testing.keyScenarios.length > 0
		|| (plan.testing.edgeCases?.length ?? 0) > 0
		|| plan.testing.testChanges.length > 0;

	const renderMarkdown = (content: string) => (
		<MarkdownBlock
			content={content}
			rootDir={rootDir}
			exportDir={exportDir}
			knownPaths={knownPaths}
			onOpenFile={onOpenFile}
		/>
	);

	return (
		<div className={styles["artifact-document"]}>
			<SectionCard title={overviewTitle}>
				<div className={styles.subsection}>
					{renderMarkdown(plan.overview)}
				</div>

				{plan.expectedOutcomes.length > 0 && (
					<div className={styles.subsection}>
						<h3 className={styles.subheading}>Expected Outcomes</h3>
						<ul className={styles.list}>
							{plan.expectedOutcomes.map((outcome, idx) => (
								<li key={idx}>
									{renderMarkdown(outcome)}
								</li>
							))}
						</ul>
					</div>
				)}

				{plan.follows && (
					<div className={styles.subsection}>
						<div className={styles["meta-row"]}>
							<strong>Follows:</strong>
							{followsRef
								? (
										<FileLink
											path={followsRef.path}
											lineStart={followsRef.lineStart}
											lineEnd={followsRef.lineEnd}
											label={followsRef.label}
											rootDir={rootDir}
											onOpenFile={onOpenFile}
										/>
									)
								: renderMarkdown(plan.follows)}
						</div>
					</div>
				)}

				{plan.calibration && (
					<div className={styles.subsection}>
						<h3 className={styles.subheading}>Calibration</h3>
						<div className={styles["meta-row"]}>
							<StatusBadge label={`Cadence: ${plan.calibration.cadence}`} />
							<StatusBadge label={`Familiarity: ${plan.calibration.familiarity}`} />
							<StatusBadge label={`Structure: ${plan.calibration.structureStance}`} />
						</div>
					</div>
				)}

				{plan.reviewComment && (
					<div className={styles.subsection}>
						<div className={styles.callout}>
							<div className={styles["meta-row"]}>
								<strong>Review Note</strong>
								{plan.approvedVia
									&& <StatusBadge label={`via ${plan.approvedVia}`} tone="info" />}
							</div>
							{renderMarkdown(plan.reviewComment)}
						</div>
					</div>
				)}
			</SectionCard>

			{hasScope && (
				<SectionCard title="Scope">
					{plan.scope.inScope.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>In Scope</h3>
							<ul className={styles.list}>
								{plan.scope.inScope.map((item, idx) => (
									<li key={idx}>
										{renderMarkdown(item)}
									</li>
								))}
							</ul>
						</div>
					)}
					{plan.scope.outOfScope.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Out of Scope</h3>
							<ul className={styles.list}>
								{plan.scope.outOfScope.map((item, idx) => (
									<li key={idx}>
										{renderMarkdown(item)}
									</li>
								))}
							</ul>
						</div>
					)}
				</SectionCard>
			)}

			{plan.openQuestions && plan.openQuestions.length > 0 && (
				<SectionCard title="Open Questions & Assumptions">
					<ol className={styles.list}>
						{plan.openQuestions.map((question, idx) => (
							<li key={idx}>
								{renderMarkdown(question)}
							</li>
						))}
					</ol>
				</SectionCard>
			)}

			{plan.userStories && plan.userStories.length > 0 && (
				<SectionCard title="User Stories">
					<ul className={styles.list}>
						{plan.userStories.map((story, idx) => (
							<li key={idx}>
								{renderMarkdown(story)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			{plan.functionalRequirements && plan.functionalRequirements.length > 0 && (
				<SectionCard title="Functional Requirements">
					<ol className={styles.list}>
						{plan.functionalRequirements.map((req, idx) => (
							<li key={idx}>
								{renderMarkdown(req)}
							</li>
						))}
					</ol>
				</SectionCard>
			)}

			{plan.nonFunctionalRequirements && plan.nonFunctionalRequirements.length > 0 && (
				<SectionCard title="Non-Functional Requirements">
					<ul className={styles.list}>
						{plan.nonFunctionalRequirements.map((req, idx) => (
							<li key={idx}>
								{renderMarkdown(req)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			{plan.currentImplementation.length > 0 && (
				<SectionCard title="Current Implementation">
					<ul className={styles.list}>
						{plan.currentImplementation.map((item, idx) => (
							<li key={idx}>
								{renderMarkdown(item)}
							</li>
						))}
					</ul>
				</SectionCard>
			)}

			{plan.keyDecisions.length > 0 && (
				<SectionCard title="Key Decisions">
					<ol className={styles.list}>
						{plan.keyDecisions.map((decision, idx) => (
							<li key={idx}>
								{renderMarkdown(decision)}
							</li>
						))}
					</ol>
				</SectionCard>
			)}

			{plan.proposedChanges.length > 0 && (
				<SectionCard title="Proposed Changes">
					<ol className={styles.list}>
						{plan.proposedChanges.map((change, idx) => (
							<li key={idx}>
								{renderMarkdown(change)}
							</li>
						))}
					</ol>
				</SectionCard>
			)}

			{plan.dataModels?.trim() && (
				<SectionCard title="Data Models / Contracts">
					{renderMarkdown(plan.dataModels)}
				</SectionCard>
			)}

			{plan.components && plan.components.length > 0 && (
				<SectionCard title="Components">
					<DataTable
						caption="Planned components"
						hideCaption
						rows={plan.components}
						getRowKey={(row, idx) => `${row.component}-${idx}`}
						columns={[
							{
								key: "component",
								header: "Component",
								isRowHeader: true,
								render: row => <code>{row.component}</code>,
							},
							{
								key: "path",
								header: "Package / Path",
								render: row => (
									<FileLink
										path={row.path}
										rootDir={rootDir}
										onOpenFile={row.path.endsWith("/") ? undefined : onOpenFile}
									/>
								),
							},
							{
								key: "responsibility",
								header: "Responsibility",
								render: row => renderMarkdown(row.responsibility),
							},
						]}
					/>
				</SectionCard>
			)}

			{plan.fileStructure.length > 0 && (
				<SectionCard title="File Structure">
					<DataTable
						caption="Planned files"
						hideCaption
						rows={plan.fileStructure}
						getRowKey={(row, idx) => `${row.path}-${idx}`}
						columns={[
							{
								key: "path",
								header: "Path",
								isRowHeader: true,
								render: row => (
									<FileLink
										path={row.path}
										rootDir={rootDir}
										onOpenFile={row.path.endsWith("/") ? undefined : onOpenFile}
									/>
								),
							},
							{
								key: "action",
								header: "Action",
								render: row => (
									<StatusBadge
										label={row.action}
										tone={getFileActionTone(row.action)}
									/>
								),
							},
							{
								key: "reason",
								header: "Reason",
								render: row => renderMarkdown(row.reason),
							},
						]}
					/>
				</SectionCard>
			)}

			{mermaidFence && (
				<SectionCard title="Architecture Diagram">
					<MarkdownBlock content={mermaidFence} />
				</SectionCard>
			)}

			{plan.risks && plan.risks.length > 0 && (
				<SectionCard title="Risks">
					<DataTable
						caption="Identified risks and mitigations"
						hideCaption
						rows={plan.risks}
						getRowKey={(row, idx) => `${row.risk}-${idx}`}
						columns={[
							{
								key: "risk",
								header: "Risk",
								isRowHeader: true,
								render: row => renderMarkdown(row.risk),
							},
							{
								key: "impact",
								header: "Impact",
								render: row => renderMarkdown(row.impact),
							},
							{
								key: "mitigation",
								header: "Mitigation",
								render: row => renderMarkdown(row.mitigation),
							},
						]}
					/>
				</SectionCard>
			)}

			{plan.apiReference?.trim() && (
				<SectionCard title="API Reference">
					{renderMarkdown(plan.apiReference)}
				</SectionCard>
			)}

			{plan.migrationPlan?.trim() && (
				<SectionCard title="Migration Plan">
					{renderMarkdown(plan.migrationPlan)}
				</SectionCard>
			)}

			{plan.alternatives?.trim() && (
				<SectionCard title="Alternatives Considered">
					{renderMarkdown(plan.alternatives)}
				</SectionCard>
			)}

			{hasTesting && (
				<SectionCard title="Testing">
					{plan.testing.validationCommands.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Validation Approach</h3>
							<ul className={styles.commands}>
								{plan.testing.validationCommands.map((cmd, idx) => (
									<li key={idx} className={styles["command-row"]}>
										<code>{cmd}</code>
										<CopyButton text={cmd} label="Copy" />
									</li>
								))}
							</ul>
						</div>
					)}

					{plan.testing.keyScenarios.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Key Scenarios</h3>
							<ul className={styles.list}>
								{plan.testing.keyScenarios.map((scenario, idx) => (
									<li key={idx}>
										{renderMarkdown(scenario)}
									</li>
								))}
							</ul>
						</div>
					)}

					{plan.testing.edgeCases && plan.testing.edgeCases.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Edge Cases</h3>
							<ul className={styles.list}>
								{plan.testing.edgeCases.map((edge, idx) => (
									<li key={idx}>
										{renderMarkdown(edge)}
									</li>
								))}
							</ul>
						</div>
					)}

					{plan.testing.testChanges.length > 0 && (
						<div className={styles.subsection}>
							<h3 className={styles.subheading}>Test Changes</h3>
							<ul className={styles.list}>
								{plan.testing.testChanges.map((change, idx) => (
									<li key={idx}>
										{renderMarkdown(change)}
									</li>
								))}
							</ul>
						</div>
					)}
				</SectionCard>
			)}
		</div>
	);
}
