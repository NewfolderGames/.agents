import crypto from "node:crypto";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import type { AppDrizzleDb } from "../db/client.js";
import { questions, questionSets, sessions, tasks } from "../db/schema.js";
import { FileRefSchema, type QuestionAnswerValue, QuestionAnswerValueSchema, type QuestionBlockingMode, type QuestionItem, QuestionOptionSchema, type QuestionSection, QuestionSectionSchema, type QuestionSetRecord, type ResolvedQuestionPolicy, resolveQuestionPolicy } from "@/shared/contracts.js";
import { formatBlockingModeLabel, formatTaskId } from "@/shared/format.js";
import { NotFoundError, QuestionBlockerError, ValidationError } from "./errors.js";
import { parseJsonWithSchema } from "./json.js";
import { ensureSessionTx, type SessionMetaInput } from "./sessions.js";
import { type DbExecutor, recordTimelineEvent } from "./timeline.js";

const ContextRefsArraySchema = z.array(FileRefSchema);
const QuestionOptionsArraySchema = z.array(QuestionOptionSchema);
const QuestionSectionsArraySchema = z.array(QuestionSectionSchema);

export type QuestionSubmitScope = "all" | "immediate" | "before_step_finish" | "answered";

export interface SubmitQuestionOptions {
	scope?: QuestionSubmitScope;
	questionIds?: string[];
}

export interface UnresolvedQuestionEntry {
	questionSet: QuestionSetRecord;
	question: QuestionItem;
	policy: ResolvedQuestionPolicy;
}

export interface CreateQuestionSetInput {
	id?: string;
	title: string;
	description?: string;
	submitLabel?: string;
	blockingMode?: QuestionBlockingMode;
	taskId?: number;
	stepNumber?: number;
	sections?: QuestionSection[];
	questions: QuestionItem[];
}

function loadEditableQuestionSetTx(
	tx: DbExecutor,
	sessionId: string,
	questionSetId: string,
): {
	setRow: typeof questionSets.$inferSelect;
	qRows: Array<typeof questions.$inferSelect>;
} {
	const setRow = tx
		.select()
		.from(questionSets)
		.where(and(eq(questionSets.id, questionSetId), eq(questionSets.sessionId, sessionId)))
		.get();
	if (!setRow) {
		throw new NotFoundError("QuestionSet", questionSetId);
	}
	if (setRow.status === "submitted") {
		throw new ValidationError("Question set has already been submitted.");
	}

	const qRows = tx
		.select()
		.from(questions)
		.where(eq(questions.questionSetId, questionSetId))
		.orderBy(asc(questions.position))
		.all();
	return { setRow, qRows };
}

/**
 * Determine whether a question holds a meaningful user response (treating empty arrays
 * and whitespace-only `"other"` fallback strings as unanswered).
 *
 * @param question - Question schema definition specifying `kind` and options.
 * @param value - Current answer payload stored for the question.
 * @param otherText - Free-text companion input when the `"__other__"` sentinel is selected.
 * @returns `true` when the answer satisfies completion rules.
 */
export function isNonEmptyAnswer(
	question: QuestionItem,
	value: QuestionAnswerValue | undefined,
	otherText?: string,
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
		if (value.includes("__other__") && question.required) {
			return Boolean(otherText?.trim()) || value.some(v => v !== "__other__");
		}
		return true;
	}
	const trimmed = value.trim();
	if (!trimmed) {
		return false;
	}
	if (trimmed === "__other__") {
		return Boolean(otherText?.trim());
	}
	return true;
}

