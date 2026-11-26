import { useCallback, useEffect, useState } from "react";
import { type App, applyDocumentTheme, applyHostStyleVariables, useApp, useHostStyleVariables } from "@modelcontextprotocol/ext-apps/react";
import { z } from "zod";
import { toFileUri } from "@/shared/format.js";

const ToggleAuxPaneResultSchema = z.looseObject({
	isError: z.boolean().optional(),
});

export interface McpAppCapabilities {
	canSendMessage: boolean;
	canUpdateContext: boolean;
	canCallServerTools: boolean;
}

export interface CallServerToolResult {
	ok: boolean;
	text?: string;
	structuredContent?: unknown;
	error?: string;
}

export interface UseMcpAppOptions {
	appName: string;
	onToolResult: (structuredContent: unknown) => void;
	onToolError?: (message: string) => void;
}

export interface McpAppBridge {
	app: App | null;
	isConnected: boolean;
	connectionError: string | null;
	isToolStreaming: boolean;
	capabilities: McpAppCapabilities;
	callTool: (name: string, args: Record<string, unknown>) => Promise<CallServerToolResult>;
	sendMessage: (text: string) => Promise<boolean>;
	openWorkspaceFile: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/**
 * Connect to the SEP-1865 MCP App host, registering all notification handlers
 * BEFORE `connect()` runs and syncing host theme + CSS variables automatically.
 */
export function useMcpApp(options: UseMcpAppOptions): McpAppBridge {
	const [isToolStreaming, setIsToolStreaming] = useState(false);

	const { app, isConnected, error } = useApp({
		appInfo: { name: options.appName, version: "2.0.0" },
		capabilities: {},
		onAppCreated: (createdApp) => {
			createdApp.ontoolinput = () => {
				setIsToolStreaming(true);
			};
			createdApp.ontoolinputpartial = () => {
				setIsToolStreaming(true);
			};
			createdApp.ontoolresult = (result) => {
				setIsToolStreaming(false);
				if (result.structuredContent !== undefined) {
					options.onToolResult(result.structuredContent);
					return;
				}
				if (result.isError) {
					const errText
						= result.content?.[0]?.type === "text"
							? result.content[0].text
							: "Tool execution failed.";
					options.onToolError?.(errText);
				}
			};
			createdApp.ontoolcancelled = (params) => {
				setIsToolStreaming(false);
				if (params.reason) {
					options.onToolError?.(`Cancelled: ${params.reason}`);
				}
			};
			createdApp.onhostcontextchanged = (ctx) => {
				if (ctx.theme) {
					applyDocumentTheme(ctx.theme);
					document.documentElement.style.colorScheme = ctx.theme;
				}
				if (ctx.styles?.variables) {
					applyHostStyleVariables(ctx.styles.variables);
				}
			};
			createdApp.onteardown = async () => ({});
		},
	});

	useHostStyleVariables(app, app?.getHostContext());

	useEffect(() => {
		const ctx = app?.getHostContext();
		if (ctx?.theme) {
			applyDocumentTheme(ctx.theme);
			document.documentElement.style.colorScheme = ctx.theme;
		}
	}, [app, isConnected]);

	const hostCaps = isConnected ? app?.getHostCapabilities() : undefined;
	const capabilities: McpAppCapabilities = {
		canSendMessage: Boolean(hostCaps?.message),
		canUpdateContext: Boolean(hostCaps?.updateModelContext),
		canCallServerTools: Boolean(hostCaps?.serverTools),
	};

	const callTool = useCallback(
		async (
			name: string,
			args: Record<string, unknown>,
		): Promise<CallServerToolResult> => {
			if (!app) {
				return { ok: false, error: "Not connected to MCP host." };
			}
			try {
				const result = await app.callServerTool({ name, arguments: args });
				const text
					= result.content?.[0]?.type === "text" ? result.content[0].text : undefined;
				if (result.isError) {
					return { ok: false, error: text ?? `Tool "${name}" failed.` };
				}
				return {
					ok: true,
					text,
					structuredContent: result.structuredContent,
				};
			}
			catch (err) {
				return {
					ok: false,
					error: err instanceof Error ? err.message : String(err),
				};
			}
		},
		[app],
	);

	const sendMessage = useCallback(
		async (text: string) => {
			if (!app || !app.getHostCapabilities()?.message) {
				return false;
			}
			try {
				const res = await app.sendMessage({
					role: "user",
					content: [{ type: "text", text }],
				});
				return !res.isError;
			}
			catch {
				return false;
			}
		},
		[app],
	);

	const openWorkspaceFile = useCallback(
		async (filePath: string, rootDir?: string) => {
			if (!app) {
				return false;
			}
			const uri = toFileUri(filePath, rootDir);
			if (!uri) {
				return false;
			}
			try {
				const result = await app.request(
					{
						method: "com.google.antigravity/toggle-aux-pane",
						params: { tabType: "fileView", uri },
					},
					ToggleAuxPaneResultSchema,
				);
				return !result.isError;
			}
			catch {
				return false;
			}
		},
		[app],
	);

	return {
		app,
		isConnected,
		connectionError: error ? error.message : null,
		isToolStreaming,
		capabilities,
		callTool,
		sendMessage,
		openWorkspaceFile,
	};
}
