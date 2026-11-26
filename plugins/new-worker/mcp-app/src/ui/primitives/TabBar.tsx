import { type KeyboardEvent, useEffect, useRef } from "react";
import styles from "./TabBar.module.css";

/** Metadata describing one tab button inside {@link TabBar}. */
export interface TabBarItem<T extends string> {
	id: T;
	label: string;
	count?: number;
}

/** Props accepted by {@link TabBar}. */
export interface TabBarProps<T extends string> {
	ariaLabel: string;
	tabs: Array<TabBarItem<T>>;
	activeTab: T;
	onSelectTab: (tab: T) => void;
}

/** Accessible single-row ARIA tabstrip with arrow-key navigation and active-tab scroll centering. */
export function TabBar<T extends string>({
	ariaLabel,
	tabs,
	activeTab,
	onSelectTab,
}: TabBarProps<T>) {
	const tabRefs = useRef<Map<T, HTMLButtonElement>>(new Map());

	useEffect(() => {
		const el = tabRefs.current.get(activeTab);
		if (el && typeof el.scrollIntoView === "function") {
			el.scrollIntoView({
				block: "nearest",
				inline: "nearest",
				container: "nearest",
			} as ScrollIntoViewOptions);
		}
	}, [activeTab]);

	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const index = tabs.findIndex(t => t.id === activeTab);
		if (index === -1) {
			return;
		}
		let nextIndex: number | null = null;
		if (event.key === "ArrowRight") {
			nextIndex = (index + 1) % tabs.length;
		}
		else if (event.key === "ArrowLeft") {
			nextIndex = (index - 1 + tabs.length) % tabs.length;
		}
		else if (event.key === "Home") {
			nextIndex = 0;
		}
		else if (event.key === "End") {
			nextIndex = tabs.length - 1;
		}
		if (nextIndex === null) {
			return;
		}
		event.preventDefault();
		const nextTab = tabs[nextIndex];
		if (nextTab) {
			onSelectTab(nextTab.id);
			tabRefs.current.get(nextTab.id)?.focus();
		}
	};

	return (
		<div
			className={styles["tab-bar"]}
			role="tablist"
			aria-label={ariaLabel}
			onKeyDown={handleKeyDown}
		>
			{tabs.map((tab) => {
				const selected = tab.id === activeTab;
				return (
					<button
						key={tab.id}
						ref={(el) => {
							if (el) {
								tabRefs.current.set(tab.id, el);
							}
							else {
								tabRefs.current.delete(tab.id);
							}
						}}
						type="button"
						role="tab"
						id={`tab-${tab.id}`}
						className={styles.tab}
						aria-selected={selected}
						tabIndex={selected ? 0 : -1}
						onClick={() => onSelectTab(tab.id)}
					>
						{tab.count !== undefined ? `${tab.label} (${tab.count})` : tab.label}
					</button>
				);
			})}
		</div>
	);
}