function mapQuestionSets(
	setRows: Array<typeof questionSets.$inferSelect>,
	questionRows: Array<typeof questions.$inferSelect>,
): QuestionSetRecord[] {
	const itemsBySet = new Map<string, Array<typeof questions.$inferSelect>>();
	for (const qRow of questionRows) {
		const bucket = itemsBySet.get(qRow.questionSetId) ?? [];
		bucket.push(qRow);
		itemsBySet.set(qRow.questionSetId, bucket);
	}

	return setRows.map((setRow) => {
		const rows = (itemsBySet.get(setRow.id) ?? []).sort((a, b) => a.position - b.position);
		const answers: Record<string, QuestionAnswerValue> = {};
		const otherTexts: Record<string, string> = {};
		const answeredQuestionIds: string[] = [];

		const items: QuestionItem[] = rows.map((qRow) => {
			if (qRow.answerJson !== null) {
				const parsedAnswer = parseJsonWithSchema(qRow.answerJson, QuestionAnswerValueSchema, undefined);
				if (parsedAnswer !== undefined) {
					answers[qRow.questionKey] = parsedAnswer;
				}
			}
			if (qRow.otherText !== null) {
				otherTexts[qRow.questionKey] = qRow.otherText;
			}
			if (qRow.isSubmitted) {
				answeredQuestionIds.push(qRow.questionKey);
			}

			return {
				id: qRow.questionKey,
				sectionId: qRow.sectionId ?? undefined,
				prompt: qRow.prompt,
				hint: qRow.hint ?? undefined,
				contextRefs: parseJsonWithSchema(qRow.contextRefsJson, ContextRefsArraySchema, []),
				kind: qRow.kind,
				required: qRow.required,
				options: qRow.optionsJson
					? parseJsonWithSchema(qRow.optionsJson, QuestionOptionsArraySchema, [])
					: undefined,
				allowOther: qRow.allowOther,
				placeholder: qRow.placeholder ?? undefined,
				defaultValue: qRow.defaultValueJson
					? parseJsonWithSchema(qRow.defaultValueJson, QuestionAnswerValueSchema, undefined)
					: undefined,
				blockingMode: qRow.blockingMode ?? undefined,
				taskId: qRow.taskId ?? undefined,
				stepNumber: qRow.stepNumber ?? undefined,
			};
		});

		return {
			id: setRow.id,
			sessionId: setRow.sessionId,
			title: setRow.title,
			description: setRow.description ?? undefined,
			submitLabel: setRow.submitLabel,
			blockingMode: setRow.blockingMode,
			taskId: setRow.taskId ?? undefined,
			stepNumber: setRow.stepNumber ?? undefined,
			sections: parseJsonWithSchema(setRow.sectionsJson, QuestionSectionsArraySchema, []),
			questions: items,
			status: setRow.status,
			answeredQuestionIds,
			answers,
			otherTexts,
			createdAt: setRow.createdAt,
			submittedAt: setRow.submittedAt ?? undefined,
		};
	});
}

/** Read question sets for a session or group (strictly read-only). */
export function listQuestionSets(
	db: DbExecutor,
	filter?: {
		sessionId?: string;
		groupId?: string;
		taskId?: number;
		status?: "pending" | "partial" | "submitted";
	},
): QuestionSetRecord[] {
	const conditions = [];
	if (filter?.sessionId) {
		conditions.push(eq(questionSets.sessionId, filter.sessionId));
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
		conditions.push(inArray(questionSets.sessionId, sessionIds));
	}
	if (filter?.taskId !== undefined) {
		conditions.push(eq(questionSets.taskId, filter.taskId));
	}
	if (filter?.status) {
		conditions.push(eq(questionSets.status, filter.status));
	}

	const setRows = db
		.select()
		.from(questionSets)
		.where(conditions.length > 0 ? and(...conditions) : undefined)
		.orderBy(desc(questionSets.createdAt))
		.all();
	if (setRows.length === 0) {
		return [];
	}

	const setIds = setRows.map(s => s.id);
	const qRows = db
		.select()
		.from(questions)
		.where(inArray(questions.questionSetId, setIds))
		.orderBy(asc(questions.position))
		.all();

	return mapQuestionSets(setRows, qRows);
}

/** Return unresolved questions across the provided question sets. */
export function getUnresolvedQuestions(questionSetList: QuestionSetRecord[]): UnresolvedQuestionEntry[] {
	const unresolved: UnresolvedQuestionEntry[] = [];
	for (const qs of questionSetList) {
		if (qs.status === "submitted") {
			continue;
		}
		const answeredSet = new Set(qs.answeredQuestionIds);
		for (const q of qs.questions) {
			if (!answeredSet.has(q.id)) {
				unresolved.push({
					questionSet: qs,
					question: q,
					policy: resolveQuestionPolicy(qs, q),
				});
			}
		}
	}
	return unresolved;
}

