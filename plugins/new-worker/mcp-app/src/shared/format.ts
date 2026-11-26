import { type QuestionAnswerValue, type QuestionBlockingMode, type QuestionItem, type QuestionSetRecord, resolveQuestionPolicy } from "./contracts.js";

/** Join truthy CSS Module class names safely. */
export function cx(...classes: Array<string | false | null | undefined>): string {
	return classes.filter(Boolean).join(" ");
}

/** Format a global integer task ID for UI display (`#1`). */
export function formatTaskId(taskId: number): string {
	return `#${taskId}`;
}

/** Zero-pad a global integer task ID to at least 3 digits for exported filenames (`001`). */
export function padTaskId(taskId: number, minWidth = 3): string {
	return String(taskId).padStart(minWidth, "0");
}

/** Build the canonical Markdown filename for an exported task plan or report (`001-slug.plan.md`). */
export function formatTaskFilename(
	taskId: number,
	slug: string,
	role: "plan" | "report",
): string {
	return `${padTaskId(taskId)}-${slug}.${role}.md`;
}

/** Resolve a workspace-relative or absolute path into a `file://` URI for Antigravity aux pane. */
export function toFileUri(filePath: string, rootDir?: string): string | null {
	const clean = filePath.trim();
	if (!clean || clean.includes("\0")) {
		return null;
	}
	if (clean.startsWith("file://")) {
		return clean;
	}
	let resolved = clean;
	if (!clean.startsWith("/")) {
		if (!rootDir || !rootDir.startsWith("/")) {
			return null;
		}
		const base = rootDir.endsWith("/") ? rootDir.slice(0, -1) : rootDir;
		resolved = `${base}/${clean.replace(/^\.\//, "")}`;
	}
	const encoded = resolved
		.split("/")
		.map(segment => encodeURIComponent(segment))
		.join("/");
	return `file://${encoded.startsWith("/") ? encoded : `/${encoded}`}`;
}

/** Format a human-readable line range suffix (`path:10-20`). */
export function formatFileLocation(
	path: string,
	lineStart?: number,
	lineEnd?: number,
): string {
	if (lineStart && lineEnd && lineEnd !== lineStart) {
		return `${path}:${lineStart}-${lineEnd}`;
	}
	if (lineStart) {
		return `${path}:${lineStart}`;
	}
	return path;
}

/** Format one answer value for compact replies and summaries. */
export function formatAnswerValue(
	question: QuestionItem,
	value: QuestionAnswerValue | undefined,
	otherText?: string,
): string {
	if (value === undefined) {
		return "(unanswered)";
	}
	if (typeof value === "boolean") {
		return value ? "Yes" : "No";
	}
	if (Array.isArray(value)) {
		const resolved = value.map((item) => {
			if (item === "__other__") {
				return otherText?.trim() ? `Other: ${otherText.trim()}` : "Other";
			}
			const opt = question.options?.find(o => o.value === item);
			return opt ? opt.label : item;
		});
		return resolved.length > 0 ? resolved.join(", ") : "(none selected)";
	}
	if (value === "__other__") {
		return otherText?.trim() ? `Other: ${otherText.trim()}` : "Other";
	}
	const opt = question.options?.find(o => o.value === value);
	return opt ? opt.label : value || "(empty)";
}

/** Format a human-readable label for a question's blocking policy. */
export function formatBlockingModeLabel(
	blockingMode: QuestionBlockingMode,
	taskId?: number,
	stepNumber?: number,
): string {
	switch (blockingMode) {
		case "immediate":
			return "Must answer now";
		case "before_step_finish": {
			if (taskId && stepNumber) {
				return `Before Task #${taskId} Step ${stepNumber}`;
			}
			if (stepNumber) {
				return `Before Step ${stepNumber}`;
			}
			return "Before step finish";
		}
		case "anytime":
			return "Answer anytime";
	}
}

