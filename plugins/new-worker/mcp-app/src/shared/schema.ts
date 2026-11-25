import { z } from "zod";

export const CURRENT_SESSION_SCHEMA_VERSION = 1 as const;
export const CURRENT_INDEX_SCHEMA_VERSION = 1 as const;
export const CURRENT_SETTINGS_SCHEMA_VERSION = 1 as const;

export const SessionIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9._-]{1,80}$/, "sessionId must match [a-zA-Z0-9._-]{1,80}");

export const TaskNumberSchema = z
	.string()
	.regex(/^\d{2,}$/, "taskNumber must be a zero-padded numeric string such as 01");

export const SlugSchema = z
	.string()
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be lowercase kebab-case ASCII");

export const LanguageSchema = z.enum(["en", "ko"]);

export const FileRefSchema = z.object({
	label: z.string().min(1),
	path: z.string().min(1),
	lineStart: z.number().int().positive().optional(),
	lineEnd: z.number().int().positive().optional(),
});
export type FileRef = z.infer<typeof FileRefSchema>;

export const TaskItemStatusSchema = z.enum(["pending", "in_progress", "done"]);
export type TaskItemStatus = z.infer<typeof TaskItemStatusSchema>;

export const TaskItemSchema = z.object({
	id: z.string().min(1),
	text: z.string().min(1),
	status: TaskItemStatusSchema,
	createdAt: z.string().optional(),
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	updatedAt: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

export const TaskStepSchema = z.object({
	title: z.string().min(1),
	outcome: z.string().min(1),
	items: z.array(TaskItemSchema).min(1),
	createdAt: z.string().optional(),
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	updatedAt: z.string().optional(),
});
export type TaskStep = z.infer<typeof TaskStepSchema>;

export const TaskLifecycleStatusSchema = z.enum([
	"planned",
	"in_progress",
	"done",
	"cancelled",
	"superseded",
]);
export type TaskLifecycleStatus = z.infer<typeof TaskLifecycleStatusSchema>;

export const TaskRecordSchema = z.object({
	taskNumber: TaskNumberSchema,
	slug: SlugSchema,
	title: z.string().min(1),
	status: TaskLifecycleStatusSchema,
	summary: z.string().min(1),
	steps: z.array(TaskStepSchema).min(1),
	planFile: z.string().optional(),
	reportFile: z.string().optional(),
	createdAt: z.string().optional(),
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	updatedAt: z.string().min(1),
});
export type TaskRecord = z.infer<typeof TaskRecordSchema>;

export const TargetRepoSchema = z.object({
	repo: z.string().min(1),
	branch: z.string().min(1),
	commit: z.string().min(1),
});
export type TargetRepo = z.infer<typeof TargetRepoSchema>;

export const PlanReviewStatusSchema = z.enum([
	"draft",
	"pending_review",
	"approved",
	"changes_requested",
]);
export type PlanReviewStatus = z.infer<typeof PlanReviewStatusSchema>;

export const PlanApprovalSourceSchema = z.enum([
	"ui",
	"harness_artifact",
	"chat",
]);
export type PlanApprovalSource = z.infer<typeof PlanApprovalSourceSchema>;

export const PlanComponentRowSchema = z.object({
	component: z.string().min(1),
	path: z.string().min(1),
	responsibility: z.string().min(1),
});

export const PlanRiskRowSchema = z.object({
	risk: z.string().min(1),
	impact: z.string().min(1),
	mitigation: z.string().min(1),
});

export const PlanFileEntrySchema = z.object({
	path: z.string().min(1),
	action: z.enum(["added", "modified", "deleted"]),
	reason: z.string().min(1),
});

export const PlanRecordSchema = z.object({
	taskNumber: TaskNumberSchema,
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
	language: LanguageSchema.default("en"),
	reviewStatus: PlanReviewStatusSchema.optional(),
	reviewComment: z.string().optional(),
	generatedPlanPath: z.string().optional(),
	approvedVia: PlanApprovalSourceSchema.optional(),
	createdAt: z.string().min(1),
	reviewedAt: z.string().optional(),
});
export type PlanRecord = z.infer<typeof PlanRecordSchema>;

export const ReportModeSchema = z.enum(["implementation", "audit"]);
export type ReportMode = z.infer<typeof ReportModeSchema>;

export const VerificationStatusSchema = z.enum(["PASS", "FAIL", "SKIPPED", "NOT RUN"]);
export type VerificationStatus = z.infer<typeof VerificationStatusSchema>;

export const FollowUpPrioritySchema = z.enum(["MUST", "SHOULD", "COULD"]);
export type FollowUpPriority = z.infer<typeof FollowUpPrioritySchema>;

export const FindingSeveritySchema = z.enum(["critical", "high", "medium", "low"]);
export type FindingSeverity = z.infer<typeof FindingSeveritySchema>;

export const ReportFileChangeSchema = z.object({
	path: z.string().min(1),
	action: z.enum(["Added", "Modified", "Deleted"]),
	summary: z.string().min(1),
	lineStart: z.number().int().positive().optional(),
	lineEnd: z.number().int().positive().optional(),
	beforeText: z.string().optional(),
	afterText: z.string().optional(),
});
export type ReportFileChange = z.infer<typeof ReportFileChangeSchema>;

export const ReportVerificationRowSchema = z.object({
	check: z.string().min(1),
	command: z.string().min(1),
	result: VerificationStatusSchema,
	notes: z.string().min(1),
});
export type ReportVerificationRow = z.infer<typeof ReportVerificationRowSchema>;

export const ReportFollowUpSchema = z.object({
	id: z.string().min(1),
	priority: FollowUpPrioritySchema,
	location: z.string().min(1),
	lineStart: z.number().int().positive().optional(),
	lineEnd: z.number().int().positive().optional(),
	action: z.string().min(1),
});
export type ReportFollowUp = z.infer<typeof ReportFollowUpSchema>;

export const AuditFindingSchema = z.object({
	id: z.string().min(1),
	severity: FindingSeveritySchema,
	title: z.string().min(1),
	location: z.string().min(1),
	lineStart: z.number().int().positive().optional(),
	lineEnd: z.number().int().positive().optional(),
	detail: z.string().min(1),
});
export type AuditFinding = z.infer<typeof AuditFindingSchema>;

export const AuditVerificationRowSchema = z.object({
	target: z.string().min(1),
	status: z.enum(["PASS", "PARTIAL", "FAIL"]),
	observed: z.string().min(1),
});

export const ReportRecordSchema = z.object({
	taskNumber: TaskNumberSchema,
	slug: SlugSchema,
	title: z.string().min(1),
	mode: ReportModeSchema,
	outcome: z.string().min(1),
	target: TargetRepoSchema,
	planRef: z.string().optional(),
	summary: z.string().min(1),
	actionsCompleted: z.array(z.string().min(1)).default([]),
	filesChanged: z.array(ReportFileChangeSchema).default([]),
	diffStat: z.string().optional(),
	planDeviations: z.array(z.string().min(1)).default([]),
	verification: z.array(ReportVerificationRowSchema).default([]),
	tryCommand: z.string().optional(),
	unverifiedLimitations: z.string().optional(),
	operationalNotes: z.array(z.string().min(1)).default([]),
	verificationMatrix: z.array(AuditVerificationRowSchema).default([]),
	findings: z.array(AuditFindingSchema).default([]),
	followUps: z.array(ReportFollowUpSchema).default([]),
	language: LanguageSchema.default("en"),
	createdAt: z.string().min(1),
});
export type ReportRecord = z.infer<typeof ReportRecordSchema>;

export const HandoffKindSchema = z.enum([
	"plan_approval",
	"mid_session_pause",
	"completion",
	"subagent_scout",
	"custom",
]);
export type HandoffKind = z.infer<typeof HandoffKindSchema>;

export const HandoffRecordSchema = z.object({
	id: z.string().min(1),
	taskNumber: TaskNumberSchema.optional(),
	kind: HandoffKindSchema,
	title: z.string().min(1),
	summary: z.string().min(1),
	workingNow: z.string().optional(),
	verifyCommand: z.string().optional(),
	entryPoint: z.string().optional(),
	nextStep: z.string().optional(),
	artifactLinks: z.array(FileRefSchema).default([]),
	structuredData: z.record(z.string(), z.unknown()).optional(),
	createdAt: z.string().min(1),
});
export type HandoffRecord = z.infer<typeof HandoffRecordSchema>;

export const QuestionKindSchema = z.enum([
	"single_select",
	"multi_select",
	"text",
	"textarea",
	"boolean",
]);
export type QuestionKind = z.infer<typeof QuestionKindSchema>;

export const QuestionBlockingModeSchema = z.enum([
	"immediate",
	"before_step_finish",
	"anytime",
]);
export type QuestionBlockingMode = z.infer<typeof QuestionBlockingModeSchema>;

export const QuestionOptionSchema = z.object({
	value: z.string().min(1),
	label: z.string().min(1),
	description: z.string().optional(),
	recommended: z.boolean().optional(),
});
export type QuestionOption = z.infer<typeof QuestionOptionSchema>;

export const QuestionSectionSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
});
export type QuestionSection = z.infer<typeof QuestionSectionSchema>;

