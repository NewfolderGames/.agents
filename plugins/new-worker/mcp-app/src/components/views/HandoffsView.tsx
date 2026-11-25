import { useState } from "react";
import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { EmptyState } from "@/components/common/display/EmptyState.js";
import { FilterBar } from "@/components/common/display/FilterBar.js";
import { HandoffCard } from "@/components/prefabs/HandoffCard.js";
import { ToolCallRow } from "@/components/prefabs/ToolCallRow.js";
import type { HandoffRecord, ToolCallRecord, WidgetDisplayMode } from "@/shared/schema.js";
import styles from "./HandoffsView.module.css";

export interface HandoffsViewProps {
	tab: "handoffs" | "calls";
	handoffs: HandoffRecord[];
	toolCalls: ToolCallRecord[];
	workspacePath?: string;
	defaultDisplayMode?: WidgetDisplayMode;
	isBusy?: boolean;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
	onClearToolCalls?: () => void;
}

export function HandoffsView({
	tab,
	handoffs,
	toolCalls,
	workspacePath,
	defaultDisplayMode = "full",
	isBusy = false,
	onOpenFile,
	onClearToolCalls,
}: HandoffsViewProps) {
	const [toolFilter, setToolFilter] = useState("all");

	if (tab === "handoffs") {
		if (handoffs.length === 0) {
			return (
				<EmptyState
					title="No handoffs recorded yet."
					detail="Structured handoffs created via record_handoff appear here."
				/>
			);
		}
		return (
			<div className={styles["handoffs-view"]}>
				{handoffs.map(handoff => (
					<HandoffCard
						key={handoff.id}
						handoff={handoff}
						workspacePath={workspacePath}
						defaultDisplayMode={defaultDisplayMode}
						onOpenFile={onOpenFile}
					/>
				))}
			</div>
		);
	}

	if (toolCalls.length === 0) {
		return (
			<EmptyState
				title="No tool calls recorded yet."
				detail="Model tool invocations against this session are logged here chronologically."
			/>
		);
	}

	const toolNames = Array.from(new Set(toolCalls.map(c => c.toolName)));
	const filterOptions = [
		{ value: "all", label: `All (${toolCalls.length})` },
		...toolNames.map(name => ({
			value: name,
			label: `${name} (${toolCalls.filter(c => c.toolName === name).length})`,
		})),
	];
	const visibleCalls
		= toolFilter === "all"
			? toolCalls
			: toolCalls.filter(c => c.toolName === toolFilter);

	return (
		<div className={styles["handoffs-view"]}>
			<div className={styles.toolbar}>
				<FilterBar
					options={filterOptions}
					value={toolFilter}
					onChange={setToolFilter}
				/>
				{onClearToolCalls && (
					<ActionButton
						variant="danger"
						disabled={isBusy || toolCalls.length === 0}
						onClick={() => {
							setToolFilter("all");
							onClearToolCalls();
						}}
					>
						Clear History
					</ActionButton>
				)}
			</div>
			<div className={styles.list}>
				{visibleCalls.map(call => (
					<ToolCallRow key={call.id} call={call} />
				))}
			</div>
		</div>
	);
}
