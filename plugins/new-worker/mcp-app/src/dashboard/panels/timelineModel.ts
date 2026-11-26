import type { TimelineActor, TimelineEntityType, TimelineEvent } from "@/shared/contracts.js";

export type TimelineNodeTone = "success" | "info" | "warning" | "neutral";
export type TimelineNodeShape = "solid" | "ring" | "note";

export interface TimelineEventPresentation {
	label: string;
	tone: TimelineNodeTone;
	shape: TimelineNodeShape;
}

export interface TimelineDayGroup {
	dateKey: string;
	dateLabel: string;
	events: TimelineEvent[];
}

const EVENT_PRESENTATION_MAP: Record<string, TimelineEventPresentation> = {
	step_completed: { label: "Step completed", tone: "success", shape: "solid" },
	report_written: { label: "Report delivered", tone: "success", shape: "solid" },
	question_set_submitted: { label: "Questions answered", tone: "success", shape: "solid" },
	step_started: { label: "Step started", tone: "warning", shape: "ring" },
	question_set_created: { label: "Questions asked", tone: "warning", shape: "ring" },
	question_set_partial: { label: "Partial answers", tone: "warning", shape: "ring" },
	plan_written: { label: "Plan created", tone: "info", shape: "solid" },
	plan_updated: { label: "Plan updated", tone: "info", shape: "ring" },
	handoff_recorded: { label: "Handoff", tone: "info", shape: "solid" },
	note: { label: "Note", tone: "info", shape: "note" },
	session_created: { label: "Session started", tone: "neutral", shape: "ring" },
	group_created: { label: "Group created", tone: "neutral", shape: "ring" },
	session_group_assigned: { label: "Group updated", tone: "neutral", shape: "ring" },
	task_created: { label: "Task created", tone: "neutral", shape: "solid" },
};

const ENTITY_TYPE_LABELS: Record<TimelineEntityType, string> = {
	session: "Session",
	session_group: "Group",
	task: "Task",
	task_step: "Step",
	task_item: "Item",
	plan: "Plan",
	report: "Report",
	handoff: "Handoff",
	question_set: "Questions",
	note: "Note",
};

const UTC_DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	timeZone: "UTC",
});

/**
 * Map a raw timeline event to a human-readable kind label, semantic color tone,
 * and non-color-dependent node marker shape.
 */
export function describeTimelineEvent(event: TimelineEvent): TimelineEventPresentation {
	if (event.eventType === "task_status_changed") {
		const lowerTitle = event.title.toLowerCase();
		if (lowerTitle.includes("done")) {
			return { label: "Task completed", tone: "success", shape: "solid" };
		}
		if (lowerTitle.includes("in_progress")) {
			return { label: "Task started", tone: "warning", shape: "ring" };
		}
		return { label: "Status changed", tone: "neutral", shape: "ring" };
	}

	const mapped = EVENT_PRESENTATION_MAP[event.eventType];
	if (mapped) {
		return mapped;
	}

	const readable = event.eventType.replace(/_/g, " ").trim();
	const label = readable
		? `${readable.charAt(0).toUpperCase()}${readable.slice(1)}`
		: "Event";
	return { label, tone: "neutral", shape: "ring" };
}

/** Format a polymorphic timeline entity type into a concise display label. */
export function formatEntityTypeLabel(entityType: TimelineEntityType): string {
	return ENTITY_TYPE_LABELS[entityType];
}

/** Extract a deterministic UTC `HH:MMZ` clock string from an ISO timestamp. */
export function formatTimelineClock(iso: string): string {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) {
		return iso;
	}
	return `${parsed.toISOString().slice(11, 16)}Z`;
}

/** Derive a UTC calendar day key (`YYYY-MM-DD`) and readable date header label. */
export function formatTimelineDateKey(iso: string): { dateKey: string; dateLabel: string } {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) {
		return { dateKey: "unknown", dateLabel: "Unknown date" };
	}
	return {
		dateKey: parsed.toISOString().slice(0, 10),
		dateLabel: UTC_DAY_FORMATTER.format(parsed),
	};
}

/** Group consecutive timeline events by UTC calendar day without altering incoming order. */
export function groupTimelineEventsByDate(events: readonly TimelineEvent[]): TimelineDayGroup[] {
	const groups: TimelineDayGroup[] = [];

	for (const event of events) {
		const { dateKey, dateLabel } = formatTimelineDateKey(event.createdAt);
		const lastGroup = groups.at(-1);
		if (lastGroup && lastGroup.dateKey === dateKey) {
			lastGroup.events.push(event);
			continue;
		}
		groups.push({
			dateKey,
			dateLabel,
			events: [event],
		});
	}

	return groups;
}

/** Filter timeline events by actor and linked entity type. */
export function filterTimelineEvents(
	events: readonly TimelineEvent[],
	actorFilter: "all" | TimelineActor,
	entityFilter: "all" | TimelineEntityType,
): TimelineEvent[] {
	return events.filter((event) => {
		if (actorFilter !== "all" && event.actor !== actorFilter) {
			return false;
		}
		return entityFilter === "all" || event.links.some(link => link.entityType === entityFilter);
	});
}
