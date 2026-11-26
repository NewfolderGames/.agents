import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		alias: {
			"@": new URL("./src", import.meta.url).pathname,
		},
	},
	ssr: {
		noExternal: true,
		target: "node",
	},
	build: {
		ssr: "server/index.ts",
		outDir: "dist",
		emptyOutDir: false,
		target: "node22",
		rolldownOptions: {
			external: [/^node:/],
			output: {
				entryFileNames: "server.mjs",
				codeSplitting: false,
			},
		},
	},
});
