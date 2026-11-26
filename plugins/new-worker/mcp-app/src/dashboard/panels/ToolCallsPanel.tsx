import { useState } from "react";
import type { ToolCallRecord } from "@/shared/contracts.js";
import { formatShortTimestamp } from "@/shared/format.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { EmptyState } from "@/ui/primitives/EmptyState.js";
import { FilterPills } from "@/ui/primitives/FilterPills.js";
import { StatusBadge } from "@/ui/primitives/StatusBadge.js";
import styles from "./ToolCallsPanel.module.css";

export interface ToolCallsPanelProps {
	toolCalls: ToolCallRecord[];
	isBusy: boolean;
	canClear: boolean;
	onRequestClear: () => void;
}

/** Dashboard panel displaying chronological mutating tool calls with per-tool filters and clear action. */
export function ToolCallsPanel({
	toolCalls,
	isBusy,
	canClear,
	onRequestClear,
}: ToolCallsPanelProps) {
	const [toolFilter, setToolFilter] = useState("all");

	if (toolCalls.length === 0) {
		return (
			<EmptyState
				title="No tool calls recorded yet."
				detail="Mutating model tool calls against sessions are logged here chronologically."
			/>
		);
	}

	const names = Array.from(new Set(toolCalls.map(c => c.toolName)));
	const visible = toolFilter === "all"
		? toolCalls
		: toolCalls.filter(c => c.toolName === toolFilter);

	return (
		<div className={styles["calls-panel"]}>
			<div className={styles.toolbar}>
				<FilterPills
					ariaLabel="Filter tool calls by tool name"
					value={toolFilter}
					onChange={setToolFilter}
					options={[
						{ value: "all", label: `All (${toolCalls.length})` },
						...names.map(name => ({
							value: name,
							label: `${name} (${toolCalls.filter(c => c.toolName === name).length})`,
						})),
					]}
				/>
				{canClear && (
					<ActionButton
						variant="danger"
						size="compact"
						disabled={isBusy}
						onClick={onRequestClear}
					>
						Clear History
					</ActionButton>
				)}
			</div>

			<div className={styles.list}>
				{visible.map(call => (
					<div key={call.id} className={styles.row}>
						<div className={styles.head}>
							<code>{call.toolName}</code>
							<div>
								<StatusBadge
									label={call.status}
									tone={call.status === "ok" ? "success" : "danger"}
								/>
								{" "}
								<StatusBadge label={formatShortTimestamp(call.timestamp)} />
							</div>
						</div>
						<div className={styles.summary}>{call.summary}</div>
						{call.argsSummary && <code>{call.argsSummary}</code>}
					</div>
				))}
			</div>
		</div>
	);
}