/** Guard against task mutations while any `immediate` question remains unanswered. */
export function assertNoImmediateQuestionBlocker(
	db: DbExecutor,
	sessionId: string,
	taskId?: number,
): void {
	const sets = listQuestionSets(db, { sessionId });
	const blocking = getUnresolvedQuestions(sets).filter(entry =>
		entry.policy.blockingMode === "immediate"
		&& (entry.policy.taskId === undefined || taskId === undefined || entry.policy.taskId === taskId));
	if (blocking.length === 0) {
		return;
	}
	const ids = blocking.map(b => b.question.id);
	throw new QuestionBlockerError(
		"immediate",
		ids,
		`Blocked by unresolved immediate question(s): ${ids.join(", ")}. Read answers or wait for user submission before mutating tasks.`,
	);
}

/** Guard against finishing a task step while a `before_step_finish` question targets that step. */
export function assertStepQuestionsSatisfied(
	db: DbExecutor,
	sessionId: string,
	taskId: number,
	stepNumber: number,
): void {
	const sets = listQuestionSets(db, { sessionId });
	const blocking = getUnresolvedQuestions(sets).filter((entry) => {
		if (entry.policy.blockingMode !== "before_step_finish") {
			return false;
		}
		const matchesTask = entry.policy.taskId === undefined || entry.policy.taskId === taskId;
		const matchesStep = entry.policy.stepNumber === undefined || entry.policy.stepNumber === stepNumber;
		return matchesTask && matchesStep;
	});
	if (blocking.length === 0) {
		return;
	}
	const ids = blocking.map(b => b.question.id);
	throw new QuestionBlockerError(
		"before_step_finish",
		ids,
		`Cannot finish Task ${formatTaskId(taskId)} Step ${stepNumber} while deferred question(s) remain unanswered: ${ids.join(", ")}.`,
	);
}

/** Create or replace a question round (`ask_questions`). */
export function createQuestionSet(
	db: AppDrizzleDb,
	sessionId: string,
	input: CreateQuestionSetInput,
	meta?: SessionMetaInput,
): { sessionId: string; questionSet: QuestionSetRecord } {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const session = ensureSessionTx(tx, sessionId, meta, now);
		const setId = input.id?.trim() || `q-${crypto.randomUUID().slice(0, 8)}`;

		if (input.taskId !== undefined) {
			const taskExists = tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.id, input.taskId)).get();
			if (!taskExists) {
				throw new NotFoundError("Task", input.taskId);
			}
		}

		const existing = tx.select().from(questionSets).where(eq(questionSets.id, setId)).get();
		if (existing) {
			tx.delete(questionSets).where(eq(questionSets.id, setId)).run();
		}

		const defaultAnswers: Record<string, QuestionAnswerValue> = {};
		for (const q of input.questions) {
			if (q.defaultValue !== undefined) {
				defaultAnswers[q.id] = q.defaultValue;
			}
		}

		const insertedSet = tx
			.insert(questionSets)
			.values({
				id: setId,
				sessionId,
				taskId: input.taskId ?? null,
				stepNumber: input.stepNumber ?? null,
				title: input.title,
				description: input.description ?? null,
				submitLabel: input.submitLabel ?? "Submit Answers",
				blockingMode: input.blockingMode ?? "immediate",
				sectionsJson: JSON.stringify(input.sections ?? []),
				status: "pending",
				createdAt: now,
			})
			.returning()
			.get();

		const insertedQuestions = input.questions.map((q, position) =>
			tx
				.insert(questions)
				.values({
					questionSetId: setId,
					questionKey: q.id,
					position,
					sectionId: q.sectionId ?? null,
					prompt: q.prompt,
					hint: q.hint ?? null,
					contextRefsJson: JSON.stringify(q.contextRefs ?? []),
					kind: q.kind,
					required: q.required ?? true,
					optionsJson: q.options ? JSON.stringify(q.options) : null,
					allowOther: q.allowOther ?? false,
					placeholder: q.placeholder ?? null,
					defaultValueJson:
						defaultAnswers[q.id] !== undefined ? JSON.stringify(defaultAnswers[q.id]) : null,
					blockingMode: q.blockingMode ?? null,
					taskId: q.taskId ?? null,
					stepNumber: q.stepNumber ?? null,
					answerJson:
						defaultAnswers[q.id] !== undefined ? JSON.stringify(defaultAnswers[q.id]) : null,
					isSubmitted: false,
				})
				.returning()
				.get());

		const [questionSet] = mapQuestionSets([insertedSet], insertedQuestions);
		if (!questionSet) {
			throw new ValidationError("Failed to materialize created question set.");
		}

		const links: Array<{
			entityType: "question_set" | "session" | "task";
			entityId: string;
			role: "subject" | "parent" | "related";
			label?: string;
		}> = [
			{ entityType: "question_set", entityId: setId, role: "subject", label: input.title },
			{
				entityType: "session",
				entityId: sessionId,
				role: "parent",
				label: session.title ?? sessionId,
			},
		];
		if (input.taskId !== undefined) {
			links.push({
				entityType: "task",
				entityId: String(input.taskId),
				role: "related",
				label: `Task ${formatTaskId(input.taskId)}`,
			});
		}

		recordTimelineEvent(tx, {
			sessionId,
			groupId: session.groupId,
			eventType: "question_set_created",
			actor: "agent",
			title: `Asked questions: ${input.title}`,
			summary: `${input.questions.length} question(s) (${formatBlockingModeLabel(questionSet.blockingMode, questionSet.taskId, questionSet.stepNumber)})`,
			links,
			createdAt: now,
		});

		return { sessionId, questionSet };
	});
}

