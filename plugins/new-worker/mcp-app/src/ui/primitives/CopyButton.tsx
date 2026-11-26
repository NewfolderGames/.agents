import { useState } from "react";
import { ActionButton } from "./ActionButton.js";
import styles from "./CopyButton.module.css";

export interface CopyButtonProps {
	text: string;
	label?: string;
	copiedLabel?: string;
	size?: "default" | "compact";
}

/** Clipboard copy button displaying temporary confirmation feedback after copying `text`. */
export function CopyButton({
	text,
	label = "Copy",
	copiedLabel = "Copied",
	size = "compact",
}: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(true);
			setTimeout(() => setCopied(false), 1800);
		}
		catch {
			setCopied(false);
		}
	};

	return (
		<span className={styles["copy-button"]}>
			<ActionButton
				variant="subtle"
				size={size}
				onClick={() => void handleCopy()}
				disabled={!text}
			>
				{copied ? copiedLabel : label}
			</ActionButton>
		</span>
	);
}
