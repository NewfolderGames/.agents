import fs from "node:fs";
import path, { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function renameAppHtml(): Plugin {
	return {
		name: "rename-app-html",
		apply: "build",
		closeBundle() {
			const distDir = resolve(import.meta.dirname, "dist");
			const indexHtml = path.join(distDir, "index.html");
			const appHtml = path.join(distDir, "app.html");
			if (fs.existsSync(indexHtml)) {
				fs.renameSync(indexHtml, appHtml);
			}
		},
	};
}

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), viteSingleFile(), renameAppHtml()],
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
	build: {
		outDir: "dist",
		emptyOutDir: false,
		target: "esnext",
		assetsInlineLimit: Number.MAX_SAFE_INTEGER,
		cssCodeSplit: false,
	},
});
