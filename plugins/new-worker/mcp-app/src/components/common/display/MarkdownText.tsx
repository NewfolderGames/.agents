import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import styles from "./MarkdownText.module.css";

export interface MarkdownTextProps {
	content: string;
}

export function MarkdownText({ content }: MarkdownTextProps) {
	return (
		<div className={styles["markdown-text"]}>
			<Markdown rehypePlugins={[rehypeRaw]}>{content}</Markdown>
		</div>
	);
}
