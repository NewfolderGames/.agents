import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppDrizzleDb } from "../db/client.js";
import { handoffs, plans, reports, sessions, tasks } from "../db/schema.js";
import { type FileRef, FileRefSchema, type HandoffKind, type HandoffRecord, type PlanApprovalSource, PlanBodyJsonSchema, type PlanComponentRow, type PlanFileEntry, type PlanRecord, type PlanReviewStatus, type PlanRiskRow, ReportBodyJsonSchema, type ReportMode, type ReportRecord, type TargetRepo } from "@/shared/contracts.js";
import { formatTaskFilename, formatTaskId } from "@/shared/format.js";
import { renderPlanMarkdown, renderReportMarkdown } from "@/shared/markdown.js";
import { NotFoundError, ReportImmutableError, ValidationError } from "./errors.js";
import { parseJsonObject, parseJsonWithSchema } from "./json.js";
import { ensureSessionTx, getSession, type SessionMetaInput } from "./sessions.js";
import { exportTasksMarkdownIfConfigured, getTaskById, writeFileAtomic } from "./tasks.js";
import { type DbExecutor, recordTimelineEvent } from "./timeline.js";

const ArtifactLinksArraySchema = z.array(FileRefSchema);
const EMPTY_PLAN_BODY = PlanBodyJsonSchema.parse({});
const EMPTY_REPORT_BODY = ReportBodyJsonSchema.parse({});

export interface WritePlanInput {
	taskId?: number;
	slug: string;
	title: string;
	target: TargetRepo;
	follows?: string;
	overview: string;
	expectedOutcomes: string[];
	scope: { inScope: string[]; outOfScope: string[] };
	openQuestions?: string[];
	userStories?: string[];
	functionalRequirements?: string[];
	nonFunctionalRequirements?: string[];
	currentImplementation: string[];
	keyDecisions: string[];
	proposedChanges: string[];
	dataModels?: string;
	components?: PlanComponentRow[];
	fileStructure: PlanFileEntry[];
	architectureDiagram?: string;
	risks?: PlanRiskRow[];
	apiReference?: string;
	migrationPlan?: string;
	alternatives?: string;
	calibration?: { cadence: string; familiarity: string; structureStance: string };
	testing: {
		validationCommands: string[];
		keyScenarios: string[];
		edgeCases?: string[];
		testChanges: string[];
	};
	language?: "en" | "ko";
	reviewStatus?: PlanReviewStatus;
	reviewComment?: string;
	approvedVia?: PlanApprovalSource;
}

export interface UpdatePlanScopeInput {
	inScope?: string[];
	outOfScope?: string[];
}

export interface UpdatePlanTestingInput {
	validationCommands?: string[];
	keyScenarios?: string[];
	edgeCases?: string[] | null;
	testChanges?: string[];
}

export interface UpdatePlanInput {
	taskId: number;
	slug?: string;
	title?: string;
	target?: TargetRepo;
	follows?: string | null;
	overview?: string;
	expectedOutcomes?: string[];
	scope?: UpdatePlanScopeInput;
	openQuestions?: string[] | null;
	userStories?: string[] | null;
	functionalRequirements?: string[] | null;
	nonFunctionalRequirements?: string[] | null;
	currentImplementation?: string[];
	keyDecisions?: string[];
	proposedChanges?: string[];
	dataModels?: string | null;
	components?: PlanComponentRow[] | null;
	fileStructure?: PlanFileEntry[];
	architectureDiagram?: string | null;
	risks?: PlanRiskRow[] | null;
	apiReference?: string | null;
	migrationPlan?: string | null;
	alternatives?: string | null;
	calibration?: { cadence: string; familiarity: string; structureStance: string } | null;
	testing?: UpdatePlanTestingInput;
	language?: "en" | "ko";
	reviewStatus?: PlanReviewStatus;
	reviewComment?: string | null;
	approvedVia?: PlanApprovalSource | null;
	changeSummary?: string;
}

