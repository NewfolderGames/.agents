import { useState } from "react";
import type { WidgetDisplayMode } from "@/shared/contracts.js";

/** Toggle straight between the configured default mode (`minimized` or `compact`) and `"full"`. */
export function useDisplayMode(defaultMode: WidgetDisplayMode): {
	displayMode: WidgetDisplayMode;
	toggleExpand: () => void;
} {
	const [manual, setManual] = useState<{
		forDefault: WidgetDisplayMode;
		mode: WidgetDisplayMode;
	} | null>(null);

	const displayMode
		= manual && manual.forDefault === defaultMode
			? manual.mode
			: defaultMode;

	const toggleExpand = () => {
		const nextMode: WidgetDisplayMode
			= displayMode === "full"
				? defaultMode === "full"
					? "compact"
					: defaultMode
				: "full";
		setManual({ forDefault: defaultMode, mode: nextMode });
	};

	return { displayMode, toggleExpand };
}
