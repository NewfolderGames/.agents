import { useId } from "react";
import styles from "./TextAreaInput.module.css";

export interface TextAreaInputProps {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	rows?: number;
	ariaLabel?: string;
	errorMessage?: string;
}

/** Multi-line text input primitive pre-wired for `:user-invalid` live validation hints. */
export function TextAreaInput({
	id,
	value,
	onChange,
	placeholder,
	required = false,
	disabled = false,
	rows = 3,
	ariaLabel,
	errorMessage = "This field is required.",
}: TextAreaInputProps) {
	const fallbackId = useId();
	const inputId = id ?? fallbackId;
	const errorId = `${inputId}-err`;

	return (
		<div className={styles["text-area"]}>
			<textarea
				id={inputId}
				rows={rows}
				className={styles.field}
				value={value}
				placeholder={placeholder}
				required={required}
				disabled={disabled}
				aria-label={ariaLabel}
				aria-invalid="false"
				data-error={errorId}
				onChange={e => onChange(e.target.value)}
			/>
			<span id={errorId} className={styles.error}>
				{errorMessage}
			</span>
		</div>
	);
}
