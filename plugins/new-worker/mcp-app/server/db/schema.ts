import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const schemaMigrations = sqliteTable("schema_migrations", {
	version: integer("version").primaryKey(),
	name: text("name").notNull(),
	checksum: text("checksum").notNull(),
	appliedAt: text("applied_at").notNull(),
});

export const sessionGroups = sqliteTable("session_groups", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	description: text("description"),
	notes: text("notes"),
	createdAt: text("created_at").notNull(),
	updatedAt: text("updated_at").notNull(),
});

export const sessions = sqliteTable(
	"sessions",
	{
		id: text("id").primaryKey(),
		groupId: text("group_id").references(() => sessionGroups.id, { onDelete: "set null" }),
		title: text("title"),
		rootDir: text("root_dir"),
		exportDir: text("export_dir"),
		createdAt: text("created_at").notNull(),
		updatedAt: text("updated_at").notNull(),
	},
	t => [
		index("idx_sessions_group_id").on(t.groupId),
		index("idx_sessions_root_dir").on(t.rootDir),
		index("idx_sessions_updated_at").on(t.updatedAt),
	],
);

export const tasks = sqliteTable(
	"tasks",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		status: text("status", {
			enum: ["planned", "in_progress", "done", "cancelled", "superseded"],
		}).notNull(),
		summary: text("summary").notNull(),
		planFile: text("plan_file"),
		reportFile: text("report_file"),
		createdAt: text("created_at").notNull(),
		startedAt: text("started_at"),
		completedAt: text("completed_at"),
		updatedAt: text("updated_at").notNull(),
	},
	t => [
		index("idx_tasks_session_id").on(t.sessionId),
		index("idx_tasks_status").on(t.status),
	],
);

export const taskSteps = sqliteTable(
	"task_steps",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		stepIndex: integer("step_index").notNull(),
		title: text("title").notNull(),
		outcome: text("outcome").notNull(),
		createdAt: text("created_at").notNull(),
		startedAt: text("started_at"),
		completedAt: text("completed_at"),
		updatedAt: text("updated_at").notNull(),
	},
	t => [
		uniqueIndex("uq_task_steps_task_step").on(t.taskId, t.stepIndex),
	],
);

export const taskItems = sqliteTable(
	"task_items",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		stepId: integer("step_id")
			.notNull()
			.references(() => taskSteps.id, { onDelete: "cascade" }),
		taskId: integer("task_id")
			.notNull()
			.references(() => tasks.id, { onDelete: "cascade" }),
		itemKey: text("item_key").notNull(),
		itemIndex: integer("item_index").notNull(),
		text: text("text").notNull(),
		status: text("status", { enum: ["pending", "in_progress", "done"] }).notNull(),
		createdAt: text("created_at").notNull(),
		startedAt: text("started_at"),
		completedAt: text("completed_at"),
		updatedAt: text("updated_at").notNull(),
	},
	t => [
		uniqueIndex("uq_task_items_task_key").on(t.taskId, t.itemKey),
		index("idx_task_items_step_id").on(t.stepId),
	],
);

export const plans = sqliteTable(
	"plans",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id")
			.notNull()
			.unique()
			.references(() => tasks.id, { onDelete: "cascade" }),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		targetRepo: text("target_repo").notNull(),
		targetBranch: text("target_branch").notNull(),
		targetCommit: text("target_commit").notNull(),
		follows: text("follows"),
		overview: text("overview").notNull(),
		language: text("language", { enum: ["en", "ko"] }).notNull().default("en"),
		reviewStatus: text("review_status", {
			enum: ["draft", "pending_review", "approved", "changes_requested"],
		}),
		reviewComment: text("review_comment"),
		generatedPlanPath: text("generated_plan_path"),
		approvedVia: text("approved_via", { enum: ["ui", "harness_artifact", "chat"] }),
		bodyJson: text("body_json").notNull(),
		createdAt: text("created_at").notNull(),
		reviewedAt: text("reviewed_at"),
	},
	t => [
		index("idx_plans_session_id").on(t.sessionId),
	],
);

export const reports = sqliteTable(
	"reports",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		taskId: integer("task_id")
			.notNull()
			.unique()
			.references(() => tasks.id, { onDelete: "cascade" }),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		slug: text("slug").notNull(),
		title: text("title").notNull(),
		mode: text("mode", { enum: ["implementation", "audit"] }).notNull(),
		outcome: text("outcome").notNull(),
		targetRepo: text("target_repo").notNull(),
		targetBranch: text("target_branch").notNull(),
		targetCommit: text("target_commit").notNull(),
		planRef: text("plan_ref"),
		summary: text("summary").notNull(),
		language: text("language", { enum: ["en", "ko"] }).notNull().default("en"),
		bodyJson: text("body_json").notNull(),
		createdAt: text("created_at").notNull(),
	},
	t => [
		index("idx_reports_session_id").on(t.sessionId),
	],
);

