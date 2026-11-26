import { Component, type ComponentProps, createContext, type ReactNode, useContext, useMemo } from "react";
import Markdown, { type Components, defaultUrlTransform, MarkdownHooks } from "react-markdown";
import rehypeMermaid, { type RehypeMermaidOptions } from "rehype-mermaid";
import remarkGfm from "remark-gfm";
import { type ResolveFileOptions, resolveFileReference, transformMdastFileLinks } from "@/shared/fileRefs.js";
import { hasMermaidFence, injectMermaidThemeDirective } from "@/shared/mermaid.js";
import { useColorScheme } from "@/ui/hooks/useColorScheme.js";
import { FileLink } from "./FileLink.js";
import fileLinkStyles from "./FileLink.module.css";
import styles from "./MarkdownBlock.module.css";

export interface MarkdownBlockProps {
	content: string;
	rootDir?: string;
	exportDir?: string;
	knownPaths?: readonly string[];
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

type RemarkPlugins = NonNullable<ComponentProps<typeof Markdown>["remarkPlugins"]>;
type RehypePlugins = NonNullable<ComponentProps<typeof Markdown>["rehypePlugins"]>;

const EXTERNAL_OR_ANCHOR_PATTERN = /^(?:https?|ircs?|mailto|xmpp):|^#/i;
const InsidePreContext = createContext(false);

function stripHastNode<T extends { node?: unknown }>(props: T): Omit<T, "node"> {
	const rest = { ...props };
	delete rest.node;
	return rest;
}

function allowSafeAndFileUrls(url: string): string {
	if (/^file:\/\//i.test(url)) {
		return url;
	}
	return defaultUrlTransform(url);
}

function remarkFileLinks(options: ResolveFileOptions) {
	return (tree: Parameters<typeof transformMdastFileLinks>[0]) => {
		transformMdastFileLinks(tree, options);
	};
}

const REMARK_PLUGINS: RemarkPlugins = [remarkGfm];

const MERMAID_OPTIONS: RehypeMermaidOptions = {
	strategy: "inline-svg",
	errorFallback: (_element, diagram, error) => ({
		type: "element",
		tagName: "div",
		properties: {
			"data-mermaid-error": "true",
			"role": "alert",
		},
		children: [
			{
				type: "element",
				tagName: "strong",
				properties: {},
				children: [
					{
						type: "text",
						value: `Mermaid render error: ${error instanceof Error ? error.message : String(error)}`,
					},
				],
			},
			{
				type: "element",
				tagName: "pre",
				properties: {},
				children: [
					{
						type: "element",
						tagName: "code",
						properties: {},
						children: [{ type: "text", value: diagram }],
					},
				],
			},
		],
	}),
};

const MERMAID_REHYPE_PLUGINS: RehypePlugins = [[rehypeMermaid, MERMAID_OPTIONS]];

interface MarkdownLinkElementProps {
	href?: string;
	children?: ReactNode;
	title?: string;
	rootDir?: string;
	exportDir?: string;
	knownPaths?: readonly string[];
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

function MarkdownAnchor({
	href,
	children,
	title,
	rootDir,
	exportDir,
	knownPaths,
	onOpenFile,
}: MarkdownLinkElementProps) {
	if (!href) {
		return <span>{children}</span>;
	}

	if (href.startsWith("#")) {
		return <a href={href} title={title}>{children}</a>;
	}

	if (!EXTERNAL_OR_ANCHOR_PATTERN.test(href) && onOpenFile) {
		const resolved = resolveFileReference(href, { rootDir, exportDir, knownPaths });
		if (resolved) {
			return (
				<button
					type="button"
					className={fileLinkStyles["file-link"]}
					title={title ?? `Open ${resolved.label}`}
					onClick={() => void onOpenFile(resolved.path, rootDir)}
				>
					{children}
				</button>
			);
		}
	}

	return (
		<a
			href={href}
			title={title}
			target="_blank"
			rel="noopener noreferrer"
		>
			{children}
		</a>
	);
}

interface MarkdownCodeProps {
	className?: string;
	children?: ReactNode;
	rootDir?: string;
	exportDir?: string;
	knownPaths?: readonly string[];
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

function MarkdownInlineCode({
	className,
	children,
	rootDir,
	exportDir,
	knownPaths,
	onOpenFile,
}: MarkdownCodeProps) {
	const insidePre = useContext(InsidePreContext);

	if (!insidePre && onOpenFile && typeof children === "string") {
		const resolved = resolveFileReference(children, { rootDir, exportDir, knownPaths });
		if (resolved) {
			return (
				<FileLink
					path={resolved.path}
					lineStart={resolved.lineStart}
					lineEnd={resolved.lineEnd}
					label={resolved.label}
					rootDir={rootDir}
					onOpenFile={onOpenFile}
				/>
			);
		}
	}

	return <code className={className}>{children}</code>;
}

const STATIC_COMPONENTS: Components = {
	table: props => (
		<div
			tabIndex={0}
			role="region"
			aria-label="Markdown table"
			className={styles["table-wrap"]}
		>
			<table {...stripHastNode(props)} />
		</div>
	),
	pre: props => (
		<InsidePreContext.Provider value={true}>
			<pre {...stripHastNode(props)} />
		</InsidePreContext.Provider>
	),
	a: props => (
		<a
			{...stripHastNode(props)}
			target="_blank"
			rel="noopener noreferrer"
		/>
	),
};

interface MermaidErrorBoundaryProps {
	fallback: ReactNode;
	children: ReactNode;
}

interface MermaidErrorBoundaryState {
	hasError: boolean;
}

class MermaidErrorBoundary extends Component<MermaidErrorBoundaryProps, MermaidErrorBoundaryState> {
	override state: MermaidErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): MermaidErrorBoundaryState {
		return { hasError: true };
	}

