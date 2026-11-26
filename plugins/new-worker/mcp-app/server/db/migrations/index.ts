import { MIGRATION_0001_INITIAL, type SqlMigration } from "./0001_initial.js";

export { MIGRATION_0001_INITIAL, type SqlMigration };

/** Ordered forward-only SQLite migrations. Never reorder or edit an applied migration. */
export const MIGRATIONS: readonly SqlMigration[] = [
	MIGRATION_0001_INITIAL,
];
