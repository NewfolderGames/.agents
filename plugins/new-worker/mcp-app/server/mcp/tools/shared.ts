import { z } from "zod";
import { GroupIdSchema, TimelineEntityTypeSchema, TimelineLinkRoleSchema } from "@/shared/contracts.js";
import type { AppDrizzleDb } from "../../db/client.js";
import type { SessionMetaInput } from "../../repositories/sessions.js";
import { recordToolCall } from "../../repositories/settings.js";

/** Visibility metadata restricting UI callback tools to MCP App webviews. */
export const APP_ONLY_META = {
	ui: {
		visibility: ["app" as const],
	},
};

/**
 * Normalize `null` placeholders sent by lazy MCP callers into `undefined` while
 * preserving the inner Zod schema for JSON Schema generation.
 */
export function optionalInput<T extends z.ZodTypeAny>(schema: T) {
	return z.preprocess(
		val => (val === null ? undefined : val),
		schema.optional(),
	);
}

/**
 * Normalize `null` or null-containing optional arrays (`[null]`) into `undefined`
 * (or a filtered array) so placeholder arrays do not fail MCP input validation.
 */
export function optionalArrayInput<T extends z.ZodTypeAny>(itemSchema: T) {
	return z.preprocess(
		(val) => {
			if (val === null || val === undefined) {
				return undefined;
			}
			if (Array.isArray(val)) {
				const filtered = val.filter(item => item !== null && item !== undefined);
				return filtered.length === 0 ? undefined : filtered;
			}
			return val;
		},
		z.array(itemSchema).optional(),
	);
}

/** Optional session metadata fields shared across model-facing mutating tools. */
export const SessionMetaZodFields = {
	sessionTitle: optionalInput(z.string()).describe("Optional human-readable title for the session."),
	rootDir: optionalInput(z.string()).describe("Optional absolute root directory path associated with this session."),
	exportDir: optionalInput(z.string()).describe("Optional absolute directory path for Markdown artifact export."),
	groupId: GroupIdSchema.nullable().optional().describe("Optional 1:N session group ID."),
};

/** Schema for polymorphic entity associations attached to timeline notes. */
export const TimelineNoteLinkInputSchema = z.object({
	entityType: TimelineEntityTypeSchema,
	entityId: z.string().min(1),
	role: TimelineLinkRoleSchema.optional(),
	label: z.string().optional(),
});

/** Structured MCP error result returned when a tool handler throws. */
export interface ToolTextErrorResult {
	isError: true;
	content: Array<{ type: "text"; text: string }>;

	[x: string]: unknown;
}

/**
 * Format an unknown thrown value into a concise single-string error message.
 *
 * @param err - Caught exception or thrown primitive value.
 * @returns Human-readable message suitable for MCP `isError` responses.
 */
export function summarizeError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * Extract optional session metadata fields when at least one metadata property was supplied.
 *
 * @param args - Tool arguments possibly carrying session metadata overrides.
 * @returns Normalized {@link SessionMetaInput} object, or `undefined` when all fields are omitted.
 */
export function buildSessionMeta(args: {
	sessionTitle?: string;
	rootDir?: string;
	exportDir?: string;
	groupId?: string | null;
}): SessionMetaInput | undefined {
	if (
		args.sessionTitle === undefined
		&& args.rootDir === undefined
		&& args.exportDir === undefined
		&& args.groupId === undefined
	) {
		return undefined;
	}
	return {
		title: args.sessionTitle,
		rootDir: args.rootDir,
		exportDir: args.exportDir,
		groupId: args.groupId,
	};
}

/**
 * Execute a mutating MCP tool handler, persisting any thrown error to `tool_calls`
 * when `sessionId` is known and returning an `isError` MCP response.
 *
 * @param db - Active SQLite database handle.
 * @param ctx - Tool name and optional target session identifier for audit logging.
 * @param fn - Tool handler producing the normal MCP payload.
 * @returns Handler result on success or {@link ToolTextErrorResult} on failure.
 */
export async function runLoggedTool<TResult>(
	db: AppDrizzleDb,
	ctx: { sessionId?: string; toolName: string },
	fn: () => Promise<TResult> | TResult,
): Promise<TResult | ToolTextErrorResult> {
	try {
		return await fn();
	}
	catch (err) {
		const msg = summarizeError(err);
		if (ctx.sessionId) {
			try {
				recordToolCall(db, ctx.sessionId, ctx.toolName, "error", msg);
			}
			catch {
				// Ignore secondary logging errors (for example, invalid sessionId).
			}
		}
		return {
			isError: true,
			content: [{ type: "text", text: msg }],
		};
	}
}

/**
 * Execute a read-only or UI callback MCP tool handler, converting thrown exceptions
 * into structured `isError` payloads without writing audit records.
 *
 * @param fn - Handler returning the MCP tool response.
 * @returns Handler result on success or {@link ToolTextErrorResult} on failure.
 */
export async function runSafeTool<TResult>(
	fn: () => Promise<TResult> | TResult,
): Promise<TResult | ToolTextErrorResult> {
	try {
		return await fn();
	}
	catch (err) {
		return {
			isError: true,
			content: [{ type: "text", text: summarizeError(err) }],
		};
	}
}
