import type { ReactNode } from "react";
import styles from "./DataTable.module.css";

export interface DataTableProps {
	headers: string[];
	rows: ReactNode[][];
}

export function DataTable({ headers, rows }: DataTableProps) {
	return (
		<div className={styles["data-table"]}>
			<table className={styles.table}>
				<thead className={styles.head}>
					<tr className={styles.row}>
						{headers.map(h => (
							<th key={h} className={styles.cell}>
								{h}
							</th>
						))}
					</tr>
				</thead>
				<tbody className={styles.body}>
					{rows.map((cells, rowIdx) => (
						<tr key={rowIdx} className={styles.row}>
							{cells.map((cell, cellIdx) => (
								<td key={cellIdx} className={styles.cell}>
									{cell}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
