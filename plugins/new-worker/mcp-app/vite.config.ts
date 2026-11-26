import fs from "node:fs";
import path, { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

function devRouteRewrite(): Plugin {
	return {
		name: "new-worker-dev-routes",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const rawUrl = req.url ?? "/";
				const pathname = rawUrl.split("?")[0] ?? "/";
				if (pathname === "/dashboard" || pathname === "/dashboard/") {
					req.url = "/dashboard.html";
					next();
					return;
				}
				if (pathname.startsWith("/widget/")) {
					const route = pathname.replace(/\/+$/, "");
					const widgetHtmlPath = path.join(import.meta.dirname, "widget.html");
					void fs.promises
						.readFile(widgetHtmlPath, "utf8")
						.then(async (rawHtml) => {
							const injected = rawHtml.replace(
								"</head>",
								`<script>window.__NEW_WORKER_ROUTE__=${JSON.stringify(route)};</script></head>`,
							);
							const transformed = await server.transformIndexHtml(rawUrl, injected);
							res.statusCode = 200;
							res.setHeader("Content-Type", "text/html");
							res.end(transformed);
						})
						.catch(next);
					return;
				}
				next();
			});
		},
	};
}

export default defineConfig({
	plugins: [react(), devRouteRewrite()],
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "./src"),
		},
	},
	css: {
		modules: {
			// Preserve kebab-case and leading-dash RSCSS names so styles["-active"] resolves directly.
			localsConvention: "dashes",
		},
	},
});
