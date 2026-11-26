import crypto from "node:crypto";
import path from "node:path";
import { and, desc, eq, inArray, ne, notInArray, sql } from "drizzle-orm";
import type { AppDrizzleDb } from "../db/client.js";
import { questionSets, sessionGroups, sessions, tasks, toolCalls } from "../db/schema.js";
import { GroupIdSchema, type SessionGroup, type SessionGroupSummary, SessionIdSchema, type SessionRecord, type SessionSummary } from "@/shared/contracts.js";
import { NotFoundError, ValidationError } from "./errors.js";
import { type DbExecutor, recordTimelineEvent } from "./timeline.js";

/** Maximum number of tool call log entries kept in DB on new session start and displayed in the Log footer. */
export const MAX_TOOL_CALL_LOGS = 100;

/**
 * Prune the `tool_calls` table globally so at most `keepCount` newest rows remain.
 * Invoked automatically when a new session is created to bound database growth.
 */
export function pruneToolCallsGlobalTx(tx: DbExecutor, keepCount = MAX_TOOL_CALL_LOGS): number {
	const keepIds = tx
		.select({ id: toolCalls.id })
		.from(toolCalls)
		.orderBy(desc(toolCalls.createdAt), desc(sql`rowid`))
		.limit(keepCount)
		.all()
		.map(row => row.id);

	if (keepIds.length < keepCount) {
		return 0;
	}

	const result = tx
		.delete(toolCalls)
		.where(notInArray(toolCalls.id, keepIds))
		.run();
	return Number(result.changes ?? 0);
}

/** Check whether a session ID already exists in SQLite (strictly read-only). */
export function hasSession(db: DbExecutor, sessionId: string): boolean {
	const row = db
		.select({ id: sessions.id })
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.get();
	return Boolean(row);
}

export interface SessionMetaInput {
	title?: string;
	rootDir?: string;
	exportDir?: string;
	groupId?: string | null;
}

export interface UpsertGroupInput {
	id?: string;
	name: string;
	description?: string;
	notes?: string;
}

/** Validate an absolute local directory path without null bytes. */
export function validateAbsoluteDir(dirPath: string, fieldName: string): string {
	if (!dirPath || dirPath.includes("\0") || !path.isAbsolute(dirPath)) {
		throw new ValidationError(`${fieldName} must be an absolute path without null bytes.`);
	}
	return path.resolve(dirPath);
}

