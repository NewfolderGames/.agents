import crypto from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { AppDrizzleDb } from "../db/client.js";
import { sessions, toolCalls, uiSettings } from "../db/schema.js";
import { DEFAULT_UI_SETTINGS, type ToolCallRecord, type UiSettings } from "@/shared/contracts.js";
import { ensureSessionTx, MAX_TOOL_CALL_LOGS } from "./sessions.js";
import type { DbExecutor } from "./timeline.js";

export { MAX_TOOL_CALL_LOGS };

/** Read singleton UI settings (strictly read-only). */
export function getUiSettings(db: DbExecutor): UiSettings {
	const row = db.select().from(uiSettings).where(eq(uiSettings.id, 1)).get();
	if (!row) {
		return { ...DEFAULT_UI_SETTINGS };
	}
	return {
		displayType: row.displayType,
		stepDisplayType: row.stepDisplayType,
		updatedAt: row.updatedAt,
	};
}

/** Persist UI widget display mode settings into singleton row `id = 1`. */
export function updateUiSettings(
	db: AppDrizzleDb,
	patch: Partial<Pick<UiSettings, "displayType" | "stepDisplayType">>,
): UiSettings {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const current = getUiSettings(tx);
		const nextDisplay = patch.displayType ?? current.displayType;
		const nextStepDisplay = patch.stepDisplayType ?? current.stepDisplayType;

		const existing = tx.select().from(uiSettings).where(eq(uiSettings.id, 1)).get();
		if (!existing) {
			const inserted = tx
				.insert(uiSettings)
				.values({
					id: 1,
					displayType: nextDisplay,
					stepDisplayType: nextStepDisplay,
					updatedAt: now,
				})
				.returning()
				.get();
			return {
				displayType: inserted.displayType,
				stepDisplayType: inserted.stepDisplayType,
				updatedAt: inserted.updatedAt,
			};
		}

		const updated = tx
			.update(uiSettings)
			.set({
				displayType: nextDisplay,
				stepDisplayType: nextStepDisplay,
				updatedAt: now,
			})
			.where(eq(uiSettings.id, 1))
			.returning()
			.get()!;
		return {
			displayType: updated.displayType,
			stepDisplayType: updated.stepDisplayType,
			updatedAt: updated.updatedAt,
		};
	});
}

/** Log a tool call against a session. New session creation prunes global `tool_calls` to 100 rows. */
export function recordToolCall(
	db: AppDrizzleDb,
	sessionId: string,
	toolName: string,
	status: "ok" | "error",
	summary: string,
	argsSummary?: string,
): ToolCallRecord {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		ensureSessionTx(tx, sessionId, undefined, now);
		const id = `tc-${crypto.randomUUID().slice(0, 8)}`;

		const inserted = tx
			.insert(toolCalls)
			.values({
				id,
				sessionId,
				toolName,
				status,
				summary,
				argsSummary: argsSummary ?? null,
				createdAt: now,
			})
			.returning()
			.get();

		return {
			id: inserted.id,
			sessionId: inserted.sessionId,
			toolName: inserted.toolName,
			timestamp: inserted.createdAt,
			status: inserted.status,
			summary: inserted.summary,
			argsSummary: inserted.argsSummary ?? undefined,
		};
	});
}

export interface ClearToolCallsTarget {
	sessionId?: string;
	groupId?: string;
	all?: boolean;
}

/**
 * Clear recorded tool call logs for a session, a session group, or all stored logs
 * without affecting timeline events or task artifacts.
 */
export function clearToolCalls(
	db: AppDrizzleDb,
	target: string | ClearToolCallsTarget,
): void {
	const resolved: ClearToolCallsTarget = typeof target === "string"
		? { sessionId: target }
		: target;

	db.transaction((tx) => {
		const now = new Date().toISOString();
		if (resolved.all) {
			tx.delete(toolCalls).run();
			if (resolved.sessionId) {
				tx.update(sessions)
					.set({ updatedAt: now })
					.where(eq(sessions.id, resolved.sessionId))
					.run();
			}
			return;
		}

		if (resolved.groupId) {
			const memberIds = tx
				.select({ id: sessions.id })
				.from(sessions)
				.where(eq(sessions.groupId, resolved.groupId))
				.all()
				.map(r => r.id);
			if (memberIds.length > 0) {
				tx.delete(toolCalls).where(inArray(toolCalls.sessionId, memberIds)).run();
				tx.update(sessions)
					.set({ updatedAt: now })
					.where(inArray(sessions.id, memberIds))
					.run();
			}
			return;
		}

		if (resolved.sessionId) {
			tx.delete(toolCalls).where(eq(toolCalls.sessionId, resolved.sessionId)).run();
			tx.update(sessions)
				.set({ updatedAt: now })
				.where(eq(sessions.id, resolved.sessionId))
				.run();
		}
	});
}

/** List up to {@link MAX_TOOL_CALL_LOGS} (100) newest tool calls for a session or group (strictly read-only). */
export function listToolCalls(
	db: DbExecutor,
	filter?: { sessionId?: string; groupId?: string; limit?: number },
): ToolCallRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(toolCalls.sessionId, filter.sessionId));
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
		conditions.push(inArray(toolCalls.sessionId, sessionIds));
	}

	const cappedLimit = Math.min(filter?.limit ?? MAX_TOOL_CALL_LOGS, MAX_TOOL_CALL_LOGS);
	const rows = db
		.select()
		.from(toolCalls)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(toolCalls.createdAt), desc(sql`rowid`))
		.limit(cappedLimit)
		.all();

	return rows.map(row => ({
		id: row.id,
		sessionId: row.sessionId,
		toolName: row.toolName,
		timestamp: row.createdAt,
		status: row.status,
		summary: row.summary,
		argsSummary: row.argsSummary ?? undefined,
	}));
}

/** Compute a deterministic revision hash for dashboard polling short-circuits. */
export function computeRevision(parts: unknown): string {
	return crypto
		.createHash("sha256")
		.update(JSON.stringify(parts))
		.digest("hex")
		.slice(0, 16);
}
