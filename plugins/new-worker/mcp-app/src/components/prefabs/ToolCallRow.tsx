import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { formatShortTimestamp } from "@/shared/format.js";
import type { ToolCallRecord } from "@/shared/schema.js";
import styles from "./ToolCallRow.module.css";

export interface ToolCallRowProps {
	call: ToolCallRecord;
}

export function ToolCallRow({ call }: ToolCallRowProps) {
	return (
		<details className={styles["tool-call-row"]}>
			<summary className={styles.summary}>
				<span className={styles.left}>
					<code>{call.toolName}</code>
					<span className={styles.text}>{call.summary}</span>
				</span>
				<span className={styles.right}>
					<StatusBadge
						label={call.status}
						tone={call.status === "ok" ? "success" : "danger"}
					/>
					<span className={styles.time}>{formatShortTimestamp(call.timestamp)}</span>
				</span>
			</summary>
			{call.argsSummary && (
				<pre className={styles.args}>{call.argsSummary}</pre>
			)}
		</details>
	);
}
