import { ActionButton } from "@/components/common/buttons/ActionButton.js";
import styles from "./FilterBar.module.css";

export interface FilterOption {
	value: string;
	label: string;
}

export interface FilterBarProps {
	options: FilterOption[];
	value: string;
	onChange: (value: string) => void;
}

export function FilterBar({ options, value, onChange }: FilterBarProps) {
	return (
		<div className={styles["filter-bar"]} role="group" aria-label="Filter options">
			{options.map(opt => (
				<ActionButton
					key={opt.value}
					variant="subtle"
					active={opt.value === value}
					aria-pressed={opt.value === value}
					onClick={() => onChange(opt.value)}
				>
					{opt.label}
				</ActionButton>
			))}
		</div>
	);
}
