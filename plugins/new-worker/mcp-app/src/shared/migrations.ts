import { CURRENT_INDEX_SCHEMA_VERSION, CURRENT_SESSION_SCHEMA_VERSION, CURRENT_SETTINGS_SCHEMA_VERSION, type SessionData, SessionDataSchema, SessionIndexFileSchema, type SessionSummary, SessionSummarySchema, type UiSettings, UiSettingsSchema } from "./schema.js";

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Migrate legacy v0 or current v1 session JSON to a validated SessionData object. */
export function migrateSessionData(raw: unknown): SessionData {
	if (!isPlainObject(raw)) {
		throw new Error("Invalid session JSON payload.");
	}

	const rawVersion = raw.schemaVersion === undefined ? 0 : raw.schemaVersion;
	if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 0) {
		throw new Error("Invalid session schemaVersion.");
	}
	if (rawVersion > CURRENT_SESSION_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported session schema version ${rawVersion} (max supported: ${CURRENT_SESSION_SCHEMA_VERSION}).`,
		);
	}

	if (rawVersion === 0) {
		const rawSets = Array.isArray(raw.questionSets) ? raw.questionSets : [];
		const normalizedSets = rawSets.map((qs) => {
			if (!isPlainObject(qs)) {
				return qs;
			}
			const questionIds = Array.isArray(qs.questions)
				? qs.questions
						.filter(isPlainObject)
						.map(q => q.id)
						.filter((id): id is string => typeof id === "string")
				: [];
			return {
				...qs,
				blockingMode: qs.blockingMode ?? "immediate",
				answeredQuestionIds: Array.isArray(qs.answeredQuestionIds)
					? qs.answeredQuestionIds
					: qs.status === "submitted"
						? questionIds
						: [],
			};
		});

		return SessionDataSchema.parse({
			...raw,
			schemaVersion: CURRENT_SESSION_SCHEMA_VERSION,
			questionSets: normalizedSets,
		});
	}

	return SessionDataSchema.parse(raw);
}

/** Migrate legacy bare-array v0 or versioned v1 index JSON to SessionSummary[]. */
export function migrateSessionIndex(raw: unknown): SessionSummary[] {
	if (Array.isArray(raw)) {
		return SessionSummarySchema.array().parse(raw);
	}
	if (!isPlainObject(raw)) {
		throw new Error("Invalid session index JSON payload.");
	}

	const rawVersion = raw.schemaVersion === undefined ? 0 : raw.schemaVersion;
	if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 0) {
		throw new Error("Invalid index schemaVersion.");
	}
	if (rawVersion > CURRENT_INDEX_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported index schema version ${rawVersion} (max supported: ${CURRENT_INDEX_SCHEMA_VERSION}).`,
		);
	}

	return SessionIndexFileSchema.parse({
		schemaVersion: CURRENT_INDEX_SCHEMA_VERSION,
		sessions: raw.sessions,
	}).sessions;
}

/** Migrate legacy or current UI settings JSON to a validated UiSettings object. */
export function migrateUiSettings(raw: unknown): UiSettings {
	if (!isPlainObject(raw)) {
		throw new Error("Invalid UI settings JSON payload.");
	}

	const rawVersion = raw.schemaVersion === undefined ? 0 : raw.schemaVersion;
	if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion) || rawVersion < 0) {
		throw new Error("Invalid settings schemaVersion.");
	}
	if (rawVersion > CURRENT_SETTINGS_SCHEMA_VERSION) {
		throw new Error(
			`Unsupported settings schema version ${rawVersion} (max supported: ${CURRENT_SETTINGS_SCHEMA_VERSION}).`,
		);
	}

	return UiSettingsSchema.parse({
		...raw,
		schemaVersion: CURRENT_SETTINGS_SCHEMA_VERSION,
	});
}
