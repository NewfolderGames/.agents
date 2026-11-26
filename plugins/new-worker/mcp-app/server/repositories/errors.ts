/** Base domain error for all server repository and migration failures. */
export class DomainError extends Error {
	readonly code: string;

	constructor(code: string, message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = new.target.name;
		this.code = code;
	}
}

export class MigrationError extends DomainError {
	readonly version?: number;

	constructor(message: string, version?: number, options?: ErrorOptions) {
		super("MIGRATION_ERROR", message, options);
		this.version = version;
	}
}

export class ValidationError extends DomainError {
	constructor(message: string, options?: ErrorOptions) {
		super("VALIDATION_ERROR", message, options);
	}
}

export class NotFoundError extends DomainError {
	readonly entityType: string;
	readonly entityId: string | number;

	constructor(entityType: string, entityId: string | number) {
		super("NOT_FOUND", `${entityType} "${entityId}" was not found.`);
		this.entityType = entityType;
		this.entityId = entityId;
	}
}

export class ReportImmutableError extends DomainError {
	readonly taskId: number;

	constructor(taskId: number) {
		super(
			"REPORT_IMMUTABLE",
			`Report for Task #${taskId} already exists and is immutable.`,
		);
		this.taskId = taskId;
	}
}

export class QuestionBlockerError extends DomainError {
	readonly blockingMode: "immediate" | "before_step_finish";
	readonly questionIds: string[];

	constructor(
		blockingMode: "immediate" | "before_step_finish",
		questionIds: string[],
		message: string,
	) {
		super("QUESTION_BLOCKER", message);
		this.blockingMode = blockingMode;
		this.questionIds = questionIds;
	}
}
