import { useId } from "react";
import { cx } from "@/shared/format.js";
import styles from "./TextAreaInput.module.css";

export interface TextAreaInputProps {
	label: string;
	value: string;
	onChange: (value: string) => void;
	hint?: string;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	rows?: number;
	errorText?: string;
	forceInvalid?: boolean;
}

export function TextAreaInput({
	label,
	value,
	onChange,
	hint,
	placeholder,
	required = false,
	disabled = false,
	rows = 3,
	errorText = "Please fill out this field.",
	forceInvalid = false,
}: TextAreaInputProps) {
	const id = useId();
	const hintId = `${id}-hint`;
	const errorId = `${id}-error`;

	return (
		<div className={cx(styles["text-area-input"], forceInvalid && styles["-invalid"])}>
			<label className={styles.label} htmlFor={id}>
				{label}
				{required && <span aria-hidden="true"> *</span>}
			</label>
			{hint && (
				<span id={hintId} className={styles.hint}>
					{hint}
				</span>
			)}
			<textarea
				id={id}
				rows={rows}
				className={styles.control}
				value={value}
				placeholder={placeholder}
				required={required}
				disabled={disabled}
				aria-describedby={hint ? hintId : undefined}
				data-error={errorId}
				onChange={e => onChange(e.target.value)}
			/>
			<span id={errorId} className={styles.error}>
				{errorText}
			</span>
		</div>
	);
}
