import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { AppDrizzleDb } from "../db/client.js";
import { sessions, taskItems, tasks, taskSteps } from "../db/schema.js";
import type { TaskItem, TaskItemStatus, TaskLifecycleStatus, TaskRecord, TaskStep, TaskStepSnapshot } from "@/shared/contracts.js";
import { formatTaskId } from "@/shared/format.js";
import { renderTasksMarkdown } from "@/shared/markdown.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { assertNoImmediateQuestionBlocker, assertStepQuestionsSatisfied } from "./questions.js";
import { ensureSessionTx, getSession, type SessionMetaInput } from "./sessions.js";
import { type DbExecutor, recordTimelineEvent } from "./timeline.js";

export interface UpsertTaskInput {
	taskId?: number;
	slug: string;
	title: string;
	status: TaskLifecycleStatus;
	summary: string;
	steps: Array<{
		title: string;
		outcome: string;
		items: Array<{
			itemKey: string;
			text: string;
			status: TaskItemStatus;
		}>;
	}>;
	planFile?: string;
	reportFile?: string;
}

/**
 * Write UTF-8 text atomically to `targetPath` via a sibling temporary file + `rename`
 * so concurrent file readers never observe truncated Markdown exports.
 */
export async function writeFileAtomic(targetPath: string, content: string): Promise<void> {
	const dir = path.dirname(targetPath);
	await fs.mkdir(dir, { recursive: true });
	const tmpName = `.${path.basename(targetPath)}.${process.pid}.${crypto.randomUUID()}.tmp`;
	const tmpPath = path.join(dir, tmpName);
	await fs.writeFile(tmpPath, content, "utf8");
	await fs.rename(tmpPath, targetPath);
}

/** Re-render and atomically overwrite `tasks.md` when `session.exportDir` is configured. */
export async function exportTasksMarkdownIfConfigured(
	db: DbExecutor,
	sessionId: string,
): Promise<void> {
	const session = getSession(db, sessionId);
	if (!session?.exportDir) {
		return;
	}
	const sessionTasks = listTasks(db, { sessionId });
	const md = renderTasksMarkdown(sessionTasks);
	await writeFileAtomic(path.join(session.exportDir, "tasks.md"), md);
}

function normalizeSingleInProgress<T extends {
	items: Array<{ itemKey: string; text: string; status: TaskItemStatus }>;
}>(
	steps: T[],
	preferItemKey?: string,
): T[] {
	let activeKey = preferItemKey;
	if (!activeKey) {
		for (const step of steps) {
			for (const item of step.items) {
				if (item.status === "in_progress") {
					activeKey = item.itemKey;
				}
			}
		}
	}

	let seenPreferred = false;
	return steps.map(step => ({
		...step,
		items: step.items.map((item) => {
			if (item.status !== "in_progress") {
				return item;
			}
			if (activeKey && item.itemKey === activeKey && !seenPreferred) {
				seenPreferred = true;
				return item;
			}
			return { ...item, status: "pending" as const };
		}),
	}));
}

