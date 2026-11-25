import { useCallback, useEffect, useState } from "react";
import { type App, applyDocumentTheme, applyHostStyleVariables, useApp, useHostStyleVariables } from "@modelcontextprotocol/ext-apps/react";
import { z } from "zod";
import { toFileUri } from "@/shared/format.js";
import { AppToolPayloadSchema } from "@/shared/schema.js";
import { useWorkspaceStore } from "@/shared/workspaceStore.js";

const ToggleAuxPaneResultSchema = z
	.object({
		isError: z.boolean().optional(),
	})
	.passthrough();

const UnchangedResultSchema = z
	.object({
		unchanged: z.literal(true),
		revision: z.string().optional(),
	})
	.passthrough();

export interface McpBridgeCapabilities {
	canSendMessage: boolean;
	canUpdateContext: boolean;
	canCallServerTools: boolean;
}

export interface CallAppToolOptions {
	background?: boolean;
}

export interface CallAppToolResult {
	ok: boolean;
	text?: string;
	unchanged?: boolean;
	error?: string;
}

export interface McpBridgeState {
	app: App | null;
	isConnected: boolean;
	connectionError: string | null;
	isToolStreaming: boolean;
	capabilities: McpBridgeCapabilities;
	callAppTool: (
		name: string,
		args: Record<string, unknown>,
		options?: CallAppToolOptions,
	) => Promise<CallAppToolResult>;
	sendMessage: (text: string) => Promise<boolean>;
	openWorkspaceFile: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function useMcpBridge(): McpBridgeState {
	const [isToolStreaming, setIsToolStreaming] = useState(false);

	const { app, isConnected, error } = useApp({
		appInfo: { name: "new-worker", version: "1.3.0" },
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
				const parsed = AppToolPayloadSchema.safeParse(result.structuredContent);
				if (parsed.success) {
					useWorkspaceStore.getState().applyPayload(parsed.data);
				}
				else if (result.isError) {
					const errText
						= result.content?.[0]?.type === "text"
							? result.content[0].text
							: "Tool execution failed.";
					useWorkspaceStore.getState().setErrorMessage(errText);
				}
			};
			createdApp.ontoolcancelled = (params) => {
				setIsToolStreaming(false);
				if (params.reason) {
					useWorkspaceStore.getState().setErrorMessage(`Cancelled: ${params.reason}`);
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
	const capabilities: McpBridgeCapabilities = {
		canSendMessage: Boolean(hostCaps?.message),
		canUpdateContext: Boolean(hostCaps?.updateModelContext),
		canCallServerTools: Boolean(hostCaps?.serverTools),
	};

	const callAppTool = useCallback(
		async (
			name: string,
			args: Record<string, unknown>,
			options?: CallAppToolOptions,
		): Promise<CallAppToolResult> => {
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
				const unchangedParsed = UnchangedResultSchema.safeParse(result.structuredContent);
				if (unchangedParsed.success) {
					return { ok: true, text, unchanged: true };
				}
				const parsed = AppToolPayloadSchema.safeParse(result.structuredContent);
				if (parsed.success) {
					if (options?.background) {
						useWorkspaceStore.getState().applyBackgroundRefresh(parsed.data);
					}
					else {
						useWorkspaceStore.getState().applyPayload(parsed.data);
					}
				}
				return { ok: true, text };
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
		async (filePath: string, workspacePath?: string) => {
			if (!app) {
				return false;
			}
			const uri = toFileUri(filePath, workspacePath);
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
		callAppTool,
		sendMessage,
		openWorkspaceFile,
	};
}
