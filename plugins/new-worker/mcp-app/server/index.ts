import { realpathSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { parseCliArgs } from "./config.js";
import { openDatabase } from "./db/client.js";
import { registerNewWorkerServer } from "./mcp/server.js";

function resolveDefaultHtmlPath(filename: "dashboard.html" | "widget.html"): string {
	const currentFile = fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFile);
	if (path.basename(currentDir) === "dist") {
		return path.join(currentDir, filename);
	}
	return path.resolve(currentDir, "..", "dist", filename);
}

function safeRealpath(targetPath: string): string {
	try {
		return realpathSync(targetPath);
	}
	catch {
		return path.resolve(targetPath);
	}
}

async function main(): Promise<void> {
	const config = parseCliArgs(process.argv.slice(2));
	const dashboardHtmlPath = config.dashboardHtmlPath
		? path.resolve(config.dashboardHtmlPath)
		: resolveDefaultHtmlPath("dashboard.html");
	const widgetHtmlPath = config.widgetHtmlPath
		? path.resolve(config.widgetHtmlPath)
		: resolveDefaultHtmlPath("widget.html");

	const handle = openDatabase(config.dataDir);
	const server = new McpServer(
		{
			name: "new-worker-ui",
			version: "2.0.0",
		},
		{
			capabilities: {
				resources: {},
				tools: {},
			},
		},
	);

	registerNewWorkerServer(server, {
		db: handle.db,
		loadDashboardHtml: () => fs.readFile(dashboardHtmlPath, "utf8"),
		loadWidgetHtml: () => fs.readFile(widgetHtmlPath, "utf8"),
	});

	const shutdown = () => {
		handle.close();
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(
		`new-worker-ui MCP server running on stdio (db: ${handle.dbPath}, schema v${handle.migrationResult.currentVersion})`,
	);
}

const isEntrypoint
	= process.argv[1]
		&& safeRealpath(process.argv[1]) === safeRealpath(fileURLToPath(import.meta.url));

if (isEntrypoint) {
	main().catch((err) => {
		console.error("Fatal error starting new-worker-ui MCP server:", err);
		process.exit(1);
	});
}