export interface WriteReportInput {
	taskId?: number;
	slug: string;
	title: string;
	mode: ReportMode;
	outcome: string;
	target: TargetRepo;
	planRef?: string;
	summary: string;
	actionsCompleted?: string[];
	filesChanged?: ReportRecord["filesChanged"];
	diffStat?: string;
	planDeviations?: string[];
	verification?: ReportRecord["verification"];
	tryCommand?: string;
	unverifiedLimitations?: string;
	operationalNotes?: string[];
	verificationMatrix?: ReportRecord["verificationMatrix"];
	findings?: ReportRecord["findings"];
	followUps?: ReportRecord["followUps"];
	language?: "en" | "ko";
}

export interface RecordHandoffInput {
	id?: string;
	taskId?: number;
	kind: HandoffKind;
	title: string;
	summary: string;
	workingNow?: string;
	verifyCommand?: string;
	entryPoint?: string;
	nextStep?: string;
	artifactLinks?: FileRef[];
	structuredData?: Record<string, unknown>;
}

function mapPlanRow(row: typeof plans.$inferSelect): PlanRecord {
	const body = parseJsonWithSchema(row.bodyJson, PlanBodyJsonSchema, EMPTY_PLAN_BODY);
	return {
		taskId: row.taskId,
		sessionId: row.sessionId,
		slug: row.slug,
		title: row.title,
		target: {
			repo: row.targetRepo,
			branch: row.targetBranch,
			commit: row.targetCommit,
		},
		follows: row.follows ?? undefined,
		overview: row.overview,
		expectedOutcomes: body.expectedOutcomes,
		scope: body.scope,
		openQuestions: body.openQuestions,
		userStories: body.userStories,
		functionalRequirements: body.functionalRequirements,
		nonFunctionalRequirements: body.nonFunctionalRequirements,
		currentImplementation: body.currentImplementation,
		keyDecisions: body.keyDecisions,
		proposedChanges: body.proposedChanges,
		dataModels: body.dataModels,
		components: body.components,
		fileStructure: body.fileStructure,
		architectureDiagram: body.architectureDiagram,
		risks: body.risks,
		apiReference: body.apiReference,
		migrationPlan: body.migrationPlan,
		alternatives: body.alternatives,
		calibration: body.calibration,
		testing: body.testing,
		language: row.language,
		reviewStatus: row.reviewStatus ?? undefined,
		reviewComment: row.reviewComment ?? undefined,
		generatedPlanPath: row.generatedPlanPath ?? undefined,
		approvedVia: row.approvedVia ?? undefined,
		createdAt: row.createdAt,
		reviewedAt: row.reviewedAt ?? undefined,
	};
}

function mapReportRow(row: typeof reports.$inferSelect): ReportRecord {
	const body = parseJsonWithSchema(row.bodyJson, ReportBodyJsonSchema, EMPTY_REPORT_BODY);
	return {
		taskId: row.taskId,
		sessionId: row.sessionId,
		slug: row.slug,
		title: row.title,
		mode: row.mode,
		outcome: row.outcome,
		target: {
			repo: row.targetRepo,
			branch: row.targetBranch,
			commit: row.targetCommit,
		},
		planRef: row.planRef ?? undefined,
		summary: row.summary,
		actionsCompleted: body.actionsCompleted,
		filesChanged: body.filesChanged,
		diffStat: body.diffStat,
		planDeviations: body.planDeviations,
		verification: body.verification,
		tryCommand: body.tryCommand,
		unverifiedLimitations: body.unverifiedLimitations,
		operationalNotes: body.operationalNotes,
		verificationMatrix: body.verificationMatrix,
		findings: body.findings,
		followUps: body.followUps,
		language: row.language,
		createdAt: row.createdAt,
	};
}

