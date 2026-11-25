import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { allocateNextTaskNumber, formatBlockingModeLabel, formatTaskFilename } from "../src/shared/format.js";
import { renderPlanMarkdown, renderReportMarkdown, renderTasksMarkdown } from "../src/shared/markdown.js";
import { migrateSessionData, migrateSessionIndex, migrateUiSettings } from "../src/shared/migrations.js";
import { type AppToolPayload, CURRENT_INDEX_SCHEMA_VERSION, CURRENT_SESSION_SCHEMA_VERSION, CURRENT_SETTINGS_SCHEMA_VERSION, DEFAULT_UI_SETTINGS, type HandoffRecord, type PlanRecord, PlanRecordSchema, type QuestionAnswerValue, type QuestionItem, type QuestionSetRecord, QuestionSetRecordSchema, type ReportRecord, ReportRecordSchema, type ResolvedQuestionPolicy, resolveQuestionPolicy, type SessionData, SessionDataSchema, SessionIdSchema, type SessionSummary, type TaskItemStatus, type TaskRecord, TaskRecordSchema, type TaskStepSnapshot, type UiSettings, UiSettingsSchema } from "../src/shared/schema.js";

const MAX_TOOL_CALLS = 200;

export type QuestionSubmitScope = "all" | "immediate" | "before_step_finish" | "answered";

export interface SessionMetaInput {
	workspacePath?: string;
	exportDir?: string;
}

export interface BuildPayloadOptions {
	activeItemId?: string;
	activeStepIndex?: number;
	activeTaskItemId?: string;
	stepSnapshot?: TaskStepSnapshot;
	revision?: string;
	includeSessions?: boolean;
}

export interface SubmitQuestionOptions {
	scope?: QuestionSubmitScope;
	questionIds?: string[];
}

export interface UnresolvedQuestionEntry {
	questionSet: QuestionSetRecord;
	question: QuestionItem;
	policy: ResolvedQuestionPolicy;
}

export interface SessionStore {
	getDataDir(): string;

	listSessions(): Promise<SessionSummary[]>;

	getSession(sessionId: string): Promise<SessionData | null>;

	getLatestSession(): Promise<SessionData | null>;

	getSettings(): Promise<UiSettings>;

	updateSettings(
		patch: Partial<Pick<UiSettings, "displayType" | "stepDisplayType">>,
	): Promise<UiSettings>;

	getRevision(sessionId?: string): Promise<{
		session: SessionData | null;
		sessions: SessionSummary[];
		settings: UiSettings;
		revision: string;
	}>;

	clearToolCalls(sessionId: string): Promise<SessionData>;

	ensureSession(sessionId: string, meta?: SessionMetaInput): Promise<SessionData>;

	upsertTask(
		sessionId: string,
		taskInput: Omit<TaskRecord, "taskNumber" | "updatedAt"> & { taskNumber?: string },
		meta?: SessionMetaInput,
	): Promise<{ session: SessionData; task: TaskRecord }>;

	updateTaskItem(
		sessionId: string,
		taskNumber: string,
		itemId: string,
		status: TaskItemStatus,
		taskStatus?: TaskRecord["status"],
	): Promise<{ session: SessionData; task: TaskRecord; updatedStepIndex: number }>;

	writePlan(
		sessionId: string,
		planInput: Omit<PlanRecord, "taskNumber" | "createdAt"> & {
			taskNumber?: string;
		},
		meta?: SessionMetaInput,
	): Promise<{
		session: SessionData;
		plan: PlanRecord;
		planFilePath: string;
		planMarkdown: string;
	}>;

	writeReport(
		sessionId: string,
		reportInput: Omit<ReportRecord, "taskNumber" | "createdAt"> & {
			taskNumber?: string;
		},
		meta?: SessionMetaInput,
	): Promise<{ session: SessionData; report: ReportRecord }>;

	recordHandoff(
		sessionId: string,
		handoffInput: Omit<HandoffRecord, "id" | "createdAt"> & { id?: string },
		meta?: SessionMetaInput,
	): Promise<{ session: SessionData; handoff: HandoffRecord }>;

	createQuestionSet(
		sessionId: string,
		questionInput: Omit<
			QuestionSetRecord,
			"id" | "createdAt" | "status" | "answers" | "otherTexts" | "answeredQuestionIds"
		> & { id?: string },
		meta?: SessionMetaInput,
	): Promise<{ session: SessionData; questionSet: QuestionSetRecord }>;

	saveQuestionDraft(
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
	): Promise<{ session: SessionData; questionSet: QuestionSetRecord }>;