export const QuestionItemSchema = z.object({
	id: z.string().min(1),
	sectionId: z.string().optional(),
	prompt: z.string().min(1),
	hint: z.string().optional(),
	contextRefs: z.array(FileRefSchema).default([]),
	kind: QuestionKindSchema,
	required: z.boolean().default(true),
	options: z.array(QuestionOptionSchema).optional(),
	allowOther: z.boolean().default(false),
	placeholder: z.string().optional(),
	defaultValue: z.union([z.string(), z.array(z.string()), z.boolean()]).optional(),
	blockingMode: QuestionBlockingModeSchema.optional(),
	taskNumber: TaskNumberSchema.optional(),
	stepNumber: z.number().int().positive().optional(),
});
export type QuestionItem = z.infer<typeof QuestionItemSchema>;

export const QuestionAnswerValueSchema = z.union([
	z.string(),
	z.array(z.string()),
	z.boolean(),
]);
export type QuestionAnswerValue = z.infer<typeof QuestionAnswerValueSchema>;

export const QuestionSetRecordSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1),
	description: z.string().optional(),
	submitLabel: z.string().default("Submit Answers"),
	blockingMode: QuestionBlockingModeSchema.default("immediate"),
	taskNumber: TaskNumberSchema.optional(),
	stepNumber: z.number().int().positive().optional(),
	sections: z.array(QuestionSectionSchema).default([]),
	questions: z.array(QuestionItemSchema).min(1),
	status: z.enum(["pending", "partial", "submitted"]).default("pending"),
	answeredQuestionIds: z.array(z.string()).default([]),
	answers: z.record(z.string(), QuestionAnswerValueSchema).default({}),
	otherTexts: z.record(z.string(), z.string()).default({}),
	createdAt: z.string().min(1),
	submittedAt: z.string().optional(),
});
export type QuestionSetRecord = z.infer<typeof QuestionSetRecordSchema>;

