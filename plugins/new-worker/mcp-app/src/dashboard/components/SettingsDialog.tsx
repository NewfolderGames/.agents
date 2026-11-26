import type { StepDisplayOverride, UiSettings, WidgetDisplayMode } from "@/shared/contracts.js";
import { ActionButton } from "@/ui/primitives/ActionButton.js";
import { ModalDialog } from "@/ui/primitives/ModalDialog.js";
import styles from "./SettingsDialog.module.css";

export interface SettingsDialogProps {
	open: boolean;
	settings: UiSettings;
	isBusy: boolean;
	onUpdateSettings: (patch: {
		displayType?: WidgetDisplayMode;
		stepDisplayType?: StepDisplayOverride;
	}) => void;
	onClose: () => void;
}

/** Modal dialog for updating persistent inline widget and step-widget display mode settings. */
export function SettingsDialog({
	open,
	settings,
	isBusy,
	onUpdateSettings,
	onClose,
}: SettingsDialogProps) {
	return (
		<ModalDialog open={open} title="Inline Widget Display Settings" onClose={onClose}>
			<div className={styles["settings-dialog"]}>
				<p className={styles.hint}>
					These layout modes apply only to inline chat widgets, never the Dashboard.
				</p>

				<div className={styles.row}>
					<span className={styles.label}>Default Widget Display</span>
					<div className={styles.options}>
						{(["minimized", "compact", "full"] as const).map(mode => (
							<ActionButton
								key={mode}
								variant="subtle"
								active={settings.displayType === mode}
								disabled={isBusy}
								onClick={() => onUpdateSettings({ displayType: mode })}
							>
								{mode}
							</ActionButton>
						))}
					</div>
				</div>

				<div className={styles.row}>
					<span className={styles.label}>Step Widget Override</span>
					<div className={styles.options}>
						{(["inherit", "minimized", "compact", "full"] as const).map(mode => (
							<ActionButton
								key={mode}
								variant="subtle"
								active={settings.stepDisplayType === mode}
								disabled={isBusy}
								onClick={() => onUpdateSettings({ stepDisplayType: mode })}
							>
								{mode === "inherit" ? "Default" : mode}
							</ActionButton>
						))}
					</div>
				</div>
			</div>
		</ModalDialog>
	);
}