	submitQuestionAnswers(
		sessionId: string,
		questionSetId: string,
		answers: Record<string, QuestionAnswerValue>,
		otherTexts: Record<string, string>,
		options?: SubmitQuestionOptions,
	): Promise<{
		session: SessionData;
		questionSet: QuestionSetRecord;
		submittedQuestionIds: string[];
	}>;

	recordToolCall(
		sessionId: string,
		toolName: string,
		status: "ok" | "error",
		summary: string,
		argsSummary?: string,
	): Promise<void>;

	buildPayload(
		session: SessionData | null,
		mode: AppToolPayload["mode"],
		activeTab: AppToolPayload["activeTab"],
		options?: BuildPayloadOptions,
	): Promise<AppToolPayload>;
}

async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
	const dir = path.dirname(targetPath);
	await fs.mkdir(dir, { recursive: true });
	const tmpName = `.${path.basename(targetPath)}.${process.pid}.${crypto.randomUUID()}.tmp`;
	const tmpPath = path.join(dir, tmpName);
	await fs.writeFile(tmpPath, content, "utf8");
	await fs.rename(tmpPath, targetPath);
}

function validateExportDir(exportDir: string): string {
	if (!exportDir || exportDir.includes("\0") || !path.isAbsolute(exportDir)) {
		throw new Error("exportDir must be an absolute path without null bytes.");
	}
	return path.resolve(exportDir);
}

function isEnoent(err: unknown): boolean {
	return (err as NodeJS.ErrnoException)?.code === "ENOENT";
}

function summarizeSession(session: SessionData): SessionSummary {
	return {
		sessionId: session.sessionId,
		workspacePath: session.workspacePath,
		updatedAt: session.updatedAt,
		taskCount: session.tasks.length,
		pendingQuestionCount: session.questionSets.filter(q => q.status !== "submitted").length,
	};
}

function normalizeSingleInProgress(task: TaskRecord, activeItemId?: string): TaskRecord {
	let seenActive = false;
	return {
		...task,
		steps: task.steps.map(step => ({
			...step,
			items: step.items.map((item) => {
				if (item.status !== "in_progress") {
					return item;
				}
				if (activeItemId && item.id !== activeItemId) {
					return { ...item, status: "pending" as const };
				}
				if (!activeItemId && seenActive) {
					return { ...item, status: "pending" as const };
				}
				seenActive = true;
				return item;
			}),
		})),
	};
}

function isNonEmptyAnswer(
	value: QuestionAnswerValue | undefined,
	otherText: string | undefined,
): boolean {
	if (value === undefined) {
		return false;
	}
	if (typeof value === "boolean") {
		return true;
	}
	if (Array.isArray(value)) {
		if (value.length === 0) {
			return false;
		}
		if (value.includes("__other__") && (!otherText || otherText.trim().length === 0)) {
			return false;
		}
		return true;
	}
	if (value === "__other__") {
		return Boolean(otherText && otherText.trim().length > 0);
	}
	return value.trim().length > 0;
}

export function getUnresolvedQuestions(session: SessionData): UnresolvedQuestionEntry[] {
	const entries: UnresolvedQuestionEntry[] = [];
	for (const qs of session.questionSets) {
		if (qs.status === "submitted") {
			continue;
		}
		const answered = new Set(qs.answeredQuestionIds);
		for (const q of qs.questions) {
			if (!answered.has(q.id)) {
				entries.push({
					questionSet: qs,
					question: q,
					policy: resolveQuestionPolicy(qs, q),
				});
			}
		}
	}
	return entries;
}

function computeRevision(
	session: SessionData | null,
	sessions: SessionSummary[],
	settings: UiSettings,
): string {
	const indexPart = sessions
		.map(s => `${s.sessionId}:${s.updatedAt}:${s.taskCount}:${s.pendingQuestionCount}`)
		.join(",");
	return `${session?.sessionId ?? "none"}|${session?.updatedAt ?? "0"}|${settings.displayType}:${settings.stepDisplayType}|${indexPart}`;
}

