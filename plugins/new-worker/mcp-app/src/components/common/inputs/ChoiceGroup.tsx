import { useId } from "react";
import type { QuestionOption } from "@/shared/schema.js";
import styles from "./ChoiceGroup.module.css";

export interface ChoiceGroupProps {
	legend: string;
	mode: "single" | "multi";
	options: QuestionOption[];
	value: string | string[];
	onChange: (value: string | string[]) => void;
	allowOther?: boolean;
	otherText?: string;
	onOtherTextChange?: (text: string) => void;
	hint?: string;
	required?: boolean;
	disabled?: boolean;
	errorText?: string;
}

export function ChoiceGroup({
	legend,
	mode,
	options,
	value,
	onChange,
	allowOther = false,
	otherText = "",
	onOtherTextChange,
	hint,
	required = false,
	disabled = false,
	errorText = "Select an option.",
}: ChoiceGroupProps) {
	const groupName = useId();
	const hintId = `${groupName}-hint`;
	const errorId = `${groupName}-error`;

	const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
	const isOtherSelected = selectedValues.includes("__other__");

	const handleSelect = (optionValue: string, checked: boolean) => {
		if (mode === "single") {
			onChange(optionValue);
			return;
		}
		if (checked) {
			onChange([...selectedValues.filter(v => v !== optionValue), optionValue]);
			return;
		}
		onChange(selectedValues.filter(v => v !== optionValue));
	};

	const renderOption = (opt: QuestionOption, idx: number) => {
		const checked = selectedValues.includes(opt.value);
		const controlId = `${groupName}-opt-${idx}`;
		return (
			<label key={opt.value} htmlFor={controlId} className={styles.option}>
				<input
					id={controlId}
					type={mode === "single" ? "radio" : "checkbox"}
					name={mode === "single" ? groupName : `${groupName}-${idx}`}
					value={opt.value}
					checked={checked}
					required={mode === "single" ? required : false}
					disabled={disabled}
					aria-describedby={hint ? hintId : undefined}
					data-error={errorId}
					onChange={e => handleSelect(opt.value, e.target.checked)}
				/>
				<span className={styles.text}>
					<span className={styles.title}>
						{opt.label}
						{opt.recommended ? " (Recommended)" : ""}
					</span>
					{opt.description && <span className={styles.desc}>{opt.description}</span>}
				</span>
			</label>
		);
	};

	return (
		<fieldset className={styles["choice-group"]}>
			<legend className={styles.legend}>
				{legend}
				{required && <span aria-hidden="true"> *</span>}
			</legend>
			{hint && (
				<span id={hintId} className={styles.hint}>
					{hint}
				</span>
			)}
			<div className={styles.options}>
				{options.map((opt, idx) => renderOption(opt, idx))}
				{allowOther && (
					<div className={styles.other}>
						<label className={styles.option} htmlFor={`${groupName}-other`}>
							<input
								id={`${groupName}-other`}
								type={mode === "single" ? "radio" : "checkbox"}
								name={mode === "single" ? groupName : `${groupName}-other`}
								value="__other__"
								checked={isOtherSelected}
								required={mode === "single" ? required : false}
								disabled={disabled}
								data-error={errorId}
								onChange={e => handleSelect("__other__", e.target.checked)}
							/>
							<span className={styles.text}>
								<span className={styles.title}>Other</span>
							</span>
						</label>
						{isOtherSelected && (
							<input
								type="text"
								className={styles.otherinput}
								value={otherText}
								placeholder="Specify other value..."
								required={required}
								disabled={disabled}
								aria-label={`${legend} (Other)`}
								onChange={e => onOtherTextChange?.(e.target.value)}
							/>
						)}
					</div>
				)}
			</div>
			<span id={errorId} className={styles.error}>
				{errorText}
			</span>
		</fieldset>
	);
}
