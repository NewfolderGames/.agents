import { useState } from "react";
import type { ToolCallRecord } from "@/shared/contracts.js";
import { formatShortTimestamp } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./LogFooter.module.css";

export interface LogFooterProps {
	isOpen: boolean;
	toolCalls: ToolCallRecord[];
	isBusy: boolean;
	canClear: boolean;
	onToggle: () => void;
	onRequestClear: () => void;
}

const MAX_VISIBLE_LOGS = 100;

/**
 * Footer log drawer displaying up to 100 chronological tool call logs in scrollable rows,
 * toggled via the Dashboard header or footer bar with a Clear All action.
 */
export function LogFooter({
	isOpen,
	toolCalls,
	isBusy,
	canClear,
	onToggle,
	onRequestClear,
}: LogFooterProps) {
	const [toolFilter, setToolFilter] = useState("all");
	const cappedCalls = toolCalls.slice(0, MAX_VISIBLE_LOGS);
	const toolNames = Array.from(new Set(cappedCalls.map(c => c.toolName))).sort();
	const activeFilter = toolFilter === "all" || toolNames.includes(toolFilter) ? toolFilter : "all";
	const visible = activeFilter === "all"
		? cappedCalls
		: cappedCalls.filter(c => c.toolName === activeFilter);

	return (
		<div className={styles["log-footer"]}>
			<div className={styles.bar}>
				<div className={styles.titlegroup}>
					<strong className={styles.title}>Log</strong>
					<StatusBadge label={`${cappedCalls.length} / ${MAX_VISIBLE_LOGS}`} />
					{isOpen && toolNames.length > 1 && (
						<select
							aria-label="Filter logs by tool"
							className={styles.filter}
							value={activeFilter}
							onChange={e => setToolFilter(e.target.value)}
						>
							<option value="all">{`All tools (${cappedCalls.length})`}</option>
							{toolNames.map(name => (
								<option key={name} value={name}>
									{`${name} (${cappedCalls.filter(c => c.toolName === name).length})`}
								</option>
							))}
						</select>
					)}
				</div>
				<div className={styles.actions}>
					{isOpen && canClear && (
						<ActionButton
							variant="danger"
							size="compact"
							disabled={isBusy || cappedCalls.length === 0}
							onClick={onRequestClear}
						>
							Clear All
						</ActionButton>
					)}
					<ActionButton
						variant="subtle"
						size="compact"
						onClick={onToggle}
					>
						{isOpen ? "Hide Logs" : "Show Logs"}
					</ActionButton>
				</div>
			</div>

			{isOpen && (
				<div
					className={styles.scroller}
					tabIndex={0}
					role="region"
					aria-label="Tool call logs"
				>
					{visible.length === 0
						? <p className={styles.empty}>No tool call logs recorded yet.</p>
						: (
								<ol role="list" className={styles.rows}>
									{visible.map(call => (
										<li key={call.id} className={styles.row}>
											<time
												className={styles.time}
												dateTime={call.timestamp}
												title={call.timestamp}
											>
												{formatShortTimestamp(call.timestamp)}
											</time>
											<StatusBadge
												label={call.status}
												tone={call.status === "ok" ? "success" : "danger"}
											/>
											<code className={styles.tool}>{call.toolName}</code>
											<span className={styles.summary}>{call.summary}</span>
											{call.argsSummary && (
												<code className={styles.args}>{call.argsSummary}</code>
											)}
										</li>
									))}
								</ol>
							)}
				</div>
			)}
		</div>
	);
}
