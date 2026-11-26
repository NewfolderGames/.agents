const OUTER_FENCE_PATTERN = /^(`{3,}|~{3,})[ \t]*(?:mermaid)?[ \t]*\r?\n([\s\S]*?)\r?\n\1[ \t]*$/i;
const MERMAID_FENCE_DETECT_PATTERN = /(?:^|\n)[ \t]*(?:`{3,}|~{3,})[ \t]*mermaid\b/i;
const MERMAID_FENCE_REPLACE_PATTERN
	= /(^|\r?\n)([ \t]*)(`{3,}|~{3,})([ \t]*mermaid[^\r\n]*\r?\n)((?:[\s\S]*?\r?\n)?)([ \t]*\3[ \t]*(?=\r?\n|$))/gi;

/**
 * Strip a single outer fenced code block (` ```mermaid `, ` ~~~mermaid `, or bare ` ``` `)
 * from raw Mermaid source so callers can pass either bare or fenced diagrams without double-fencing.
 */
export function stripMermaidFence(raw: string): string {
	const trimmed = raw.trim();
	if (!trimmed) {
		return "";
	}

	const match = OUTER_FENCE_PATTERN.exec(trimmed);
	return match ? match[2]!.trim() : trimmed;
}

/**
 * Wrap raw or already-fenced Mermaid diagram source in a single canonical ` ```mermaid ` fence.
 * Returns an empty string when the normalized source is blank.
 */
export function wrapMermaidFence(raw: string): string {
	const body = stripMermaidFence(raw);
	if (!body) {
		return "";
	}

	return `\`\`\`mermaid\n${body}\n\`\`\``;
}

/** Detect whether a Markdown string contains at least one fenced `mermaid` code block. */
export function hasMermaidFence(markdown: string): boolean {
	return MERMAID_FENCE_DETECT_PATTERN.test(markdown);
}

/**
 * Inject a Mermaid `%%{init: {'theme': '...'}}%%` directive into every fenced `mermaid`
 * block that does not already declare an explicit `%%{init:` directive or YAML frontmatter (`---`).
 *
 * `mermaid-isomorphic`'s browser build ignores `options.mermaidConfig`, so injecting the theme
 * directive per block lets `rehype-mermaid` follow live light/dark host theme changes.
 */
export function injectMermaidThemeDirective(
	markdown: string,
	theme: "default" | "dark",
): string {
	if (!hasMermaidFence(markdown)) {
		return markdown;
	}

	return markdown.replace(
		MERMAID_FENCE_REPLACE_PATTERN,
		(
			match: string,
			prefix: string,
			indent: string,
			fence: string,
			header: string,
			body: string,
			closing: string,
		) => {
			const firstLine = body
				.split(/\r?\n/)
				.find(line => line.trim().length > 0)
				?.trim() ?? "";

			if (!firstLine || firstLine.startsWith("%%{init:") || firstLine === "---") {
				return match;
			}

			return `${prefix}${indent}${fence}${header}%%{init: {'theme': '${theme}'}}%%\n${body}${closing}`;
		},
	);
}