export interface ResolvedQuestionPolicy {
	blockingMode: QuestionBlockingMode;
	taskNumber?: string;
	stepNumber?: number;
}

/** Resolve effective blocking policy for a question, falling back to its parent question set. */
export function resolveQuestionPolicy(
	questionSet: Pick<QuestionSetRecord, "blockingMode" | "taskNumber" | "stepNumber">,
	question: Pick<QuestionItem, "blockingMode" | "taskNumber" | "stepNumber">,
): ResolvedQuestionPolicy {
	const blockingMode = question.blockingMode ?? questionSet.blockingMode ?? "immediate";
	return {
		blockingMode,
		taskNumber: question.taskNumber ?? questionSet.taskNumber,
		stepNumber: question.stepNumber ?? questionSet.stepNumber,
	};
}

export const ToolCallRecordSchema = z.object({
	id: z.string().min(1),
	toolName: z.string().min(1),
	timestamp: z.string().min(1),
	status: z.enum(["ok", "error"]),
	summary: z.string().min(1),
	argsSummary: z.string().optional(),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

export const SessionDataSchema = z.object({
	schemaVersion: z.number().int().positive().default(CURRENT_SESSION_SCHEMA_VERSION),
	sessionId: SessionIdSchema,
	workspacePath: z.string().optional(),
	exportDir: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
	tasks: z.array(TaskRecordSchema).default([]),
	plans: z.array(PlanRecordSchema).default([]),
	reports: z.array(ReportRecordSchema).default([]),
	handoffs: z.array(HandoffRecordSchema).default([]),
	questionSets: z.array(QuestionSetRecordSchema).default([]),
	toolCalls: z.array(ToolCallRecordSchema).default([]),
});
export type SessionData = z.infer<typeof SessionDataSchema>;

export const SessionSummarySchema = z.object({
	sessionId: SessionIdSchema,
	workspacePath: z.string().optional(),
	updatedAt: z.string().min(1),
	taskCount: z.number().int().nonnegative(),
	pendingQuestionCount: z.number().int().nonnegative(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionIndexFileSchema = z.object({
	schemaVersion: z.number().int().positive().default(CURRENT_INDEX_SCHEMA_VERSION),
	sessions: z.array(SessionSummarySchema),
});
export type SessionIndexFile = z.infer<typeof SessionIndexFileSchema>;

export const WorkspaceTabSchema = z.enum([
	"tasks",
	"plans",
	"reports",
	"handoffs",
	"questions",
	"calls",
]);
export type WorkspaceTab = z.infer<typeof WorkspaceTabSchema>;

export const AppViewModeSchema = z.enum([
	"dashboard",
	"tasks",
	"task_step",
	"plan",
	"report",
	"handoff",
	"questions",
]);
export type AppViewMode = z.infer<typeof AppViewModeSchema>;

export const WidgetDisplayModeSchema = z.enum(["minimized", "compact", "full"]);
export type WidgetDisplayMode = z.infer<typeof WidgetDisplayModeSchema>;

export const StepDisplayOverrideSchema = z.enum(["inherit", "minimized", "compact", "full"]);
export type StepDisplayOverride = z.infer<typeof StepDisplayOverrideSchema>;

export const UiSettingsSchema = z.object({
	schemaVersion: z.number().int().positive().default(CURRENT_SETTINGS_SCHEMA_VERSION),
	displayType: WidgetDisplayModeSchema.default("minimized"),
	stepDisplayType: StepDisplayOverrideSchema.default("inherit"),
});
export type UiSettings = z.infer<typeof UiSettingsSchema>;

export const DEFAULT_UI_SETTINGS: UiSettings = {
	schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
	displayType: "minimized",
	stepDisplayType: "inherit",
};

export function resolveWidgetDisplayMode(
	settings: UiSettings,
	widgetKind: "widget" | "step" = "widget",
): WidgetDisplayMode {
	if (widgetKind === "step" && settings.stepDisplayType !== "inherit") {
		return settings.stepDisplayType;
	}
	return settings.displayType;
}

export const TaskStepSnapshotSchema = z.object({
	taskNumber: TaskNumberSchema,
	taskTitle: z.string().min(1),
	stepIndex: z.number().int().nonnegative(),
	totalSteps: z.number().int().positive(),
	step: TaskStepSchema,
	itemId: z.string().min(1).optional(),
	capturedAt: z.string().optional(),
});
export type TaskStepSnapshot = z.infer<typeof TaskStepSnapshotSchema>;

export const AppToolPayloadSchema = z.object({
	mode: AppViewModeSchema,
	sessionId: SessionIdSchema.nullable(),
	activeTab: WorkspaceTabSchema,
	activeItemId: z.string().optional(),
	activeStepIndex: z.number().int().nonnegative().optional(),
	activeTaskItemId: z.string().optional(),
	stepSnapshot: TaskStepSnapshotSchema.optional(),
	revision: z.string().optional(),
	settings: UiSettingsSchema.optional(),
	session: SessionDataSchema.nullable(),
	sessions: z.array(SessionSummarySchema).optional(),
});
export type AppToolPayload = z.infer<typeof AppToolPayloadSchema>;
