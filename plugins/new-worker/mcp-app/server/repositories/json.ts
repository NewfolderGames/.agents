import { z } from "zod";

/**
 * Decode JSON column payloads using a Zod schema, falling back to `fallback` so
 * corrupted or partial historical rows never break read queries.
 */
export function parseJsonWithSchema<T>(
	raw: string | null | undefined,
	schema: z.ZodType<T>,
	fallback: T,
): T {
	if (!raw) {
		return fallback;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		const result = schema.safeParse(parsed);
		return result.success ? result.data : fallback;
	}
	catch {
		return fallback;
	}
}

/**
 * Decode an arbitrary JSON object column (such as event metadata or handoff
 * `structuredData`), returning `undefined` when missing, malformed, or non-object.
 */
export function parseJsonObject(
	raw: string | null | undefined,
): Record<string, unknown> | undefined {
	if (!raw) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
			const recordSchema = z.record(z.string(), z.unknown());
			const result = recordSchema.safeParse(parsed);
			return result.success ? result.data : undefined;
		}
	}
	catch {
		// Ignore malformed historical JSON objects during reads.
	}
	return undefined;
}
