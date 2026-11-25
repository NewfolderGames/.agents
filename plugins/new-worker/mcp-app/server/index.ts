import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import { createSessionStore } from "./store.js";
import { registerNewWorkerServer } from "./tools.js";

export interface ServerCliConfig {
	dataDir: string;
	htmlPath?: string;
}

export function isUsableCliValue(value: string | undefined): value is string {
	if (!value) {
		return false;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 && !trimmed.includes("${");
}

export function resolveDefaultDataDir(): string {
	const envDir = process.env.NEW_WORKER_DATA_DIR;
	if (isUsableCliValue(envDir)) {
		return path.resolve(envDir.trim());
	}

	const currentDir = path.dirname(fileURLToPath(import.meta.url));
	const base = path.basename(currentDir);
	if (base === "dist" || base === "server") {
		return path.resolve(currentDir, "..", "data");
	}

	const xdgData = process.env.XDG_DATA_HOME?.trim()
		|| path.join(os.homedir(), ".local", "share");
	return path.join(xdgData, "new-worker-mcp");
}

export function parseCliArgs(argv: string[]): ServerCliConfig {
	let dataDir = resolveDefaultDataDir();
	const envHtml = process.env.NEW_WORKER_APP_HTML;
	let htmlPath = isUsableCliValue(envHtml) ? envHtml.trim() : undefined;

	for (let i = 0; i < argv.length; i += 1) {
		const arg = argv[i];
		if (!arg) {
			continue;
		}
		if (arg.startsWith("--data-dir=")) {
			const candidate = arg.slice("--data-dir=".length);
			if (isUsableCliValue(candidate)) {
				dataDir = path.resolve(candidate.trim());
			}
		}
		else if (arg === "--data-dir") {
			const candidate = argv[i + 1];
			if (isUsableCliValue(candidate)) {
				dataDir = path.resolve(candidate.trim());
				i += 1;
			}
		}
		else if (arg.startsWith("--html-path=")) {
			const candidate = arg.slice("--html-path=".length);
			if (isUsableCliValue(candidate)) {
				htmlPath = candidate.trim();
			}
		}
		else if (arg === "--html-path") {
			const candidate = argv[i + 1];
			if (isUsableCliValue(candidate)) {
				htmlPath = candidate.trim();
				i += 1;
			}
		}
	}

	return { dataDir, htmlPath };
}

function resolveDefaultHtmlPath(): string {
	const currentFile = fileURLToPath(import.meta.url);
	const currentDir = path.dirname(currentFile);
	if (path.basename(currentDir) === "dist") {
		return path.join(currentDir, "app.html");
	}
	return path.resolve(currentDir, "..", "dist", "app.html");
}

async function main(): Promise<void> {
	const config = parseCliArgs(process.argv.slice(2));
	const resolvedHtmlPath = config.htmlPath
		? path.resolve(config.htmlPath)
		: resolveDefaultHtmlPath();

	const store = createSessionStore(config.dataDir);
	const server = new McpServer(
		{
			name: "new-worker-ui",
			version: "1.3.0",
		},
		{
			capabilities: {
				resources: {},
				tools: {},
			},
		},
	);

	registerNewWorkerServer(server, {
		store,
		loadAppHtml: () => fs.readFile(resolvedHtmlPath, "utf8"),
	});

	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error(`new-worker-ui MCP server running on stdio (dataDir: ${store.getDataDir()})`);
}

const isEntrypoint
	= process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
	main().catch((err) => {
		console.error("Fatal error starting new-worker-ui MCP server:", err);
		process.exit(1);
	});
}