function mapHandoffRow(row: typeof handoffs.$inferSelect): HandoffRecord {
	return {
		id: row.id,
		sessionId: row.sessionId,
		taskId: row.taskId ?? undefined,
		kind: row.kind,
		title: row.title,
		summary: row.summary,
		workingNow: row.workingNow ?? undefined,
		verifyCommand: row.verifyCommand ?? undefined,
		entryPoint: row.entryPoint ?? undefined,
		nextStep: row.nextStep ?? undefined,
		artifactLinks: parseJsonWithSchema(row.artifactLinksJson, ArtifactLinksArraySchema, []),
		structuredData: parseJsonObject(row.structuredDataJson),
		createdAt: row.createdAt,
	};
}

/** Look up a plan by global `taskId`, returning `null` if absent. */
export function getPlanByTaskId(db: DbExecutor, taskId: number): PlanRecord | null {
	const row = db.select().from(plans).where(eq(plans.taskId, taskId)).get();
	return row ? mapPlanRow(row) : null;
}

/** List plans matching optional session/group filters, ordered newest task first. */
export function listPlans(
	db: DbExecutor,
	filter?: { sessionId?: string; groupId?: string; limit?: number },
): PlanRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(plans.sessionId, filter.sessionId));
	}
	if (filter?.groupId) {
		const sessionIds = db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.groupId, filter.groupId))
			.all()
			.map(r => r.id);
		if (sessionIds.length === 0) {
			return [];
		}
		conditions.push(inArray(plans.sessionId, sessionIds));
	}
	const rows = db
		.select()
		.from(plans)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(plans.taskId))
		.limit(filter?.limit ?? 100)
		.all();
	return rows.map(mapPlanRow);
}

/** Look up an immutable report by global `taskId`, returning `null` if absent. */
export function getReportByTaskId(db: DbExecutor, taskId: number): ReportRecord | null {
	const row = db.select().from(reports).where(eq(reports.taskId, taskId)).get();
	return row ? mapReportRow(row) : null;
}

/** List reports matching optional session/group filters, ordered newest task first. */
export function listReports(
	db: DbExecutor,
	filter?: { sessionId?: string; groupId?: string; limit?: number },
): ReportRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(reports.sessionId, filter.sessionId));
	}
	if (filter?.groupId) {
		const sessionIds = db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.groupId, filter.groupId))
			.all()
			.map(r => r.id);
		if (sessionIds.length === 0) {
			return [];
		}
		conditions.push(inArray(reports.sessionId, sessionIds));
	}
	const rows = db
		.select()
		.from(reports)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(reports.taskId))
		.limit(filter?.limit ?? 100)
		.all();
	return rows.map(mapReportRow);
}

/** List structured session handoffs matching optional session, group, or task filters. */
export function listHandoffs(
	db: DbExecutor,
	filter?: { sessionId?: string; groupId?: string; taskId?: number; limit?: number },
): HandoffRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(handoffs.sessionId, filter.sessionId));
	}
	if (filter?.groupId) {
		const sessionIds = db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.groupId, filter.groupId))
			.all()
			.map(r => r.id);
		if (sessionIds.length === 0) {
			return [];
		}
		conditions.push(inArray(handoffs.sessionId, sessionIds));
	}
	if (filter?.taskId !== undefined) {
		conditions.push(eq(handoffs.taskId, filter.taskId));
	}
	const rows = db
		.select()
		.from(handoffs)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(handoffs.createdAt))
		.limit(filter?.limit ?? 100)
		.all();
	return rows.map(mapHandoffRow);
}

function resolveNullableField<T>(patch: T | null | undefined, current: T | undefined): T | undefined {
	if (patch === undefined) {
		return current;
	}
	return patch === null ? undefined : patch;
}

