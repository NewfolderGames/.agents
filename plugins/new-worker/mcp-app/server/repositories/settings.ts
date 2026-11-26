import crypto from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { AppDrizzleDb } from "../db/client.js";
import { sessions, toolCalls, uiSettings } from "../db/schema.js";
import { DEFAULT_UI_SETTINGS, type ToolCallRecord, type UiSettings } from "@/shared/contracts.js";
import { ensureSessionTx } from "./sessions.js";
import type { DbExecutor } from "./timeline.js";

const MAX_TOOL_CALLS_PER_SESSION = 200;

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

/** Log a tool call against a session, keeping at most the latest 200 entries per session. */
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

		const overflowIds = tx
			.select({ id: toolCalls.id })
			.from(toolCalls)
			.where(eq(toolCalls.sessionId, sessionId))
			.orderBy(desc(toolCalls.createdAt))
			.limit(1000)
			.offset(MAX_TOOL_CALLS_PER_SESSION)
			.all()
			.map(row => row.id);

		if (overflowIds.length > 0) {
			tx.delete(toolCalls).where(inArray(toolCalls.id, overflowIds)).run();
		}

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

/** Clear recorded tool calls for a session without affecting timeline or artifacts. */
export function clearToolCalls(db: AppDrizzleDb, sessionId: string): void {
	db.transaction((tx) => {
		tx.delete(toolCalls).where(eq(toolCalls.sessionId, sessionId)).run();
		tx.update(sessions)
			.set({ updatedAt: new Date().toISOString() })
			.where(eq(sessions.id, sessionId))
			.run();
	});
}

/** List tool calls for a session or group (strictly read-only). */
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

	const rows = db
		.select()
		.from(toolCalls)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(toolCalls.createdAt))
		.limit(filter?.limit ?? 200)
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
