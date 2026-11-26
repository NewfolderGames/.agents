import { useId } from "react";
import styles from "./TextInput.module.css";

export interface TextInputProps {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	required?: boolean;
	disabled?: boolean;
	ariaLabel?: string;
	errorMessage?: string;
}

/** Single-line text input primitive pre-wired for `:user-invalid` live validation hints. */
export function TextInput({
	id,
	value,
	onChange,
	placeholder,
	required = false,
	disabled = false,
	ariaLabel,
	errorMessage = "This field is required.",
}: TextInputProps) {
	const fallbackId = useId();
	const inputId = id ?? fallbackId;
	const errorId = `${inputId}-err`;

	return (
		<div className={styles["text-input"]}>
			<input
				id={inputId}
				type="text"
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
