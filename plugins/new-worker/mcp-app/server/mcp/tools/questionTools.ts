import { registerAppTool } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { QuestionBlockingModeSchema, QuestionItemSchema, QuestionSectionSchema, SessionIdSchema, TaskIdSchema } from "@/shared/contracts.js";
import { formatPlainTextQuestions } from "@/shared/format.js";
import type { AppDrizzleDb } from "../../db/client.js";
import { createQuestionSet } from "../../repositories/questions.js";
import { hasSession } from "../../repositories/sessions.js";
import { recordToolCall } from "../../repositories/settings.js";
import { buildWidgetPayload } from "../../repositories/workspace.js";
import { WIDGET_RESOURCE_URIS } from "../resources.js";
import { buildSessionMeta, optionalArrayInput, optionalInput, runLoggedTool, SessionMetaZodFields } from "./shared.js";

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
				id: optionalInput(z.string().min(1)),
				title: z.string().min(1),
				description: optionalInput(z.string()),
				submitLabel: optionalInput(z.string()),
				blockingMode: optionalInput(QuestionBlockingModeSchema),
				taskId: optionalInput(TaskIdSchema),
				stepNumber: optionalInput(z.number().int().positive()),
				sections: optionalArrayInput(QuestionSectionSchema),
				questions: z.array(QuestionItemSchema).min(1),
				...SessionMetaZodFields,
			}),
			_meta: {
				ui: { resourceUri: WIDGET_RESOURCE_URIS.questions },
			},
		},
		args => runLoggedTool(db, { sessionId: args.sessionId, toolName: "ask_questions" }, () => {
			const isNewSession = !hasSession(db, args.sessionId);
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

			const sessionHint = isNewSession
				? `\nNew session "${args.sessionId}" created — call open_workspace({ sessionId: "${args.sessionId}" }) to open the Dashboard UI.`
				: "";

			return {
				content: [{
					type: "text",
					text: `${formatPlainTextQuestions(questionSet)}${sessionHint}`,
				}],
				structuredContent: payload,
			};
		}),
	);
}