/** Save partial form draft answers without finalizing submission. */
export function saveQuestionDraft(
	db: AppDrizzleDb,
	sessionId: string,
	questionSetId: string,
	answers: Record<string, QuestionAnswerValue>,
	otherTexts: Record<string, string>,
): QuestionSetRecord {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const { setRow, qRows } = loadEditableQuestionSetTx(tx, sessionId, questionSetId);

		for (const qRow of qRows) {
			const hasAnswer = Object.prototype.hasOwnProperty.call(answers, qRow.questionKey);
			const hasOther = Object.prototype.hasOwnProperty.call(otherTexts, qRow.questionKey);
			if (!hasAnswer && !hasOther) {
				continue;
			}
			tx.update(questions)
				.set({
					answerJson: hasAnswer ? JSON.stringify(answers[qRow.questionKey]) : qRow.answerJson,
					otherText: hasOther ? (otherTexts[qRow.questionKey] ?? null) : qRow.otherText,
				})
				.where(eq(questions.pk, qRow.pk))
				.run();
		}

		tx.update(sessions).set({ updatedAt: now }).where(eq(sessions.id, sessionId)).run();

		const refreshedRows = tx
			.select()
			.from(questions)
			.where(eq(questions.questionSetId, questionSetId))
			.orderBy(asc(questions.position))
			.all();
		return mapQuestionSets([setRow], refreshedRows)[0]!;
	});
}

