import { describe, expect, it } from "vitest";
import type { TimelineEvent } from "@/shared/contracts.js";
import { describeTimelineEvent, filterTimelineEvents, formatEntityTypeLabel, formatTimelineClock, formatTimelineDateKey, groupTimelineEventsByDate } from "./timelineModel.js";

function makeEvent(overrides: Partial<TimelineEvent> = {}): TimelineEvent {
	return {
		id: 1,
		sessionId: "sess-1",
		groupId: null,
		eventType: "task_created",
		actor: "agent",
		title: "Allocated Task #1",
		links: [],
		createdAt: "2026-11-26T09:15:00.000Z",
		...overrides,
	};
}

describe("describeTimelineEvent", () => {
	it("maps milestone, progress, artifact, and note event types", () => {
		expect(describeTimelineEvent(makeEvent({ eventType: "step_completed" }))).toEqual({
			label: "Step completed",
			tone: "success",
			shape: "solid",
		});
		expect(describeTimelineEvent(makeEvent({ eventType: "step_started" }))).toEqual({
			label: "Step started",
			tone: "warning",
			shape: "ring",
		});
		expect(describeTimelineEvent(makeEvent({ eventType: "plan_written" }))).toEqual({
			label: "Plan created",
			tone: "info",
			shape: "solid",
		});
		expect(describeTimelineEvent(makeEvent({ eventType: "note" }))).toEqual({
			label: "Note",
			tone: "info",
			shape: "note",
		});
	});

	it("classifies task_status_changed titles and unknown event types", () => {
		expect(
			describeTimelineEvent(makeEvent({
				eventType: "task_status_changed",
				title: "Task #1 marked done",
			})),
		).toEqual({
			label: "Task completed",
			tone: "success",
			shape: "solid",
		});
		expect(
			describeTimelineEvent(makeEvent({
				eventType: "task_status_changed",
				title: "Task #1 marked in_progress",
			})),
		).toEqual({
			label: "Task started",
			tone: "warning",
			shape: "ring",
		});
		expect(
			describeTimelineEvent(makeEvent({
				eventType: "task_status_changed",
				title: "Task #1 marked cancelled",
			})),
		).toEqual({
			label: "Status changed",
			tone: "neutral",
			shape: "ring",
		});
		expect(
			describeTimelineEvent(makeEvent({ eventType: "custom_audit_hook" })),
		).toEqual({
			label: "Custom audit hook",
			tone: "neutral",
			shape: "ring",
		});
	});
});

describe("timeline date and clock formatting", () => {
	it("formats UTC clock and date keys cleanly", () => {
		expect(formatTimelineClock("2026-11-26T09:15:42.000Z")).toBe("09:15Z");
		expect(formatTimelineDateKey("2026-11-26T09:15:42.000Z")).toEqual({
			dateKey: "2026-11-26",
			dateLabel: "Nov 26, 2026",
		});
	});

	it("handles invalid timestamps without throwing", () => {
		expect(formatTimelineClock("not-a-date")).toBe("not-a-date");
		expect(formatTimelineDateKey("not-a-date")).toEqual({
			dateKey: "unknown",
			dateLabel: "Unknown date",
		});
	});

	it("formats entity type labels", () => {
		expect(formatEntityTypeLabel("session_group")).toBe("Group");
		expect(formatEntityTypeLabel("question_set")).toBe("Questions");
		expect(formatEntityTypeLabel("task_step")).toBe("Step");
	});
});

describe("groupTimelineEventsByDate", () => {
	it("groups consecutive events by day while preserving order and input immutability", () => {
		const events = [
			makeEvent({ id: 3, createdAt: "2026-11-26T11:30:00.000Z" }),
			makeEvent({ id: 2, createdAt: "2026-11-26T09:15:00.000Z" }),
			makeEvent({ id: 1, createdAt: "2026-11-25T22:00:00.000Z" }),
		];
		const snapshot = [...events];

		const groups = groupTimelineEventsByDate(events);

		expect(events).toEqual(snapshot);
		expect(groups).toHaveLength(2);
		expect(groups[0]?.dateKey).toBe("2026-11-26");
		expect(groups[0]?.events.map(e => e.id)).toEqual([3, 2]);
		expect(groups[1]?.dateKey).toBe("2026-11-25");
		expect(groups[1]?.events.map(e => e.id)).toEqual([1]);
	});
});

describe("filterTimelineEvents", () => {
	it("filters by actor and linked entity type", () => {
		const events = [
			makeEvent({
				id: 1,
				actor: "agent",
				links: [{ entityType: "task", entityId: "1", role: "subject" }],
			}),
			makeEvent({
				id: 2,
				actor: "user",
				links: [{ entityType: "note", entityId: "9", role: "subject" }],
			}),
		];

		expect(filterTimelineEvents(events, "all", "all").map(e => e.id)).toEqual([1, 2]);
		expect(filterTimelineEvents(events, "user", "all").map(e => e.id)).toEqual([2]);
		expect(filterTimelineEvents(events, "all", "task").map(e => e.id)).toEqual([1]);
		expect(filterTimelineEvents(events, "user", "task")).toEqual([]);
	});
});
