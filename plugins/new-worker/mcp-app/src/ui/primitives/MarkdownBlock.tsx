import Markdown from "react-markdown";
import styles from "./MarkdownBlock.module.css";

export interface MarkdownBlockProps {
	content: string;
}

/** Safe Markdown renderer omitting raw HTML plugins (`rehype-raw`). */
export function MarkdownBlock({ content }: MarkdownBlockProps) {
	return (
		<div className={styles["markdown-block"]}>
			<Markdown>{content}</Markdown>
		</div>
	);
}
