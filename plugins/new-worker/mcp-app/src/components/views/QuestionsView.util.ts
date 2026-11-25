import { formatBlockingModeLabel } from "@/shared/format.js";
import { type QuestionAnswerValue, type QuestionBlockingMode, type QuestionItem, type QuestionSection, type QuestionSetRecord, resolveQuestionPolicy } from "@/shared/schema.js";

export interface QuestionGroup {
	section: QuestionSection | null;
	questions: QuestionItem[];
}

export interface PolicyBadgeInfo {
	label: string;
	tone: "danger" | "warning" | "neutral";
	mode: QuestionBlockingMode;
}

export function groupQuestionsBySection(questionSet: QuestionSetRecord): QuestionGroup[] {
	if (questionSet.sections.length === 0) {
		return [{ section: null, questions: questionSet.questions }];
	}
	const groups: QuestionGroup[] = questionSet.sections.map(section => ({
		section,
		questions: questionSet.questions.filter(q => q.sectionId === section.id),
	}));
	const knownIds = new Set(questionSet.sections.map(s => s.id));
	const ungrouped = questionSet.questions.filter(
		q => !q.sectionId || !knownIds.has(q.sectionId),
	);
	if (ungrouped.length > 0) {
		groups.push({ section: null, questions: ungrouped });
	}
	return groups.filter(g => g.questions.length > 0);
}

export function isQuestionAnswered(
	question: QuestionItem,
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

export function validateQuestionsSubset(
	questions: QuestionItem[],
	answers: Record<string, QuestionAnswerValue>,
	otherTexts: Record<string, string>,
): string[] {
	const invalidIds: string[] = [];
	for (const q of questions) {
		if (q.required && !isQuestionAnswered(q, answers[q.id], otherTexts[q.id])) {
			invalidIds.push(q.id);
		}
	}
	return invalidIds;
}

export function validateQuestionSetAnswers(
	questionSet: QuestionSetRecord,
	answers: Record<string, QuestionAnswerValue>,
	otherTexts: Record<string, string>,
): string[] {
	return validateQuestionsSubset(questionSet.questions, answers, otherTexts);
}

export function policyTone(mode: QuestionBlockingMode): "danger" | "warning" | "neutral" {
	switch (mode) {
		case "immediate":
			return "danger";
		case "before_step_finish":
			return "warning";
		case "anytime":
			return "neutral";
	}
}

export function getQuestionSetUrgencyRank(questionSet: QuestionSetRecord): number {
	const answered = new Set(questionSet.answeredQuestionIds);
	const remaining = questionSet.questions.filter(q => !answered.has(q.id));
	const source = remaining.length > 0 ? remaining : questionSet.questions;

	let best = 2;
	for (const q of source) {
		const mode = resolveQuestionPolicy(questionSet, q).blockingMode;
		if (mode === "immediate") {
			return 0;
		}
		if (mode === "before_step_finish") {
			best = 1;
		}
	}
	return best;
}

export function sortOpenQuestionSets(sets: QuestionSetRecord[]): QuestionSetRecord[] {
	return [...sets].sort((a, b) => {
		const rankDiff = getQuestionSetUrgencyRank(a) - getQuestionSetUrgencyRank(b);
		if (rankDiff !== 0) {
			return rankDiff;
		}
		return b.createdAt.localeCompare(a.createdAt);
	});
}

export function getHighestPolicyBadge(questionSet: QuestionSetRecord): PolicyBadgeInfo {
	const answered = new Set(questionSet.answeredQuestionIds);
	const remaining = questionSet.questions.filter(q => !answered.has(q.id));
	const source = remaining.length > 0 ? remaining : questionSet.questions;

	const firstImmediate = source.find(
		q => resolveQuestionPolicy(questionSet, q).blockingMode === "immediate",
	);
	if (firstImmediate) {
		const p = resolveQuestionPolicy(questionSet, firstImmediate);
		return {
			mode: "immediate",
			label: formatBlockingModeLabel(p.blockingMode, p.taskNumber, p.stepNumber),
			tone: "danger",
		};
	}

	const firstStep = source.find(
		q => resolveQuestionPolicy(questionSet, q).blockingMode === "before_step_finish",
	);
	if (firstStep) {
		const p = resolveQuestionPolicy(questionSet, firstStep);
		return {
			mode: "before_step_finish",
			label: formatBlockingModeLabel(p.blockingMode, p.taskNumber, p.stepNumber),
			tone: "warning",
		};
	}

	return {
		mode: "anytime",
		label: formatBlockingModeLabel("anytime"),
		tone: "neutral",
	};
}
