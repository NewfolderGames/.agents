import { formatFileLocation, formatTaskFilename } from "./format.js";
import type { AuditFinding, FindingSeverity, PlanRecord, ReportRecord, SessionData, TaskItem, TaskRecord } from "./schema.js";

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

/** Render the session's `tasks.md` hub matching `session-templates.md` Section 1. */
export function renderTasksMarkdown(session: SessionData, linkBase?: string): string {
	const sortedTasks = [...session.tasks].sort((a, b) =>
		a.taskNumber.localeCompare(b.taskNumber));
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
			`| ${task.taskNumber} | ${formatTaskStatusCell(task)} | ${task.title} | ${planCell} \\| ${reportCell} |`,
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
			lines.push(`<summary>${summaryMark} Task ${task.taskNumber} - ${task.title}</summary>`);
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

		lines.push(`## Task ${task.taskNumber} - ${task.title}`);
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

/** Render an immutable `NN-<slug>.plan.md` matching `session-templates.md` Section 2. */
export function renderPlanMarkdown(plan: PlanRecord, linkBase?: string): string {
	const lines: string[] = [
		`# Plan ${plan.taskNumber}: ${plan.title}`,
		"",
		`- **Task**: \`${plan.taskNumber}\` ([tasks.md](${formatSessionLink("tasks.md", linkBase)}))`,
		`- **Target**: \`${plan.target.repo}\` @ \`${plan.target.branch}\` (\`${plan.target.commit}\`)`,
	];

	if (plan.follows) {
		lines.push(`- **Follows**: ${plan.follows}`);
	}

	lines.push(
		"",
		"## Requirements",
		"",
		"### Overview & Goals",
		plan.overview,
		"",
		"Expected outcomes:",
		...plan.expectedOutcomes.map(item => `- ${item}`),
		"",
		"### Scope",
		"",
		"#### In Scope",
		...plan.scope.inScope.map(item => `- ${item}`),
		"",
		"#### Out of Scope",
		...plan.scope.outOfScope.map(item => `- ${item}`),
	);

	if (plan.openQuestions && plan.openQuestions.length > 0) {
		lines.push("", "### Open Questions & Assumptions");
		plan.openQuestions.forEach((item, idx) => {
			lines.push(`${idx + 1}. ${item}`);
		});
	}

	if (plan.userStories && plan.userStories.length > 0) {
		lines.push("", "### User Stories", ...plan.userStories.map(item => `- ${item}`));
	}

	if (plan.functionalRequirements && plan.functionalRequirements.length > 0) {
		lines.push("", "### Functional Requirements");
		plan.functionalRequirements.forEach((item, idx) => {
			lines.push(`${idx + 1}. ${item}`);
		});
	}

	if (plan.nonFunctionalRequirements && plan.nonFunctionalRequirements.length > 0) {
		lines.push(
			"",
			"### Non-Functional Requirements",
			...plan.nonFunctionalRequirements.map(item => `- ${item}`),
		);
	}

	lines.push(
		"",
		"## Technical Design",
		"",
		"### Current Implementation",
		...plan.currentImplementation.map(item => `- ${item}`),
		"",
		"### Key Decisions",
	);
	plan.keyDecisions.forEach((item, idx) => {
		lines.push(`${idx + 1}. ${item}`);
	});

	lines.push("", "### Proposed Changes");
	plan.proposedChanges.forEach((item, idx) => {
		lines.push(`${idx + 1}. ${item}`);
	});

	if (plan.dataModels) {
		lines.push("", "### Data Models / Contracts", plan.dataModels);
	}

	if (plan.components && plan.components.length > 0) {
		lines.push(
			"",
			"### Components",
			"| Component | Package / Path | Responsibility |",
			"|---|---|---|",
			...plan.components.map(
				row => `| \`${row.component}\` | \`${row.path}\` | ${row.responsibility} |`,
			),
		);
	}

	lines.push("", "### File Structure", "```text");
	for (const entry of plan.fileStructure) {
		lines.push(`${entry.path} (${entry.action}: ${entry.reason})`);
	}
	lines.push("```");

	if (plan.architectureDiagram) {
		lines.push("", "### Architecture Diagram", "```mermaid", plan.architectureDiagram, "```");
	}

	if (plan.risks && plan.risks.length > 0) {
		lines.push(
			"",
			"### Risks",
			"| Risk | Impact | Mitigation |",
			"|---|---|---|",
			...plan.risks.map(row => `| ${row.risk} | ${row.impact} | ${row.mitigation} |`),
		);
	}

	if (plan.alternatives) {
		lines.push("", "## Alternatives Considered", "", plan.alternatives);
	}

	lines.push("", "## Testing", "", "### Validation Approach");
	plan.testing.validationCommands.forEach((cmd, idx) => {
		lines.push(`${idx + 1}. Run \`${cmd}\``);
	});

	lines.push("", "### Key Scenarios", ...plan.testing.keyScenarios.map(item => `- ${item}`));

	if (plan.testing.edgeCases && plan.testing.edgeCases.length > 0) {
		lines.push("", "### Edge Cases", ...plan.testing.edgeCases.map(item => `- ${item}`));
	}

	lines.push("", "### Test Changes", ...plan.testing.testChanges.map(item => `- ${item}`), "");
	return lines.join("\n");
}

function groupFindingsBySeverity(
	findings: AuditFinding[],
): Array<{ severity: FindingSeverity; heading: string; items: AuditFinding[] }> {
	const order: Array<{ severity: FindingSeverity; heading: string }> = [
		{ severity: "critical", heading: "Critical" },
		{ severity: "high", heading: "High" },
		{ severity: "medium", heading: "Medium" },
		{ severity: "low", heading: "Low" },
	];
	return order
		.map(group => ({
			...group,
			items: findings.filter(item => item.severity === group.severity),
		}))
		.filter(group => group.items.length > 0);
}

/** Render an Implementation or Audit `NN-<slug>.report.md` matching `session-templates.md` Sections 3-4. */
export function renderReportMarkdown(
	report: ReportRecord,
	linkBase?: string,
	workspaceLinkBase?: string,
): string {
	const lines: string[] = [
		`# Report ${report.taskNumber}: ${report.title}`,
		"",
		`- **Task**: \`${report.taskNumber}\` ([tasks.md](${formatSessionLink("tasks.md", linkBase)}))`,
		`- **Outcome**: \`${report.outcome}\``,
		`- **Target**: \`${report.target.repo}\` @ \`${report.target.branch}\` (\`${report.target.commit}\`)`,
	];

	if (report.planRef) {
		lines.push(
			`- **Plan**: [${report.planRef}](${formatSessionLink(report.planRef, linkBase)})`,
		);
	}

	if (report.mode === "audit") {
		lines.push("", "## Summary & Verdict", "", report.summary);

		lines.push(
			"",
			"## Scope & Verification Matrix",
			"",
			"| Check / Spec | Status | Observed Result |",
			"|---|---|---|",
		);
		for (const row of report.verificationMatrix) {
			lines.push(`| \`${row.target}\` | \`${row.status}\` | ${row.observed} |`);
		}

		lines.push("", "## Findings");
		const groups = groupFindingsBySeverity(report.findings);
		if (groups.length === 0) {
			lines.push("", "No findings recorded.");
		}
		else {
			for (const group of groups) {
				lines.push("", `### ${group.heading}`);
				for (const item of group.items) {
					const loc = formatWorkspaceLink(
						item.location,
						item.lineStart,
						item.lineEnd,
						workspaceLinkBase,
					);
					lines.push(`- **\`${item.id}\` - ${item.title}** (${loc}): ${item.detail}`);
				}
			}
		}

		lines.push("", "## Recommended Next Tasks");
		if (report.followUps.length === 0) {
			lines.push("", "No recommended next tasks.");
		}
		else {
			lines.push("", "| ID | Priority | Location | Follow-Up Action |", "|---|---|---|---|");
			for (const row of report.followUps) {
				const loc = formatWorkspaceLink(
					row.location,
					row.lineStart,
					row.lineEnd,
					workspaceLinkBase,
				);
				lines.push(`| \`${row.id}\` | \`${row.priority}\` | ${loc} | ${row.action} |`);
			}
		}
		lines.push("");
		return lines.join("\n");
	}

	lines.push("", "## Summary & Outcome", "", report.summary);

	lines.push("", "## Actions Completed", "");
	if (report.actionsCompleted.length === 0) {
		lines.push("- No actions listed.");
	}
	else {
		for (const action of report.actionsCompleted) {
			lines.push(`- ${action}`);
		}
	}

	lines.push("", "### Files Changed");
	if (report.diffStat) {
		lines.push(`Diff stat: \`${report.diffStat}\``);
	}
	lines.push("", "| File / Directory | Action | Summary |", "|---|---|---|");
	for (const file of report.filesChanged) {
		const loc = formatWorkspaceLink(
			file.path,
			file.lineStart,
			file.lineEnd,
			workspaceLinkBase,
		);
		lines.push(`| ${loc} | ${file.action} | ${file.summary} |`);
	}

	if (report.planDeviations.length > 0) {
		lines.push("", "### Plan Deviations");
		for (const dev of report.planDeviations) {
			lines.push(`- ${dev}`);
		}
	}

	lines.push(
		"",
		"## Verification & How to Run",
		"",
		"| Check | Command | Result | Notes |",
		"|---|---|---|---|",
	);
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

	lines.push("", "## Follow-Up & Future Work");
	if (report.followUps.length === 0) {
		lines.push("", "No follow-up items identified.");
	}
	else {
		lines.push("", "| ID | Priority | Location | Follow-Up Action |", "|---|---|---|---|");
		for (const row of report.followUps) {
			const loc = formatWorkspaceLink(
				row.location,
				row.lineStart,
				row.lineEnd,
				workspaceLinkBase,
			);
			lines.push(`| \`${row.id}\` | \`${row.priority}\` | ${loc} | ${row.action} |`);
		}
	}

	lines.push("");
	return lines.join("\n");
}

/** Return the expected Markdown filenames for a report or plan record. */
export function getArtifactFilename(
	taskNumber: string,
	slug: string,
	role: "plan" | "report",
): string {
	return formatTaskFilename(taskNumber, slug, role);
}
