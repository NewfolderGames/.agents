import fs from "node:fs";
import path, { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function flattenDashboardOutput(): Plugin {
	return {
		name: "flatten-dashboard-html",
		apply: "build",
		closeBundle() {
			const distDir = resolve(import.meta.dirname, "dist");
			const built = path.join(distDir, "dashboard.html");
			if (!fs.existsSync(built)) {
				throw new Error("Expected dist/dashboard.html to be generated.");
			}
		},
	};
}

export default defineConfig({
	plugins: [react(), viteSingleFile(), flattenDashboardOutput()],
	resolve: {
		alias: {
			"@": resolve(import.meta.dirname, "./src"),
		},
	},
	css: {
		modules: {
			localsConvention: "dashes",
		},
	},
	build: {
		outDir: "dist",
		emptyOutDir: false,
		target: "esnext",
		assetsInlineLimit: Number.MAX_SAFE_INTEGER,
		cssCodeSplit: false,
		rollupOptions: {
			input: resolve(import.meta.dirname, "dashboard.html"),
		},
	},
});
