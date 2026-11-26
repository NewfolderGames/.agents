import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import type { AppDrizzleDb } from "../db/client.js";
import { sessions, timelineEvents, timelineLinks } from "../db/schema.js";
import type { TimelineActor, TimelineEntityType, TimelineEvent, TimelineLink, TimelineLinkRole } from "@/shared/contracts.js";
import { parseJsonObject } from "./json.js";

export type DbExecutor = Pick<AppDrizzleDb, "select" | "insert" | "update" | "delete">;

export interface RecordTimelineInput {
	sessionId?: string | null;
	groupId?: string | null;
	eventType: string;
	actor?: TimelineActor;
	title: string;
	summary?: string;
	metadata?: Record<string, unknown>;
	links?: Array<{
		entityType: TimelineEntityType;
		entityId: string;
		role?: TimelineLinkRole;
		label?: string;
	}>;
	createdAt?: string;
}

export interface TimelineQueryFilter {
	sessionId?: string;
	groupId?: string;
	entityType?: TimelineEntityType;
	entityId?: string;
	entityTypes?: TimelineEntityType[];
	eventTypes?: string[];
	limit?: number;
	beforeId?: number;
}

/**
 * Record a timeline event and its deduplicated polymorphic links inside an active DB
 * executor (standalone DB or synchronous transaction).
 */
export function recordTimelineEvent(db: DbExecutor, input: RecordTimelineInput): TimelineEvent {
	const createdAt = input.createdAt ?? new Date().toISOString();
	let resolvedGroupId = input.groupId ?? null;
	if (!resolvedGroupId && input.sessionId) {
		const sessionRow = db
			.select({ groupId: sessions.groupId })
			.from(sessions)
			.where(eq(sessions.id, input.sessionId))
			.get();
		resolvedGroupId = sessionRow?.groupId ?? null;
	}

	const inserted = db
		.insert(timelineEvents)
		.values({
			sessionId: input.sessionId ?? null,
			groupId: resolvedGroupId,
			eventType: input.eventType,
			actor: input.actor ?? "agent",
			title: input.title,
			summary: input.summary ?? null,
			metadataJson: input.metadata ? JSON.stringify(input.metadata) : null,
			createdAt,
		})
		.returning()
		.get();

	const dedupedLinks = new Map<string, TimelineLink>();
	for (const rawLink of input.links ?? []) {
		const role: TimelineLinkRole = rawLink.role ?? "subject";
		const key = `${rawLink.entityType}:${rawLink.entityId}:${role}`;
		if (!dedupedLinks.has(key)) {
			dedupedLinks.set(key, {
				entityType: rawLink.entityType,
				entityId: rawLink.entityId,
				role,
				label: rawLink.label,
			});
		}
	}

	const storedLinks: TimelineLink[] = [];
	if (dedupedLinks.size > 0) {
		const values = Array.from(dedupedLinks.values()).map(link => ({
			eventId: inserted.id,
			entityType: link.entityType,
			entityId: link.entityId,
			role: link.role,
			label: link.label ?? null,
		}));
		const rows = db.insert(timelineLinks).values(values).returning().all();
		for (const row of rows) {
			storedLinks.push({
				id: row.id,
				entityType: row.entityType,
				entityId: row.entityId,
				role: row.role,
				label: row.label ?? undefined,
			});
		}
	}

	return {
		id: inserted.id,
		sessionId: inserted.sessionId,
		groupId: inserted.groupId,
		eventType: inserted.eventType,
		actor: inserted.actor,
		title: inserted.title,
		summary: inserted.summary ?? undefined,
		metadata: input.metadata,
		links: storedLinks,
		createdAt: inserted.createdAt,
	};
}

/** Query timeline events with polymorphic entity/group/session filters and cursor pagination. */
export function queryTimelineEvents(
	db: DbExecutor,
	filter: TimelineQueryFilter = {},
): TimelineEvent[] {
	const conditions: SQL[] = [];

	if (filter.sessionId) {
		conditions.push(eq(timelineEvents.sessionId, filter.sessionId));
	}
	if (filter.groupId) {
		const groupSessionIds = db
			.select({ id: sessions.id })
			.from(sessions)
			.where(eq(sessions.groupId, filter.groupId))
			.all()
			.map(row => row.id);
		if (groupSessionIds.length > 0) {
			conditions.push(
				or(
					eq(timelineEvents.groupId, filter.groupId),
					inArray(timelineEvents.sessionId, groupSessionIds),
				)!,
			);
		}
		else {
			conditions.push(eq(timelineEvents.groupId, filter.groupId));
		}
	}
	if (filter.eventTypes && filter.eventTypes.length > 0) {
		conditions.push(inArray(timelineEvents.eventType, filter.eventTypes));
	}
	if (filter.beforeId !== undefined) {
		conditions.push(lt(timelineEvents.id, filter.beforeId));
	}

	if (filter.entityType && filter.entityId) {
		const matchedIds = db
			.select({ eventId: timelineLinks.eventId })
			.from(timelineLinks)
			.where(
				and(
					eq(timelineLinks.entityType, filter.entityType),
					eq(timelineLinks.entityId, filter.entityId),
				),
			)
			.all()
			.map(r => r.eventId);
		if (matchedIds.length === 0) {
			return [];
		}
		conditions.push(inArray(timelineEvents.id, matchedIds));
	}
	else if (filter.entityTypes && filter.entityTypes.length > 0) {
		const matchedIds = db
			.select({ eventId: timelineLinks.eventId })
			.from(timelineLinks)
			.where(inArray(timelineLinks.entityType, filter.entityTypes))
			.all()
			.map(r => r.eventId);
		if (matchedIds.length === 0) {
			return [];
		}
		conditions.push(inArray(timelineEvents.id, matchedIds));
	}
	else if (filter.entityType) {
		const matchedIds = db
			.select({ eventId: timelineLinks.eventId })
			.from(timelineLinks)
			.where(eq(timelineLinks.entityType, filter.entityType))
			.all()
			.map(r => r.eventId);
		if (matchedIds.length === 0) {
			return [];
		}
		conditions.push(inArray(timelineEvents.id, matchedIds));
	}

	const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
	const rows = db
		.select()
		.from(timelineEvents)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(timelineEvents.id))
		.limit(limit)
		.all();

	if (rows.length === 0) {
		return [];
	}

	const eventIds = rows.map(r => r.id);
	const linkRows = db
		.select()
		.from(timelineLinks)
		.where(inArray(timelineLinks.eventId, eventIds))
		.all();

	const linksByEvent = new Map<number, TimelineLink[]>();
	for (const linkRow of linkRows) {
		const bucket = linksByEvent.get(linkRow.eventId) ?? [];
		bucket.push({
			id: linkRow.id,
			entityType: linkRow.entityType,
			entityId: linkRow.entityId,
			role: linkRow.role,
			label: linkRow.label ?? undefined,
		});
		linksByEvent.set(linkRow.eventId, bucket);
	}

	return rows.map(row => ({
		id: row.id,
		sessionId: row.sessionId,
		groupId: row.groupId,
		eventType: row.eventType,
		actor: row.actor,
		title: row.title,
		summary: row.summary ?? undefined,
		metadata: parseJsonObject(row.metadataJson),
		links: linksByEvent.get(row.id) ?? [],
		createdAt: row.createdAt,
	}));
}
