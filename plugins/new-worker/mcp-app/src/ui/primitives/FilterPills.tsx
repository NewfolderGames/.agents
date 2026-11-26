import { ActionButton } from "./ActionButton.js";
import styles from "./FilterPills.module.css";

export interface FilterPillOption<T extends string> {
	value: T;
	label: string;
}

export interface FilterPillsProps<T extends string> {
	options: Array<FilterPillOption<T>>;
	value: T;
	onChange: (value: T) => void;
	ariaLabel?: string;
}

/** Horizontal filter button strip for narrowing panels by status, actor, or entity type. */
export function FilterPills<T extends string>({
	options,
	value,
	onChange,
	ariaLabel = "Filter options",
}: FilterPillsProps<T>) {
	return (
		<div className={styles["filter-pills"]} role="group" aria-label={ariaLabel}>
			{options.map(opt => (
				<ActionButton
					key={opt.value}
					variant="subtle"
					size="compact"
					active={opt.value === value}
					onClick={() => onChange(opt.value)}
				>
					{opt.label}
				</ActionButton>
			))}
		</div>
	);
}
