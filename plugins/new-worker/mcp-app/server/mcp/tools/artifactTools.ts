import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AuditFindingSchema, AuditVerificationRowSchema, FileRefSchema, HandoffKindSchema, LanguageSchema, PlanApprovalSourceSchema, PlanCalibrationSchema, PlanComponentRowSchema, PlanFileEntrySchema, PlanReviewStatusSchema, PlanRiskRowSchema, PlanScopeSchema, ReportFileChangeSchema, ReportFollowUpSchema, ReportModeSchema, ReportVerificationRowSchema, SessionIdSchema, SlugSchema, TargetRepoSchema, TaskIdSchema } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { recordHandoff, updatePlan, writePlan, writeReport } from "../../repositories/artifacts.js";
import { hasSession } from "../../repositories/sessions.js";
import { recordToolCall } from "../../repositories/settings.js";
import { buildWidgetPayload } from "../../repositories/workspace.js";
import { WIDGET_RESOURCE_URIS } from "../resources.js";
import { buildSessionMeta, optionalArrayInput, optionalInput, runLoggedTool, SessionMetaZodFields } from "./shared.js";

/**
 * Register `write_plan`, `update_plan`, `write_report`, and `record_handoff` tools
 * for structured Markdown-backed deliverables and mid-session handoffs.
 *
 * @param server - Target MCP server instance.
 * @param db - Active Drizzle SQLite database connection.
 */