/** Submit all or a scoped subset of question answers and update question set status. */
export function submitQuestionAnswers(
	db: AppDrizzleDb,
	sessionId: string,
	questionSetId: string,
	answers: Record<string, QuestionAnswerValue>,
	otherTexts: Record<string, string>,
	options: SubmitQuestionOptions = {},
): { questionSet: QuestionSetRecord; submittedQuestionIds: string[] } {
	return db.transaction((tx) => {
		const now = new Date().toISOString();
		const { setRow, qRows } = loadEditableQuestionSetTx(tx, sessionId, questionSetId);
		const [currentSet] = mapQuestionSets([setRow], qRows);
		if (!currentSet) {
			throw new NotFoundError("QuestionSet", questionSetId);
		}

		const mergedAnswers: Record<string, QuestionAnswerValue> = {
			...currentSet.answers,
			...answers,
		};
		const mergedOther: Record<string, string> = {
			...currentSet.otherTexts,
			...otherTexts,
		};

		const scope = options.scope ?? "all";
		const explicitSet = options.questionIds ? new Set(options.questionIds) : null;
		const existingAnswered = new Set(currentSet.answeredQuestionIds);

		const targetIds = currentSet.questions
			.filter((q) => {
				if (explicitSet && !explicitSet.has(q.id)) {
					return false;
				}
				const policy = resolveQuestionPolicy(currentSet, q);
				if (scope === "immediate") {
					return policy.blockingMode === "immediate";
				}
				if (scope === "before_step_finish") {
					return policy.blockingMode === "before_step_finish";
				}
				if (scope === "answered") {
					return isNonEmptyAnswer(q, mergedAnswers[q.id], mergedOther[q.id]);
				}
				return true;
			})
			.map(q => q.id);

		if (targetIds.length === 0) {
			throw new ValidationError("No matching questions found for this submission.");
		}

		for (const q of currentSet.questions) {
			if (!targetIds.includes(q.id) || !q.required) {
				continue;
			}
			if (!isNonEmptyAnswer(q, mergedAnswers[q.id], mergedOther[q.id])) {
				throw new ValidationError(`Required question "${q.prompt}" has no valid answer.`);
			}
		}

		const newlyAnswered = new Set<string>(existingAnswered);
		for (const id of targetIds) {
			newlyAnswered.add(id);
		}

		for (const qRow of qRows) {
			const ans = mergedAnswers[qRow.questionKey];
			const other = mergedOther[qRow.questionKey];
			const markSubmitted = newlyAnswered.has(qRow.questionKey);
			tx.update(questions)
				.set({
					answerJson: ans !== undefined ? JSON.stringify(ans) : null,
					otherText: other !== undefined ? other : null,
					isSubmitted: markSubmitted,
					answeredAt: markSubmitted ? (qRow.answeredAt ?? now) : null,
				})
				.where(eq(questions.pk, qRow.pk))
				.run();
		}

		const allDone = currentSet.questions.every(q => newlyAnswered.has(q.id));
		const nextStatus: "pending" | "partial" | "submitted" = allDone ? "submitted" : "partial";

		const updatedSetRow = tx
			.update(questionSets)
			.set({
				status: nextStatus,
				submittedAt: allDone ? now : null,
			})
			.where(eq(questionSets.id, questionSetId))
			.returning()
			.get()!;

		const sessionRow = tx
			.update(sessions)
			.set({ updatedAt: now })
			.where(eq(sessions.id, sessionId))
			.returning()
			.get()!;

		const refreshedRows = tx
			.select()
			.from(questions)
			.where(eq(questions.questionSetId, questionSetId))
			.orderBy(asc(questions.position))
			.all();
		const [updatedSet] = mapQuestionSets([updatedSetRow], refreshedRows);

		recordTimelineEvent(tx, {
			sessionId,
			groupId: sessionRow.groupId,
			eventType: allDone ? "question_set_submitted" : "question_set_partial",
			actor: "user",
			title: allDone
				? `Answered questions: ${updatedSet!.title}`
				: `Partially answered: ${updatedSet!.title}`,
			summary: `${targetIds.length} answer(s) submitted (${newlyAnswered.size}/${updatedSet!.questions.length})`,
			links: [
				{
					entityType: "question_set",
					entityId: questionSetId,
					role: "subject",
					label: updatedSet!.title,
				},
				{
					entityType: "session",
					entityId: sessionId,
					role: "parent",
					label: sessionRow.title ?? sessionId,
				},
				...(updatedSet!.taskId !== undefined
					? [{
							entityType: "task" as const,
							entityId: String(updatedSet!.taskId),
							role: "related" as const,
							label: `Task ${formatTaskId(updatedSet!.taskId)}`,
						}]
					: []),
			],
			createdAt: now,
		});

		return {
			questionSet: updatedSet!,
			submittedQuestionIds: targetIds,
		};
	});
}