function hydrateTaskRecords(
	taskRows: Array<typeof tasks.$inferSelect>,
	stepRows: Array<typeof taskSteps.$inferSelect>,
	itemRows: Array<typeof taskItems.$inferSelect>,
): TaskRecord[] {
	const itemsByStep = new Map<number, TaskItem[]>();
	for (const row of [...itemRows].sort((a, b) => a.itemIndex - b.itemIndex)) {
		const bucket = itemsByStep.get(row.stepId) ?? [];
		bucket.push({
			id: row.id,
			itemKey: row.itemKey,
			text: row.text,
			status: row.status,
			createdAt: row.createdAt,
			startedAt: row.startedAt ?? undefined,
			completedAt: row.completedAt ?? undefined,
			updatedAt: row.updatedAt,
		});
		itemsByStep.set(row.stepId, bucket);
	}

	const stepsByTask = new Map<number, TaskStep[]>();
	for (const row of [...stepRows].sort((a, b) => a.stepIndex - b.stepIndex)) {
		const bucket = stepsByTask.get(row.taskId) ?? [];
		bucket.push({
			id: row.id,
			stepIndex: row.stepIndex,
			title: row.title,
			outcome: row.outcome,
			items: itemsByStep.get(row.id) ?? [],
			createdAt: row.createdAt,
			startedAt: row.startedAt ?? undefined,
			completedAt: row.completedAt ?? undefined,
			updatedAt: row.updatedAt,
		});
		stepsByTask.set(row.taskId, bucket);
	}

	return taskRows.map(row => ({
		taskId: row.id,
		sessionId: row.sessionId,
		slug: row.slug,
		title: row.title,
		status: row.status,
		summary: row.summary,
		steps: stepsByTask.get(row.id) ?? [],
		planFile: row.planFile ?? undefined,
		reportFile: row.reportFile ?? undefined,
		createdAt: row.createdAt,
		startedAt: row.startedAt ?? undefined,
		completedAt: row.completedAt ?? undefined,
		updatedAt: row.updatedAt,
	}));
}

/** Read a single task by global integer `taskId` (strictly read-only). */
export function getTaskById(db: DbExecutor, taskId: number): TaskRecord | null {
	const taskRow = db.select().from(tasks).where(eq(tasks.id, taskId)).get();
	if (!taskRow) {
		return null;
	}
	const stepRows = db
		.select()
		.from(taskSteps)
		.where(eq(taskSteps.taskId, taskId))
		.orderBy(asc(taskSteps.stepIndex))
		.all();
	const itemRows = db
		.select()
		.from(taskItems)
		.where(eq(taskItems.taskId, taskId))
		.orderBy(asc(taskItems.itemIndex))
		.all();

	return hydrateTaskRecords([taskRow], stepRows, itemRows)[0] ?? null;
}

/** Read the current active (or latest) task for a session (strictly read-only). */
export function getCurrentTaskForSession(db: DbExecutor, sessionId: string): TaskRecord | null {
	const rows = listTasks(db, { sessionId });
	return (
		rows.find(t => t.status === "in_progress")
		?? rows.find(t => t.status === "planned")
		?? rows[0]
		?? null
	);
}

/** List tasks with optional session, group, status, and limit filters (strictly read-only). */
export function listTasks(
	db: DbExecutor,
	filter?: {
		sessionId?: string;
		groupId?: string;
		status?: TaskLifecycleStatus;
		limit?: number;
	},
): TaskRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(tasks.sessionId, filter.sessionId));
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
		conditions.push(inArray(tasks.sessionId, sessionIds));
	}
	if (filter?.status) {
		conditions.push(eq(tasks.status, filter.status));
	}

	const taskRows = db
		.select()
		.from(tasks)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(tasks.id))
		.limit(filter?.limit ?? 200)
		.all();

	if (taskRows.length === 0) {
		return [];
	}

	const taskIds = taskRows.map(t => t.id);
	const stepRows = db
		.select()
		.from(taskSteps)
		.where(inArray(taskSteps.taskId, taskIds))
		.orderBy(asc(taskSteps.stepIndex))
		.all();
	const itemRows = db
		.select()
		.from(taskItems)
		.where(inArray(taskItems.taskId, taskIds))
		.orderBy(asc(taskItems.itemIndex))
		.all();

	return hydrateTaskRecords(taskRows, stepRows, itemRows);
}

