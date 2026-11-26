import type { McpServer } from "@modelcontextprotocol/server";
import type { AppDrizzleDb } from "../db/client.js";
import { registerTools } from "./registerTools.js";
import { registerUiResources, type RegisterResourcesOptions } from "./resources.js";

export interface RegisterNewWorkerServerOptions extends RegisterResourcesOptions {
	db: AppDrizzleDb;
}

/** Register all SEP-1865 UI resources and MCP tools on the New Worker server. */
export function registerNewWorkerServer(
	server: McpServer,
	options: RegisterNewWorkerServerOptions,
): void {
	registerUiResources(server, {
		loadDashboardHtml: options.loadDashboardHtml,
		loadWidgetHtml: options.loadWidgetHtml,
	});
	registerTools(server, options.db);
}
