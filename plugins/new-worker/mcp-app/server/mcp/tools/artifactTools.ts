import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { AuditFindingSchema, AuditVerificationRowSchema, FileRefSchema, HandoffKindSchema, LanguageSchema, PlanCalibrationSchema, PlanComponentRowSchema, PlanFileEntrySchema, PlanRiskRowSchema, PlanScopeSchema, PlanTestingSchema, ReportFileChangeSchema, ReportFollowUpSchema, ReportModeSchema, ReportVerificationRowSchema, SessionIdSchema, SlugSchema, TargetRepoSchema, TaskIdSchema } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { recordHandoff, writePlan, writeReport } from "../../repositories/artifacts.js";
import { recordToolCall } from "../../repositories/settings.js";
import { buildWidgetPayload } from "../../repositories/workspace.js";
import { WIDGET_RESOURCE_URIS } from "../resources.js";
import { buildSessionMeta, runLoggedTool, SessionMetaZodFields } from "./shared.js";

/**
 * Register `write_plan`, `write_report`, and `record_handoff` tools for structured
 * Markdown-backed deliverables and mid-session handoffs.
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
				"Persist a structured technical plan. If taskId is omitted, automatically allocates a new global taskId starting from 1 and returns taskId plus planFilePath (001-<slug>.plan.md exported when exportDir is configured).",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				taskId: TaskIdSchema.optional().describe("Existing global taskId to attach this plan to; omit to allocate a new global taskId."),
				slug: SlugSchema,
				title: z.string().min(1),
				target: TargetRepoSchema,
				follows: z.string().optional(),
				overview: z.string().min(1),
				expectedOutcomes: z.array(z.string().min(1)).min(1),
				scope: PlanScopeSchema,
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
				calibration: PlanCalibrationSchema.optional(),
				testing: PlanTestingSchema,
				language: LanguageSchema.optional(),
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

			return {
				content: [
					{
						type: "text",
						text: `Saved Plan ${formatTaskId(plan.taskId)} "${plan.title}" (taskId: ${plan.taskId}, file: ${planFilePath}).`,
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
				taskId: TaskIdSchema.optional(),
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

			return {
				content: [
					{
						type: "text",
						text: `Delivered ${report.mode} Report ${formatTaskId(report.taskId)} "${report.title}" (${report.outcome}, file: ${reportFilePath}).`,
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
				id: z.string().min(1).optional(),
				taskId: TaskIdSchema.optional(),
				kind: HandoffKindSchema,
				title: z.string().min(1),
				summary: z.string().min(1),
				workingNow: z.string().optional(),
				verifyCommand: z.string().optional(),
				entryPoint: z.string().optional(),
				nextStep: z.string().optional(),
				artifactLinks: z.array(FileRefSchema).optional(),
				structuredData: z.record(z.string(), z.unknown()).optional(),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.handoff },
			},
		},
		args => runLoggedTool(db, { sessionId: args.sessionId, toolName: "record_handoff" }, () => {
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

			return {
				content: [
					{
						type: "text",
						text: `Recorded ${handoff.kind} handoff "${handoff.title}" (id: ${handoff.id}).`,
					},
				],
				structuredContent: payload,
			};
		}),
	);
}
