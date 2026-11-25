import { describe, expect, it } from "vitest";
import { filterFollowUpsByPriority, priorityTone } from "@/components/prefabs/FollowUpTable.util.js";
import { filterFindingsBySeverity, severityTone } from "@/components/prefabs/ReportFindingList.util.js";
import { countStepProgress, countTaskProgress, getStepPendingQuestions, resolveActiveStepIndex } from "@/components/prefabs/TaskStepList.util.js";
import { selectActivePlan } from "@/components/views/PlanView.util.js";
import { getHighestPolicyBadge, groupQuestionsBySection, sortOpenQuestionSets, validateQuestionSetAnswers } from "@/components/views/QuestionsView.util.js";
import { selectActiveReport } from "@/components/views/ReportView.util.js";
import { partitionTasks } from "@/components/views/TasksView.util.js";
import { formatDuration } from "./format.js";
import { migrateSessionData, migrateSessionIndex, migrateUiSettings } from "./migrations.js";
import { DEFAULT_UI_SETTINGS, type PlanRecord, type QuestionSetRecord, type ReportRecord, resolveQuestionPolicy, resolveWidgetDisplayMode, type TaskRecord } from "./schema.js";

describe("component utility modules", () => {
	it("computes task progress, active step index, step pending questions, and partitions", () => {
		const activeTask: TaskRecord = {
			taskNumber: "02",
			slug: "active",
			title: "Active",
			status: "in_progress",
			summary: "Active task",
			updatedAt: "2026-11-25T00:00:00.000Z",
			steps: [
				{
					title: "Step 1",
					outcome: "Done",
					items: [
						{ id: "1", text: "One", status: "done" },
						{ id: "2", text: "Two", status: "in_progress" },
					],
				},
				{
					title: "Step 2",
					outcome: "Next",
					items: [{ id: "3", text: "Three", status: "pending" }],
				},
			],
		};
		const doneTask: TaskRecord = { ...activeTask, taskNumber: "01", status: "done" };

		expect(countStepProgress(activeTask.steps[0]!)).toEqual({ done: 1, total: 2 });
		expect(countTaskProgress(activeTask)).toEqual({ done: 1, total: 3 });
		expect(resolveActiveStepIndex(activeTask)).toBe(0);
		expect(resolveActiveStepIndex(activeTask, 1)).toBe(1);
		expect(partitionTasks([activeTask, doneTask])).toEqual({
			activeTasks: [activeTask],
			collapsedTasks: [doneTask],
		});

		const sets: QuestionSetRecord[] = [
			{
				id: "qs-step",
				title: "Step Q",
				submitLabel: "Submit",
				blockingMode: "anytime",
				sections: [],
				questions: [
					{
						id: "q-s1",
						prompt: "Check",
						contextRefs: [],
						kind: "boolean",
						required: true,
						allowOther: false,
						blockingMode: "before_step_finish",
						taskNumber: "02",
						stepNumber: 1,
					},
				],
				status: "pending",
				answeredQuestionIds: [],
				answers: {},
				otherTexts: {},
				createdAt: "2026-11-25T00:00:00.000Z",
			},
		];
		expect(getStepPendingQuestions(sets, "02", 1)).toBe(1);
		expect(getStepPendingQuestions(sets, "02", 2)).toBe(0);
	});

	it("handles plan and report selection", () => {
		const plans = [
			{ taskNumber: "01" } as PlanRecord,
			{ taskNumber: "02" } as PlanRecord,
		];
		expect(selectActivePlan(plans, "01")?.taskNumber).toBe("01");
		expect(selectActivePlan(plans)?.taskNumber).toBe("02");

		const reports = [
			{ taskNumber: "01" } as ReportRecord,
			{ taskNumber: "03" } as ReportRecord,
		];
		expect(selectActiveReport(reports, "01")?.taskNumber).toBe("01");
		expect(selectActiveReport(reports)?.taskNumber).toBe("03");
	});

	it("filters audit findings and follow-ups accurately", () => {
		const findings = [
			{
				id: "C1",
				severity: "critical" as const,
				title: "Crit",
				location: "a.ts",
				detail: "d",
			},
			{ id: "L1", severity: "low" as const, title: "Low", location: "b.ts", detail: "d" },
		];
		expect(filterFindingsBySeverity(findings, "all")).toHaveLength(2);
		expect(filterFindingsBySeverity(findings, "critical")).toHaveLength(1);
		expect(severityTone("critical")).toBe("danger");

		const followUps = [
			{ id: "F1", priority: "MUST" as const, location: "a.ts", action: "fix" },
			{ id: "F2", priority: "COULD" as const, location: "b.ts", action: "tidy" },
		];
		expect(filterFollowUpsByPriority(followUps, "MUST")).toHaveLength(1);
		expect(priorityTone("MUST")).toBe("danger");
	});

	it("groups questions, sorts open sets by urgency, resolves policies, and validates answers", () => {
		const anytimeSet: QuestionSetRecord = {
			id: "qs-any",
			title: "Anytime",
			submitLabel: "Submit",
			blockingMode: "anytime",
			sections: [],
			questions: [
				{
					id: "qa",
					prompt: "Later",
					contextRefs: [],
					kind: "text",
					required: false,
					allowOther: false,
				},
			],
			status: "pending",
			answeredQuestionIds: [],
			answers: {},
			otherTexts: {},
			createdAt: "2026-11-25T02:00:00.000Z",
		};

		const qs: QuestionSetRecord = {
			id: "qs-1",
			title: "Test",
			submitLabel: "Submit",
			blockingMode: "immediate",
			sections: [{ id: "s1", title: "Section 1" }],
			questions: [
				{
					id: "q1",
					sectionId: "s1",
					prompt: "Pick many",
					contextRefs: [],
					kind: "multi_select",
					required: true,
					allowOther: true,
					options: [{ value: "a", label: "A" }],
				},
				{
					id: "q2",
					prompt: "Optional",
					contextRefs: [],
					kind: "text",
					required: false,
					allowOther: false,
					blockingMode: "anytime",
				},
			],
			status: "pending",
			answeredQuestionIds: [],
			answers: {},
			otherTexts: {},
			createdAt: "2026-11-25T00:00:00.000Z",
		};

		expect(resolveQuestionPolicy(qs, qs.questions[0]!).blockingMode).toBe("immediate");
		expect(resolveQuestionPolicy(qs, qs.questions[1]!).blockingMode).toBe("anytime");
		expect(getHighestPolicyBadge(qs).mode).toBe("immediate");
		expect(sortOpenQuestionSets([anytimeSet, qs]).map(s => s.id)).toEqual(["qs-1", "qs-any"]);

		const groups = groupQuestionsBySection(qs);
		expect(groups).toHaveLength(2);
		expect(validateQuestionSetAnswers(qs, {}, {})).toEqual(["q1"]);
		expect(validateQuestionSetAnswers(qs, { q1: ["__other__"] }, { q1: "  " })).toEqual([
			"q1",
		]);
		expect(
			validateQuestionSetAnswers(qs, { q1: ["__other__"] }, { q1: "Custom" }),
		).toEqual([]);
	});

	it("migrates legacy v0 session and index payloads cleanly", () => {
		const migratedSession = migrateSessionData({
			sessionId: "old-1",
			createdAt: "2026-11-24T00:00:00.000Z",
			updatedAt: "2026-11-24T00:00:00.000Z",
		});
		expect(migratedSession.schemaVersion).toBe(1);
		expect(migratedSession.tasks).toEqual([]);

		const migratedIndex = migrateSessionIndex([
			{
				sessionId: "old-1",
				updatedAt: "2026-11-24T00:00:00.000Z",
				taskCount: 0,
				pendingQuestionCount: 0,
			},
		]);
		expect(migratedIndex).toHaveLength(1);
		expect(() => migrateSessionIndex({ schemaVersion: 99, sessions: [] })).toThrow();

		const migratedSettings = migrateUiSettings({});
		expect(migratedSettings).toEqual(DEFAULT_UI_SETTINGS);
		expect(() => migrateUiSettings({ schemaVersion: 99 })).toThrow();
	});

	it("resolves widget display modes and formats task durations", () => {
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "minimized",
			stepDisplayType: "inherit",
		}, "widget")).toBe("minimized");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "minimized",
			stepDisplayType: "inherit",
		}, "step")).toBe("minimized");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "compact",
			stepDisplayType: "inherit",
		}, "widget")).toBe("compact");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "minimized",
			stepDisplayType: "compact",
		}, "step")).toBe("compact");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "minimized",
			stepDisplayType: "full",
		}, "step")).toBe("full");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "full",
			stepDisplayType: "minimized",
		}, "widget")).toBe("full");
		expect(resolveWidgetDisplayMode({
			schemaVersion: 1,
			displayType: "full",
			stepDisplayType: "minimized",
		}, "step")).toBe("minimized");

		expect(formatDuration(undefined)).toBeNull();
		expect(formatDuration("2026-11-25T00:00:00.000Z", "2026-11-25T00:00:00.400Z")).toBe("<1s");
		expect(formatDuration("2026-11-25T00:00:00.000Z", "2026-11-25T00:00:42.000Z")).toBe("42s");
		expect(formatDuration("2026-11-25T00:00:00.000Z", "2026-11-25T00:02:05.000Z")).toBe("2m 05s");
		expect(formatDuration("2026-11-25T00:00:00.000Z", "2026-11-25T01:05:00.000Z")).toBe("1h 05m");
	});
});