export function registerArtifactTools(server: McpServer, db: AppDrizzleDb): void {
	// write_plan -> /widget/plan
	registerAppTool(
		server,
		"write_plan",
		{
			title: "Write Plan",
			description:
				"Persist a structured technical plan. If taskId is omitted, automatically allocates a new global taskId starting from 1 and returns taskId plus planFilePath (001-<slug>.plan.md exported when exportDir is configured). Use update_plan for partial edits to an existing plan.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: optionalInput(TaskIdSchema).describe("Existing global taskId to attach this plan to; omit to allocate a new global taskId."),
				slug: SlugSchema,
				title: z.string().min(1),
				target: TargetRepoSchema,
				follows: optionalInput(z.string()),
				overview: z.string().min(1),
				expectedOutcomes: z.array(z.string().min(1)).min(1),
				scope: PlanScopeSchema,
				openQuestions: optionalArrayInput(z.string().min(1)),
				userStories: optionalArrayInput(z.string().min(1)),
				functionalRequirements: optionalArrayInput(z.string().min(1)),
				nonFunctionalRequirements: optionalArrayInput(z.string().min(1)),
				currentImplementation: z.array(z.string().min(1)).min(1),
				keyDecisions: z.array(z.string().min(1)).min(1),
				proposedChanges: z.array(z.string().min(1)).min(1),
				dataModels: optionalInput(z.string()),
				components: optionalArrayInput(PlanComponentRowSchema),
				fileStructure: z.array(PlanFileEntrySchema).min(1),
				architectureDiagram: optionalInput(z.string()),
				risks: optionalArrayInput(PlanRiskRowSchema),
				apiReference: optionalInput(z.string()),
				migrationPlan: optionalInput(z.string()),
				alternatives: optionalInput(z.string()),
				calibration: optionalInput(PlanCalibrationSchema),
				testing: z.object({
					validationCommands: z.array(z.string().min(1)).min(1),
					keyScenarios: z.array(z.string().min(1)).min(1),
					edgeCases: optionalArrayInput(z.string().min(1)),
					testChanges: z.array(z.string().min(1)).min(1),
				}),
				language: optionalInput(LanguageSchema),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.plan },
			},
		},
		args => runLoggedTool(db, {
			sessionId: args.sessionId,
			toolName: "write_plan",
		}, async () => {
			const isNewSession = !hasSession(db, args.sessionId);
			const { plan, planFilePath } = await writePlan(
				db,
				args.sessionId,
				{
					taskId: args.taskId,
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
					apiReference: args.apiReference,
					migrationPlan: args.migrationPlan,
					alternatives: args.alternatives,
					calibration: args.calibration,
					testing: args.testing,
					language: args.language,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"write_plan",
				"ok",
				`Plan ${formatTaskId(plan.taskId)}: ${plan.title}`,
				`taskId=${plan.taskId}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "plan",
				sessionId: args.sessionId,
				taskId: plan.taskId,
			});

			const sessionHint = isNewSession
				? ` New session "${args.sessionId}" created — call open_workspace({ sessionId: "${args.sessionId}" }) to open the Dashboard UI.`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `Saved Plan ${formatTaskId(plan.taskId)} "${plan.title}" (taskId: ${plan.taskId}, file: ${planFilePath}).${sessionHint}`,
					},
				],
				structuredContent: {
					...payload,
					taskId: plan.taskId,
					planFilePath,
				},
			};
		}),
	);

	// update_plan -> /widget/plan
	registerAppTool(
		server,
		"update_plan",
		{
			title: "Update Plan",
			description:
				"Partially update an existing technical plan by global taskId without resending unchanged sections. Works during plan review, mid-execution sync, or post-completion reconfiguration, and re-exports NNN-<slug>.plan.md and tasks.md when exportDir is configured.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: TaskIdSchema.describe("Existing global taskId whose plan should be updated."),
				slug: optionalInput(SlugSchema),
				title: optionalInput(z.string().min(1)),
				target: optionalInput(TargetRepoSchema),
				follows: z.string().min(1).nullable().optional(),
				overview: optionalInput(z.string().min(1)),
				expectedOutcomes: optionalArrayInput(z.string().min(1)),
				scope: optionalInput(z.object({
					inScope: optionalArrayInput(z.string().min(1)),
					outOfScope: optionalArrayInput(z.string().min(1)),
				})),
				openQuestions: z.array(z.string().min(1)).nullable().optional(),
				userStories: z.array(z.string().min(1)).nullable().optional(),
				functionalRequirements: z.array(z.string().min(1)).nullable().optional(),
				nonFunctionalRequirements: z.array(z.string().min(1)).nullable().optional(),
				currentImplementation: optionalArrayInput(z.string().min(1)),
				keyDecisions: optionalArrayInput(z.string().min(1)),
				proposedChanges: optionalArrayInput(z.string().min(1)),
				dataModels: z.string().nullable().optional(),
				components: z.array(PlanComponentRowSchema).nullable().optional(),
				fileStructure: optionalArrayInput(PlanFileEntrySchema),
				architectureDiagram: z.string().nullable().optional(),
				risks: z.array(PlanRiskRowSchema).nullable().optional(),
				apiReference: z.string().nullable().optional(),
				migrationPlan: z.string().nullable().optional(),
				alternatives: z.string().nullable().optional(),
				calibration: PlanCalibrationSchema.nullable().optional(),
				testing: optionalInput(z.object({
					validationCommands: optionalArrayInput(z.string().min(1)),
					keyScenarios: optionalArrayInput(z.string().min(1)),
					edgeCases: z.array(z.string().min(1)).nullable().optional(),
					testChanges: optionalArrayInput(z.string().min(1)),
				})),
				language: optionalInput(LanguageSchema),
				reviewStatus: optionalInput(PlanReviewStatusSchema),
				reviewComment: z.string().nullable().optional(),
				approvedVia: PlanApprovalSourceSchema.nullable().optional(),
				changeSummary: optionalInput(z.string().min(1)).describe("Concise summary of the plan change for timeline tracking."),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.plan },
			},
		},
		args => runLoggedTool(db, {
			sessionId: args.sessionId,
			toolName: "update_plan",
		}, async () => {
			const { plan, planFilePath } = await updatePlan(
				db,
				args.sessionId,
				{
					taskId: args.taskId,
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
					apiReference: args.apiReference,
					migrationPlan: args.migrationPlan,
					alternatives: args.alternatives,
					calibration: args.calibration,
					testing: args.testing,
					language: args.language,
					reviewStatus: args.reviewStatus,
					reviewComment: args.reviewComment,
					approvedVia: args.approvedVia,
					changeSummary: args.changeSummary,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"update_plan",
				"ok",
				`Updated Plan ${formatTaskId(plan.taskId)}: ${args.changeSummary ?? plan.title}`,
				`taskId=${plan.taskId}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "plan",
				sessionId: args.sessionId,
				taskId: plan.taskId,
			});

			return {
				content: [
					{
						type: "text",
						text: `Updated Plan ${formatTaskId(plan.taskId)} "${plan.title}" (taskId: ${plan.taskId}, file: ${planFilePath}).`,
					},
				],
				structuredContent: {
					...payload,
					taskId: plan.taskId,
					planFilePath,
				},
			};
		}),
	);

	// write_report -> /widget/report
	registerAppTool(
		server,
		"write_report",
		{
			title: "Write Report",
			description:
				"Deliver an immutable implementation or audit report. Rejects overwrites if a report already exists for taskId. Auto-allocates a global taskId when omitted (useful for standalone audits) and exports NNN-<slug>.report.md when exportDir is set.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: optionalInput(TaskIdSchema),
				slug: SlugSchema,
				title: z.string().min(1),
				mode: ReportModeSchema,
				outcome: z.string().min(1),
				target: TargetRepoSchema,
				planRef: optionalInput(z.string()),
				summary: z.string().min(1),
				actionsCompleted: optionalArrayInput(z.string().min(1)),
				filesChanged: optionalArrayInput(ReportFileChangeSchema),
				diffStat: optionalInput(z.string()),
				planDeviations: optionalArrayInput(z.string().min(1)),
				verification: optionalArrayInput(ReportVerificationRowSchema),
				tryCommand: optionalInput(z.string()),
				unverifiedLimitations: optionalInput(z.string()),
				operationalNotes: optionalArrayInput(z.string().min(1)),
				verificationMatrix: optionalArrayInput(AuditVerificationRowSchema),
				findings: optionalArrayInput(AuditFindingSchema),
				followUps: optionalArrayInput(ReportFollowUpSchema),
				language: optionalInput(LanguageSchema),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.report },
			},
		},
		args => runLoggedTool(db, {
			sessionId: args.sessionId,
			toolName: "write_report",
		}, async () => {
			const isNewSession = !hasSession(db, args.sessionId);
			const { report, reportFilePath } = await writeReport(
				db,
				args.sessionId,
				{
					taskId: args.taskId,
					slug: args.slug,
					title: args.title,
					mode: args.mode,
					outcome: args.outcome,
					target: args.target,
					planRef: args.planRef,
					summary: args.summary,
					actionsCompleted: args.actionsCompleted,
					filesChanged: args.filesChanged,
					diffStat: args.diffStat,
					planDeviations: args.planDeviations,
					verification: args.verification,
					tryCommand: args.tryCommand,
					unverifiedLimitations: args.unverifiedLimitations,
					operationalNotes: args.operationalNotes,
					verificationMatrix: args.verificationMatrix,
					findings: args.findings,
					followUps: args.followUps,
					language: args.language,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"write_report",
				"ok",
				`Report ${formatTaskId(report.taskId)} (${report.mode}): ${report.outcome}`,
				`taskId=${report.taskId}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "report",
				sessionId: args.sessionId,
				taskId: report.taskId,
			});

			const sessionHint = isNewSession
				? ` New session "${args.sessionId}" created — call open_workspace({ sessionId: "${args.sessionId}" }) to open the Dashboard UI.`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `Delivered ${report.mode} Report ${formatTaskId(report.taskId)} "${report.title}" (${report.outcome}, file: ${reportFilePath}).${sessionHint}`,
					},
				],
				structuredContent: {
					...payload,
					taskId: report.taskId,
					reportFilePath,
				},
			};
		}),
	);

	// record_handoff -> /widget/handoff
	registerAppTool(
		server,
		"record_handoff",
		{
			title: "Record Handoff",
			description:
				"Record a structured mid-session pause, plan approval request, subagent scout summary, or completion handoff linked to the session and optional global taskId.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				id: optionalInput(z.string().min(1)),
				taskId: optionalInput(TaskIdSchema),
				kind: HandoffKindSchema,
				title: z.string().min(1),
				summary: z.string().min(1),
				workingNow: optionalInput(z.string()),
				verifyCommand: optionalInput(z.string()),
				entryPoint: optionalInput(z.string()),
				nextStep: optionalInput(z.string()),
				artifactLinks: optionalArrayInput(FileRefSchema),
				structuredData: optionalInput(z.record(z.string(), z.unknown())),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.handoff },
			},
		},
		args => runLoggedTool(db, { sessionId: args.sessionId, toolName: "record_handoff" }, () => {
			const isNewSession = !hasSession(db, args.sessionId);
			const { handoff } = recordHandoff(
				db,
				args.sessionId,
				{
					id: args.id,
					taskId: args.taskId,
					kind: args.kind,
					title: args.title,
					summary: args.summary,
					workingNow: args.workingNow,
					verifyCommand: args.verifyCommand,
					entryPoint: args.entryPoint,
					nextStep: args.nextStep,
					artifactLinks: args.artifactLinks,
					structuredData: args.structuredData,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"record_handoff",
				"ok",
				`Handoff (${handoff.kind}): ${handoff.title}`,
				`handoffId=${handoff.id}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "handoff",
				sessionId: args.sessionId,
				taskId: handoff.taskId,
				handoffId: handoff.id,
			});

			const sessionHint = isNewSession
				? ` New session "${args.sessionId}" created — call open_workspace({ sessionId: "${args.sessionId}" }) to open the Dashboard UI.`
				: "";

			return {
				content: [
					{
						type: "text",
						text: `Recorded ${handoff.kind} handoff "${handoff.title}" (id: ${handoff.id}).${sessionHint}`,
					},
				],
				structuredContent: payload,
			};
		}),
	);
}
