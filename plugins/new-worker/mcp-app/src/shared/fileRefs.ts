import type { PlanRecord, ReportRecord } from "./contracts.js";
import { toFileUri } from "./format.js";

export interface ParsedFileReference {
	path: string;
	lineStart?: number;
	lineEnd?: number;
}

export interface ResolvedFileReference extends ParsedFileReference {
	label: string;
}

export interface ResolveFileOptions {
	rootDir?: string;
	exportDir?: string;
	knownPaths?: readonly string[];
}

const LINE_SUFFIX_PATTERN = /^(.*?)(?:#L(\d+)(?:-L?(\d+))?|:(\d+)(?:-(\d+))?)$/;
const SESSION_ARTIFACT_PATTERN = /^(?:tasks\.md|\d+-[a-z0-9-]+\.(?:plan|report)\.md)$/i;
const EXTENSION_PATTERN = /\.[a-zA-Z][a-zA-Z0-9]{0,11}$/;
const DOTFILE_PATTERN = /^\.[a-zA-Z][a-zA-Z0-9_-]*$/;
const KNOWN_EXTENSIONLESS_FILES = new Set([
	"Dockerfile",
	"Gemfile",
	"LICENSE",
	"Makefile",
	"Procfile",
	"README",
]);
const TEXT_CANDIDATE_PATTERN
	= /(?:^|(?<=[\s([{"']))((?:[a-zA-Z0-9._-]+\/)*[a-zA-Z0-9._-]+\.[a-zA-Z][a-zA-Z0-9]{0,11}(?:#L\d+(?:-L?\d+)?|:\d+(?:-\d+)?)?)(?=$|[\s)\]}"',;!?]|\.(?:\s|$))/g;

const SKIP_MDAST_TYPES = new Set([
	"code",
	"definition",
	"html",
	"image",
	"imageReference",
	"inlineCode",
	"link",
	"linkReference",
]);

interface MdastNode {
	type: string;
	value?: string;
	url?: string;
	children?: MdastNode[];
}

function splitPathAndLines(raw: string): ParsedFileReference {
	const match = LINE_SUFFIX_PATTERN.exec(raw);
	if (!match) {
		return { path: raw };
	}
	const path = match[1]!;
	const startRaw = match[2] ?? match[4];
	const endRaw = match[3] ?? match[5];
	const lineStart = startRaw ? Number.parseInt(startRaw, 10) : undefined;
	const lineEnd = endRaw ? Number.parseInt(endRaw, 10) : undefined;
	return {
		path,
		lineStart: lineStart && lineStart > 0 ? lineStart : undefined,
		lineEnd: lineEnd && lineEnd > 0 ? lineEnd : undefined,
	};
}

function isValidFileBasename(basename: string): boolean {
	if (!basename || basename === "." || basename === "..") {
		return false;
	}
	return EXTENSION_PATTERN.test(basename)
		|| DOTFILE_PATTERN.test(basename)
		|| KNOWN_EXTENSIONLESS_FILES.has(basename);
}

/**
 * Parse a file path or filename with optional `:line(-line)` or `#Lline(-Lline)` suffix,
 * rejecting URLs, globs, CLI flags, directories, and numeric version strings.
 */
export function parseFileReference(raw: string): ParsedFileReference | null {
	const trimmed = raw.trim();
	if (
		!trimmed
		|| /\s/.test(trimmed)
		|| trimmed.includes("://")
		|| /[*?<>|"]/.test(trimmed)
		|| trimmed.startsWith("-")
		|| trimmed.startsWith("@")
		|| trimmed.startsWith("#")
	) {
		return null;
	}

	const parsed = splitPathAndLines(trimmed);
	if (!parsed.path || parsed.path.endsWith("/")) {
		return null;
	}

	const basename = parsed.path.split("/").pop() ?? "";
	if (!isValidFileBasename(basename)) {
		return null;
	}

	return parsed;
}

/**
 * Parse a `file://` URI (with optional `#L10` or `#L10-L20` fragment) back into a local
 * filesystem path and line range suitable for `FileLink` and `openWorkspaceFile`.
 */
export function parseFileUriHref(href: string): ParsedFileReference | null {
	if (!href.startsWith("file://")) {
		return null;
	}
	const withoutScheme = href.slice("file://".length);
	const hashIdx = withoutScheme.indexOf("#");
	const rawEncodedPath = hashIdx === -1 ? withoutScheme : withoutScheme.slice(0, hashIdx);
	const fragment = hashIdx === -1 ? "" : withoutScheme.slice(hashIdx);

	const decodedPath = rawEncodedPath
		.split("/")
		.map((segment) => {
			try {
				return decodeURIComponent(segment);
			}
			catch {
				return segment;
			}
		})
		.join("/");

	if (!decodedPath || decodedPath.endsWith("/")) {
		return null;
	}

	const parsedFragment = fragment ? splitPathAndLines(`x${fragment}`) : undefined;
	return {
		path: decodedPath,
		lineStart: parsedFragment?.lineStart,
		lineEnd: parsedFragment?.lineEnd,
	};
}

function findUniqueKnownPath(
	cleanPath: string,
	knownPaths?: readonly string[],
): string | null {
	if (!knownPaths || knownPaths.length === 0) {
		return null;
	}
	const cleanKnown = knownPaths
		.map(p => p.trim())
		.filter(p => Boolean(p) && !p.endsWith("/"));

	const exact = cleanKnown.find(p => p.replace(/^\.\//, "") === cleanPath);
	if (exact) {
		return exact;
	}

	if (cleanPath.includes("/")) {
		const suffixMatches = Array.from(
			new Set(cleanKnown.filter(p => p.replace(/^\.\//, "").endsWith(`/${cleanPath}`))),
		);
		return suffixMatches.length === 1 ? suffixMatches[0]! : null;
	}

	const basenameMatches = Array.from(
		new Set(cleanKnown.filter(p => (p.split("/").pop() ?? "") === cleanPath)),
	);
	return basenameMatches.length === 1 ? basenameMatches[0]! : null;
}

/**
 * Resolve a raw file reference (path, `file://` URI, session artifact name, or unique
 * known filename) against `rootDir`, `exportDir`, and `knownPaths`. Returns `null` when
 * the reference cannot be resolved to a valid `file://` URI.
 */
export function resolveFileReference(
	raw: string,
	options: ResolveFileOptions,
): ResolvedFileReference | null {
	const trimmed = raw.trim();
	if (!trimmed) {
		return null;
	}

	if (trimmed.startsWith("file://")) {
		const uriParsed = parseFileUriHref(trimmed);
		if (!uriParsed) {
			return null;
		}
		return {
			...uriParsed,
			label: uriParsed.path.split("/").pop() || uriParsed.path,
		};
	}

	const parsed = parseFileReference(trimmed);
	if (!parsed) {
		return null;
	}

	const cleanPath = parsed.path.replace(/^\.\//, "");

	if (parsed.path.startsWith("/")) {
		return toFileUri(parsed.path, options.rootDir)
			? {
					path: parsed.path,
					label: trimmed,
					lineStart: parsed.lineStart,
					lineEnd: parsed.lineEnd,
				}
			: null;
	}

	if (!cleanPath.includes("/") && SESSION_ARTIFACT_PATTERN.test(cleanPath) && options.exportDir) {
		const base = options.exportDir.endsWith("/") ? options.exportDir.slice(0, -1) : options.exportDir;
		const joined = `${base}/${cleanPath}`;
		return toFileUri(joined, options.rootDir)
			? { path: joined, label: trimmed, lineStart: parsed.lineStart, lineEnd: parsed.lineEnd }
			: null;
	}

	const knownMatch = findUniqueKnownPath(cleanPath, options.knownPaths);
	if (knownMatch && toFileUri(knownMatch, options.rootDir)) {
		return {
			path: knownMatch,
			label: trimmed,
			lineStart: parsed.lineStart,
			lineEnd: parsed.lineEnd,
		};
	}

	if (cleanPath.includes("/") && toFileUri(cleanPath, options.rootDir)) {
		return {
			path: cleanPath,
			label: trimmed,
			lineStart: parsed.lineStart,
			lineEnd: parsed.lineEnd,
		};
	}

	return null;
}

/** Build a `file://` href (preserving optional `#L...` fragments) for Markdown links. */
export function formatResolvedFileHref(
	resolved: ParsedFileReference,
	rootDir?: string,
): string | null {
	const baseUri = toFileUri(resolved.path, rootDir);
	if (!baseUri) {
		return null;
	}
	if (!resolved.lineStart) {
		return baseUri;
	}
	const lineSuffix = resolved.lineEnd && resolved.lineEnd !== resolved.lineStart
		? `#L${resolved.lineStart}-L${resolved.lineEnd}`
		: `#L${resolved.lineStart}`;
	return `${baseUri}${lineSuffix}`;
}

/** Collect deduplicated workspace file paths referenced structurally in a {@link PlanRecord}. */
export function collectPlanPaths(plan: PlanRecord): string[] {
	const raw = [
		...plan.fileStructure.map(entry => entry.path),
		...(plan.components?.map(row => row.path) ?? []),
	];
	return Array.from(new Set(raw.filter(p => Boolean(p) && !p.endsWith("/"))));
}

/** Collect deduplicated workspace file paths referenced structurally in a {@link ReportRecord}. */
export function collectReportPaths(report: ReportRecord): string[] {
	const raw = [
		...report.filesChanged.map(file => file.path),
		...report.findings.map(finding => finding.location),
		...report.followUps.map(followUp => followUp.location),
	];
	return Array.from(new Set(raw.filter(p => Boolean(p) && !p.endsWith("/"))));
}

function splitTextNodeToMdast(
	value: string,
	options: ResolveFileOptions,
): MdastNode[] | null {
	TEXT_CANDIDATE_PATTERN.lastIndex = 0;
	const nodes: MdastNode[] = [];
	let lastIndex = 0;
	let matchedAny = false;

	for (const match of value.matchAll(TEXT_CANDIDATE_PATTERN)) {
		const token = match[1];
		const startIndex = match.index;
		if (!token || startIndex === undefined) {
			continue;
		}
		const resolved = resolveFileReference(token, options);
		const href = resolved ? formatResolvedFileHref(resolved, options.rootDir) : null;
		if (!resolved || !href) {
			continue;
		}
		matchedAny = true;
		if (startIndex > lastIndex) {
			nodes.push({ type: "text", value: value.slice(lastIndex, startIndex) });
		}
		nodes.push({
			type: "link",
			url: href,
			children: [{ type: "text", value: token }],
		});
		lastIndex = startIndex + token.length;
	}

	if (!matchedAny) {
		return null;
	}
	if (lastIndex < value.length) {
		nodes.push({ type: "text", value: value.slice(lastIndex) });
	}
	return nodes;
}

/**
 * Transform an mdast syntax tree in place, turning resolvable unbackticked file names
 * and paths in prose nodes into `file://` links while skipping code and existing links.
 */
export function transformMdastFileLinks(
	tree: MdastNode,
	options: ResolveFileOptions,
): void {
	if (!tree.children || SKIP_MDAST_TYPES.has(tree.type)) {
		return;
	}

	const nextChildren: MdastNode[] = [];
	for (const child of tree.children) {
		if (child.type === "text" && typeof child.value === "string") {
			const replaced = splitTextNodeToMdast(child.value, options);
			if (replaced) {
				nextChildren.push(...replaced);
				continue;
			}
		}
		else {
			transformMdastFileLinks(child, options);
		}
		nextChildren.push(child);
	}
	tree.children = nextChildren;
}
