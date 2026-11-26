import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { QuestionBlockingModeSchema, QuestionItemSchema, QuestionSectionSchema, SessionIdSchema, TaskIdSchema } from "@/shared/contracts.js";
import { formatPlainTextQuestions } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { createQuestionSet } from "../../repositories/questions.js";
import { recordToolCall } from "../../repositories/settings.js";
import { buildWidgetPayload } from "../../repositories/workspace.js";
import { WIDGET_RESOURCE_URIS } from "../resources.js";
import { buildSessionMeta, runLoggedTool, SessionMetaZodFields } from "./shared.js";

/**
 * Register the `ask_questions` interactive elicitation tool bound to the
 * standalone questions widget (`ui://new-worker/widget/questions`).
 *
 * @param server - Target MCP server instance.
 * @param db - Active Drizzle SQLite database connection.
 */
export function registerQuestionTools(server: McpServer, db: AppDrizzleDb): void {
	// ask_questions -> /widget/questions
	registerAppTool(
		server,
		"ask_questions",
		{
			title: "Ask Questions",
			description:
				"Present a structured interactive question set supporting immediate, before_step_finish, and anytime blocking modes, optional global taskId + stepNumber binding, and grouped sections.",
			inputSchema: z.object({
				sessionId: SessionIdSchema,
				id: z.string().min(1).optional(),
				title: z.string().min(1),
				description: z.string().optional(),
				submitLabel: z.string().optional(),
				blockingMode: QuestionBlockingModeSchema.optional(),
				taskId: TaskIdSchema.optional(),
				stepNumber: z.number().int().positive().optional(),
				sections: z.array(QuestionSectionSchema).optional(),
				questions: z.array(QuestionItemSchema).min(1),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.questions },
			},
		},
		args => runLoggedTool(db, { sessionId: args.sessionId, toolName: "ask_questions" }, () => {
			const { questionSet } = createQuestionSet(
				db,
				args.sessionId,
				{
					id: args.id,
					title: args.title,
					description: args.description,
					submitLabel: args.submitLabel,
					blockingMode: args.blockingMode,
					taskId: args.taskId,
					stepNumber: args.stepNumber,
					sections: args.sections,
					questions: args.questions,
				},
				buildSessionMeta(args),
			);

			recordToolCall(
				db,
				args.sessionId,
				"ask_questions",
				"ok",
				`Question set "${questionSet.title}" (${questionSet.questions.length} Qs, ${questionSet.blockingMode})`,
				`questionSetId=${questionSet.id}`,
			);

			const payload = buildWidgetPayload(db, {
				widget: "questions",
				sessionId: args.sessionId,
				taskId: questionSet.taskId,
				questionSetId: questionSet.id,
			});

			return {
				content: [{ type: "text", text: formatPlainTextQuestions(questionSet) }],
				structuredContent: payload,
			};
		}),
	);
}
