export interface SqlMigration {
	version: number;
	name: string;
	sql: string;
}

/**
 * Initial SQLite schema for new-worker:
 * - 1:N session_groups -> sessions
 * - Global integer AUTOINCREMENT tasks (id starting at 1) -> task_steps -> task_items
 * - 1:1 task plans & immutable reports, plus handoffs, question_sets -> questions
 * - Polymorphic timeline_events + timeline_links
 * - Tool calls audit log & singleton ui_settings
 */
export const MIGRATION_0001_INITIAL: SqlMigration = {
	version: 1,
	name: "initial_schema",
	sql: `
CREATE TABLE IF NOT EXISTS session_groups (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	description TEXT,
	notes TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
	id TEXT PRIMARY KEY,
	group_id TEXT REFERENCES session_groups(id) ON DELETE SET NULL,
	title TEXT,
	root_dir TEXT,
	export_dir TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_group_id ON sessions(group_id);
CREATE INDEX IF NOT EXISTS idx_sessions_root_dir ON sessions(root_dir);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at);

CREATE TABLE IF NOT EXISTS tasks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	slug TEXT NOT NULL,
	title TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('planned', 'in_progress', 'done', 'cancelled', 'superseded')),
	summary TEXT NOT NULL,
	plan_file TEXT,
	report_file TEXT,
	created_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT,
	updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

CREATE TABLE IF NOT EXISTS task_steps (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	step_index INTEGER NOT NULL,
	title TEXT NOT NULL,
	outcome TEXT NOT NULL,
	created_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT,
	updated_at TEXT NOT NULL,
	UNIQUE(task_id, step_index)
);

CREATE TABLE IF NOT EXISTS task_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	step_id INTEGER NOT NULL REFERENCES task_steps(id) ON DELETE CASCADE,
	task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
	item_key TEXT NOT NULL,
	item_index INTEGER NOT NULL,
	text TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'done')),
	created_at TEXT NOT NULL,
	started_at TEXT,
	completed_at TEXT,
	updated_at TEXT NOT NULL,
	UNIQUE(task_id, item_key)
);

CREATE INDEX IF NOT EXISTS idx_task_items_step_id ON task_items(step_id);

CREATE TABLE IF NOT EXISTS plans (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	task_id INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	slug TEXT NOT NULL,
	title TEXT NOT NULL,
	target_repo TEXT NOT NULL,
	target_branch TEXT NOT NULL,
	target_commit TEXT NOT NULL,
	follows TEXT,
	overview TEXT NOT NULL,
	language TEXT NOT NULL DEFAULT 'en',
	review_status TEXT,
	review_comment TEXT,
	generated_plan_path TEXT,
	approved_via TEXT,
	body_json TEXT NOT NULL,
	created_at TEXT NOT NULL,
	reviewed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_plans_session_id ON plans(session_id);

CREATE TABLE IF NOT EXISTS reports (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	task_id INTEGER NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	slug TEXT NOT NULL,
	title TEXT NOT NULL,
	mode TEXT NOT NULL CHECK (mode IN ('implementation', 'audit')),
	outcome TEXT NOT NULL,
	target_repo TEXT NOT NULL,
	target_branch TEXT NOT NULL,
	target_commit TEXT NOT NULL,
	plan_ref TEXT,
	summary TEXT NOT NULL,
	language TEXT NOT NULL DEFAULT 'en',
	body_json TEXT NOT NULL,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reports_session_id ON reports(session_id);

CREATE TABLE IF NOT EXISTS handoffs (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
	kind TEXT NOT NULL CHECK (kind IN ('plan_approval', 'mid_session_pause', 'completion', 'subagent_scout', 'custom')),
	title TEXT NOT NULL,
	summary TEXT NOT NULL,
	working_now TEXT,
	verify_command TEXT,
	entry_point TEXT,
	next_step TEXT,
	artifact_links_json TEXT NOT NULL DEFAULT '[]',
	structured_data_json TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_handoffs_session_created ON handoffs(session_id, created_at);

CREATE TABLE IF NOT EXISTS question_sets (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
	step_number INTEGER,
	title TEXT NOT NULL,
	description TEXT,
	submit_label TEXT NOT NULL DEFAULT 'Submit Answers',
	blocking_mode TEXT NOT NULL DEFAULT 'immediate' CHECK (blocking_mode IN ('immediate', 'before_step_finish', 'anytime')),
	sections_json TEXT NOT NULL DEFAULT '[]',
	status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'submitted')),
	created_at TEXT NOT NULL,
	submitted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_question_sets_session_status ON question_sets(session_id, status);

CREATE TABLE IF NOT EXISTS questions (
	pk INTEGER PRIMARY KEY AUTOINCREMENT,
	question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
	question_key TEXT NOT NULL,
	position INTEGER NOT NULL,
	section_id TEXT,
	prompt TEXT NOT NULL,
	hint TEXT,
	context_refs_json TEXT NOT NULL DEFAULT '[]',
	kind TEXT NOT NULL CHECK (kind IN ('single_select', 'multi_select', 'text', 'textarea', 'boolean')),
	required INTEGER NOT NULL DEFAULT 1,
	options_json TEXT,
	allow_other INTEGER NOT NULL DEFAULT 0,
	placeholder TEXT,
	default_value_json TEXT,
	blocking_mode TEXT CHECK (blocking_mode IN ('immediate', 'before_step_finish', 'anytime')),
	task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
	step_number INTEGER,
	answer_json TEXT,
	other_text TEXT,
	is_submitted INTEGER NOT NULL DEFAULT 0,
	answered_at TEXT,
	UNIQUE(question_set_id, question_key)
);

CREATE INDEX IF NOT EXISTS idx_questions_set_id ON questions(question_set_id);

CREATE TABLE IF NOT EXISTS tool_calls (
	id TEXT PRIMARY KEY,
	session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
	tool_name TEXT NOT NULL,
	status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
	summary TEXT NOT NULL,
	args_summary TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_session_created ON tool_calls(session_id, created_at);

CREATE TABLE IF NOT EXISTS timeline_events (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
	group_id TEXT REFERENCES session_groups(id) ON DELETE SET NULL,
	event_type TEXT NOT NULL,
	actor TEXT NOT NULL DEFAULT 'agent' CHECK (actor IN ('agent', 'user', 'system')),
	title TEXT NOT NULL,
	summary TEXT,
	metadata_json TEXT,
	created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_session_created ON timeline_events(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_events_group_created ON timeline_events(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_timeline_events_created ON timeline_events(created_at);

CREATE TABLE IF NOT EXISTS timeline_links (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	event_id INTEGER NOT NULL REFERENCES timeline_events(id) ON DELETE CASCADE,
	entity_type TEXT NOT NULL CHECK (entity_type IN ('session', 'session_group', 'task', 'task_step', 'task_item', 'plan', 'report', 'handoff', 'question_set', 'note')),
	entity_id TEXT NOT NULL,
	role TEXT NOT NULL DEFAULT 'subject' CHECK (role IN ('subject', 'parent', 'related')),
	label TEXT,
	UNIQUE(event_id, entity_type, entity_id, role)
);

CREATE INDEX IF NOT EXISTS idx_timeline_links_event_id ON timeline_links(event_id);
CREATE INDEX IF NOT EXISTS idx_timeline_links_entity ON timeline_links(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS ui_settings (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	display_type TEXT NOT NULL DEFAULT 'minimized' CHECK (display_type IN ('minimized', 'compact', 'full')),
	step_display_type TEXT NOT NULL DEFAULT 'inherit' CHECK (step_display_type IN ('inherit', 'minimized', 'compact', 'full')),
	updated_at TEXT NOT NULL
);
`,
};
