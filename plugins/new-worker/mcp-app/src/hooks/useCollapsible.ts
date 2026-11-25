import { useState } from "react";
import type { WidgetDisplayMode } from "../shared/schema.js";

export function useCollapsible(defaultCollapsed: boolean): {
	collapsed: boolean;
	toggle: () => void;
} {
	const [manual, setManual] = useState<{
		forDefault: boolean;
		collapsed: boolean;
	} | null>(null);
	const collapsed
		= manual && manual.forDefault === defaultCollapsed
			? manual.collapsed
			: defaultCollapsed;
	const toggle = () =>
		setManual({ forDefault: defaultCollapsed, collapsed: !collapsed });
	return { collapsed, toggle };
}

export function useDisplayMode(defaultMode: WidgetDisplayMode): {
	displayMode: WidgetDisplayMode;
	setDisplayMode: (mode: WidgetDisplayMode) => void;
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
	const setDisplayMode = (mode: WidgetDisplayMode) =>
		setManual({ forDefault: defaultMode, mode });
	const toggleExpand = () =>
		setDisplayMode(
			displayMode === "full"
				? defaultMode === "full"
					? "compact"
					: defaultMode
				: "full",
		);
	return { displayMode, setDisplayMode, toggleExpand };
}