function mapSessionRow(row: typeof sessions.$inferSelect): SessionRecord {
	return {
		sessionId: row.id,
		groupId: row.groupId ?? null,
		title: row.title ?? undefined,
		rootDir: row.rootDir ?? undefined,
		exportDir: row.exportDir ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

function mapGroupRow(row: typeof sessionGroups.$inferSelect): SessionGroup {
	return {
		id: row.id,
		name: row.name,
		description: row.description ?? undefined,
		notes: row.notes ?? undefined,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

/**
 * Ensure a session row exists inside an active transaction, updating any provided
 * metadata (`title`, `rootDir`, `exportDir`, `groupId`) and recording a creation event.
 */
export function ensureSessionTx(
	tx: DbExecutor,
	sessionId: string,
	meta?: SessionMetaInput,
	now = new Date().toISOString(),
): SessionRecord {
	const parsedId = SessionIdSchema.safeParse(sessionId);
	if (!parsedId.success) {
		throw new ValidationError(parsedId.error.issues[0]?.message ?? "Invalid sessionId.");
	}

	const cleanRootDir = meta?.rootDir !== undefined
		? (meta.rootDir.trim() ? validateAbsoluteDir(meta.rootDir.trim(), "rootDir") : null)
		: undefined;
	const cleanExportDir = meta?.exportDir !== undefined
		? (meta.exportDir.trim() ? validateAbsoluteDir(meta.exportDir.trim(), "exportDir") : null)
		: undefined;
	const cleanTitle = meta?.title !== undefined ? (meta.title.trim() || null) : undefined;

	if (meta?.groupId) {
		const groupExists = tx
			.select({ id: sessionGroups.id })
			.from(sessionGroups)
			.where(eq(sessionGroups.id, meta.groupId))
			.get();
		if (!groupExists) {
			throw new NotFoundError("SessionGroup", meta.groupId);
		}
	}

	const existing = tx.select().from(sessions).where(eq(sessions.id, sessionId)).get();
	if (!existing) {
		const inserted = tx
			.insert(sessions)
			.values({
				id: sessionId,
				groupId: meta?.groupId ?? null,
				title: cleanTitle ?? null,
				rootDir: cleanRootDir ?? null,
				exportDir: cleanExportDir ?? null,
				createdAt: now,
				updatedAt: now,
			})
			.returning()
			.get();

		recordTimelineEvent(tx, {
			sessionId,
			groupId: inserted.groupId,
			eventType: "session_created",
			actor: "agent",
			title: cleanTitle ? `Started session "${cleanTitle}"` : `Started session ${sessionId}`,
			links: [
				{
					entityType: "session",
					entityId: sessionId,
					role: "subject",
					label: cleanTitle ?? sessionId,
				},
				...(inserted.groupId
					? [{
							entityType: "session_group" as const,
							entityId: inserted.groupId,
							role: "parent" as const,
						}]
					: []),
			],
			createdAt: now,
		});
		pruneToolCallsGlobalTx(tx, MAX_TOOL_CALL_LOGS);
		return mapSessionRow(inserted);
	}

	const nextGroupId = meta?.groupId !== undefined ? meta.groupId : existing.groupId;
	const nextTitle = cleanTitle !== undefined ? cleanTitle : existing.title;
	const nextRootDir = cleanRootDir !== undefined ? cleanRootDir : existing.rootDir;
	const nextExportDir = cleanExportDir !== undefined ? cleanExportDir : existing.exportDir;

	const updated = tx
		.update(sessions)
		.set({
			groupId: nextGroupId,
			title: nextTitle,
			rootDir: nextRootDir,
			exportDir: nextExportDir,
			updatedAt: now,
		})
		.where(eq(sessions.id, sessionId))
		.returning()
		.get()!;

	return mapSessionRow(updated);
}

/** Create or update session metadata (`title`, `rootDir`, `exportDir`, `groupId`). */
export function upsertSession(
	db: AppDrizzleDb,
	sessionId: string,
	meta?: SessionMetaInput,
): SessionRecord {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const prev = tx.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		const session = ensureSessionTx(tx, sessionId, meta, now);

		if (prev && meta?.groupId !== undefined && meta.groupId !== prev.groupId) {
			recordTimelineEvent(tx, {
				sessionId,
				groupId: session.groupId,
				eventType: "session_group_assigned",
				actor: "user",
				title: session.groupId
					? `Assigned session to group "${session.groupId}"`
					: "Removed session from group",
				links: [
					{
						entityType: "session",
						entityId: sessionId,
						role: "subject",
						label: session.title ?? sessionId,
					},
					...(session.groupId
						? [{
								entityType: "session_group" as const,
								entityId: session.groupId,
								role: "related" as const,
							}]
						: []),
				],
				createdAt: now,
			});
		}
		return session;
	});
}

/** Read a single session record strictly read-only. */
export function getSession(db: DbExecutor, sessionId: string): SessionRecord | null {
	const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
	return row ? mapSessionRow(row) : null;
}

/** Read the most recently updated session strictly read-only. */
export function getLatestSession(db: DbExecutor): SessionRecord | null {
	const row = db.select().from(sessions).orderBy(desc(sessions.updatedAt)).limit(1).get();
	return row ? mapSessionRow(row) : null;
}

/** List session summaries with optional group and `rootDir` filters (strictly read-only). */
export function listSessions(
	db: DbExecutor,
	filter?: { groupId?: string; rootDir?: string },
): SessionSummary[] {
	const conditions = [];
	if (filter?.groupId) {
		conditions.push(eq(sessions.groupId, filter.groupId));
	}
	if (filter?.rootDir) {
		conditions.push(eq(sessions.rootDir, filter.rootDir));
	}

	const rows = db
		.select()
		.from(sessions)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(sessions.updatedAt))
		.all();

	if (rows.length === 0) {
		return [];
	}

	const sessionIds = rows.map(r => r.id);
	const taskRows = db
		.select({ sessionId: tasks.sessionId })
		.from(tasks)
		.where(inArray(tasks.sessionId, sessionIds))
		.all();
	const pendingQuestionRows = db
		.select({ sessionId: questionSets.sessionId })
		.from(questionSets)
		.where(
			and(
				inArray(questionSets.sessionId, sessionIds),
				ne(questionSets.status, "submitted"),
			),
		)
		.all();

	const taskCounts = new Map<string, number>();
	for (const r of taskRows) {
		taskCounts.set(r.sessionId, (taskCounts.get(r.sessionId) ?? 0) + 1);
	}
	const pendingCounts = new Map<string, number>();
	for (const r of pendingQuestionRows) {
		pendingCounts.set(r.sessionId, (pendingCounts.get(r.sessionId) ?? 0) + 1);
	}

	return rows.map(row => ({
		sessionId: row.id,
		groupId: row.groupId ?? null,
		title: row.title ?? undefined,
		rootDir: row.rootDir ?? undefined,
		exportDir: row.exportDir ?? undefined,
		updatedAt: row.updatedAt,
		taskCount: taskCounts.get(row.id) ?? 0,
		pendingQuestionCount: pendingCounts.get(row.id) ?? 0,
	}));
}

/** Create or update a session group with metadata and notes. */
export function upsertSessionGroup(
	db: AppDrizzleDb,
	input: UpsertGroupInput,
): SessionGroup {
	const name = input.name.trim();
	if (!name) {
		throw new ValidationError("Group name cannot be empty.");
	}
	const id = input.id?.trim() || `grp-${crypto.randomUUID().slice(0, 8)}`;
	const parsedId = GroupIdSchema.safeParse(id);
	if (!parsedId.success) {
		throw new ValidationError(parsedId.error.issues[0]?.message ?? "Invalid groupId.");
	}

	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const existing = tx.select().from(sessionGroups).where(eq(sessionGroups.id, id)).get();
		if (!existing) {
			const inserted = tx
				.insert(sessionGroups)
				.values({
					id,
					name,
					description: input.description?.trim() || null,
					notes: input.notes?.trim() || null,
					createdAt: now,
					updatedAt: now,
				})
				.returning()
				.get();

			recordTimelineEvent(tx, {
				groupId: id,
				eventType: "group_created",
				actor: "agent",
				title: `Created group "${name}"`,
				summary: inserted.description ?? undefined,
				links: [{
					entityType: "session_group",
					entityId: id,
					role: "subject",
					label: name,
				}],
				createdAt: now,
			});
			return mapGroupRow(inserted);
		}

		const updated = tx
			.update(sessionGroups)
			.set({
				name,
				description: input.description !== undefined ? (input.description.trim() || null) : existing.description,
				notes: input.notes !== undefined ? (input.notes.trim() || null) : existing.notes,
				updatedAt: now,
			})
			.where(eq(sessionGroups.id, id))
			.returning()
			.get()!;

		return mapGroupRow(updated);
	});
}