	override render(): ReactNode {
		if (this.state.hasError) {
			return this.props.fallback;
		}
		return this.props.children;
	}
}

/**
 * Safe GFM + Mermaid Markdown renderer omitting raw HTML plugins (`rehype-raw`).
 * Renders synchronously when no Mermaid fence is present, converts resolvable file
 * references into clickable `FileLink` buttons when `onOpenFile` is provided, and
 * uses `MarkdownHooks` with `rehype-mermaid` (`inline-svg`) + live theme sync for Mermaid blocks.
 */
export function MarkdownBlock({
	content,
	rootDir,
	exportDir,
	knownPaths,
	onOpenFile,
}: MarkdownBlockProps) {
	const containsMermaid = hasMermaidFence(content);
	const colorScheme = useColorScheme();
	const themedContent = useMemo(
		() => (containsMermaid
			? injectMermaidThemeDirective(content, colorScheme === "dark" ? "dark" : "default")
			: content),
		[containsMermaid, content, colorScheme],
	);

	const canLinkFiles = Boolean(
		onOpenFile && (rootDir || exportDir || (knownPaths && knownPaths.length > 0)),
	);

	const remarkPlugins = useMemo<RemarkPlugins>(() => {
		if (!canLinkFiles) {
			return REMARK_PLUGINS;
		}
		return [
			remarkGfm,
			[remarkFileLinks, { rootDir, exportDir, knownPaths }],
		];
	}, [canLinkFiles, rootDir, exportDir, knownPaths]);

	const components = useMemo<Components>(() => {
		if (!onOpenFile) {
			return STATIC_COMPONENTS;
		}
		return {
			table: STATIC_COMPONENTS.table,
			pre: STATIC_COMPONENTS.pre,
			a: props => (
				<MarkdownAnchor
					href={props.href}
					title={props.title}
					rootDir={rootDir}
					exportDir={exportDir}
					knownPaths={knownPaths}
					onOpenFile={onOpenFile}
				>
					{props.children}
				</MarkdownAnchor>
			),
			code: props => (
				<MarkdownInlineCode
					className={props.className}
					rootDir={rootDir}
					exportDir={exportDir}
					knownPaths={knownPaths}
					onOpenFile={onOpenFile}
				>
					{props.children}
				</MarkdownInlineCode>
			),
		};
	}, [onOpenFile, rootDir, exportDir, knownPaths]);

	if (!containsMermaid) {
		return (
			<div className={styles["markdown-block"]}>
				<Markdown
					remarkPlugins={remarkPlugins}
					urlTransform={allowSafeAndFileUrls}
					components={components}
				>
					{content}
				</Markdown>
			</div>
		);
	}

	const plainFallback = (
		<Markdown
			remarkPlugins={remarkPlugins}
			urlTransform={allowSafeAndFileUrls}
			components={components}
		>
			{content}
		</Markdown>
	);

	return (
		<div className={styles["markdown-block"]}>
			<MermaidErrorBoundary key={themedContent} fallback={plainFallback}>
				<MarkdownHooks
					remarkPlugins={remarkPlugins}
					rehypePlugins={MERMAID_REHYPE_PLUGINS}
					urlTransform={allowSafeAndFileUrls}
					components={components}
					fallback={<pre className={styles["mermaid-loading"]}>Rendering diagram...</pre>}
				>
					{themedContent}
				</MarkdownHooks>
			</MermaidErrorBoundary>
		</div>
	);
}