export const handoffs = sqliteTable(
	"handoffs",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
		kind: text("kind", {
			enum: ["plan_approval", "mid_session_pause", "completion", "subagent_scout", "custom"],
		}).notNull(),
		title: text("title").notNull(),
		summary: text("summary").notNull(),
		workingNow: text("working_now"),
		verifyCommand: text("verify_command"),
		entryPoint: text("entry_point"),
		nextStep: text("next_step"),
		artifactLinksJson: text("artifact_links_json").notNull().default("[]"),
		structuredDataJson: text("structured_data_json"),
		createdAt: text("created_at").notNull(),
	},
	t => [
		index("idx_handoffs_session_created").on(t.sessionId, t.createdAt),
	],
);

export const questionSets = sqliteTable(
	"question_sets",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
		stepNumber: integer("step_number"),
		title: text("title").notNull(),
		description: text("description"),
		submitLabel: text("submit_label").notNull().default("Submit Answers"),
		blockingMode: text("blocking_mode", {
			enum: ["immediate", "before_step_finish", "anytime"],
		})
			.notNull()
			.default("immediate"),
		sectionsJson: text("sections_json").notNull().default("[]"),
		status: text("status", { enum: ["pending", "partial", "submitted"] })
			.notNull()
			.default("pending"),
		createdAt: text("created_at").notNull(),
		submittedAt: text("submitted_at"),
	},
	t => [
		index("idx_question_sets_session_status").on(t.sessionId, t.status),
	],
);

export const questions = sqliteTable(
	"questions",
	{
		pk: integer("pk").primaryKey({ autoIncrement: true }),
		questionSetId: text("question_set_id")
			.notNull()
			.references(() => questionSets.id, { onDelete: "cascade" }),
		questionKey: text("question_key").notNull(),
		position: integer("position").notNull(),
		sectionId: text("section_id"),
		prompt: text("prompt").notNull(),
		hint: text("hint"),
		contextRefsJson: text("context_refs_json").notNull().default("[]"),
		kind: text("kind", {
			enum: ["single_select", "multi_select", "text", "textarea", "boolean"],
		}).notNull(),
		required: integer("required", { mode: "boolean" }).notNull().default(true),
		optionsJson: text("options_json"),
		allowOther: integer("allow_other", { mode: "boolean" }).notNull().default(false),
		placeholder: text("placeholder"),
		defaultValueJson: text("default_value_json"),
		blockingMode: text("blocking_mode", {
			enum: ["immediate", "before_step_finish", "anytime"],
		}),
		taskId: integer("task_id").references(() => tasks.id, { onDelete: "set null" }),
		stepNumber: integer("step_number"),
		answerJson: text("answer_json"),
		otherText: text("other_text"),
		isSubmitted: integer("is_submitted", { mode: "boolean" }).notNull().default(false),
		answeredAt: text("answered_at"),
	},
	t => [
		uniqueIndex("uq_questions_set_key").on(t.questionSetId, t.questionKey),
		index("idx_questions_set_id").on(t.questionSetId),
	],
);

export const toolCalls = sqliteTable(
	"tool_calls",
	{
		id: text("id").primaryKey(),
		sessionId: text("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		toolName: text("tool_name").notNull(),
		status: text("status", { enum: ["ok", "error"] }).notNull(),
		summary: text("summary").notNull(),
		argsSummary: text("args_summary"),
		createdAt: text("created_at").notNull(),
	},
	t => [
		index("idx_tool_calls_session_created").on(t.sessionId, t.createdAt),
	],
);

export const timelineEvents = sqliteTable(
	"timeline_events",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		sessionId: text("session_id").references(() => sessions.id, { onDelete: "cascade" }),
		groupId: text("group_id").references(() => sessionGroups.id, { onDelete: "set null" }),
		eventType: text("event_type").notNull(),
		actor: text("actor", { enum: ["agent", "user", "system"] })
			.notNull()
			.default("agent"),
		title: text("title").notNull(),
		summary: text("summary"),
		metadataJson: text("metadata_json"),
		createdAt: text("created_at").notNull(),
	},
	t => [
		index("idx_timeline_events_session_created").on(t.sessionId, t.createdAt),
		index("idx_timeline_events_group_created").on(t.groupId, t.createdAt),
		index("idx_timeline_events_created").on(t.createdAt),
	],
);

export const timelineLinks = sqliteTable(
	"timeline_links",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		eventId: integer("event_id")
			.notNull()
			.references(() => timelineEvents.id, { onDelete: "cascade" }),
		entityType: text("entity_type", {
			enum: [
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
			],
		}).notNull(),
		entityId: text("entity_id").notNull(),
		role: text("role", { enum: ["subject", "parent", "related"] })
			.notNull()
			.default("subject"),
		label: text("label"),
	},
	t => [
		uniqueIndex("uq_timeline_links_unique").on(t.eventId, t.entityType, t.entityId, t.role),
		index("idx_timeline_links_event_id").on(t.eventId),
		index("idx_timeline_links_entity").on(t.entityType, t.entityId),
	],
);

export const uiSettings = sqliteTable(
	"ui_settings",
	{
		id: integer("id").primaryKey(),
		displayType: text("display_type", { enum: ["minimized", "compact", "full"] })
			.notNull()
			.default("minimized"),
		stepDisplayType: text("step_display_type", {
			enum: ["inherit", "minimized", "compact", "full"],
		})
			.notNull()
			.default("inherit"),
		updatedAt: text("updated_at").notNull(),
	},
	t => [
		check("chk_ui_settings_singleton", sql`${t.id} = 1`),
	],
);
