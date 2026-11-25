import { formatFileLocation } from "@/shared/format.js";
import styles from "./FileLink.module.css";

export interface FileLinkProps {
	path: string;
	lineStart?: number;
	lineEnd?: number;
	label?: string;
	workspacePath?: string;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function FileLink({
	path,
	lineStart,
	lineEnd,
	label,
	workspacePath,
	onOpenFile,
}: FileLinkProps) {
	const displayText = label ?? formatFileLocation(path, lineStart, lineEnd);

	if (!onOpenFile) {
		return <code className={styles["file-link"]}>{displayText}</code>;
	}

	return (
		<button
			type="button"
			className={styles["file-link"]}
			title={`Open ${displayText}`}
			onClick={() => void onOpenFile(path, workspacePath)}
		>
			<code>{displayText}</code>
		</button>
	);
}
