import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import type { StepDisplayOverride, UiSettings, WidgetDisplayMode } from "@/shared/schema.js";
import styles from "./SettingsPanel.module.css";

export interface SettingsPanelProps {
	settings: UiSettings;
	isBusy?: boolean;
	onUpdateSettings: (patch: {
		displayType?: WidgetDisplayMode;
		stepDisplayType?: StepDisplayOverride;
	}) => void;
	onClose: () => void;
}

export function SettingsPanel({
	settings,
	isBusy = false,
	onUpdateSettings,
	onClose,
}: SettingsPanelProps) {
	return (
		<section className={styles["settings-panel"]} aria-label="Display settings">
			<div className={styles.header}>
				<strong className={styles.title}>Display Settings</strong>
				<ActionButton variant="subtle" onClick={onClose}>
					Close
				</ActionButton>
			</div>

			<div className={styles.rows}>
				<div className={styles.row}>
					<div className={styles.labelgroup}>
						<span className={styles.label}>Display type</span>
						<span className={styles.hint}>Default layout for all widgets</span>
					</div>
					<div className={styles.options}>
						<ActionButton
							variant="subtle"
							active={settings.displayType === "minimized"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ displayType: "minimized" })}
						>
							Minimized
						</ActionButton>
						<ActionButton
							variant="subtle"
							active={settings.displayType === "compact"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ displayType: "compact" })}
						>
							Compact
						</ActionButton>
						<ActionButton
							variant="subtle"
							active={settings.displayType === "full"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ displayType: "full" })}
						>
							Full
						</ActionButton>
					</div>
				</div>

				<div className={styles.row}>
					<div className={styles.labelgroup}>
						<span className={styles.label}>Step display type</span>
						<span className={styles.hint}>
							Override display type for the step widget
						</span>
					</div>
					<div className={styles.options}>
						<ActionButton
							variant="subtle"
							active={settings.stepDisplayType === "inherit"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ stepDisplayType: "inherit" })}
						>
							Default
						</ActionButton>
						<ActionButton
							variant="subtle"
							active={settings.stepDisplayType === "minimized"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ stepDisplayType: "minimized" })}
						>
							Minimized
						</ActionButton>
						<ActionButton
							variant="subtle"
							active={settings.stepDisplayType === "compact"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ stepDisplayType: "compact" })}
						>
							Compact
						</ActionButton>
						<ActionButton
							variant="subtle"
							active={settings.stepDisplayType === "full"}
							disabled={isBusy}
							onClick={() => onUpdateSettings({ stepDisplayType: "full" })}
						>
							Full
						</ActionButton>
					</div>
				</div>
			</div>
		</section>
	);
}