/** Build a compact, structured text reply sent via `app.sendMessage()` or copied by the user. */
export function formatQuestionReply(
	questionSet: QuestionSetRecord,
	answers: Record<string, QuestionAnswerValue>,
	otherTexts: Record<string, string>,
	submittedQuestionIds?: string[],
): string {
	const subsetSet = submittedQuestionIds ? new Set(submittedQuestionIds) : null;
	const targetQuestions = subsetSet
		? questionSet.questions.filter(q => subsetSet.has(q.id))
		: questionSet.questions;
	const isPartial = Boolean(
		subsetSet && targetQuestions.length < questionSet.questions.length,
	);
	const lines: string[] = [
		isPartial
			? `Submitted partial answers for "${questionSet.title}" (questionSetId: ${questionSet.id}):`
			: `Submitted answers for "${questionSet.title}" (questionSetId: ${questionSet.id}):`,
	];
	for (const q of targetQuestions) {
		const formatted = formatAnswerValue(q, answers[q.id], otherTexts[q.id]);
		lines.push(`- ${q.id} (${q.prompt}): ${formatted}`);
	}
	return lines.join("\n");
}

/** Build a compact plain-text representation of a question set for non-UI MCP hosts. */
export function formatPlainTextQuestions(questionSet: QuestionSetRecord): string {
	const lines: string[] = [
		`Question Set: ${questionSet.title} (id: ${questionSet.id})`,
	];
	if (questionSet.description) {
		lines.push(questionSet.description);
	}
	questionSet.questions.forEach((q, idx) => {
		const reqTag = q.required ? "required" : "optional";
		const policy = resolveQuestionPolicy(questionSet, q);
		const policyTag = formatBlockingModeLabel(
			policy.blockingMode,
			policy.taskId,
			policy.stepNumber,
		);
		lines.push(`${idx + 1}. [${q.id}] ${q.prompt} (${q.kind}, ${reqTag}, ${policyTag})`);
		if (q.hint) {
			lines.push(`   Hint: ${q.hint}`);
		}
		if (q.options && q.options.length > 0) {
			q.options.forEach((opt, optIdx) => {
				const rec = opt.recommended ? " (Recommended)" : "";
				lines.push(`   ${String.fromCharCode(97 + optIdx)}) ${opt.label}${rec}`);
			});
		}
		if (q.allowOther) {
			lines.push("   *) Other (free text)");
		}
	});
	return lines.join("\n");
}

/** Format an ISO timestamp into a short readable UTC clock label. */
export function formatShortTimestamp(iso: string): string {
	const parsed = new Date(iso);
	if (Number.isNaN(parsed.getTime())) {
		return iso;
	}
	return `${parsed.toISOString().replace("T", " ").slice(0, 16)}Z`;
}

/** Format an elapsed duration between `startedAt` and `completedAt` (or `referenceIso` / now). */
export function formatDuration(
	startedAt?: string,
	completedAt?: string,
	referenceIso?: string,
): string | null {
	if (!startedAt) {
		return null;
	}
	const startMs = Date.parse(startedAt);
	if (Number.isNaN(startMs)) {
		return null;
	}
	const endMs = completedAt
		? Date.parse(completedAt)
		: referenceIso
			? Date.parse(referenceIso)
			: Date.now();
	if (Number.isNaN(endMs)) {
		return null;
	}
	const diffSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
	if (diffSec < 1) {
		return "<1s";
	}
	if (diffSec < 60) {
		return `${diffSec}s`;
	}
	if (diffSec < 3600) {
		const minutes = Math.floor(diffSec / 60);
		const seconds = diffSec % 60;
		return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
	}
	const hours = Math.floor(diffSec / 3600);
	const minutes = Math.floor((diffSec % 3600) / 60);
	return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

/** Build a compact tooltip string from lifecycle timestamps. */
export function formatTimestampTooltip(
	createdAt?: string,
	startedAt?: string,
	completedAt?: string,
): string | undefined {
	const parts: string[] = [];
	if (createdAt) {
		parts.push(`Created ${formatShortTimestamp(createdAt)}`);
	}
	if (startedAt) {
		parts.push(`Started ${formatShortTimestamp(startedAt)}`);
	}
	if (completedAt) {
		parts.push(`Completed ${formatShortTimestamp(completedAt)}`);
	}
	return parts.length > 0 ? parts.join(" · ") : undefined;
}
