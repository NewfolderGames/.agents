import { createTwoFilesPatch } from "diff";
import styles from "./DiffBlock.module.css";

export interface DiffBlockProps {
	filePath: string;
	beforeText: string;
	afterText: string;
}

/** Unified line diff renderer highlighting added, removed, and hunk header lines. */
export function DiffBlock({ filePath, beforeText, afterText }: DiffBlockProps) {
	const patch = createTwoFilesPatch(filePath, filePath, beforeText, afterText, "", "");
	const lines = patch.split("\n");

	return (
		<pre className={styles["diff-block"]}>
			{lines.map((line, index) => {
				const cls
					= line.startsWith("+") && !line.startsWith("+++")
						? styles.add
						: line.startsWith("-") && !line.startsWith("---")
							? styles.del
							: line.startsWith("@@")
								? styles.hunk
								: undefined;
				return (
					<div key={index} className={cls}>
						{line || " "}
					</div>
				);
			})}
		</pre>
	);
}
