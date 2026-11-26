import { z } from "zod";

export const SessionIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9._-]{1,80}$/, "sessionId must match [a-zA-Z0-9._-]{1,80}");

export const GroupIdSchema = z
	.string()
	.regex(/^[a-zA-Z0-9._-]{1,80}$/, "groupId must match [a-zA-Z0-9._-]{1,80}");

export const TaskIdSchema = z.number().int().positive();

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
	id: z.number().int().positive().optional(),
	itemKey: z.string().min(1),
	text: z.string().min(1),
	status: TaskItemStatusSchema,
	createdAt: z.string().optional(),
	startedAt: z.string().optional(),
	completedAt: z.string().optional(),
	updatedAt: z.string().optional(),
});
export type TaskItem = z.infer<typeof TaskItemSchema>;

export const TaskStepSchema = z.object({
	id: z.number().int().positive().optional(),
	stepIndex: z.number().int().nonnegative().optional(),
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
	taskId: TaskIdSchema,
	sessionId: SessionIdSchema,
	slug: SlugSchema,
	title: z.string().min(1),
	status: TaskLifecycleStatusSchema,
	summary: z.string().min(1),
	steps: z.array(TaskStepSchema),
	planFile: z.string().optional(),
	reportFile: z.string().optional(),
	createdAt: z.string().min(1),
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
export type PlanComponentRow = z.infer<typeof PlanComponentRowSchema>;

export const PlanRiskRowSchema = z.object({
	risk: z.string().min(1),
	impact: z.string().min(1),
	mitigation: z.string().min(1),
});
export type PlanRiskRow = z.infer<typeof PlanRiskRowSchema>;

export const PlanFileEntrySchema = z.object({
	path: z.string().min(1),
	action: z.enum(["added", "modified", "deleted"]),
	reason: z.string().min(1),
});
export type PlanFileEntry = z.infer<typeof PlanFileEntrySchema>;

export const PlanScopeSchema = z.object({
	inScope: z.array(z.string().min(1)).min(1),
	outOfScope: z.array(z.string().min(1)).min(1),
});
export type PlanScope = z.infer<typeof PlanScopeSchema>;

export const PlanCalibrationSchema = z.object({
	cadence: z.string(),
	familiarity: z.string(),
	structureStance: z.string(),
});
export type PlanCalibration = z.infer<typeof PlanCalibrationSchema>;

export const PlanTestingSchema = z.object({
	validationCommands: z.array(z.string().min(1)).min(1),
	keyScenarios: z.array(z.string().min(1)).min(1),
	edgeCases: z.array(z.string().min(1)).optional(),
	testChanges: z.array(z.string().min(1)).min(1),
});
export type PlanTesting = z.infer<typeof PlanTestingSchema>;

/** Lenient hydration schema for serialized `plans.body_json` rows in SQLite. */
export const PlanBodyJsonSchema = z.object({
	expectedOutcomes: z.array(z.string()).default([]),
	scope: z
		.object({
			inScope: z.array(z.string()).default([]),
			outOfScope: z.array(z.string()).default([]),
		})
		.default({ inScope: [], outOfScope: [] }),
	openQuestions: z.array(z.string()).optional(),
	userStories: z.array(z.string()).optional(),
	functionalRequirements: z.array(z.string()).optional(),
	nonFunctionalRequirements: z.array(z.string()).optional(),
	currentImplementation: z.array(z.string()).default([]),
	keyDecisions: z.array(z.string()).default([]),
	proposedChanges: z.array(z.string()).default([]),
	dataModels: z.string().optional(),
	components: z.array(PlanComponentRowSchema).optional(),
	fileStructure: z.array(PlanFileEntrySchema).default([]),
	architectureDiagram: z.string().optional(),
	risks: z.array(PlanRiskRowSchema).optional(),
	alternatives: z.string().optional(),
	calibration: PlanCalibrationSchema.optional(),
	testing: z
		.object({
			validationCommands: z.array(z.string()).default([]),
			keyScenarios: z.array(z.string()).default([]),
			edgeCases: z.array(z.string()).optional(),
			testChanges: z.array(z.string()).default([]),
		})
		.default({
			validationCommands: [],
			keyScenarios: [],
			testChanges: [],
		}),
});

export const PlanRecordSchema = z.object({
	taskId: TaskIdSchema,
	sessionId: SessionIdSchema,
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
export type AuditVerificationRow = z.infer<typeof AuditVerificationRowSchema>;

/** Lenient hydration schema for serialized `reports.body_json` rows in SQLite. */
export const ReportBodyJsonSchema = z.object({
	actionsCompleted: z.array(z.string()).default([]),
	filesChanged: z.array(ReportFileChangeSchema).default([]),
	diffStat: z.string().optional(),
	planDeviations: z.array(z.string()).default([]),
	verification: z.array(ReportVerificationRowSchema).default([]),
	tryCommand: z.string().optional(),
	unverifiedLimitations: z.string().optional(),
	operationalNotes: z.array(z.string()).default([]),
	verificationMatrix: z.array(AuditVerificationRowSchema).default([]),
	findings: z.array(AuditFindingSchema).default([]),
	followUps: z.array(ReportFollowUpSchema).default([]),
});

export const ReportRecordSchema = z.object({
	taskId: TaskIdSchema,
	sessionId: SessionIdSchema,
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
	sessionId: SessionIdSchema,
	taskId: TaskIdSchema.optional(),
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
	taskId: TaskIdSchema.optional(),
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
	sessionId: SessionIdSchema,
	title: z.string().min(1),
	description: z.string().optional(),
	submitLabel: z.string().default("Submit Answers"),
	blockingMode: QuestionBlockingModeSchema.default("immediate"),
	taskId: TaskIdSchema.optional(),
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
	taskId?: number;
	stepNumber?: number;
}

/** Resolve effective blocking policy for a question, falling back to its parent question set. */
export function resolveQuestionPolicy(
	questionSet: Pick<QuestionSetRecord, "blockingMode" | "taskId" | "stepNumber">,
	question: Pick<QuestionItem, "blockingMode" | "taskId" | "stepNumber">,
): ResolvedQuestionPolicy {
	return {
		blockingMode: question.blockingMode ?? questionSet.blockingMode ?? "immediate",
		taskId: question.taskId ?? questionSet.taskId,
		stepNumber: question.stepNumber ?? questionSet.stepNumber,
	};
}

export const TimelineEntityTypeSchema = z.enum([
	"session",
	"session_group",
	"task",
	"task_step",
	"task_item",
	"plan",
	"report",
	"handoff",
	"question_set",
	"note",
]);
export type TimelineEntityType = z.infer<typeof TimelineEntityTypeSchema>;

export const TimelineLinkRoleSchema = z.enum(["subject", "parent", "related"]);
export type TimelineLinkRole = z.infer<typeof TimelineLinkRoleSchema>;

export const TimelineActorSchema = z.enum(["agent", "user", "system"]);
export type TimelineActor = z.infer<typeof TimelineActorSchema>;

export const TimelineLinkSchema = z.object({
	id: z.number().int().positive().optional(),
	entityType: TimelineEntityTypeSchema,
	entityId: z.string().min(1),
	role: TimelineLinkRoleSchema.default("subject"),
	label: z.string().optional(),
});
export type TimelineLink = z.infer<typeof TimelineLinkSchema>;

export const TimelineEventSchema = z.object({
	id: z.number().int().positive(),
	sessionId: SessionIdSchema.nullable(),
	groupId: GroupIdSchema.nullable(),
	eventType: z.string().min(1),
	actor: TimelineActorSchema,
	title: z.string().min(1),
	summary: z.string().optional(),
	metadata: z.record(z.string(), z.unknown()).optional(),
	links: z.array(TimelineLinkSchema).default([]),
	createdAt: z.string().min(1),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

export const ToolCallRecordSchema = z.object({
	id: z.string().min(1),
	sessionId: SessionIdSchema,
	toolName: z.string().min(1),
	timestamp: z.string().min(1),
	status: z.enum(["ok", "error"]),
	summary: z.string().min(1),
	argsSummary: z.string().optional(),
});
export type ToolCallRecord = z.infer<typeof ToolCallRecordSchema>;

export const SessionGroupSchema = z.object({
	id: GroupIdSchema,
	name: z.string().min(1),
	description: z.string().optional(),
	notes: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});
export type SessionGroup = z.infer<typeof SessionGroupSchema>;

export const SessionGroupSummarySchema = SessionGroupSchema.extend({
	sessionCount: z.number().int().nonnegative(),
	taskCount: z.number().int().nonnegative(),
	pendingQuestionCount: z.number().int().nonnegative(),
});
export type SessionGroupSummary = z.infer<typeof SessionGroupSummarySchema>;

export const SessionRecordSchema = z.object({
	sessionId: SessionIdSchema,
	groupId: GroupIdSchema.nullable(),
	title: z.string().optional(),
	rootDir: z.string().optional(),
	exportDir: z.string().optional(),
	createdAt: z.string().min(1),
	updatedAt: z.string().min(1),
});
export type SessionRecord = z.infer<typeof SessionRecordSchema>;

export const SessionSummarySchema = z.object({
	sessionId: SessionIdSchema,
	groupId: GroupIdSchema.nullable(),
	title: z.string().optional(),
	rootDir: z.string().optional(),
	updatedAt: z.string().min(1),
	taskCount: z.number().int().nonnegative(),
	pendingQuestionCount: z.number().int().nonnegative(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const DashboardTabSchema = z.enum([
	"tasks",
	"plans",
	"reports",
	"handoffs",
	"questions",
	"timeline",
	"calls",
]);
export type DashboardTab = z.infer<typeof DashboardTabSchema>;

export const DashboardScopeSchema = z.enum(["session", "group"]);
export type DashboardScope = z.infer<typeof DashboardScopeSchema>;

export const WidgetRouteSchema = z.enum([
	"task",
	"task-step",
	"plan",
	"report",
	"handoff",
	"questions",
]);
export type WidgetRoute = z.infer<typeof WidgetRouteSchema>;

export const WidgetDisplayModeSchema = z.enum(["minimized", "compact", "full"]);
export type WidgetDisplayMode = z.infer<typeof WidgetDisplayModeSchema>;

export const StepDisplayOverrideSchema = z.enum(["inherit", "minimized", "compact", "full"]);
export type StepDisplayOverride = z.infer<typeof StepDisplayOverrideSchema>;

export const UiSettingsSchema = z.object({
	displayType: WidgetDisplayModeSchema.default("minimized"),
	stepDisplayType: StepDisplayOverrideSchema.default("inherit"),
	updatedAt: z.string().optional(),
});
export type UiSettings = z.infer<typeof UiSettingsSchema>;

export const DEFAULT_UI_SETTINGS: UiSettings = {
	displayType: "minimized",
	stepDisplayType: "inherit",
};

/**
 * Resolve the effective widget display mode for an inline chat widget, applying
 * `stepDisplayType` overrides only when `widgetKind` is `"step"`.
 *
 * @param settings - Persistent UI display preferences.
 * @param widgetKind - Inline widget category (`"step"` honors `stepDisplayType`).
 * @returns Concrete layout mode (`"minimized"`, `"compact"`, or `"full"`).
 */
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
	taskId: TaskIdSchema,
	taskTitle: z.string().min(1),
	stepIndex: z.number().int().nonnegative(),
	totalSteps: z.number().int().positive(),
	step: TaskStepSchema,
	itemKey: z.string().min(1).optional(),
	capturedAt: z.string().optional(),
});
export type TaskStepSnapshot = z.infer<typeof TaskStepSnapshotSchema>;

export const DashboardPayloadSchema = z.object({
	kind: z.literal("dashboard"),
	scope: DashboardScopeSchema,
	sessionId: SessionIdSchema.nullable(),
	groupId: GroupIdSchema.nullable(),
	activeTab: DashboardTabSchema,
	activeItemId: z.string().optional(),
	revision: z.string(),
	settings: UiSettingsSchema,
	session: SessionRecordSchema.nullable(),
	group: SessionGroupSchema.nullable(),
	sessions: z.array(SessionSummarySchema),
	groups: z.array(SessionGroupSummarySchema),
	tasks: z.array(TaskRecordSchema),
	plans: z.array(PlanRecordSchema),
	reports: z.array(ReportRecordSchema),
	handoffs: z.array(HandoffRecordSchema),
	questionSets: z.array(QuestionSetRecordSchema),
	timeline: z.array(TimelineEventSchema),
	toolCalls: z.array(ToolCallRecordSchema),
});
export type DashboardPayload = z.infer<typeof DashboardPayloadSchema>;

export const WidgetPayloadSchema = z.object({
	kind: z.literal("widget"),
	widget: WidgetRouteSchema,
	sessionId: SessionIdSchema,
	rootDir: z.string().optional(),
	sessionTitle: z.string().optional(),
	settings: UiSettingsSchema,
	task: TaskRecordSchema.optional(),
	stepSnapshot: TaskStepSnapshotSchema.optional(),
	plan: PlanRecordSchema.optional(),
	report: ReportRecordSchema.optional(),
	handoff: HandoffRecordSchema.optional(),
	questionSet: QuestionSetRecordSchema.optional(),
	questionSets: z.array(QuestionSetRecordSchema).optional(),
});
export type WidgetPayload = z.infer<typeof WidgetPayloadSchema>;
