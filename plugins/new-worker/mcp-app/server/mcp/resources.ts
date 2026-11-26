import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import type { McpServer } from "@modelcontextprotocol/server";
import type { WidgetRoute } from "@/shared/contracts.js";

export const DASHBOARD_RESOURCE_URI = "ui://new-worker/dashboard";

export const WIDGET_RESOURCE_URIS: Record<WidgetRoute, string> = {
	"task": "ui://new-worker/widget/task",
	"task-step": "ui://new-worker/widget/task-step",
	"plan": "ui://new-worker/widget/plan",
	"report": "ui://new-worker/widget/report",
	"handoff": "ui://new-worker/widget/handoff",
	"questions": "ui://new-worker/widget/questions",
};

const WIDGET_LABELS: Record<WidgetRoute, string> = {
	"task": "New Worker Task Widget",
	"task-step": "New Worker Task Step Widget",
	"plan": "New Worker Plan Widget",
	"report": "New Worker Report Widget",
	"handoff": "New Worker Handoff Widget",
	"questions": "New Worker Questions Widget",
};

/** Inject `window.__NEW_WORKER_ROUTE__` into the single-file widget HTML before `</head>`. */
export function injectWidgetRoute(html: string, route: WidgetRoute): string {
	const routeTag = `<script>window.__NEW_WORKER_ROUTE__=${JSON.stringify(`/widget/${route}`)};</script>`;
	if (html.includes("</head>")) {
		return html.replace("</head>", `${routeTag}</head>`);
	}
	return `${routeTag}${html}`;
}

export interface RegisterResourcesOptions {
	loadDashboardHtml: () => Promise<string>;
	loadWidgetHtml: () => Promise<string>;
}

/** Register the isolated Dashboard UI resource and all 6 route-tagged inline Widget UI resources. */
export function registerUiResources(
	server: McpServer,
	options: RegisterResourcesOptions,
): void {
	const { loadDashboardHtml, loadWidgetHtml } = options;

	registerAppResource(
		server,
		"New Worker Dashboard",
		DASHBOARD_RESOURCE_URI,
		{
			description:
				"Interactive Dashboard UI for multi-session groups, tasks, plans, reports, handoffs, questions, timeline, and tool calls.",
			mimeType: RESOURCE_MIME_TYPE,
			_meta: {
				ui: {
					prefersBorder: false,
				},
			},
		},
		async () => {
			const html = await loadDashboardHtml();
			return {
				contents: [
					{
						uri: DASHBOARD_RESOURCE_URI,
						mimeType: RESOURCE_MIME_TYPE,
						text: html,
						_meta: {
							ui: {
								prefersBorder: false,
							},
						},
					},
				],
			};
		},
	);

	(Object.keys(WIDGET_RESOURCE_URIS) as WidgetRoute[]).forEach((route) => {
		const uri = WIDGET_RESOURCE_URIS[route];
		registerAppResource(
			server,
			WIDGET_LABELS[route],
			uri,
			{
				description: `Isolated inline MCP App widget for route /widget/${route}.`,
				mimeType: RESOURCE_MIME_TYPE,
				_meta: {
					ui: {
						prefersBorder: false,
					},
				},
			},
			async () => {
				const rawHtml = await loadWidgetHtml();
				return {
					contents: [
						{
							uri,
							mimeType: RESOURCE_MIME_TYPE,
							text: injectWidgetRoute(rawHtml, route),
							_meta: {
								ui: {
									prefersBorder: false,
								},
							},
						},
					],
				};
			},
		);
	});
}
