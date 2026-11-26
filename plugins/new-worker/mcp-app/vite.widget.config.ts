import fs from "node:fs";
import path, { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function verifyWidgetOutput(): Plugin {
	return {
		name: "verify-widget-html",
		apply: "build",
		closeBundle() {
			const distDir = resolve(import.meta.dirname, "dist");
			const built = path.join(distDir, "widget.html");
			if (!fs.existsSync(built)) {
				throw new Error("Expected dist/widget.html to be generated.");
			}
		},
	};
}

export default defineConfig({
	plugins: [react(), viteSingleFile(), verifyWidgetOutput()],
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
			input: resolve(import.meta.dirname, "widget.html"),
		},
	},
});
