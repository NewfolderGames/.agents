import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { formatBlockingModeLabel, formatPlainTextQuestions, formatQuestionReply, formatTaskFilename } from "../src/shared/format.js";
import { AppViewModeSchema, AuditFindingSchema, AuditVerificationRowSchema, FileRefSchema, HandoffKindSchema, LanguageSchema, PlanComponentRowSchema, PlanFileEntrySchema, PlanRiskRowSchema, QuestionAnswerValueSchema, QuestionBlockingModeSchema, QuestionItemSchema, QuestionSectionSchema, ReportFileChangeSchema, ReportFollowUpSchema, ReportModeSchema, ReportVerificationRowSchema, SessionIdSchema, SlugSchema, StepDisplayOverrideSchema, TargetRepoSchema, TaskItemStatusSchema, TaskLifecycleStatusSchema, TaskNumberSchema, TaskStepSchema, WidgetDisplayModeSchema, WorkspaceTabSchema } from "../src/shared/schema.js";
import { getUnresolvedQuestions, type SessionStore } from "./store.js";

export const APP_RESOURCE_URI = "ui://new-worker/app.html";

const UI_CSP = {
	resourceDomains: [
		"https://fonts.googleapis.com",
		"https://fonts.gstatic.com",
	],
};

export interface RegisterServerOptions {
	store: SessionStore;
	loadAppHtml: () => Promise<string>;
}

function summarizeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function registerNewWorkerServer(
	server: McpServer,
	options: RegisterServerOptions,
): void {
	const { store, loadAppHtml } = options;

	registerAppResource(
		server,
		"New Worker Web UI",
		APP_RESOURCE_URI,
		{
			description:
				"Interactive React UI for new-worker tasks, plans, reports, handoffs, tool calls, and configurable questions.",
			mimeType: RESOURCE_MIME_TYPE,
			_meta: {
				ui: {
					prefersBorder: false,
					csp: UI_CSP,
				},
			},
		},
		async () => {
			const html = await loadAppHtml();
			return {
				contents: [
					{
						uri: APP_RESOURCE_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: html,
						_meta: {
							ui: {
								prefersBorder: false,
								csp: UI_CSP,
							},
						},
					},
				],
			};
		},
	);

	// 1. open_workspace — strictly read-only aux_pane + global entrypoint ({} safe)
	registerAppTool(
		server,
		"open_workspace",
		{
			title: "New Worker Workspace",
			description:
				"Open the new-worker workspace dashboard in the side pane or sidebar. Strictly read-only: never creates sessions or writes JSON files.",
			inputSchema: z.object({
				sessionId: SessionIdSchema.optional(),
				activeTab: WorkspaceTabSchema.optional(),
				activeItemId: z.string().min(1).optional(),
			}),
			_meta: {
				"ui": {
					resourceUri: APP_RESOURCE_URI,
				},
				"com.google.antigravity/ui": {
					entrypoints: [
						{ type: "aux_pane", title: "New Worker" },
						{ type: "global", title: "New Worker" },
					],
				},
			},
		},
		async (args) => {
			const session = args.sessionId
				? await store.getSession(args.sessionId)
				: await store.getLatestSession();
			const activeTab = args.activeTab ?? "tasks";
			const payload = await store.buildPayload(session, "dashboard", activeTab, {
				activeItemId: args.activeItemId,
				includeSessions: true,
			});

			if (!session) {
				return {
					content: [{ type: "text", text: "No sessions recorded yet." }],
					structuredContent: payload,
				};
			}

			const pendingSets = session.questionSets.filter(q => q.status !== "submitted").length;
			return {
				content: [
					{
						type: "text",
						text: `Workspace "${session.sessionId}" ready (${session.tasks.length} tasks, ${session.plans.length} plans, ${session.reports.length} reports, ${pendingSets} open question sets).`,
					},
				],
				structuredContent: payload,
			};
		},
	);

	// 2. upsert_task
	registerAppTool(
		server,
		"upsert_task",
		{
			title: "Upsert Task",
			description:
				"Create or update a task in the session hub with sequential NN numbering and render tasks.md to exportDir when set. Steps must cover substantive execution work only — never create steps for initializing a plan, opening the workspace, or bootstrapping tasks.md. Progressing a task requires no blocking immediate/step questions.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				workspacePath: z.string().min(1).optional(),
				exportDir: z.string().min(1).optional(),
				taskNumber: TaskNumberSchema.optional(),
				slug: SlugSchema,
				title: z.string().min(1),
				status: TaskLifecycleStatusSchema,
				summary: z.string().min(1),
				steps: z.array(TaskStepSchema).min(1),
				planFile: z.string().optional(),
				reportFile: z.string().optional(),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, task } = await store.upsertTask(
					args.sessionId,
					{
						taskNumber: args.taskNumber,
						slug: args.slug,
						title: args.title,
						status: args.status,
						summary: args.summary,
						steps: args.steps,
						planFile: args.planFile,
						reportFile: args.reportFile,
					},
					{
						workspacePath: args.workspacePath,
						exportDir: args.exportDir,
					},
				);
				await store.recordToolCall(
					session.sessionId,
					"upsert_task",
					"ok",
					`Task ${task.taskNumber} (${task.status}): ${task.title}`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const payload = await store.buildPayload(refreshed, "tasks", "tasks", {
					activeItemId: task.taskNumber,
				});
				return {
					content: [
						{
							type: "text",
							text: `Saved Task ${task.taskNumber} - ${task.title} [${task.status}] in session "${session.sessionId}".`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				await store.recordToolCall(args.sessionId, "upsert_task", "error", summarizeError(err));
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 3. update_task_item — focused single-step inline view
	registerAppTool(
		server,
		"update_task_item",
		{
			title: "Update Task Item",
			description:
				"Update a single step checklist item status (pending, in_progress, done), sync tasks.md, and render an immutable snapshot of the active step inline. Blocked if blocking questions are unanswered.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskNumber: TaskNumberSchema,
				itemId: z.string().min(1),
				status: TaskItemStatusSchema,
				taskStatus: TaskLifecycleStatusSchema.optional(),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, task, updatedStepIndex } = await store.updateTaskItem(
					args.sessionId,
					args.taskNumber,
					args.itemId,
					args.status,
					args.taskStatus,
				);
				await store.recordToolCall(
					session.sessionId,
					"update_task_item",
					"ok",
					`Task ${task.taskNumber} Step ${updatedStepIndex + 1} item "${args.itemId}" -> ${args.status}`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const updatedStep = task.steps[updatedStepIndex];
				const stepSnapshot = updatedStep
					? {
							taskNumber: task.taskNumber,
							taskTitle: task.title,
							stepIndex: updatedStepIndex,
							totalSteps: task.steps.length,
							step: updatedStep,
							itemId: args.itemId,
							capturedAt: new Date().toISOString(),
						}
					: undefined;
				const payload = await store.buildPayload(refreshed, "task_step", "tasks", {
					activeItemId: task.taskNumber,
					activeStepIndex: updatedStepIndex,
					activeTaskItemId: args.itemId,
					stepSnapshot,
				});

				const stepBlockers = getUnresolvedQuestions(refreshed).filter(
					entry =>
						entry.policy.blockingMode === "before_step_finish"
						&& entry.policy.taskNumber === task.taskNumber
						&& entry.policy.stepNumber === updatedStepIndex + 1,
				);
				const blockerNote = stepBlockers.length > 0
					? ` Note: ${stepBlockers.length} deferred question(s) must be answered before finishing Step ${updatedStepIndex + 1}.`
					: "";

				return {
					content: [
						{
							type: "text",
							text: `Updated Task ${task.taskNumber} Step ${updatedStepIndex + 1} item "${args.itemId}" to "${args.status}" (task status: ${task.status}).${blockerNote}`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				await store.recordToolCall(
					args.sessionId,
					"update_task_item",
					"error",
					summarizeError(err),
				);
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 4. write_plan — persists plan data, generates Markdown file, and returns planFilePath
	registerAppTool(
		server,
		"write_plan",
		{
			title: "Write Plan",
			description:
				"Persist structured plan data, generate NN-<slug>.plan.md on disk, and return its file path for harness-native plan presentation.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				workspacePath: z.string().min(1).optional(),
				exportDir: z.string().min(1).optional(),
				taskNumber: TaskNumberSchema.optional(),
				slug: SlugSchema,
				title: z.string().min(1),
				target: TargetRepoSchema,
				follows: z.string().optional(),
				overview: z.string().min(1),
				expectedOutcomes: z.array(z.string().min(1)).min(1),
				scope: z.object({
					inScope: z.array(z.string().min(1)).min(1),
					outOfScope: z.array(z.string().min(1)).min(1),
				}),
				openQuestions: z.array(z.string().min(1)).optional(),
				userStories: z.array(z.string().min(1)).optional(),
				functionalRequirements: z.array(z.string().min(1)).optional(),
				nonFunctionalRequirements: z.array(z.string().min(1)).optional(),
				currentImplementation: z.array(z.string().min(1)).min(1),
				keyDecisions: z.array(z.string().min(1)).min(1),
				proposedChanges: z.array(z.string().min(1)).min(1),
				dataModels: z.string().optional(),
				components: z.array(PlanComponentRowSchema).optional(),
				fileStructure: z.array(PlanFileEntrySchema).min(1),
				architectureDiagram: z.string().optional(),
				risks: z.array(PlanRiskRowSchema).optional(),
				alternatives: z.string().optional(),
				calibration: z
					.object({
						cadence: z.string(),
						familiarity: z.string(),
						structureStance: z.string(),
					})
					.optional(),
				testing: z.object({
					validationCommands: z.array(z.string().min(1)).min(1),
					keyScenarios: z.array(z.string().min(1)).min(1),
					edgeCases: z.array(z.string().min(1)).optional(),
					testChanges: z.array(z.string().min(1)).min(1),
				}),
				language: LanguageSchema.optional(),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, plan, planFilePath } = await store.writePlan(
					args.sessionId,
					{
						taskNumber: args.taskNumber,
						slug: args.slug,
						title: args.title,
						target: args.target,
						follows: args.follows,
						overview: args.overview,
						expectedOutcomes: args.expectedOutcomes,
						scope: args.scope,
						openQuestions: args.openQuestions,
						userStories: args.userStories,
						functionalRequirements: args.functionalRequirements,
						nonFunctionalRequirements: args.nonFunctionalRequirements,
						currentImplementation: args.currentImplementation,
						keyDecisions: args.keyDecisions,
						proposedChanges: args.proposedChanges,
						dataModels: args.dataModels,
						components: args.components,
						fileStructure: args.fileStructure,
						architectureDiagram: args.architectureDiagram,
						risks: args.risks,
						alternatives: args.alternatives,
						calibration: args.calibration,
						testing: args.testing,
						language: args.language ?? "en",
					},
					{
						workspacePath: args.workspacePath,
						exportDir: args.exportDir,
					},
				);
				const filename = formatTaskFilename(plan.taskNumber, plan.slug, "plan");
				await store.recordToolCall(
					session.sessionId,
					"write_plan",
					"ok",
					`Saved ${filename}`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const payload = await store.buildPayload(refreshed, "plan", "plans", {
					activeItemId: plan.taskNumber,
				});
				return {
					content: [
						{
							type: "text",
							text: `Saved Plan ${plan.taskNumber} (${filename}).\nGenerated plan file: ${planFilePath}\nPresent or move this generated Markdown file using your harness's native plan/artifact system.`,
						},
					],
					structuredContent: {
						...payload,
						planFilePath,
					},
				};
			}
			catch (err) {
				await store.recordToolCall(args.sessionId, "write_plan", "error", summarizeError(err));
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 5. write_report
	registerAppTool(
		server,
		"write_report",
		{
			title: "Write Report",
			description:
				"Persist an immutable Implementation or Audit report NN and render NN-<slug>.report.md to exportDir when set. Implementation reports require answered blocking questions.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				workspacePath: z.string().min(1).optional(),
				exportDir: z.string().min(1).optional(),
				taskNumber: TaskNumberSchema.optional(),
				slug: SlugSchema,
				title: z.string().min(1),
				mode: ReportModeSchema,
				outcome: z.string().min(1),
				target: TargetRepoSchema,
				planRef: z.string().optional(),
				summary: z.string().min(1),
				actionsCompleted: z.array(z.string().min(1)).optional(),
				filesChanged: z.array(ReportFileChangeSchema).optional(),
				diffStat: z.string().optional(),
				planDeviations: z.array(z.string().min(1)).optional(),
				verification: z.array(ReportVerificationRowSchema).optional(),
				tryCommand: z.string().optional(),
				unverifiedLimitations: z.string().optional(),
				operationalNotes: z.array(z.string().min(1)).optional(),
				verificationMatrix: z.array(AuditVerificationRowSchema).optional(),
				findings: z.array(AuditFindingSchema).optional(),
				followUps: z.array(ReportFollowUpSchema).optional(),
				language: LanguageSchema.optional(),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, report } = await store.writeReport(
					args.sessionId,
					{
						taskNumber: args.taskNumber,
						slug: args.slug,
						title: args.title,
						mode: args.mode,
						outcome: args.outcome,
						target: args.target,
						planRef: args.planRef,
						summary: args.summary,
						actionsCompleted: args.actionsCompleted ?? [],
						filesChanged: args.filesChanged ?? [],
						diffStat: args.diffStat,
						planDeviations: args.planDeviations ?? [],
						verification: args.verification ?? [],
						tryCommand: args.tryCommand,
						unverifiedLimitations: args.unverifiedLimitations,
						operationalNotes: args.operationalNotes ?? [],
						verificationMatrix: args.verificationMatrix ?? [],
						findings: args.findings ?? [],
						followUps: args.followUps ?? [],
						language: args.language ?? "en",
					},
					{
						workspacePath: args.workspacePath,
						exportDir: args.exportDir,
					},
				);
				const filename = formatTaskFilename(report.taskNumber, report.slug, "report");
				await store.recordToolCall(
					session.sessionId,
					"write_report",
					"ok",
					`Delivered ${filename} (${report.mode}: ${report.outcome})`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const payload = await store.buildPayload(refreshed, "report", "reports", {
					activeItemId: report.taskNumber,
				});
				return {
					content: [
						{
							type: "text",
							text: `Delivered ${report.mode} Report ${report.taskNumber} (${filename}, outcome: ${report.outcome}).`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				await store.recordToolCall(args.sessionId, "write_report", "error", summarizeError(err));
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 7. record_handoff
	registerAppTool(
		server,
		"record_handoff",
		{
			title: "Record Handoff",
			description:
				"Record a structured handoff (plan approval, mid-session pause, completion, or subagent scout) for the session viewer.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				workspacePath: z.string().min(1).optional(),
				exportDir: z.string().min(1).optional(),
				id: z.string().min(1).optional(),
				taskNumber: TaskNumberSchema.optional(),
				kind: HandoffKindSchema,
				title: z.string().min(1),
				summary: z.string().min(1),
				workingNow: z.string().optional(),
				verifyCommand: z.string().optional(),
				entryPoint: z.string().optional(),
				nextStep: z.string().optional(),
				artifactLinks: z.array(FileRefSchema).optional(),
				structuredData: z.record(z.string(), z.unknown()).optional(),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, handoff } = await store.recordHandoff(
					args.sessionId,
					{
						id: args.id,
						taskNumber: args.taskNumber,
						kind: args.kind,
						title: args.title,
						summary: args.summary,
						workingNow: args.workingNow,
						verifyCommand: args.verifyCommand,
						entryPoint: args.entryPoint,
						nextStep: args.nextStep,
						artifactLinks: args.artifactLinks ?? [],
						structuredData: args.structuredData,
					},
					{
						workspacePath: args.workspacePath,
						exportDir: args.exportDir,
					},
				);
				await store.recordToolCall(
					session.sessionId,
					"record_handoff",
					"ok",
					`Handoff (${handoff.kind}): ${handoff.title}`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const payload = await store.buildPayload(refreshed, "handoff", "handoffs", {
					activeItemId: handoff.id,
				});
				return {
					content: [
						{
							type: "text",
							text: `Recorded handoff "${handoff.title}" (${handoff.kind}).${handoff.nextStep ? ` Next: ${handoff.nextStep}` : ""}`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 8. ask_questions — configurable immediate / before_step_finish / anytime bulk question form
	registerAppTool(
		server,
		"ask_questions",
		{
			title: "Ask Bulk Questions",
			description:
				"Render an interactive question form inline with configurable per-question blocking modes: immediate (blocks progression now), before_step_finish (blocks completing the target step), or anytime (non-blocking).",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				workspacePath: z.string().min(1).optional(),
				exportDir: z.string().min(1).optional(),
				id: z.string().min(1).optional(),
				title: z.string().min(1),
				description: z.string().optional(),
				submitLabel: z.string().min(1).optional(),
				blockingMode: QuestionBlockingModeSchema.optional(),
				taskNumber: TaskNumberSchema.optional(),
				stepNumber: z.number().int().positive().optional(),
				sections: z.array(QuestionSectionSchema).optional(),
				questions: z.array(QuestionItemSchema).min(1),
			}),
			_meta: {
				ui: { resourceUri: APP_RESOURCE_URI },
			},
		},
		async (args) => {
			try {
				const { session, questionSet } = await store.createQuestionSet(
					args.sessionId,
					{
						id: args.id,
						title: args.title,
						description: args.description,
						submitLabel: args.submitLabel ?? "Submit Answers",
						blockingMode: args.blockingMode ?? "immediate",
						taskNumber: args.taskNumber,
						stepNumber: args.stepNumber,
						sections: args.sections ?? [],
						questions: args.questions,
					},
					{
						workspacePath: args.workspacePath,
						exportDir: args.exportDir,
					},
				);
				await store.recordToolCall(
					session.sessionId,
					"ask_questions",
					"ok",
					`Created question set "${questionSet.title}" (${questionSet.questions.length} items, default: ${questionSet.blockingMode})`,
				);
				const refreshed = (await store.getSession(session.sessionId)) ?? session;
				const payload = await store.buildPayload(refreshed, "questions", "questions", {
					activeItemId: questionSet.id,
				});

				const hasImmediate = questionSet.questions.some(
					q => (q.blockingMode ?? questionSet.blockingMode) === "immediate",
				);
				const guidance = hasImmediate
					? "Immediate blocking questions are present: wait for user submission before progressing."
					: "No immediate blockers: you may continue intermediate work while respecting any before_step_finish or anytime gates. Read answers via get_session_state.";

				return {
					content: [
						{
							type: "text",
							text: `${formatPlainTextQuestions(questionSet)}\n\n${guidance}`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				await store.recordToolCall(args.sessionId, "ask_questions", "error", summarizeError(err));
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	// 9. get_session_state — data-only model read tool
	server.registerTool(
		"get_session_state",
		{
			title: "Get Session State",
			description:
				"Read stored tasks, plan review status, active blockers, reports, handoffs, and submitted question answers for a session.",
			inputSchema: z.object({
				sessionId: SessionIdSchema.optional(),
			}),
		},
		async (args) => {
			const session = args.sessionId
				? await store.getSession(args.sessionId)
				: await store.getLatestSession();

			if (!session) {
				return {
					content: [
						{
							type: "text",
							text: args.sessionId
								? `No session found for "${args.sessionId}".`
								: "No sessions stored yet.",
						},
					],
				};
			}

			const submittedSets = session.questionSets.filter(
				q => q.status === "submitted" || q.status === "partial",
			);
			const unresolved = getUnresolvedQuestions(session);

			const summaryLines = [
				`Session "${session.sessionId}": ${session.tasks.length} tasks, ${session.plans.length} plans, ${session.reports.length} reports, ${session.questionSets.filter(q => q.status === "submitted").length}/${session.questionSets.length} question sets submitted.`,
			];

			if (unresolved.length > 0) {
				const blockerDescriptions = unresolved.map((u) => {
					const label = formatBlockingModeLabel(
						u.policy.blockingMode,
						u.policy.taskNumber,
						u.policy.stepNumber,
					);
					return `${u.question.id} [${label}]`;
				});
				summaryLines.push(`Open questions: ${blockerDescriptions.join(", ")}.`);
			}

			for (const qs of submittedSets.slice(0, 3)) {
				const answeredIds = qs.status === "partial" ? qs.answeredQuestionIds : undefined;
				summaryLines.push("", formatQuestionReply(qs, qs.answers, qs.otherTexts, answeredIds));
			}

			return {
				content: [{ type: "text", text: summaryLines.join("\n") }],
				structuredContent: { session },
			};
		},
	);

	// App-only tools (visibility: ["app"])
	registerAppTool(
		server,
		"app_get_state",
		{
			title: "App Get State",
			description: "Read-only fetch of the active session and session index for the Web UI.",
			inputSchema: z.object({
				sessionId: SessionIdSchema.optional(),
				mode: AppViewModeSchema.optional(),
				activeTab: WorkspaceTabSchema.optional(),
				activeItemId: z.string().optional(),
				activeStepIndex: z.number().int().nonnegative().optional(),
				activeTaskItemId: z.string().optional(),
				sinceRevision: z.string().optional(),
			}),
			_meta: {
				ui: {
					visibility: ["app"],
				},
			},
		},
		async (args) => {
			const { session, revision } = await store.getRevision(args.sessionId);
			if (args.sinceRevision && args.sinceRevision === revision) {
				return {
					content: [{ type: "text", text: "Unchanged." }],
					structuredContent: {
						unchanged: true,
						revision,
					},
				};
			}
			const payload = await store.buildPayload(
				session,
				args.mode ?? "dashboard",
				args.activeTab ?? "tasks",
				{
					activeItemId: args.activeItemId,
					activeStepIndex: args.activeStepIndex,
					activeTaskItemId: args.activeTaskItemId,
					revision,
					includeSessions: true,
				},
			);
			return {
				content: [
					{
						type: "text",
						text: session
							? `Loaded session "${session.sessionId}".`
							: "No sessions recorded yet.",
					},
				],
				structuredContent: payload,
			};
		},
	);

	registerAppTool(
		server,
		"app_save_question_draft",
		{
			title: "App Save Question Draft",
			description: "Eagerly save in-progress bulk question answers on the server.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				questionSetId: z.string().min(1),
				answers: z.record(z.string(), QuestionAnswerValueSchema),
				otherTexts: z.record(z.string(), z.string()),
			}),
			_meta: {
				ui: {
					visibility: ["app"],
				},
			},
		},
		async (args) => {
			try {
				const { session, questionSet } = await store.saveQuestionDraft(
					args.sessionId,
					args.questionSetId,
					args.answers,
					args.otherTexts,
				);
				const payload = await store.buildPayload(session, "questions", "questions", {
					activeItemId: questionSet.id,
				});
				return {
					content: [{ type: "text", text: "Draft saved." }],
					structuredContent: payload,
				};
			}
			catch (err) {
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	registerAppTool(
		server,
		"app_submit_question_answers",
		{
			title: "App Submit Question Answers",
			description: "Validate and submit all or a subset of question answers, returning a compact chat reply.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				questionSetId: z.string().min(1),
				answers: z.record(z.string(), QuestionAnswerValueSchema),
				otherTexts: z.record(z.string(), z.string()),
				scope: z.enum(["all", "immediate", "before_step_finish", "answered"]).optional(),
				questionIds: z.array(z.string().min(1)).optional(),
			}),
			_meta: {
				ui: {
					visibility: ["app"],
				},
			},
		},
		async (args) => {
			try {
				const {
					session,
					questionSet,
					submittedQuestionIds,
				} = await store.submitQuestionAnswers(
					args.sessionId,
					args.questionSetId,
					args.answers,
					args.otherTexts,
					{
						scope: args.scope,
						questionIds: args.questionIds,
					},
				);
				const replyText = formatQuestionReply(
					questionSet,
					questionSet.answers,
					questionSet.otherTexts,
					submittedQuestionIds,
				);
				const payload = await store.buildPayload(session, "questions", "questions", {
					activeItemId: questionSet.id,
					includeSessions: true,
				});
				return {
					content: [{ type: "text", text: replyText }],
					structuredContent: {
						...payload,
						replyText,
					},
				};
			}
			catch (err) {
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	registerAppTool(
		server,
		"app_update_settings",
		{
			title: "App Update Settings",
			description:
				"Persist Web UI display settings (displayType: minimized|compact|full, stepDisplayType: inherit|minimized|compact|full).",
			inputSchema: z.object({
				sessionId: SessionIdSchema.optional(),
				mode: AppViewModeSchema.optional(),
				activeTab: WorkspaceTabSchema.optional(),
				activeItemId: z.string().optional(),
				displayType: WidgetDisplayModeSchema.optional(),
				stepDisplayType: StepDisplayOverrideSchema.optional(),
			}),
			_meta: {
				ui: {
					visibility: ["app"],
				},
			},
		},
		async (args) => {
			try {
				await store.updateSettings({
					displayType: args.displayType,
					stepDisplayType: args.stepDisplayType,
				});
				const { session, settings, revision } = await store.getRevision(args.sessionId);
				const payload = await store.buildPayload(
					session,
					args.mode ?? "dashboard",
					args.activeTab ?? "tasks",
					{
						activeItemId: args.activeItemId,
						revision,
						includeSessions: true,
					},
				);
				return {
					content: [
						{
							type: "text",
							text: `Updated UI settings (displayType: ${settings.displayType}, stepDisplayType: ${settings.stepDisplayType}).`,
						},
					],
					structuredContent: payload,
				};
			}
			catch (err) {
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);

	registerAppTool(
		server,
		"app_clear_tool_calls",
		{
			title: "App Clear Tool Calls",
			description: "Clear recorded tool call history for a session from the Web UI.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
			}),
			_meta: {
				ui: {
					visibility: ["app"],
				},
			},
		},
		async (args) => {
			try {
				const session = await store.clearToolCalls(args.sessionId);
				const payload = await store.buildPayload(session, "dashboard", "calls", {
					includeSessions: true,
				});
				return {
					content: [{
						type: "text",
						text: `Cleared tool call history for "${session.sessionId}".`,
					}],
					structuredContent: payload,
				};
			}
			catch (err) {
				return {
					isError: true,
					content: [{ type: "text", text: summarizeError(err) }],
				};
			}
		},
	);
}
