import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface ServerCliConfig {
	dataDir: string;
	dashboardHtmlPath?: string;
	widgetHtmlPath?: string;
}

/** Reject blank strings and unexpanded template variables such as `${PLUGIN_DATA}`. */
export function isUsableCliValue(value: string | undefined): value is string {
	if (!value) {
		return false;
	}
	const trimmed = value.trim();
	return trimmed.length > 0 && !trimmed.includes("${");
}

/** Resolve the persistent data directory from env or plugin-relative defaults. */
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

function readNextFlagValue(
	argv: string[],
	index: number,
	flag: string,
): { value?: string; nextIndex: number } {
	const arg = argv[index] ?? "";
	const prefix = `${flag}=`;
	if (arg.startsWith(prefix)) {
		const candidate = arg.slice(prefix.length);
		return {
			value: isUsableCliValue(candidate) ? candidate.trim() : undefined,
			nextIndex: index,
		};
	}
	if (arg === flag) {
		const candidate = argv[index + 1];
		return {
			value: isUsableCliValue(candidate) ? candidate.trim() : undefined,
			nextIndex: index + 1,
		};
	}
	return { nextIndex: index };
}

/** Parse `--data-dir`, `--dashboard-html`, and `--widget-html` flags with env fallbacks. */
export function parseCliArgs(argv: string[]): ServerCliConfig {
	let dataDir = resolveDefaultDataDir();
	const envDashboard = process.env.NEW_WORKER_DASHBOARD_HTML;
	const envWidget = process.env.NEW_WORKER_WIDGET_HTML;
	let dashboardHtmlPath = isUsableCliValue(envDashboard) ? envDashboard.trim() : undefined;
	let widgetHtmlPath = isUsableCliValue(envWidget) ? envWidget.trim() : undefined;

	for (let i = 0; i < argv.length; i += 1) {
		const dataMatch = readNextFlagValue(argv, i, "--data-dir");
		if (dataMatch.value) {
			dataDir = path.resolve(dataMatch.value);
			i = dataMatch.nextIndex;
			continue;
		}
		if (dataMatch.nextIndex !== i) {
			i = dataMatch.nextIndex;
			continue;
		}

		const dashMatch = readNextFlagValue(argv, i, "--dashboard-html");
		if (dashMatch.value) {
			dashboardHtmlPath = dashMatch.value;
			i = dashMatch.nextIndex;
			continue;
		}
		if (dashMatch.nextIndex !== i) {
			i = dashMatch.nextIndex;
			continue;
		}

		const widgetMatch = readNextFlagValue(argv, i, "--widget-html");
		if (widgetMatch.value) {
			widgetHtmlPath = widgetMatch.value;
			i = widgetMatch.nextIndex;
			continue;
		}
		if (widgetMatch.nextIndex !== i) {
			i = widgetMatch.nextIndex;
		}
	}

	return { dataDir, dashboardHtmlPath, widgetHtmlPath };
}