function computeLifecycleDates(
	status: TaskLifecycleStatus,
	steps: Array<{ items: Array<{ status: TaskItemStatus }> }>,
	prev: {
		createdAt?: string;
		startedAt?: string | null;
		completedAt?: string | null;
	} | undefined,
	now: string,
): { createdAt: string; startedAt: string | null; completedAt: string | null } {
	const createdAt = prev?.createdAt ?? now;
	const hasAnyStarted = steps.some(s => s.items.some(i => i.status !== "pending"));
	const isTerminal = status === "done" || status === "cancelled" || status === "superseded";
	const startedAt
		= prev?.startedAt
			?? (status === "in_progress" || isTerminal || hasAnyStarted ? now : null);
	const completedAt = isTerminal ? (prev?.completedAt ?? now) : null;
	return { createdAt, startedAt, completedAt };
}

/** Create or update a global task with its ordered steps and checklist items. */
export async function upsertTask(
	db: AppDrizzleDb,
	sessionId: string,
	input: UpsertTaskInput,
	meta?: SessionMetaInput,
): Promise<{ task: TaskRecord }> {
	if (input.steps.length === 0) {
		throw new ValidationError("Task must contain at least one step.");
	}
	const seenKeys = new Set<string>();
	for (const step of input.steps) {
		for (const item of step.items) {
			if (seenKeys.has(item.itemKey)) {
				throw new ValidationError(`Duplicate itemKey "${item.itemKey}" inside task.`);
			}
			seenKeys.add(item.itemKey);
		}
	}

	const result = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);
		assertNoImmediateQuestionBlocker(tx, sessionId, input.taskId);

		const normalizedSteps = normalizeSingleInProgress(input.steps);
		const existing = input.taskId !== undefined ? getTaskById(tx, input.taskId) : null;
		if (input.taskId !== undefined && !existing) {
			throw new NotFoundError("Task", input.taskId);
		}
		if (existing && existing.sessionId !== sessionId) {
			throw new ValidationError(
				`Task ${formatTaskId(existing.taskId)} belongs to session "${existing.sessionId}", not "${sessionId}".`,
			);
		}

		const taskDates = computeLifecycleDates(input.status, normalizedSteps, existing ?? undefined, now);
		let targetTaskId: number;

		if (existing) {
			tx.update(tasks)
				.set({
					slug: input.slug,
					title: input.title,
					status: input.status,
					summary: input.summary,
					planFile: input.planFile ?? existing.planFile ?? null,
					reportFile: input.reportFile ?? existing.reportFile ?? null,
					startedAt: taskDates.startedAt,
					completedAt: taskDates.completedAt,
					updatedAt: now,
				})
				.where(eq(tasks.id, existing.taskId))
				.run();
			targetTaskId = existing.taskId;
			tx.delete(taskSteps).where(eq(taskSteps.taskId, targetTaskId)).run();
		}
		else {
			const inserted = tx
				.insert(tasks)
				.values({
					sessionId,
					slug: input.slug,
					title: input.title,
					status: input.status,
					summary: input.summary,
					planFile: input.planFile ?? null,
					reportFile: input.reportFile ?? null,
					createdAt: taskDates.createdAt,
					startedAt: taskDates.startedAt,
					completedAt: taskDates.completedAt,
					updatedAt: now,
				})
				.returning()
				.get();
			targetTaskId = inserted.id;
		}

		const prevStepsByIndex = new Map((existing?.steps ?? []).map((s, idx) => [idx, s]));
		const prevItemsByKey = new Map<string, TaskItem>();
		for (const prevStep of existing?.steps ?? []) {
			for (const prevItem of prevStep.items) {
				prevItemsByKey.set(prevItem.itemKey, prevItem);
			}
		}

		normalizedSteps.forEach((step, stepIndex) => {
			const prevStep = prevStepsByIndex.get(stepIndex);
			const stepStarted = step.items.some(i => i.status !== "pending");
			const stepDone = step.items.every(i => i.status === "done");
			const stepRow = tx
				.insert(taskSteps)
				.values({
					taskId: targetTaskId,
					stepIndex,
					title: step.title,
					outcome: step.outcome,
					createdAt: prevStep?.createdAt ?? now,
					startedAt: prevStep?.startedAt ?? (stepStarted ? now : null),
					completedAt: stepDone ? (prevStep?.completedAt ?? now) : null,
					updatedAt: now,
				})
				.returning()
				.get();

			step.items.forEach((item, itemIndex) => {
				const prevItem = prevItemsByKey.get(item.itemKey);
				const itemDone = item.status === "done";
				tx.insert(taskItems)
					.values({
						stepId: stepRow.id,
						taskId: targetTaskId,
						itemKey: item.itemKey,
						itemIndex,
						text: item.text,
						status: item.status,
						createdAt: prevItem?.createdAt ?? now,
						startedAt:
							prevItem?.startedAt ?? (item.status !== "pending" ? now : null),
						completedAt: itemDone ? (prevItem?.completedAt ?? now) : null,
						updatedAt: now,
					})
					.run();
			});
		});

		const saved = getTaskById(tx, targetTaskId)!;

		if (!existing) {
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "task_created",
				actor: "agent",
				title: `Created Task ${formatTaskId(targetTaskId)}: ${saved.title}`,
				summary: saved.summary,
				links: [
					{
						entityType: "task",
						entityId: String(targetTaskId),
						role: "subject",
						label: `Task ${formatTaskId(targetTaskId)}`,
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
		else if (existing.status !== saved.status) {
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "task_status_changed",
				actor: "agent",
				title: `Task ${formatTaskId(targetTaskId)} marked ${saved.status}`,
				summary: `${existing.status} -> ${saved.status}`,
				links: [
					{
						entityType: "task",
						entityId: String(targetTaskId),
						role: "subject",
						label: `Task ${formatTaskId(targetTaskId)}`,
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

		return saved;
	});

	await exportTasksMarkdownIfConfigured(db, sessionId);
	return { task: result };
}

/** Update a single checklist item inside a task, enforcing blocking guards and emitting step timeline events. */
export async function updateTaskItem(
	db: AppDrizzleDb,
	sessionId: string,
	taskId: number,
	itemKey: string,
	status: TaskItemStatus,
	taskStatus?: TaskLifecycleStatus,
): Promise<{ task: TaskRecord; updatedStepIndex: number; stepSnapshot: TaskStepSnapshot }> {
	const result = db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, undefined, now);
		assertNoImmediateQuestionBlocker(tx, sessionId, taskId);

		const existing = getTaskById(tx, taskId);
		if (!existing) {
			throw new NotFoundError("Task", taskId);
		}
		if (existing.sessionId !== sessionId) {
			throw new ValidationError(
				`Task ${formatTaskId(taskId)} belongs to session "${existing.sessionId}", not "${sessionId}".`,
			);
		}

		let targetStepIndex = -1;
		let targetItemId: number | undefined;
		existing.steps.forEach((step, idx) => {
			const hit = step.items.find(i => i.itemKey === itemKey);
			if (hit) {
				targetStepIndex = idx;
				targetItemId = hit.id;
			}
		});
		if (targetStepIndex === -1 || targetItemId === undefined) {
			throw new NotFoundError("TaskItem", `${taskId}:${itemKey}`);
		}

		const updatedSteps = existing.steps.map(step => ({
			...step,
			items: step.items.map(item =>
				item.itemKey === itemKey ? { ...item, status } : item),
		}));
		const normalized = normalizeSingleInProgress(
			updatedSteps,
			status === "in_progress" ? itemKey : undefined,
		);

		const targetStepAfter = normalized[targetStepIndex]!;
		const stepBecomesDone = targetStepAfter.items.every(i => i.status === "done");
		if (stepBecomesDone) {
			assertStepQuestionsSatisfied(tx, sessionId, taskId, targetStepIndex + 1);
		}

		const nextTaskStatus: TaskLifecycleStatus
			= taskStatus
				?? (normalized.every(s => s.items.every(i => i.status === "done"))
					? "done"
					: status === "in_progress" || existing.status === "planned"
						? "in_progress"
						: existing.status);

		const taskDates = computeLifecycleDates(nextTaskStatus, normalized, existing, now);
		tx.update(tasks)
			.set({
				status: nextTaskStatus,
				startedAt: taskDates.startedAt,
				completedAt: taskDates.completedAt,
				updatedAt: now,
			})
			.where(eq(tasks.id, taskId))
			.run();

		const prevStep = existing.steps[targetStepIndex]!;
		const prevStepStarted = Boolean(prevStep.startedAt);
		const prevStepCompleted = Boolean(prevStep.completedAt);

		normalized.forEach((step, stepIdx) => {
			const origStep = existing.steps[stepIdx]!;
			const stepStarted = step.items.some(i => i.status !== "pending");
			const stepDone = step.items.every(i => i.status === "done");
			tx.update(taskSteps)
				.set({
					startedAt: origStep.startedAt ?? (stepStarted ? now : null),
					completedAt: stepDone ? (origStep.completedAt ?? now) : null,
					updatedAt: now,
				})
				.where(eq(taskSteps.id, origStep.id!))
				.run();

			step.items.forEach((item) => {
				const origItem = origStep.items.find(i => i.itemKey === item.itemKey)!;
				tx.update(taskItems)
					.set({
						status: item.status,
						startedAt: origItem.startedAt ?? (item.status !== "pending" ? now : null),
						completedAt: item.status === "done" ? (origItem.completedAt ?? now) : null,
						updatedAt: now,
					})
					.where(eq(taskItems.id, origItem.id!))
					.run();
			});
		});

		const refreshed = getTaskById(tx, taskId)!;
		const refreshedStep = refreshed.steps[targetStepIndex]!;

		if (!prevStepStarted && refreshedStep.startedAt) {
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "step_started",
				actor: "agent",
				title: `Started Task ${formatTaskId(taskId)} Step ${targetStepIndex + 1}: ${refreshedStep.title}`,
				links: [
					{
						entityType: "task_step",
						entityId: String(refreshedStep.id!),
						role: "subject",
						label: `Step ${targetStepIndex + 1}`,
					},
					{
						entityType: "task",
						entityId: String(taskId),
						role: "parent",
						label: `Task ${formatTaskId(taskId)}`,
					},
					{
						entityType: "task_item",
						entityId: `${taskId}:${itemKey}`,
						role: "related",
						label: itemKey,
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

		if (!prevStepCompleted && refreshedStep.completedAt) {
			const itemLinks = refreshedStep.items.map(item => ({
				entityType: "task_item" as const,
				entityId: `${taskId}:${item.itemKey}`,
				role: "related" as const,
				label: item.itemKey,
			}));
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "step_completed",
				actor: "agent",
				title: `Completed Task ${formatTaskId(taskId)} Step ${targetStepIndex + 1}: ${refreshedStep.title}`,
				summary: refreshedStep.outcome,
				links: [
					{
						entityType: "task_step",
						entityId: String(refreshedStep.id!),
						role: "subject",
						label: `Step ${targetStepIndex + 1}`,
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
					...itemLinks,
				],
				createdAt: now,
			});
		}

		if (existing.status !== refreshed.status) {
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "task_status_changed",
				actor: "agent",
				title: `Task ${formatTaskId(taskId)} marked ${refreshed.status}`,
				summary: `${existing.status} -> ${refreshed.status}`,
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

		const stepSnapshot: TaskStepSnapshot = {
			taskId,
			taskTitle: refreshed.title,
			stepIndex: targetStepIndex,
			totalSteps: refreshed.steps.length,
			step: refreshedStep,
			itemKey,
			capturedAt: now,
		};

		return {
			task: refreshed,
			updatedStepIndex: targetStepIndex,
			stepSnapshot,
		};
	});

	await exportTasksMarkdownIfConfigured(db, sessionId);
	return result;
}