function serializePlanBody(input: Pick<
	WritePlanInput,
	| "expectedOutcomes"
	| "scope"
	| "openQuestions"
	| "userStories"
	| "functionalRequirements"
	| "nonFunctionalRequirements"
	| "currentImplementation"
	| "keyDecisions"
	| "proposedChanges"
	| "dataModels"
	| "components"
	| "fileStructure"
	| "architectureDiagram"
	| "risks"
	| "apiReference"
	| "migrationPlan"
	| "alternatives"
	| "calibration"
	| "testing"
>): string {
	return JSON.stringify({
		expectedOutcomes: input.expectedOutcomes,
		scope: input.scope,
		openQuestions: input.openQuestions,
		userStories: input.userStories,
		functionalRequirements: input.functionalRequirements,
		nonFunctionalRequirements: input.nonFunctionalRequirements,
		currentImplementation: input.currentImplementation,
		keyDecisions: input.keyDecisions,
		proposedChanges: input.proposedChanges,
		dataModels: input.dataModels,
		components: input.components,
		fileStructure: input.fileStructure,
		architectureDiagram: input.architectureDiagram,
		risks: input.risks,
		apiReference: input.apiReference,
		migrationPlan: input.migrationPlan,
		alternatives: input.alternatives,
		calibration: input.calibration,
		testing: input.testing,
	});
}

function persistPlanMutation(
	tx: DbExecutor,
	opts: {
		sessionId: string;
		groupId?: string | null;
		sessionTitle?: string | null;
		exportDir?: string | null;
		taskId: number;
		previousFileName: string | null;
		existingPlan: typeof plans.$inferSelect | undefined;
		data: WritePlanInput;
		reviewStatus: PlanReviewStatus;
		reviewComment: string | null;
		approvedVia: PlanApprovalSource | null;
		reviewedAt: string | null;
		timelineSummary?: string;
		now: string;
	},
): {
	plan: PlanRecord;
	exportDir: string | null;
	fileName: string;
	previousFileName: string | null;
} {
	const fileName = formatTaskFilename(opts.taskId, opts.data.slug, "plan");
	const generatedPlanPath = opts.exportDir
		? path.join(opts.exportDir, fileName)
		: undefined;

	tx.update(tasks)
		.set({ planFile: fileName, updatedAt: opts.now })
		.where(eq(tasks.id, opts.taskId))
		.run();

	const bodyJson = serializePlanBody(opts.data);
	let savedRow: typeof plans.$inferSelect;
	if (opts.existingPlan) {
		savedRow = tx
			.update(plans)
			.set({
				slug: opts.data.slug,
				title: opts.data.title,
				targetRepo: opts.data.target.repo,
				targetBranch: opts.data.target.branch,
				targetCommit: opts.data.target.commit,
				follows: opts.data.follows ?? null,
				overview: opts.data.overview,
				language: opts.data.language ?? "en",
				reviewStatus: opts.reviewStatus,
				reviewComment: opts.reviewComment,
				generatedPlanPath: generatedPlanPath ?? opts.existingPlan.generatedPlanPath,
				approvedVia: opts.approvedVia,
				bodyJson,
				reviewedAt: opts.reviewedAt,
			})
			.where(eq(plans.taskId, opts.taskId))
			.returning()
			.get()!;
	}
	else {
		savedRow = tx
			.insert(plans)
			.values({
				taskId: opts.taskId,
				sessionId: opts.sessionId,
				slug: opts.data.slug,
				title: opts.data.title,
				targetRepo: opts.data.target.repo,
				targetBranch: opts.data.target.branch,
				targetCommit: opts.data.target.commit,
				follows: opts.data.follows ?? null,
				overview: opts.data.overview,
				language: opts.data.language ?? "en",
				reviewStatus: opts.reviewStatus,
				reviewComment: opts.reviewComment,
				generatedPlanPath: generatedPlanPath ?? null,
				approvedVia: opts.approvedVia,
				bodyJson,
				createdAt: opts.now,
				reviewedAt: opts.reviewedAt,
			})
			.returning()
			.get();
	}

	const plan = mapPlanRow(savedRow);
	recordTimelineEvent(tx, {
		sessionId: opts.sessionId,
		groupId: opts.groupId,
		eventType: opts.existingPlan ? "plan_updated" : "plan_written",
		actor: "agent",
		title: `${opts.existingPlan ? "Updated" : "Wrote"} Plan ${formatTaskId(opts.taskId)}: ${plan.title}`,
		summary: opts.timelineSummary?.trim() || fileName,
		links: [
			{ entityType: "plan", entityId: String(opts.taskId), role: "subject", label: fileName },
			{
				entityType: "task",
				entityId: String(opts.taskId),
				role: "parent",
				label: `Task ${formatTaskId(opts.taskId)}`,
			},
			{
				entityType: "session",
				entityId: opts.sessionId,
				role: "parent",
				label: opts.sessionTitle ?? opts.sessionId,
			},
		],
		createdAt: opts.now,
	});

	return {
		plan,
		exportDir: opts.exportDir ?? null,
		fileName,
		previousFileName: opts.previousFileName,
	};
}