export function applyTaskTimestamps(
	nextTask: TaskRecord,
	prevTask: TaskRecord | undefined,
	nowIso: string,
): TaskRecord {
	const steps = nextTask.steps.map((step, stepIdx) => {
		const prevStep = prevTask?.steps[stepIdx] ?? prevTask?.steps.find(s => s.title === step.title);
		const items = step.items.map((item) => {
			const prevItem = prevStep?.items.find(i => i.id === item.id);
			const createdAt = prevItem?.createdAt ?? item.createdAt ?? nowIso;
			const startedAt
				= prevItem?.startedAt
					?? item.startedAt
					?? (item.status === "in_progress" || item.status === "done" ? nowIso : undefined);
			const completedAt
				= item.status === "done"
					? prevItem?.status === "done" && prevItem.completedAt
						? prevItem.completedAt
						: item.completedAt ?? nowIso
					: undefined;
			const itemChanged = !prevItem || prevItem.status !== item.status || prevItem.text !== item.text;
			const updatedAt = itemChanged ? nowIso : (prevItem.updatedAt ?? createdAt);
			return {
				...item,
				createdAt,
				startedAt,
				completedAt,
				updatedAt,
			};
		});

		const stepCreatedAt = prevStep?.createdAt ?? step.createdAt ?? nowIso;
		const stepHasActivity = items.some(i => i.status === "in_progress" || i.status === "done");
		const stepStartedAt
			= prevStep?.startedAt
				?? step.startedAt
				?? (stepHasActivity ? nowIso : undefined);
		const stepAllDone = items.every(i => i.status === "done");
		const prevStepAllDone = Boolean(prevStep && prevStep.items.every(i => i.status === "done"));
		const stepCompletedAt
			= stepAllDone
				? prevStepAllDone && prevStep?.completedAt
					? prevStep.completedAt
					: step.completedAt ?? nowIso
				: undefined;
		const stepChanged
			= !prevStep
				|| prevStep.title !== step.title
				|| prevStep.outcome !== step.outcome
				|| prevStep.items.length !== items.length
				|| items.some((it, i) => it.updatedAt === nowIso || prevStep.items[i]?.status !== it.status);
		const stepUpdatedAt = stepChanged ? nowIso : (prevStep.updatedAt ?? stepCreatedAt);

		return {
			...step,
			items,
			createdAt: stepCreatedAt,
			startedAt: stepStartedAt,
			completedAt: stepCompletedAt,
			updatedAt: stepUpdatedAt,
		};
	});

	const createdAt = prevTask?.createdAt ?? nextTask.createdAt ?? nowIso;
	const hasAnyActivity = steps.some(s =>
		s.items.some(i => i.status === "in_progress" || i.status === "done"));
	const startedAt
		= prevTask?.startedAt
			?? nextTask.startedAt
			?? (nextTask.status === "in_progress" || nextTask.status === "done" || hasAnyActivity
				? nowIso
				: undefined);
	const isTerminal
		= nextTask.status === "done"
			|| nextTask.status === "cancelled"
			|| nextTask.status === "superseded";
	const completedAt = isTerminal
		? prevTask?.status === nextTask.status && prevTask.completedAt
			? prevTask.completedAt
			: nextTask.completedAt ?? nowIso
		: undefined;

	return {
		...nextTask,
		steps,
		createdAt,
		startedAt,
		completedAt,
	};
}

function assertNoImmediateQuestionBlocker(session: SessionData, taskNumber?: string): void {
	const blockers = getUnresolvedQuestions(session).filter(
		entry =>
			entry.policy.blockingMode === "immediate"
			&& (!entry.policy.taskNumber || !taskNumber || entry.policy.taskNumber === taskNumber),
	);
	if (blockers.length > 0) {
		const summary = blockers
			.map(b => `"${b.question.id}" in "${b.questionSet.title}" (${b.questionSet.id})`)
			.join(", ");
		throw new Error(
			`Blocked by immediate question(s): ${summary}. Answer and submit them before progressing.`,
		);
	}
}

function assertStepQuestionsSatisfied(
	session: SessionData,
	taskNumber: string,
	nextTask: TaskRecord | undefined,
	opts?: { finishingReport?: boolean },
): void {
	const stepBlockers = getUnresolvedQuestions(session).filter(
		entry =>
			entry.policy.blockingMode === "before_step_finish"
			&& entry.policy.taskNumber === taskNumber,
	);
	if (stepBlockers.length === 0) {
		return;
	}

	for (const blocker of stepBlockers) {
		const stepNum = blocker.policy.stepNumber ?? 1;
		const label = formatBlockingModeLabel("before_step_finish", taskNumber, stepNum);
		if (opts?.finishingReport || nextTask?.status === "done") {
			throw new Error(
				`Blocked by deferred question "${blocker.question.id}" (${label}) in "${blocker.questionSet.title}". Answer it before completing Task ${taskNumber}.`,
			);
		}
		if (!nextTask) {
			continue;
		}
		const boundStep = nextTask.steps[stepNum - 1];
		if (boundStep && boundStep.items.every(item => item.status === "done")) {
			throw new Error(
				`Cannot finish Step ${stepNum} of Task ${taskNumber} until deferred question "${blocker.question.id}" (${blocker.question.prompt}) in "${blocker.questionSet.title}" is answered.`,
			);
		}
		const laterStepActive = nextTask.steps.some(
			(step, idx) =>
				idx > stepNum - 1
				&& step.items.some(item => item.status === "in_progress" || item.status === "done"),
		);
		if (laterStepActive) {
			throw new Error(
				`Cannot advance past Step ${stepNum} of Task ${taskNumber} until deferred question "${blocker.question.id}" (${blocker.question.prompt}) in "${blocker.questionSet.title}" is answered.`,
			);
		}
	}
}

