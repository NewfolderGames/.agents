import { cx, formatFileLocation, toFileUri } from "@/shared/format.js";
import styles from "./FileLink.module.css";

export interface FileLinkProps {
	path: string;
	lineStart?: number;
	lineEnd?: number;
	label?: string;
	rootDir?: string;
	onOpenFile?: (filePath: string, rootDir?: string) => Promise<boolean>;
}

/** Interactive workspace file reference link falling back to static code text offline or when unresolvable. */
export function FileLink({
	path,
	lineStart,
	lineEnd,
	label,
	rootDir,
	onOpenFile,
}: FileLinkProps) {
	const displayText = label ?? formatFileLocation(path, lineStart, lineEnd);
	const canOpen = Boolean(onOpenFile && toFileUri(path, rootDir));

	if (!canOpen) {
		return (
			<code className={cx(styles["file-link"], styles["-static"])}>
				{displayText}
			</code>
		);
	}

	return (
		<button
			type="button"
			className={styles["file-link"]}
			title={`Open ${displayText}`}
			onClick={() => void onOpenFile!(path, rootDir)}
		>
			<code>{displayText}</code>
		</button>
	);
}
