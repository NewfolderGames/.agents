import type { McpServer } from "@modelcontextprotocol/server";
import type { AppDrizzleDb } from "../db/client.js";
import { registerAppOnlyTools } from "./tools/appTools.js";
import { registerArtifactTools } from "./tools/artifactTools.js";
import { registerQuestionTools } from "./tools/questionTools.js";
import { registerTaskTools } from "./tools/taskTools.js";
import { registerWorkspaceTools } from "./tools/workspaceTools.js";

/**
 * Register all 10 model-visible tools and 6 app-only UI callback tools on the
 * given MCP server instance.
 *
 * @param server - Target MCP server receiving tool registrations.
 * @param db - Active SQLite database handle backed by Drizzle ORM.
 */
export function registerTools(server: McpServer, db: AppDrizzleDb): void {
	registerWorkspaceTools(server, db);
	registerTaskTools(server, db);
	registerArtifactTools(server, db);
	registerQuestionTools(server, db);
	registerAppOnlyTools(server, db);
}