export function createSessionStore(rawDataDir: string): SessionStore {
	const dataDir = path.resolve(rawDataDir);
	const sessionsDir = path.join(dataDir, "sessions");
	const exportsDir = path.join(dataDir, "exports");
	const indexPath = path.join(dataDir, "index.json");
	const settingsPath = path.join(dataDir, "settings.json");

	async function getSettings(): Promise<UiSettings> {
		try {
			const raw = await fs.readFile(settingsPath, "utf8");
			return migrateUiSettings(JSON.parse(raw));
		}
		catch (err) {
			if (isEnoent(err)) {
				return { ...DEFAULT_UI_SETTINGS };
			}
			throw err;
		}
	}

	async function updateSettings(
		patch: Partial<Pick<UiSettings, "displayType" | "stepDisplayType">>,
	): Promise<UiSettings> {
		const current = await getSettings();
		const next = UiSettingsSchema.parse({
			...current,
			...patch,
			schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
		});
		await writeFileAtomic(settingsPath, JSON.stringify(next, null, 2));
		return next;
	}

	function resolveSessionPath(rawSessionId: string): string {
		const sessionId = SessionIdSchema.parse(rawSessionId);
		const resolved = path.resolve(sessionsDir, `${sessionId}.json`);
		if (!resolved.startsWith(`${sessionsDir}${path.sep}`)) {
			throw new Error("Invalid sessionId path resolution.");
		}
		return resolved;
	}

	async function readIndex(): Promise<SessionSummary[]> {
		try {
			const raw = await fs.readFile(indexPath, "utf8");
			return migrateSessionIndex(JSON.parse(raw));
		}
		catch (err) {
			if (isEnoent(err)) {
				return rebuildIndex();
			}
			throw err;
		}
	}

	async function rebuildIndex(): Promise<SessionSummary[]> {
		let entries;
		try {
			entries = await fs.readdir(sessionsDir, { withFileTypes: true });
		}
		catch (err) {
			if (isEnoent(err)) {
				return [];
			}
			throw err;
		}

		const summaries: SessionSummary[] = [];
		for (const entry of entries) {
			if (!entry.isFile() || !entry.name.endsWith(".json")) {
				continue;
			}
			try {
				const raw = await fs.readFile(path.join(sessionsDir, entry.name), "utf8");
				const parsed = migrateSessionData(JSON.parse(raw));
				summaries.push(summarizeSession(parsed));
			}
			catch {
				// Skip malformed session files during index rebuild.
			}
		}

		if (summaries.length === 0) {
			return [];
		}

		summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		await writeFileAtomic(
			indexPath,
			JSON.stringify(
				{ schemaVersion: CURRENT_INDEX_SCHEMA_VERSION, sessions: summaries },
				null,
				2,
			),
		);
		return summaries;
	}

	async function saveSession(session: SessionData, exportMarkdown = true): Promise<SessionData> {
		const validated = SessionDataSchema.parse({
			...session,
			schemaVersion: CURRENT_SESSION_SCHEMA_VERSION,
			updatedAt: new Date().toISOString(),
		});
		const sessionPath = resolveSessionPath(validated.sessionId);
		await writeFileAtomic(sessionPath, JSON.stringify(validated, null, 2));

		const currentIndex = await readIndex();
		const nextSummary = summarizeSession(validated);
		const filtered = currentIndex.filter(item => item.sessionId !== validated.sessionId);
		filtered.unshift(nextSummary);
		filtered.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		await writeFileAtomic(
			indexPath,
			JSON.stringify(
				{ schemaVersion: CURRENT_INDEX_SCHEMA_VERSION, sessions: filtered },
				null,
				2,
			),
		);

		if (exportMarkdown && validated.exportDir) {
			await exportMarkdownFiles(validated);
		}
		return validated;
	}

	async function exportMarkdownFiles(session: SessionData): Promise<void> {
		if (!session.exportDir) {
			return;
		}
		const targetDir = validateExportDir(session.exportDir);
		await fs.mkdir(targetDir, { recursive: true });
		await writeFileAtomic(path.join(targetDir, "tasks.md"), renderTasksMarkdown(session));
		for (const plan of session.plans) {
			const filename = formatTaskFilename(plan.taskNumber, plan.slug, "plan");
			await writeFileAtomic(path.join(targetDir, filename), renderPlanMarkdown(plan));
		}
		for (const report of session.reports) {
			const filename = formatTaskFilename(report.taskNumber, report.slug, "report");
			await writeFileAtomic(
				path.join(targetDir, filename),
				renderReportMarkdown(report, undefined, session.workspacePath),
			);
		}
	}

	async function getSession(sessionId: string): Promise<SessionData | null> {
		const sessionPath = resolveSessionPath(sessionId);
		try {
			const raw = await fs.readFile(sessionPath, "utf8");
			return migrateSessionData(JSON.parse(raw));
		}
		catch (err) {
			if (isEnoent(err)) {
				return null;
			}
			throw err;
		}
	}

	async function ensureSession(
		sessionId: string,
		meta?: SessionMetaInput,
	): Promise<SessionData> {
		const existing = await getSession(sessionId);
		const validExportDir = meta?.exportDir ? validateExportDir(meta.exportDir) : undefined;
		if (existing) {
			const needsMetaUpdate
				= (meta?.workspacePath && meta.workspacePath !== existing.workspacePath)
					|| (validExportDir && validExportDir !== existing.exportDir);
			if (!needsMetaUpdate) {
				return existing;
			}
			return saveSession(
				{
					...existing,
					workspacePath: meta?.workspacePath ?? existing.workspacePath,
					exportDir: validExportDir ?? existing.exportDir,
				},
				true,
			);
		}

		const now = new Date().toISOString();
		const created: SessionData = {
			schemaVersion: CURRENT_SESSION_SCHEMA_VERSION,
			sessionId: SessionIdSchema.parse(sessionId),
			workspacePath: meta?.workspacePath,
			exportDir: validExportDir,
			createdAt: now,
			updatedAt: now,
			tasks: [],
			plans: [],
			reports: [],
			handoffs: [],
			questionSets: [],
			toolCalls: [],
		};
		return saveSession(created, Boolean(validExportDir));
	}

	function allocateTaskNumberForSession(session: SessionData): string {
		const existingNumbers = [
			...session.tasks.map(t => t.taskNumber),
			...session.plans.map(p => p.taskNumber),
			...session.reports.map(r => r.taskNumber),
		];
		return allocateNextTaskNumber(existingNumbers);
	}

	return {
		getDataDir: () => dataDir,

		listSessions: () => readIndex(),

		getSession,

		async getLatestSession(): Promise<SessionData | null> {
			const summaries = await readIndex();
			const first = summaries[0];
			if (!first) {
				return null;
			}
			return getSession(first.sessionId);
		},

		getSettings,

		updateSettings,

		async getRevision(sessionId) {
			const [sessions, settings] = await Promise.all([readIndex(), getSettings()]);
			let session: SessionData | null = null;
			if (sessionId) {
				session = await getSession(sessionId);
			}
			else if (sessions[0]) {
				session = await getSession(sessions[0].sessionId);
			}
			return {
				session,
				sessions,
				settings,
				revision: computeRevision(session, sessions, settings),
			};
		},

		async clearToolCalls(sessionId) {
			const session = await getSession(sessionId);
			if (!session) {
				throw new Error(`Session "${sessionId}" does not exist.`);
			}
			return saveSession({ ...session, toolCalls: [] }, false);
		},

		ensureSession,

		async upsertTask(sessionId, taskInput, meta) {
			const session = await ensureSession(sessionId, meta);
			const taskNumber = taskInput.taskNumber ?? allocateTaskNumberForSession(session);
			const existingTask = session.tasks.find(t => t.taskNumber === taskNumber);
			const matchingPlan = session.plans.find(p => p.taskNumber === taskNumber);
			const matchingReport = session.reports.find(r => r.taskNumber === taskNumber);
			const nowIso = new Date().toISOString();
			const parsedTask = normalizeSingleInProgress(
				TaskRecordSchema.parse({
					...taskInput,
					taskNumber,
					planFile:
						taskInput.planFile
						?? (matchingPlan
							? formatTaskFilename(matchingPlan.taskNumber, matchingPlan.slug, "plan")
							: undefined),
					reportFile:
						taskInput.reportFile
						?? (matchingReport
							? formatTaskFilename(matchingReport.taskNumber, matchingReport.slug, "report")
							: undefined),
					updatedAt: nowIso,
				}),
			);
			const nextTask = applyTaskTimestamps(parsedTask, existingTask, nowIso);

			const isProgressing
				= nextTask.status === "in_progress"
					|| nextTask.status === "done"
					|| nextTask.steps.some(step => step.items.some(item => item.status !== "pending"));

			if (isProgressing) {
				assertNoImmediateQuestionBlocker(session, taskNumber);
				assertStepQuestionsSatisfied(session, taskNumber, nextTask);
			}

			const tasks = session.tasks.filter(t => t.taskNumber !== taskNumber);
			tasks.push(nextTask);
			tasks.sort((a, b) => a.taskNumber.localeCompare(b.taskNumber));

			const saved = await saveSession({ ...session, tasks });
			return { session: saved, task: nextTask };
		},

		async updateTaskItem(sessionId, taskNumber, itemId, status, taskStatus) {
			const session = await getSession(sessionId);
			if (!session) {
				throw new Error(`Session "${sessionId}" does not exist.`);
			}
			const existing = session.tasks.find(t => t.taskNumber === taskNumber);
			if (!existing) {
				throw new Error(`Task "${taskNumber}" was not found in session "${sessionId}".`);
			}

			let foundItem = false;
			let updatedStepIndex = -1;
			const updatedSteps = existing.steps.map((step, stepIdx) => ({
				...step,
				items: step.items.map((item) => {
					if (item.id === itemId) {
						foundItem = true;
						updatedStepIndex = stepIdx;
						return { ...item, status };
					}
					if (status === "in_progress" && item.status === "in_progress") {
						return { ...item, status: "pending" as const };
					}
					return item;
				}),
			}));

			if (!foundItem || updatedStepIndex === -1) {
				throw new Error(`Task item "${itemId}" was not found in Task ${taskNumber}.`);
			}

			const allDone = updatedSteps.every(step =>
				step.items.every(item => item.status === "done"));
			const nextStatus: TaskRecord["status"]
				= taskStatus ?? (allDone ? "done" : existing.status === "planned" ? "in_progress" : existing.status);

			const nowIso = new Date().toISOString();
			const updatedTask: TaskRecord = applyTaskTimestamps(
				{
					...existing,
					status: nextStatus,
					steps: updatedSteps,
					updatedAt: nowIso,
				},
				existing,
				nowIso,
			);

			const attemptingProgress
				= status !== "pending" || taskStatus === "in_progress" || taskStatus === "done";
			if (attemptingProgress) {
				assertNoImmediateQuestionBlocker(session, taskNumber);
				assertStepQuestionsSatisfied(session, taskNumber, updatedTask);
			}

			const tasks = session.tasks.map(t => (t.taskNumber === taskNumber ? updatedTask : t));
			const saved = await saveSession({ ...session, tasks });
			return { session: saved, task: updatedTask, updatedStepIndex };
		},

		async writePlan(sessionId, planInput, meta) {
			const session = await ensureSession(sessionId, meta);
			const taskNumber = planInput.taskNumber ?? allocateTaskNumberForSession(session);
			const existing = session.plans.find(p => p.taskNumber === taskNumber);

			const filename = formatTaskFilename(taskNumber, planInput.slug, "plan");
			const stagedPath = path.join(exportsDir, session.sessionId, filename);
			const planFilePath = session.exportDir
				? path.join(validateExportDir(session.exportDir), filename)
				: stagedPath;

			const nextPlan = PlanRecordSchema.parse({
				...planInput,
				taskNumber,
				generatedPlanPath: planFilePath,
				createdAt: existing?.createdAt ?? new Date().toISOString(),
			});

			const planMarkdown = renderPlanMarkdown(nextPlan);
			await writeFileAtomic(stagedPath, planMarkdown);

			const plans = session.plans.filter(p => p.taskNumber !== taskNumber);
			plans.push(nextPlan);
			plans.sort((a, b) => a.taskNumber.localeCompare(b.taskNumber));

			const tasks = session.tasks.map(t =>
				t.taskNumber === taskNumber
					? {
							...t,
							planFile: filename,
							updatedAt: new Date().toISOString(),
						}
					: t);

			const saved = await saveSession({ ...session, plans, tasks });
			return { session: saved, plan: nextPlan, planFilePath, planMarkdown };
		},

		async writeReport(sessionId, reportInput, meta) {
			const session = await ensureSession(sessionId, meta);
			const taskNumber = reportInput.taskNumber ?? allocateTaskNumberForSession(session);
			const existing = session.reports.find(r => r.taskNumber === taskNumber);
			if (existing) {
				throw new Error(
					`Report ${taskNumber} is already delivered and immutable. Allocate a new task ID for follow-up reports.`,
				);
			}

			if (reportInput.mode === "implementation") {
				assertNoImmediateQuestionBlocker(session, taskNumber);
				const matchingTask = session.tasks.find(t => t.taskNumber === taskNumber);
				assertStepQuestionsSatisfied(session, taskNumber, matchingTask, {
					finishingReport: true,
				});
			}
			else {
				assertNoImmediateQuestionBlocker(session, taskNumber);
			}

			const matchingPlan = session.plans.find(p => p.taskNumber === taskNumber);
			const nextReport = ReportRecordSchema.parse({
				...reportInput,
				taskNumber,
				planRef:
					reportInput.planRef
					?? (matchingPlan
						? formatTaskFilename(matchingPlan.taskNumber, matchingPlan.slug, "plan")
						: undefined),
				createdAt: new Date().toISOString(),
			});

			const reports = [...session.reports, nextReport].sort((a, b) =>
				a.taskNumber.localeCompare(b.taskNumber));

			const reportFile = formatTaskFilename(nextReport.taskNumber, nextReport.slug, "report");
			const tasks = session.tasks.map(t =>
				t.taskNumber === taskNumber
					? { ...t, reportFile, updatedAt: new Date().toISOString() }
					: t);

			const saved = await saveSession({ ...session, reports, tasks });
			return { session: saved, report: nextReport };
		},

		async recordHandoff(sessionId, handoffInput, meta) {
			const session = await ensureSession(sessionId, meta);
			const handoff: HandoffRecord = {
				...handoffInput,
				id: handoffInput.id ?? `handoff-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
				createdAt: new Date().toISOString(),
			};
			const handoffs = [handoff, ...session.handoffs];
			const saved = await saveSession({ ...session, handoffs });
			return { session: saved, handoff };
		},

		async createQuestionSet(sessionId, questionInput, meta) {
			const session = await ensureSession(sessionId, meta);
			const defaultSetMode = questionInput.blockingMode ?? "immediate";
			const activeTask
				= session.tasks.find(t => t.status === "in_progress")
					?? session.tasks.find(t => t.status === "planned")
					?? session.tasks[session.tasks.length - 1];

			const normalizedQuestions: QuestionItem[] = questionInput.questions.map((q) => {
				const effectiveMode = q.blockingMode ?? defaultSetMode;
				if (effectiveMode !== "before_step_finish") {
					return q;
				}
				const targetTaskNum = q.taskNumber ?? questionInput.taskNumber ?? activeTask?.taskNumber;
				const targetTask = session.tasks.find(t => t.taskNumber === targetTaskNum);
				if (!targetTask) {
					throw new Error(
						`Question "${q.id}" uses blockingMode "before_step_finish", which requires an existing task (taskNumber "${targetTaskNum ?? "none"}" was not found).`,
					);
				}
				const activeStepIdx = targetTask.steps.findIndex(step =>
					step.items.some(item => item.status !== "done"));
				const defaultStepNum = activeStepIdx === -1 ? 1 : activeStepIdx + 1;
				const resolvedStepNum = q.stepNumber ?? questionInput.stepNumber ?? defaultStepNum;
				if (resolvedStepNum < 1 || resolvedStepNum > targetTask.steps.length) {
					throw new Error(
						`Question "${q.id}" stepNumber ${resolvedStepNum} is out of bounds for Task ${targetTask.taskNumber} (1..${targetTask.steps.length}).`,
					);
				}
				return {
					...q,
					taskNumber: targetTask.taskNumber,
					stepNumber: resolvedStepNum,
				};
			});

			const answers: Record<string, QuestionAnswerValue> = {};
			for (const q of normalizedQuestions) {
				if (q.defaultValue !== undefined) {
					answers[q.id] = q.defaultValue;
				}
			}

			const questionSet = QuestionSetRecordSchema.parse({
				...questionInput,
				questions: normalizedQuestions,
				id: questionInput.id ?? `qs-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
				blockingMode: defaultSetMode,
				status: "pending",
				answeredQuestionIds: [],
				answers,
				otherTexts: {},
				createdAt: new Date().toISOString(),
			});

			const questionSets = [
				questionSet,
				...session.questionSets.filter(q => q.id !== questionSet.id),
			];
			const saved = await saveSession({ ...session, questionSets });
			return { session: saved, questionSet };
		},

		async saveQuestionDraft(sessionId, questionSetId, answers, otherTexts) {
			const session = await getSession(sessionId);
			if (!session) {
				throw new Error(`Session "${sessionId}" does not exist.`);
			}
			const existing = session.questionSets.find(q => q.id === questionSetId);
			if (!existing) {
				throw new Error(`Question set "${questionSetId}" was not found.`);
			}
			if (existing.status === "submitted") {
				return { session, questionSet: existing };
			}
			const updated: QuestionSetRecord = {
				...existing,
				answers: { ...existing.answers, ...answers },
				otherTexts: { ...existing.otherTexts, ...otherTexts },
			};
			const questionSets = session.questionSets.map(q =>
				q.id === questionSetId ? updated : q);
			const saved = await saveSession({ ...session, questionSets }, false);
			return { session: saved, questionSet: updated };
		},

		async submitQuestionAnswers(sessionId, questionSetId, answers, otherTexts, options) {
			const session = await getSession(sessionId);
			if (!session) {
				throw new Error(`Session "${sessionId}" does not exist.`);
			}
			const existing = session.questionSets.find(q => q.id === questionSetId);
			if (!existing) {
				throw new Error(`Question set "${questionSetId}" was not found.`);
			}
			if (existing.status === "submitted") {
				return { session, questionSet: existing, submittedQuestionIds: [] };
			}

			const mergedAnswers = { ...existing.answers, ...answers };
			const mergedOthers = { ...existing.otherTexts, ...otherTexts };
			const alreadyAnswered = new Set(existing.answeredQuestionIds);
			const openQuestions = existing.questions.filter(q => !alreadyAnswered.has(q.id));

			let targetQuestions: QuestionItem[];
			if (options?.questionIds && options.questionIds.length > 0) {
				const requested = new Set(options.questionIds);
				targetQuestions = openQuestions.filter(q => requested.has(q.id));
			}
			else if (options?.scope === "immediate") {
				targetQuestions = openQuestions.filter(
					q => resolveQuestionPolicy(existing, q).blockingMode === "immediate",
				);
			}
			else if (options?.scope === "before_step_finish") {
				targetQuestions = openQuestions.filter(
					q => resolveQuestionPolicy(existing, q).blockingMode === "before_step_finish",
				);
			}
			else if (options?.scope === "answered") {
				targetQuestions = openQuestions.filter(q =>
					isNonEmptyAnswer(mergedAnswers[q.id], mergedOthers[q.id]));
			}
			else {
				targetQuestions = openQuestions;
			}

			if (targetQuestions.length === 0) {
				throw new Error("No matching open questions selected for submission.");
			}

			const missingIds: string[] = [];
			for (const q of targetQuestions) {
				if (q.required && !isNonEmptyAnswer(mergedAnswers[q.id], mergedOthers[q.id])) {
					missingIds.push(q.id);
				}
			}
			if (missingIds.length > 0) {
				throw new Error(
					`Missing required answers for questions: ${missingIds.join(", ")}.`,
				);
			}

			const submittedIds = targetQuestions.map(q => q.id);
			const nextAnsweredIds = Array.from(
				new Set([...existing.answeredQuestionIds, ...submittedIds]),
			);
			const allAnswered = existing.questions.every(q => nextAnsweredIds.includes(q.id));

			const updated: QuestionSetRecord = {
				...existing,
				status: allAnswered ? "submitted" : "partial",
				answeredQuestionIds: nextAnsweredIds,
				answers: mergedAnswers,
				otherTexts: mergedOthers,
				submittedAt: allAnswered ? new Date().toISOString() : existing.submittedAt,
			};
			const questionSets = session.questionSets.map(q =>
				q.id === questionSetId ? updated : q);
			const saved = await saveSession({ ...session, questionSets }, false);
			return { session: saved, questionSet: updated, submittedQuestionIds: submittedIds };
		},

		async recordToolCall(sessionId, toolName, status, summary, argsSummary) {
			const session = await getSession(sessionId);
			if (!session) {
				return;
			}
			const entry = {
				id: `call-${Date.now()}-${crypto.randomUUID().slice(0, 6)}`,
				toolName,
				timestamp: new Date().toISOString(),
				status,
				summary,
				argsSummary,
			};
			const toolCalls = [entry, ...session.toolCalls].slice(0, MAX_TOOL_CALLS);
			await saveSession({ ...session, toolCalls }, false);
		},

		async buildPayload(session, mode, activeTab, options) {
			const [sessions, settings] = await Promise.all([
				options?.includeSessions ? readIndex() : Promise.resolve(undefined),
				getSettings(),
			]);
			const revision
				= options?.revision
					?? (sessions
						? computeRevision(session, sessions, settings)
						: `${session?.sessionId ?? "none"}|${session?.updatedAt ?? "0"}|${settings.displayType}:${settings.stepDisplayType}`);
			return {
				mode,
				sessionId: session?.sessionId ?? null,
				activeTab,
				activeItemId: options?.activeItemId,
				activeStepIndex: options?.activeStepIndex,
				activeTaskItemId: options?.activeTaskItemId,
				stepSnapshot: options?.stepSnapshot,
				revision,
				settings,
				session,
				sessions,
			};
		},
	};
}
