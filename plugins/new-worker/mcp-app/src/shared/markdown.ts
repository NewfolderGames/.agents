import type { AuditFinding, FindingSeverity, PlanRecord, ReportFollowUp, ReportRecord, TaskItem, TaskRecord } from "./contracts.js";
import { formatFileLocation, formatTaskId, padTaskId } from "./format.js";

function formatSessionLink(fileName: string, linkBase?: string): string {
	if (!linkBase) {
		return `./${fileName}`;
	}
	const clean = linkBase.endsWith("/") ? linkBase.slice(0, -1) : linkBase;
	return `${clean}/${fileName}`;
}

function formatWorkspaceLink(
	filePath: string,
	lineStart?: number,
	lineEnd?: number,
	workspaceLinkBase?: string,
): string {
	const label = formatFileLocation(filePath, lineStart, lineEnd);
	if (!workspaceLinkBase) {
		return `\`${label}\``;
	}
	const cleanBase = workspaceLinkBase.endsWith("/")
		? workspaceLinkBase.slice(0, -1)
		: workspaceLinkBase;
	const lineFragment = lineStart
		? lineEnd && lineEnd !== lineStart
			? `#L${lineStart}-L${lineEnd}`
			: `#L${lineStart}`
		: "";
	const normalizedPath = filePath.startsWith("/") ? filePath.slice(1) : filePath.replace(/^\.\//, "");
	return `[${label}](${cleanBase}/${normalizedPath}${lineFragment})`;
}

function formatTaskStatusCell(task: TaskRecord): string {
	switch (task.status) {
		case "done":
			return "Done";
		case "cancelled":
			return "Cancelled";
		case "superseded":
			return "Superseded";
		case "planned":
			return "Planned";
		case "in_progress": {
			if (task.steps.length === 0) {
				return "In Progress";
			}
			const totalSteps = task.steps.length;
			const activeStepIndex = task.steps.findIndex(step =>
				step.items.some(item => item.status !== "done"));
			const stepNum = activeStepIndex === -1 ? totalSteps : activeStepIndex + 1;
			return `In Progress (Step ${stepNum}/${totalSteps})`;
		}
	}
}

function isCollapsedTask(task: TaskRecord): boolean {
	return task.status === "done" || task.status === "cancelled" || task.status === "superseded";
}

function formatTaskItemCheckbox(item: TaskItem): string {
	if (item.status === "done") {
		return `- [x] ${item.text}`;
	}
	if (item.status === "in_progress") {
		return `- [ ] **(in progress)** ${item.text}`;
	}
	return `- [ ] ${item.text}`;
}

/** Render a session's `tasks.md` hub using global integer task IDs. */
export function renderTasksMarkdown(tasks: TaskRecord[], linkBase?: string): string {
	const sortedTasks = [...tasks].sort((a, b) => a.taskId - b.taskId);
	const lines: string[] = [
		"# Session Tasks",
		"",
		"| # | Status | Task | Docs |",
		"|---|---|---|---|",
	];

	for (const task of sortedTasks) {
		const planCell = task.planFile
			? `[plan](${formatSessionLink(task.planFile, linkBase)})`
			: "-";
		const reportCell = task.reportFile
			? `[report](${formatSessionLink(task.reportFile, linkBase)})`
			: "-";
		lines.push(
			`| ${formatTaskId(task.taskId)} | ${formatTaskStatusCell(task)} | ${task.title} | ${planCell} \\| ${reportCell} |`,
		);
	}

	const collapsed = sortedTasks.filter(isCollapsedTask);
	const expanded = sortedTasks.filter(task => !isCollapsedTask(task));

	if (collapsed.length > 0) {
		lines.push("", "---", "");
		const trimOldHistory = collapsed.length > 3;
		collapsed.forEach((task, idx) => {
			const keepDetailed = !trimOldHistory || idx >= collapsed.length - 3;
			const summaryMark = task.status === "done" ? "[x]" : "[-]";
			const docsParts: string[] = [];
			if (task.planFile) {
				docsParts.push(`[plan](${formatSessionLink(task.planFile, linkBase)})`);
			}
			if (task.reportFile) {
				docsParts.push(`[report](${formatSessionLink(task.reportFile, linkBase)})`);
			}
			const docsLine = docsParts.length > 0 ? docsParts.join(" | ") : "-";

			lines.push("<details>");
			lines.push(`<summary>${summaryMark} Task ${formatTaskId(task.taskId)} - ${task.title}</summary>`);
			lines.push("");
			lines.push(`- **Docs**: ${docsLine}`);
			lines.push(`- **Summary**: ${task.summary}`);
			if (keepDetailed) {
				lines.push("");
				for (const step of task.steps) {
					const stepMark = step.items.every(item => item.status === "done") ? "x" : " ";
					lines.push(`- [${stepMark}] ${step.title}`);
				}
			}
			lines.push("");
			lines.push("</details>");
			if (idx < collapsed.length - 1) {
				lines.push("");
			}
		});
	}

	for (const task of expanded) {
		lines.push("", "---", "");
		const docsParts: string[] = [];
		if (task.planFile) {
			docsParts.push(`[plan](${formatSessionLink(task.planFile, linkBase)})`);
		}
		if (task.reportFile) {
			docsParts.push(`[report](${formatSessionLink(task.reportFile, linkBase)})`);
		}
		else {
			docsParts.push("report (pending)");
		}

		lines.push(`## Task ${formatTaskId(task.taskId)} - ${task.title}`);
		lines.push("");
		lines.push(`- **Status**: ${formatTaskStatusCell(task)}`);
		lines.push(`- **Docs**: ${docsParts.join(" | ")}`);
		lines.push(`- **Summary**: ${task.summary}`);

		task.steps.forEach((step, stepIdx) => {
			lines.push("");
			lines.push(`### Step ${stepIdx + 1}: ${step.title}`);
			lines.push(step.outcome);
			lines.push("");
			for (const item of step.items) {
				lines.push(formatTaskItemCheckbox(item));
			}
		});
	}

	lines.push("");
	return lines.join("\n");
}

/** Render an immutable `NNN-<slug>.plan.md` document. */
export function renderPlanMarkdown(plan: PlanRecord, linkBase?: string): string {
	const padded = padTaskId(plan.taskId);
	const lines: string[] = [
		`# Plan ${padded}: ${plan.title}`,
		"",
		`- **Task**: \`${formatTaskId(plan.taskId)}\` ([tasks.md](${formatSessionLink("tasks.md", linkBase)}))`,
		`- **Target**: \`${plan.target.repo}\` @ \`${plan.target.branch}\` (\`${plan.target.commit}\`)`,
	];

	if (plan.follows) {
		lines.push(`- **Follows**: ${plan.follows}`);
	}
	if (plan.calibration) {
		lines.push(
			`- **Calibration**: Cadence \`${plan.calibration.cadence}\`, Familiarity \`${plan.calibration.familiarity}\`, Structure \`${plan.calibration.structureStance}\``,
		);
	}

	lines.push("", "## Requirements", "", "### Overview & Goals", plan.overview, "", "Expected outcomes:");
	for (const outcome of plan.expectedOutcomes) {
		lines.push(`- ${outcome}`);
	}

	lines.push("", "### Scope", "", "#### In Scope");
	for (const item of plan.scope.inScope) {
		lines.push(`- ${item}`);
	}
	lines.push("", "#### Out of Scope");
	for (const item of plan.scope.outOfScope) {
		lines.push(`- ${item}`);
	}

	if (plan.openQuestions && plan.openQuestions.length > 0) {
		lines.push("", "### Open Questions & Assumptions");
		plan.openQuestions.forEach((q, idx) => lines.push(`${idx + 1}. ${q}`));
	}
	if (plan.userStories && plan.userStories.length > 0) {
		lines.push("", "### User Stories");
		for (const story of plan.userStories) {
			lines.push(`- ${story}`);
		}
	}
	if (plan.functionalRequirements && plan.functionalRequirements.length > 0) {
		lines.push("", "### Functional Requirements");
		plan.functionalRequirements.forEach((req, idx) => lines.push(`${idx + 1}. ${req}`));
	}
	if (plan.nonFunctionalRequirements && plan.nonFunctionalRequirements.length > 0) {
		lines.push("", "### Non-Functional Requirements");
		for (const req of plan.nonFunctionalRequirements) {
			lines.push(`- ${req}`);
		}
	}

	lines.push("", "## Technical Design", "", "### Current Implementation");
	for (const item of plan.currentImplementation) {
		lines.push(`- ${item}`);
	}

	lines.push("", "### Key Decisions");
	plan.keyDecisions.forEach((dec, idx) => lines.push(`${idx + 1}. ${dec}`));

	lines.push("", "### Proposed Changes");
	plan.proposedChanges.forEach((chg, idx) => lines.push(`${idx + 1}. ${chg}`));

	if (plan.dataModels) {
		lines.push("", "### Data Models / Contracts", "", plan.dataModels);
	}
	if (plan.components && plan.components.length > 0) {
		lines.push("", "### Components", "", "| Component | Package / Path | Responsibility |", "|---|---|---|");
		for (const row of plan.components) {
			lines.push(`| \`${row.component}\` | \`${row.path}\` | ${row.responsibility} |`);
		}
	}

	lines.push("", "### File Structure", "", "```text");
	for (const entry of plan.fileStructure) {
		lines.push(`${entry.path} (${entry.action}: ${entry.reason})`);
	}
	lines.push("```");

	if (plan.architectureDiagram) {
		lines.push("", "### Architecture Diagram", "", "```mermaid", plan.architectureDiagram, "```");
	}
	if (plan.risks && plan.risks.length > 0) {
		lines.push("", "### Risks", "", "| Risk | Impact | Mitigation |", "|---|---|---|");
		for (const risk of plan.risks) {
			lines.push(`| ${risk.risk} | ${risk.impact} | ${risk.mitigation} |`);
		}
	}
	if (plan.alternatives) {
		lines.push("", "## Alternatives Considered", "", plan.alternatives);
	}

	lines.push("", "## Testing", "", "### Validation Approach");
	plan.testing.validationCommands.forEach((cmd, idx) => lines.push(`${idx + 1}. \`${cmd}\``));

	lines.push("", "### Key Scenarios");
	for (const scenario of plan.testing.keyScenarios) {
		lines.push(`- ${scenario}`);
	}
	if (plan.testing.edgeCases && plan.testing.edgeCases.length > 0) {
		lines.push("", "### Edge Cases");
		for (const edge of plan.testing.edgeCases) {
			lines.push(`- ${edge}`);
		}
	}
	lines.push("", "### Test Changes");
	for (const chg of plan.testing.testChanges) {
		lines.push(`- ${chg}`);
	}

	lines.push("");
	return lines.join("\n");
}

function groupFindingsBySeverity(
	findings: AuditFinding[],
): Record<FindingSeverity, AuditFinding[]> {
	const grouped: Record<FindingSeverity, AuditFinding[]> = {
		critical: [],
		high: [],
		medium: [],
		low: [],
	};
	for (const finding of findings) {
		grouped[finding.severity].push(finding);
	}
	return grouped;
}

function appendFollowUpsSection(
	lines: string[],
	heading: string,
	followUps: ReportFollowUp[],
	workspaceLinkBase?: string,
): void {
	lines.push("", `## ${heading}`, "");
	if (followUps.length === 0) {
		lines.push("No follow-up items identified.");
		return;
	}
	lines.push("| ID | Priority | Location | Follow-Up Action |", "|---|---|---|---|");
	for (const item of followUps) {
		const loc = formatWorkspaceLink(
			item.location,
			item.lineStart,
			item.lineEnd,
			workspaceLinkBase,
		);
		lines.push(`| \`${item.id}\` | \`${item.priority}\` | ${loc} | ${item.action} |`);
	}
}

/** Render an immutable implementation or audit `NNN-<slug>.report.md` document. */
export function renderReportMarkdown(
	report: ReportRecord,
	linkBase?: string,
	workspaceLinkBase?: string,
): string {
	const padded = padTaskId(report.taskId);
	const lines: string[] = [
		`# Report ${padded}: ${report.title}`,
		"",
		`- **Task**: \`${formatTaskId(report.taskId)}\` ([tasks.md](${formatSessionLink("tasks.md", linkBase)}))`,
		`- **Outcome**: \`${report.outcome}\``,
		`- **Target**: \`${report.target.repo}\` @ \`${report.target.branch}\` (\`${report.target.commit}\`)`,
	];

	if (report.planRef) {
		lines.push(`- **Plan**: [${report.planRef}](${formatSessionLink(report.planRef, linkBase)})`);
	}

	if (report.mode === "audit") {
		lines.push("", "## Summary & Verdict", "", report.summary);

		if (report.verificationMatrix.length > 0) {
			lines.push("", "## Scope & Verification Matrix", "", "| Check / Spec | Status | Observed Result |", "|---|---|---|");
			for (const row of report.verificationMatrix) {
				lines.push(`| ${row.target} | \`${row.status}\` | ${row.observed} |`);
			}
		}

		lines.push("", "## Findings");
		const grouped = groupFindingsBySeverity(report.findings);
		const severityOrder: Array<{ key: FindingSeverity; heading: string }> = [
			{ key: "critical", heading: "Critical" },
			{ key: "high", heading: "High" },
			{ key: "medium", heading: "Medium" },
			{ key: "low", heading: "Low" },
		];
		for (const { key, heading } of severityOrder) {
			const bucket = grouped[key];
			if (bucket.length === 0) {
				continue;
			}
			lines.push("", `### ${heading}`);
			for (const finding of bucket) {
				const loc = formatWorkspaceLink(
					finding.location,
					finding.lineStart,
					finding.lineEnd,
					workspaceLinkBase,
				);
				lines.push(`- **\`${finding.id}\` - ${finding.title}** (${loc}): ${finding.detail}`);
			}
		}

		appendFollowUpsSection(lines, "Recommended Next Tasks", report.followUps, workspaceLinkBase);
		lines.push("");
		return lines.join("\n");
	}

	lines.push("", "## Summary & Outcome", "", report.summary, "", "## Actions Completed");
	for (const action of report.actionsCompleted) {
		lines.push(`- ${action}`);
	}

	lines.push("", "### Files Changed");
	if (report.diffStat) {
		lines.push("", `Diff stat: \`${report.diffStat}\``);
	}
	lines.push("", "| File / Directory | Action | Summary |", "|---|---|---|");
	for (const file of report.filesChanged) {
		const loc = formatWorkspaceLink(file.path, file.lineStart, file.lineEnd, workspaceLinkBase);
		lines.push(`| ${loc} | ${file.action} | ${file.summary} |`);
	}

	if (report.planDeviations.length > 0) {
		lines.push("", "### Plan Deviations");
		for (const dev of report.planDeviations) {
			lines.push(`- ${dev}`);
		}
	}

	lines.push("", "## Verification & How to Run", "", "| Check | Command | Result | Notes |", "|---|---|---|---|");
	for (const row of report.verification) {
		lines.push(`| ${row.check} | \`${row.command}\` | \`${row.result}\` | ${row.notes} |`);
	}
	if (report.tryCommand) {
		lines.push("", `- **Try**: \`${report.tryCommand}\``);
	}
	if (report.unverifiedLimitations) {
		lines.push(`- **Unverified / Limitations**: ${report.unverifiedLimitations}`);
	}

	if (report.operationalNotes.length > 0) {
		lines.push("", "## Operational Notes & Rollback");
		for (const note of report.operationalNotes) {
			lines.push(`- ${note}`);
		}
	}

	appendFollowUpsSection(lines, "Follow-Up & Future Work", report.followUps, workspaceLinkBase);

	lines.push("");
	return lines.join("\n");
}
