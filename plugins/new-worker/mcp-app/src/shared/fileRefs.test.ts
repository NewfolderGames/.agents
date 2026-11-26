import { describe, expect, it } from "vitest";
import { parseFileReference, parseFileUriHref, resolveFileReference, transformMdastFileLinks } from "./fileRefs.js";

describe("file reference parsing, resolution, and mdast linking", () => {
	it("parses file paths with line ranges and rejects non-file tokens", () => {
		expect(parseFileReference("src/shared/mermaid.ts:12-30")).toEqual({
			path: "src/shared/mermaid.ts",
			lineStart: 12,
			lineEnd: 30,
		});
		expect(parseFileReference("PlansPanel.tsx#L42")).toEqual({
			path: "PlansPanel.tsx",
			lineStart: 42,
			lineEnd: undefined,
		});
		expect(parseFileReference(".gitignore")).toEqual({ path: ".gitignore" });
		expect(parseFileReference("Makefile")).toEqual({ path: "Makefile" });

		expect(parseFileReference("v2.0")).toBeNull();
		expect(parseFileReference("1.2.3")).toBeNull();
		expect(parseFileReference("src/ui/artifacts/")).toBeNull();
		expect(parseFileReference("https://example.com/a.ts")).toBeNull();
		expect(parseFileReference("server/db/*")).toBeNull();
		expect(parseFileReference("@modelcontextprotocol/sdk")).toBeNull();
		expect(parseFileReference("--export-dir")).toBeNull();
		expect(parseFileReference("pnpm test")).toBeNull();
	});

	it("parses file:// URIs back to decoded local paths and line fragments", () => {
		expect(parseFileUriHref("file:///repo/my%20app/src/index.ts#L10-L25")).toEqual({
			path: "/repo/my app/src/index.ts",
			lineStart: 10,
			lineEnd: 25,
		});
		expect(parseFileUriHref("https://example.com/foo.ts")).toBeNull();
		expect(parseFileUriHref("file:///repo/dir/")).toBeNull();
	});

	it("resolves session artifacts via exportDir, relative paths via rootDir, and unique knownPaths basenames", () => {
		const opts = {
			rootDir: "/repo/my-agents",
			exportDir: "/brain/sess-1",
			knownPaths: [
				"plugins/new-worker/mcp-app/src/dashboard/panels/PlansPanel.tsx",
				"plugins/new-worker/mcp-app/src/a/index.ts",
				"plugins/new-worker/mcp-app/src/b/index.ts",
			],
		};

		expect(resolveFileReference("002-feature.plan.md", opts)).toEqual({
			path: "/brain/sess-1/002-feature.plan.md",
			label: "002-feature.plan.md",
			lineStart: undefined,
			lineEnd: undefined,
		});
		expect(resolveFileReference("tasks.md", opts)).toEqual({
			path: "/brain/sess-1/tasks.md",
			label: "tasks.md",
			lineStart: undefined,
			lineEnd: undefined,
		});
		expect(resolveFileReference("PlansPanel.tsx:15", opts)).toEqual({
			path: "plugins/new-worker/mcp-app/src/dashboard/panels/PlansPanel.tsx",
			label: "PlansPanel.tsx:15",
			lineStart: 15,
			lineEnd: undefined,
		});
		expect(resolveFileReference("panels/PlansPanel.tsx", opts)).toEqual({
			path: "plugins/new-worker/mcp-app/src/dashboard/panels/PlansPanel.tsx",
			label: "panels/PlansPanel.tsx",
			lineStart: undefined,
			lineEnd: undefined,
		});
		expect(resolveFileReference("server/db/client.ts", opts)).toEqual({
			path: "server/db/client.ts",
			label: "server/db/client.ts",
			lineStart: undefined,
			lineEnd: undefined,
		});

		// Ambiguous basename in knownPaths must not resolve blindly.
		expect(resolveFileReference("index.ts", opts)).toBeNull();
		// Unknown bare filename without "/" must not resolve blindly.
		expect(resolveFileReference("unknown.ts", opts)).toBeNull();
	});

	it("transforms unbackticked file references in mdast prose while skipping code and existing links", () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "Updated PlansPanel.tsx and src/shared/mermaid.ts:10 in v2.0.",
						},
					],
				},
				{
					type: "code",
					value: "PlansPanel.tsx",
				},
				{
					type: "paragraph",
					children: [
						{
							type: "link",
							url: "https://example.com",
							children: [{ type: "text", value: "PlansPanel.tsx" }],
						},
					],
				},
			],
		};

		transformMdastFileLinks(tree, {
			rootDir: "/repo/my-agents",
			knownPaths: ["plugins/new-worker/mcp-app/src/dashboard/panels/PlansPanel.tsx"],
		});

		const paraChildren = tree.children[0]!.children!;
		expect(paraChildren).toEqual([
			{ type: "text", value: "Updated " },
			{
				type: "link",
				url: "file:///repo/my-agents/plugins/new-worker/mcp-app/src/dashboard/panels/PlansPanel.tsx",
				children: [{ type: "text", value: "PlansPanel.tsx" }],
			},
			{ type: "text", value: " and " },
			{
				type: "link",
				url: "file:///repo/my-agents/src/shared/mermaid.ts#L10",
				children: [{ type: "text", value: "src/shared/mermaid.ts:10" }],
			},
			{ type: "text", value: " in v2.0." },
		]);

		// Code block and existing link remain untouched.
		expect(tree.children[1]).toEqual({ type: "code", value: "PlansPanel.tsx" });
		expect(tree.children[2]!.children![0]).toEqual({
			type: "link",
			url: "https://example.com",
			children: [{ type: "text", value: "PlansPanel.tsx" }],
		});
	});
});
