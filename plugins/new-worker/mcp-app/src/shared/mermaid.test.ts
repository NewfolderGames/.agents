import { describe, expect, it } from "vitest";
import { hasMermaidFence, injectMermaidThemeDirective, stripMermaidFence, wrapMermaidFence } from "./mermaid.js";

describe("mermaid fence and theme directive helpers", () => {
	it("strips outer backtick or tilde mermaid fences without altering bare diagrams", () => {
		const bare = "flowchart TD\n  A --> B";
		expect(stripMermaidFence(`  ${bare}  `)).toBe(bare);
		expect(stripMermaidFence(`\`\`\`mermaid\n${bare}\n\`\`\``)).toBe(bare);
		expect(stripMermaidFence(`~~~mermaid\n${bare}\n~~~`)).toBe(bare);
		expect(stripMermaidFence(`\`\`\`\n${bare}\n\`\`\``)).toBe(bare);
		expect(stripMermaidFence("   \n  ")).toBe("");
	});

	it("wraps bare or already-fenced diagrams in a single mermaid fence", () => {
		const bare = "sequenceDiagram\n  Alice->>Bob: Hello";
		expect(wrapMermaidFence(bare)).toBe(`\`\`\`mermaid\n${bare}\n\`\`\``);
		expect(wrapMermaidFence(`\`\`\`mermaid\n${bare}\n\`\`\``)).toBe(`\`\`\`mermaid\n${bare}\n\`\`\``);
		expect(wrapMermaidFence("   ")).toBe("");
	});

	it("detects fenced mermaid blocks and ignores inline references or other languages", () => {
		expect(hasMermaidFence("```mermaid\ngraph LR\n  A --> B\n```")).toBe(true);
		expect(hasMermaidFence("Intro\n\n~~~MERMAID\ngraph LR\n  A --> B\n~~~")).toBe(true);
		expect(hasMermaidFence("Inline `mermaid` mention without fence.")).toBe(false);
		expect(hasMermaidFence("```ts\nconst mermaid = true;\n```")).toBe(false);
	});

	it("injects theme directive into mermaid fences while preserving explicit init directives and frontmatter", () => {
		const md = [
			"Before text.",
			"",
			"```mermaid",
			"flowchart TD",
			"  A --> B",
			"```",
			"",
			"```ts",
			"const keep = 1;",
			"```",
			"",
			"~~~mermaid",
			"%%{init: {'theme': 'forest'}}%%",
			"graph LR",
			"  C --> D",
			"~~~",
			"",
			"```mermaid",
			"---",
			"title: Frontmatter Diagram",
			"---",
			"graph TD",
			"  E --> F",
			"```",
		].join("\n");

		const themed = injectMermaidThemeDirective(md, "dark");

		expect(themed).toContain("```mermaid\n%%{init: {'theme': 'dark'}}%%\nflowchart TD\n  A --> B\n```");
		expect(themed).toContain("```ts\nconst keep = 1;\n```");
		expect(themed).toContain("~~~mermaid\n%%{init: {'theme': 'forest'}}%%\ngraph LR\n  C --> D\n~~~");
		expect(themed).toContain("```mermaid\n---\ntitle: Frontmatter Diagram\n---\ngraph TD\n  E --> F\n```");
	});
});