async function exportPlanArtifacts(
	db: AppDrizzleDb,
	sessionId: string,
	saved: {
		plan: PlanRecord;
		exportDir: string | null;
		fileName: string;
		previousFileName: string | null;
	},
): Promise<{ plan: PlanRecord; planFilePath: string; planMarkdown: string }> {
	const planMarkdown = renderPlanMarkdown(saved.plan);
	if (saved.exportDir) {
		await writeFileAtomic(path.join(saved.exportDir, saved.fileName), planMarkdown);
		if (saved.previousFileName && saved.previousFileName !== saved.fileName) {
			try {
				await fs.unlink(path.join(saved.exportDir, saved.previousFileName));
			}
			catch {
				// Ignore missing prior plan file when renaming slug.
			}
		}
		await exportTasksMarkdownIfConfigured(db, sessionId);
	}

	return {
		plan: saved.plan,
		planFilePath: saved.exportDir
			? path.join(saved.exportDir, saved.fileName)
			: saved.fileName,
		planMarkdown,
	};
}

/**
 * Persist a technical plan, auto-allocating a global `taskId` if omitted, and
 * optionally export `NNN-<slug>.plan.md` + `tasks.md` to `exportDir`.
 */
export async function writePlan(
	db: AppDrizzleDb,
	sessionId: string,
	input: WritePlanInput,
	meta?: SessionMetaInput,
): Promise<{ plan: PlanRecord; planFilePath: string; planMarkdown: string }> {
	const result = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);

		let taskId = input.taskId;
		let previousFileName: string | null = null;
		if (taskId !== undefined) {
			const existingTask = getTaskById(tx, taskId);
			if (!existingTask) {
				throw new NotFoundError("Task", taskId);
			}
			if (existingTask.sessionId !== sessionId) {
				throw new ValidationError(
					`Task ${formatTaskId(taskId)} belongs to session "${existingTask.sessionId}", not "${sessionId}".`,
				);
			}
			previousFileName = existingTask.planFile ?? null;
		}
		else {
			const createdTask = tx
				.insert(tasks)
				.values({
					sessionId,
					slug: input.slug,
					title: input.title,
					status: "planned",
					summary: input.overview,
					createdAt: now,
					updatedAt: now,
				})
				.returning()
				.get();
			taskId = createdTask.id;
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "task_created",
				actor: "agent",
				title: `Allocated Task ${formatTaskId(taskId)}: ${input.title}`,
				summary: input.overview,
				links: [
					{
						entityType: "task",
						entityId: String(taskId),
						role: "subject",
						label: `Task ${formatTaskId(taskId)}`,
					},
					{
						entityType: "session",
						entityId: sessionId,
						role: "parent",
						label: session.title ?? sessionId,
					},
				],
				createdAt: now,
			});
		}

		const existingPlan = tx.select().from(plans).where(eq(plans.taskId, taskId)).get();
		const reviewStatus = input.reviewStatus ?? existingPlan?.reviewStatus ?? "pending_review";
		const reviewedAt
			= reviewStatus === "approved" || reviewStatus === "changes_requested"
				? (existingPlan?.reviewedAt ?? now)
				: existingPlan?.reviewedAt ?? null;

		return persistPlanMutation(tx, {
			sessionId,
			groupId: session.groupId,
			sessionTitle: session.title,
			exportDir: session.exportDir,
			taskId,
			previousFileName,
			existingPlan,
			data: input,
			reviewStatus,
			reviewComment: input.reviewComment ?? existingPlan?.reviewComment ?? null,
			approvedVia: input.approvedVia ?? existingPlan?.approvedVia ?? null,
			reviewedAt,
			now,
		});
	});

	return exportPlanArtifacts(db, sessionId, result);
}

