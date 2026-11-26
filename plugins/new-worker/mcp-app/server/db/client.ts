import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { drizzle, type NodeSQLiteDatabase } from "drizzle-orm/node-sqlite";
import type { SqlMigration } from "./migrations";
import { type MigrationRunResult, runMigrations } from "./migrator.js";

export type AppDrizzleDb = NodeSQLiteDatabase & {
	$client: DatabaseSync;
};

export interface DatabaseHandle {
	dataDir: string;
	dbPath: string;
	sqlite: DatabaseSync;
	db: AppDrizzleDb;
	migrationResult: MigrationRunResult;
	close: () => void;
}

export interface OpenDatabaseOptions {
	migrations?: readonly SqlMigration[];
}

export const SQLITE_FILENAME = "new-worker.sqlite";

/**
 * Open the embedded SQLite database via `node:sqlite` + Drizzle ORM, apply runtime
 * pragmas (`WAL`, `foreign_keys = ON`, `busy_timeout = 5000`), and execute pending
 * forward-only migrations.
 */
export function openDatabase(
	dataDirOrMemory: string,
	options: OpenDatabaseOptions = {},
): DatabaseHandle {
	const isMemory = dataDirOrMemory === ":memory:";
	const resolvedDir = isMemory ? ":memory:" : path.resolve(dataDirOrMemory);
	const dbPath = isMemory ? ":memory:" : path.join(resolvedDir, SQLITE_FILENAME);

	if (!isMemory) {
		fs.mkdirSync(resolvedDir, { recursive: true });
	}

	const sqlite = new DatabaseSync(dbPath);
	try {
		if (!isMemory) {
			sqlite.exec("PRAGMA journal_mode = WAL;");
			sqlite.exec("PRAGMA synchronous = NORMAL;");
		}
		sqlite.exec("PRAGMA foreign_keys = ON;");
		sqlite.exec("PRAGMA busy_timeout = 5000;");

		const migrationResult = runMigrations(sqlite, {
			dbPath,
			migrations: options.migrations,
		});

		const db = drizzle({ client: sqlite });
		return {
			dataDir: resolvedDir,
			dbPath,
			sqlite,
			db,
			migrationResult,
			close: () => {
				sqlite.close();
			},
		};
	}
	catch (err) {
		sqlite.close();
		throw err;
	}
}
