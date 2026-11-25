import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/shared/format.js";
import styles from "./ActionButton.module.css";

export interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: "default" | "primary" | "subtle" | "danger";
	active?: boolean;
}

export function ActionButton({
	variant = "default",
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
				active && styles["-active"],
				className,
			)}
			{...rest}
		>
			{children}
		</button>
	);
}
