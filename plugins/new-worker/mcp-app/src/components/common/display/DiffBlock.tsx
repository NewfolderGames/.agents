import { diffLines } from "diff";
import { cx } from "@/shared/format.js";
import styles from "./DiffBlock.module.css";

export interface DiffBlockProps {
	beforeText: string;
	afterText: string;
}

export function DiffBlock({ beforeText, afterText }: DiffBlockProps) {
	const chunks = diffLines(beforeText, afterText);

	return (
		<pre className={styles["diff-block"]}>
			{chunks.map((part, idx) => {
				const prefix = part.added ? "+ " : part.removed ? "- " : "  ";
				const lines = part.value.replace(/\n$/, "").split("\n");
				return lines.map((line, lineIdx) => (
					<div
						key={`${idx}-${lineIdx}`}
						className={cx(
							styles.line,
							part.added && styles["-added"],
							part.removed && styles["-removed"],
						)}
					>
						{prefix}
						{line}
					</div>
				));
			})}
		</pre>
	);
}