/**
 * Partially update an existing technical plan for `taskId` across any lifecycle
 * stage (pre-approval review, mid-execution sync, or post-completion reconfiguration)
 * and re-export `NNN-<slug>.plan.md` + `tasks.md` when `exportDir` is configured.
 */
export async function updatePlan(
	db: AppDrizzleDb,
	sessionId: string,
	input: UpdatePlanInput,
	meta?: SessionMetaInput,
): Promise<{ plan: PlanRecord; planFilePath: string; planMarkdown: string }> {
	const result = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);

		const existingTask = getTaskById(tx, input.taskId);
		if (!existingTask) {
			throw new NotFoundError("Task", input.taskId);
		}
		if (existingTask.sessionId !== sessionId) {
			throw new ValidationError(
				`Task ${formatTaskId(input.taskId)} belongs to session "${existingTask.sessionId}", not "${sessionId}".`,
			);
		}

		const existingPlanRow = tx.select().from(plans).where(eq(plans.taskId, input.taskId)).get();
		if (!existingPlanRow) {
			throw new NotFoundError("Plan", input.taskId);
		}
		const existingPlan = mapPlanRow(existingPlanRow);

		const merged: WritePlanInput = {
			taskId: input.taskId,
			slug: input.slug ?? existingPlan.slug,
			title: input.title ?? existingPlan.title,
			target: input.target ?? existingPlan.target,
			follows: resolveNullableField(input.follows, existingPlan.follows),
			overview: input.overview ?? existingPlan.overview,
			expectedOutcomes: input.expectedOutcomes ?? existingPlan.expectedOutcomes,
			scope: {
				inScope: input.scope?.inScope ?? existingPlan.scope.inScope,
				outOfScope: input.scope?.outOfScope ?? existingPlan.scope.outOfScope,
			},
			openQuestions: resolveNullableField(input.openQuestions, existingPlan.openQuestions),
			userStories: resolveNullableField(input.userStories, existingPlan.userStories),
			functionalRequirements: resolveNullableField(
				input.functionalRequirements,
				existingPlan.functionalRequirements,
			),
			nonFunctionalRequirements: resolveNullableField(
				input.nonFunctionalRequirements,
				existingPlan.nonFunctionalRequirements,
			),
			currentImplementation: input.currentImplementation ?? existingPlan.currentImplementation,
			keyDecisions: input.keyDecisions ?? existingPlan.keyDecisions,
			proposedChanges: input.proposedChanges ?? existingPlan.proposedChanges,
			dataModels: resolveNullableField(input.dataModels, existingPlan.dataModels),
			components: resolveNullableField(input.components, existingPlan.components),
			fileStructure: input.fileStructure ?? existingPlan.fileStructure,
			architectureDiagram: resolveNullableField(
				input.architectureDiagram,
				existingPlan.architectureDiagram,
			),
			risks: resolveNullableField(input.risks, existingPlan.risks),
			apiReference: resolveNullableField(input.apiReference, existingPlan.apiReference),
			migrationPlan: resolveNullableField(input.migrationPlan, existingPlan.migrationPlan),
			alternatives: resolveNullableField(input.alternatives, existingPlan.alternatives),
			calibration: resolveNullableField(input.calibration, existingPlan.calibration),
			testing: {
				validationCommands:
					input.testing?.validationCommands ?? existingPlan.testing.validationCommands,
				keyScenarios: input.testing?.keyScenarios ?? existingPlan.testing.keyScenarios,
				edgeCases: resolveNullableField(input.testing?.edgeCases, existingPlan.testing.edgeCases),
				testChanges: input.testing?.testChanges ?? existingPlan.testing.testChanges,
			},
			language: input.language ?? existingPlan.language,
		};

		const reviewStatus = input.reviewStatus ?? existingPlanRow.reviewStatus ?? "pending_review";
		const reviewedAt = input.reviewStatus !== undefined
			? (reviewStatus === "approved" || reviewStatus === "changes_requested" ? now : null)
			: existingPlanRow.reviewedAt;

		const reviewComment = input.reviewComment === undefined
			? existingPlanRow.reviewComment
			: input.reviewComment;
		const approvedVia = input.approvedVia === undefined
			? existingPlanRow.approvedVia
			: input.approvedVia;

		return persistPlanMutation(tx, {
			sessionId,
			groupId: session.groupId,
			sessionTitle: session.title,
			exportDir: session.exportDir,
			taskId: input.taskId,
			previousFileName: existingTask.planFile ?? null,
			existingPlan: existingPlanRow,
			data: merged,
			reviewStatus,
			reviewComment,
			approvedVia,
			reviewedAt,
			timelineSummary: input.changeSummary,
			now,
		});
	});

	return exportPlanArtifacts(db, sessionId, result);
}

