import { type ReactNode, useId } from "react";
import styles from "./DataTable.module.css";

export interface DataTableColumn<T> {
	key: string;
	header: string;
	render: (row: T) => ReactNode;
	isRowHeader?: boolean;
}

export interface DataTableProps<T> {
	caption: string;
	hideCaption?: boolean;
	rows: T[];
	columns: Array<DataTableColumn<T>>;
	getRowKey: (row: T, index: number) => string;
}

/** Container-responsive scrollable data table with keyboard scroll focus (`tabIndex={0}`). */
export function DataTable<T>({
	caption,
	hideCaption = false,
	rows,
	columns,
	getRowKey,
}: DataTableProps<T>) {
	const captionId = useId();

	return (
		<div
			tabIndex={0}
			role="region"
			aria-labelledby={captionId}
			className={styles["data-table"]}
		>
			<table className={styles.table}>
				<caption
					id={captionId}
					className={hideCaption ? "visually-hidden" : styles.caption}
				>
					{caption}
				</caption>
				<thead>
					<tr>
						{columns.map(col => (
							<th key={col.key} scope="col">
								{col.header}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, index) => (
						<tr key={getRowKey(row, index)}>
							{columns.map(col =>
								col.isRowHeader
									? (
											<th key={col.key} scope="row">
												{col.render(row)}
											</th>
										)
									: (
											<td key={col.key} data-label={col.header}>
												{col.render(row)}
											</td>
										))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