/** Delete a session group (member sessions stay intact with `groupId: null`). */
export function deleteSessionGroup(db: AppDrizzleDb, groupId: string): void {
	db.transaction((tx) => {
		const existing = tx.select().from(sessionGroups).where(eq(sessionGroups.id, groupId)).get();
		if (!existing) {
			throw new NotFoundError("SessionGroup", groupId);
		}
		tx.delete(sessionGroups).where(eq(sessionGroups.id, groupId)).run();
	});
}

/** Assign a session to a group or pass `null` to detach it. */
export function assignSessionGroup(
	db: AppDrizzleDb,
	sessionId: string,
	groupId: string | null,
): SessionRecord {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = tx.select().from(sessions).where(eq(sessions.id, sessionId)).get();
		if (!session) {
			throw new NotFoundError("Session", sessionId);
		}
		let groupName: string | undefined;
		if (groupId !== null) {
			const group = tx.select().from(sessionGroups).where(eq(sessionGroups.id, groupId)).get();
			if (!group) {
				throw new NotFoundError("SessionGroup", groupId);
			}
			groupName = group.name;
		}

		const updated = tx
			.update(sessions)
			.set({ groupId, updatedAt: now })
			.where(eq(sessions.id, sessionId))
			.returning()
			.get()!;

		recordTimelineEvent(tx, {
			sessionId,
			groupId,
			eventType: "session_group_assigned",
			actor: "agent",
			title: groupName
				? `Assigned session to "${groupName}"`
				: "Detached session from group",
			links: [
				{
					entityType: "session",
					entityId: sessionId,
					role: "subject",
					label: updated.title ?? sessionId,
				},
				...(groupId
					? [{
							entityType: "session_group" as const,
							entityId: groupId,
							role: "related" as const,
							label: groupName,
						}]
					: []),
			],
			createdAt: now,
		});

		return mapSessionRow(updated);
	});
}

/** Look up a single 1:N session group by ID, returning `null` if not found. */
export function getSessionGroup(db: DbExecutor, groupId: string): SessionGroup | null {
	const row = db.select().from(sessionGroups).where(eq(sessionGroups.id, groupId)).get();
	return row ? mapGroupRow(row) : null;
}

/** List all session groups with session, task, and pending question counts. */
export function listSessionGroups(db: DbExecutor): SessionGroupSummary[] {
	const groupRows = db
		.select()
		.from(sessionGroups)
		.orderBy(desc(sessionGroups.updatedAt))
		.all();
	if (groupRows.length === 0) {
		return [];
	}

	const sessionRows = db.select().from(sessions).all();
	const groupBySession = new Map<string, string>();
	const sessionCounts = new Map<string, number>();
	for (const s of sessionRows) {
		if (s.groupId) {
			groupBySession.set(s.id, s.groupId);
			sessionCounts.set(s.groupId, (sessionCounts.get(s.groupId) ?? 0) + 1);
		}
	}

	const taskCounts = new Map<string, number>();
	for (const t of db.select({ sessionId: tasks.sessionId }).from(tasks).all()) {
		const gId = groupBySession.get(t.sessionId);
		if (gId) {
			taskCounts.set(gId, (taskCounts.get(gId) ?? 0) + 1);
		}
	}

	const pendingCounts = new Map<string, number>();
	const openQuestions = db
		.select({ sessionId: questionSets.sessionId })
		.from(questionSets)
		.where(ne(questionSets.status, "submitted"))
		.all();
	for (const q of openQuestions) {
		const gId = groupBySession.get(q.sessionId);
		if (gId) {
			pendingCounts.set(gId, (pendingCounts.get(gId) ?? 0) + 1);
		}
	}

	return groupRows.map(row => ({
		...mapGroupRow(row),
		sessionCount: sessionCounts.get(row.id) ?? 0,
		taskCount: taskCounts.get(row.id) ?? 0,
		pendingQuestionCount: pendingCounts.get(row.id) ?? 0,
	}));
}
