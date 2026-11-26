import { useId } from "react";
import type { QuestionOption } from "@/shared/contracts.js";
import { cx } from "@/shared/format.js";
import { StatusBadge } from "./StatusBadge.js";
import styles from "./ChoiceGroup.module.css";

export interface ChoiceGroupProps {
	mode: "single" | "multi";
	options: QuestionOption[];
	value: string | string[] | undefined;
	allowOther?: boolean;
	otherText?: string;
	required?: boolean;
	disabled?: boolean;
	onChange: (value: string | string[]) => void;
	onOtherTextChange?: (text: string) => void;
}

/** Radio or checkbox group primitive supporting optional free-text `"Other"` answers. */
export function ChoiceGroup({
	mode,
	options,
	value,
	allowOther = false,
	otherText = "",
	required = false,
	disabled = false,
	onChange,
	onOtherTextChange,
}: ChoiceGroupProps) {
	const groupName = useId();
	const selectedSet = new Set(
		Array.isArray(value) ? value : typeof value === "string" && value ? [value] : [],
	);

	const handleToggle = (optValue: string) => {
		if (mode === "single") {
			onChange(optValue);
			return;
		}
		const next = new Set(selectedSet);
		if (next.has(optValue)) {
			next.delete(optValue);
		}
		else {
			next.add(optValue);
		}
		onChange(Array.from(next));
	};

	const hasOtherSelected = selectedSet.has("__other__");

	return (
		<div className={styles["choice-group"]}>
			{options.map((opt, idx) => {
				const isSelected = selectedSet.has(opt.value);
				return (
					<label
						key={opt.value}
						className={cx(styles.option, isSelected && styles["-selected"])}
					>
						<input
							className={styles.control}
							type={mode === "single" ? "radio" : "checkbox"}
							name={mode === "single" ? groupName : `${groupName}-${idx}`}
							value={opt.value}
							checked={isSelected}
							required={mode === "single" ? required : false}
							disabled={disabled}
							onChange={() => handleToggle(opt.value)}
						/>
						<span className={styles.content}>
							<span className={styles.top}>
								<span className={styles.label}>{opt.label}</span>
								{opt.recommended && <StatusBadge label="Recommended" tone="info" />}
							</span>
							{opt.description && (
								<span className={styles.description}>{opt.description}</span>
							)}
						</span>
					</label>
				);
			})}

			{allowOther && (
				<>
					<label
						className={cx(styles.option, hasOtherSelected && styles["-selected"])}
					>
						<input
							className={styles.control}
							type={mode === "single" ? "radio" : "checkbox"}
							name={mode === "single" ? groupName : `${groupName}-other`}
							value="__other__"
							checked={hasOtherSelected}
							required={mode === "single" ? required : false}
							disabled={disabled}
							onChange={() => handleToggle("__other__")}
						/>
						<span className={styles.content}>
							<span className={styles.top}>
								<span className={styles.label}>Other</span>
							</span>
							<span className={styles.description}>Provide a custom response</span>
						</span>
					</label>
					{hasOtherSelected && (
						<div className={styles.other}>
							<input
								type="text"
								className={styles.input}
								value={otherText}
								placeholder="Enter custom answer..."
								required={required}
								disabled={disabled}
								aria-label="Custom answer"
								onChange={e => onOtherTextChange?.(e.target.value)}
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}