/**
 * Persist an immutable implementation or audit report (`NNN-<slug>.report.md`).
 * Rejects overwrites when a report already exists for `taskId`.
 */
export async function writeReport(
	db: AppDrizzleDb,
	sessionId: string,
	input: WriteReportInput,
	meta?: SessionMetaInput,
): Promise<{ report: ReportRecord; reportFilePath: string; reportMarkdown: string }> {
	const result = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);

		let taskId = input.taskId;
		if (taskId !== undefined) {
			const existingTask = getTaskById(tx, taskId);
			if (!existingTask) {
				throw new NotFoundError("Task", taskId);
			}
			if (existingTask.sessionId !== sessionId) {
				throw new ValidationError(
					`Task ${formatTaskId(taskId)} belongs to session "${existingTask.sessionId}", not "${sessionId}".`,
				);
			}
			const existingReport = tx.select().from(reports).where(eq(reports.taskId, taskId)).get();
			if (existingReport) {
				throw new ReportImmutableError(taskId);
			}
		}
		else {
			const createdTask = tx
				.insert(tasks)
				.values({
					sessionId,
					slug: input.slug,
					title: input.title,
					status: "done",
					summary: input.summary,
					createdAt: now,
					startedAt: now,
					completedAt: now,
					updatedAt: now,
				})
				.returning()
				.get();
			taskId = createdTask.id;
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "task_created",
				actor: "agent",
				title: `Allocated Task ${formatTaskId(taskId)} (${input.mode}): ${input.title}`,
				summary: input.summary,
				links: [
					{
						entityType: "task",
						entityId: String(taskId),
						role: "subject",
						label: `Task ${formatTaskId(taskId)}`,
					},
					{
						entityType: "session",
						entityId: sessionId,
						role: "parent",
						label: session.title ?? sessionId,
					},
				],
				createdAt: now,
			});
		}

		const fileName = formatTaskFilename(taskId, input.slug, "report");
		const existingTaskRow = tx.select().from(tasks).where(eq(tasks.id, taskId)).get()!;
		const planRef = input.planRef ?? existingTaskRow.planFile ?? undefined;

		tx.update(tasks)
			.set({
				reportFile: fileName,
				status: input.outcome.toLowerCase().includes("block") ? existingTaskRow.status : "done",
				completedAt:
					input.outcome.toLowerCase().includes("block")
						? existingTaskRow.completedAt
						: (existingTaskRow.completedAt ?? now),
				updatedAt: now,
			})
			.where(eq(tasks.id, taskId))
			.run();

		const bodyJson = JSON.stringify({
			actionsCompleted: input.actionsCompleted ?? [],
			filesChanged: input.filesChanged ?? [],
			diffStat: input.diffStat,
			planDeviations: input.planDeviations ?? [],
			verification: input.verification ?? [],
			tryCommand: input.tryCommand,
			unverifiedLimitations: input.unverifiedLimitations,
			operationalNotes: input.operationalNotes ?? [],
			verificationMatrix: input.verificationMatrix ?? [],
			findings: input.findings ?? [],
			followUps: input.followUps ?? [],
		});

		const savedRow = tx
			.insert(reports)
			.values({
				taskId,
				sessionId,
				slug: input.slug,
				title: input.title,
				mode: input.mode,
				outcome: input.outcome,
				targetRepo: input.target.repo,
				targetBranch: input.target.branch,
				targetCommit: input.target.commit,
				planRef: planRef ?? null,
				summary: input.summary,
				language: input.language ?? "en",
				bodyJson,
				createdAt: now,
			})
			.returning()
			.get();

		const report = mapReportRow(savedRow);
		recordTimelineEvent(tx, {
			sessionId,
			groupId: session.groupId,
			eventType: "report_written",
			actor: "agent",
			title: `Delivered ${report.mode} Report ${formatTaskId(taskId)}: ${report.title}`,
			summary: `${report.outcome} (${fileName})`,
			links: [
				{
					entityType: "report",
					entityId: String(taskId),
					role: "subject",
					label: fileName,
				},
				{
					entityType: "task",
					entityId: String(taskId),
					role: "parent",
					label: `Task ${formatTaskId(taskId)}`,
				},
				{
					entityType: "session",
					entityId: sessionId,
					role: "parent",
					label: session.title ?? sessionId,
				},
			],
			createdAt: now,
		});

		return {
			report,
			exportDir: session.exportDir,
			fileName,
		};
	});

	const reportMarkdown = renderReportMarkdown(result.report);
	if (result.exportDir) {
		await writeFileAtomic(path.join(result.exportDir, result.fileName), reportMarkdown);
		await exportTasksMarkdownIfConfigured(db, sessionId);
	}

	const session = getSession(db, sessionId);
	return {
		report: result.report,
		reportFilePath: session?.exportDir
			? path.join(session.exportDir, result.fileName)
			: result.fileName,
		reportMarkdown,
	};
}

