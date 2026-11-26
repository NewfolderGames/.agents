import { useEffect, useState } from "react";

export type ColorScheme = "light" | "dark";

function detectColorScheme(): ColorScheme {
	if (typeof document === "undefined" || typeof window === "undefined") {
		return "light";
	}

	const dataTheme = document.documentElement.dataset.theme;
	if (dataTheme === "dark" || dataTheme === "light") {
		return dataTheme;
	}

	const inlineScheme = document.documentElement.style.colorScheme.trim();
	if (inlineScheme === "dark" || inlineScheme === "light") {
		return inlineScheme;
	}

	return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Observe active light/dark theme from both MCP host overrides (`data-theme` / `colorScheme`
 * on `<html>`) and the OS `prefers-color-scheme` media query.
 */
export function useColorScheme(): ColorScheme {
	const [scheme, setScheme] = useState<ColorScheme>(detectColorScheme);

	useEffect(() => {
		const update = () => {
			setScheme(detectColorScheme());
		};

		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["data-theme", "style", "class"],
		});

		const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
		mediaQuery?.addEventListener("change", update);

		return () => {
			observer.disconnect();
			mediaQuery?.removeEventListener("change", update);
		};
	}, []);

	return scheme;
}
