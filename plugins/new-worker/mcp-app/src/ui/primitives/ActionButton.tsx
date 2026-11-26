import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/shared/format.js";
import styles from "./ActionButton.module.css";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "primary" | "subtle" | "danger";
	size?: "default" | "compact";
	active?: boolean;
}

/** RSCSS button primitive supporting `default`, `primary`, `subtle`, and `danger` variants. */
export function ActionButton({
	variant = "default",
	size = "default",
	active = false,
	className,
	type = "button",
	children,
	...rest
}: ActionButtonProps) {
	return (
		<button
			type={type}
			className={cx(
				styles["action-button"],
				variant !== "default" && styles[`-${variant}`],
				size === "compact" && styles["-compact"],
				active && styles["-active"],
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	);
}