/** Record a structured handoff (`plan_approval`, `mid_session_pause`, `completion`, `subagent_scout`, `custom`). */
export function recordHandoff(
	db: AppDrizzleDb,
	sessionId: string,
	input: RecordHandoffInput,
	meta?: SessionMetaInput,
): { handoff: HandoffRecord } {
	const handoff = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);
		const id = input.id?.trim() || `h-${crypto.randomUUID().slice(0, 8)}`;

		if (input.taskId !== undefined) {
			const taskExists = tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, input.taskId)).get();
			if (!taskExists) {
				throw new NotFoundError("Task", input.taskId);
			}
		}

		const inserted = tx
			.insert(handoffs)
			.values({
				id,
				sessionId,
				taskId: input.taskId ?? null,
				kind: input.kind,
				title: input.title,
				summary: input.summary,
				workingNow: input.workingNow ?? null,
				verifyCommand: input.verifyCommand ?? null,
				entryPoint: input.entryPoint ?? null,
				nextStep: input.nextStep ?? null,
				artifactLinksJson: JSON.stringify(input.artifactLinks ?? []),
				structuredDataJson: input.structuredData ? JSON.stringify(input.structuredData) : null,
				createdAt: now,
			})
			.returning()
			.get();

		recordTimelineEvent(tx, {
			sessionId,
			groupId: session.groupId,
			eventType: "handoff_recorded",
			actor: "agent",
			title: `Handoff (${input.kind}): ${input.title}`,
			summary: input.summary,
			links: [
				{ entityType: "handoff", entityId: id, role: "subject", label: input.title },
				{
					entityType: "session",
					entityId: sessionId,
					role: "parent",
					label: session.title ?? sessionId,
				},
				...(input.taskId !== undefined
					? [{
							entityType: "task" as const,
							entityId: String(input.taskId),
							role: "related" as const,
							label: `Task ${formatTaskId(input.taskId)}`,
						}]
					: []),
			],
			createdAt: now,
		});

		return mapHandoffRow(inserted);
	});

	return { handoff };
}
