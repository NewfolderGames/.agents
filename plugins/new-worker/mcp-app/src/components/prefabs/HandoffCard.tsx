import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import { CopyButton } from "@/components/common/buttons/CopyButton.js";
import { FileLink } from "@/components/common/display/FileLink.js";
import { MarkdownText } from "@/components/common/display/MarkdownText.js";
import { StatusBadge } from "@/components/common/display/StatusBadge.js";
import { useDisplayMode } from "@/hooks/useCollapsible.js";
import { formatShortTimestamp } from "@/shared/format.js";
import type { HandoffRecord, WidgetDisplayMode } from "@/shared/schema.js";
import styles from "./HandoffCard.module.css";

export interface HandoffCardProps {
	handoff: HandoffRecord;
	workspacePath?: string;
	defaultDisplayMode?: WidgetDisplayMode;
	onOpenFile?: (filePath: string, workspacePath?: string) => Promise<boolean>;
}

export function HandoffCard({
	handoff,
	workspacePath,
	defaultDisplayMode = "full",
	onOpenFile,
}: HandoffCardProps) {
	const { displayMode, toggleExpand } = useDisplayMode(defaultDisplayMode);

	if (displayMode === "minimized") {
		return (
			<article className={styles["handoff-card"]}>
				<div className={styles.minrow}>
					<span className={styles.mintitle}>
						{handoff.taskNumber
							? `Task ${handoff.taskNumber} · ${handoff.title}`
							: handoff.title}
					</span>
					<div className={styles.minmeta}>
						<StatusBadge label={handoff.kind} />
						<ActionButton variant="subtle" onClick={toggleExpand}>
							Expand
						</ActionButton>
					</div>
				</div>
			</article>
		);
	}

	const isCompact = displayMode === "compact";

	return (
		<article className={styles["handoff-card"]}>
			<div className={styles.header}>
				<div className={styles.title}>
					<strong className={styles.heading}>{handoff.title}</strong>
					{handoff.taskNumber && (
						<code>
							Task
							{" "}
							{handoff.taskNumber}
						</code>
					)}
				</div>
				<div className={styles.meta}>
					<StatusBadge label={handoff.kind} />
					<span className={styles.time}>{formatShortTimestamp(handoff.createdAt)}</span>
					<ActionButton variant="subtle" onClick={toggleExpand}>
						{isCompact ? "Expand" : "Minimize"}
					</ActionButton>
				</div>
			</div>

			{isCompact
				? (
						<p className={styles.minimized}>
							{handoff.nextStep
								? `Next: ${handoff.nextStep}`
								: handoff.summary}
						</p>
					)
				: (
						<>
							<MarkdownText content={handoff.summary} />

							{(handoff.workingNow || handoff.verifyCommand || handoff.entryPoint || handoff.nextStep) && (
								<dl className={styles.facts}>
									{handoff.workingNow && (
										<>
											<dt className={styles.term}>Working now</dt>
											<dd className={styles.desc}>{handoff.workingNow}</dd>
										</>
									)}
									{handoff.verifyCommand && (
										<>
											<dt className={styles.term}>Verify</dt>
											<dd className={styles.desc}>
												<code>{handoff.verifyCommand}</code>
												{" "}
												<CopyButton text={handoff.verifyCommand} label="Copy" />
											</dd>
										</>
									)}
									{handoff.entryPoint && (
										<>
											<dt className={styles.term}>Entry point</dt>
											<dd className={styles.desc}>
												<code>{handoff.entryPoint}</code>
											</dd>
										</>
									)}
									{handoff.nextStep && (
										<>
											<dt className={styles.term}>Next step</dt>
											<dd className={styles.desc}>{handoff.nextStep}</dd>
										</>
									)}
								</dl>
							)}

							{handoff.artifactLinks.length > 0 && (
								<div className={styles.links}>
									{handoff.artifactLinks.map((ref, idx) => (
										<FileLink
											key={`${ref.path}-${idx}`}
											path={ref.path}
											lineStart={ref.lineStart}
											lineEnd={ref.lineEnd}
											label={ref.label}
											workspacePath={workspacePath}
											onOpenFile={onOpenFile}
										/>
									))}
								</div>
							)}

							{handoff.structuredData && (
								<details className={styles.raw}>
									<summary>Structured Data</summary>
									<pre className={styles.json}>
										{JSON.stringify(handoff.structuredData, null, 2)}
									</pre>
								</details>
							)}
						</>
					)}
		</article>
	);
}
