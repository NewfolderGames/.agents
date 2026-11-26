import crypto from "node:crypto";
import fs from "node:fs";
import type { DatabaseSync } from "node:sqlite";
import { MigrationError } from "../repositories/errors.js";
import { MIGRATIONS, type SqlMigration } from "./migrations";

export interface AppliedMigrationRecord {
	version: number;
	name: string;
	checksum: string;
	appliedAt: string;
}

export interface MigrationRunResult {
	currentVersion: number;
	appliedVersions: number[];
	backupPath?: string;
}

export interface MigrationStatus {
	currentVersion: number;
	latestVersion: number;
	applied: AppliedMigrationRecord[];
	pending: Array<{ version: number; name: string }>;
}

interface MigrationRow {
	version: number;
	name: string;
	checksum: string;
	applied_at: string;
}

const CREATE_MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
	version INTEGER PRIMARY KEY,
	name TEXT NOT NULL,
	checksum TEXT NOT NULL,
	applied_at TEXT NOT NULL
);`;

/** Compute deterministic SHA-256 hex checksum of migration SQL. */
export function computeMigrationChecksum(sql: string): string {
	return crypto.createHash("sha256").update(sql.trim(), "utf8").digest("hex");
}

function validateMigrationDefinitions(migrations: readonly SqlMigration[]): void {
	let prevVersion = 0;
	for (const migration of migrations) {
		if (!Number.isInteger(migration.version) || migration.version <= prevVersion) {
			throw new MigrationError(
				`Migration versions must be strictly ascending integers (found ${migration.version} after ${prevVersion}).`,
				migration.version,
			);
		}
		if (!migration.name.trim()) {
			throw new MigrationError(
				`Migration v${migration.version} has an empty name.`,
				migration.version,
			);
		}
		prevVersion = migration.version;
	}
}

function readUserVersion(db: DatabaseSync): number {
	const row = db.prepare("PRAGMA user_version").get() as { user_version?: number } | undefined;
	return typeof row?.user_version === "number" ? row.user_version : 0;
}

function isMigrationRow(value: unknown): value is MigrationRow {
	if (!value || typeof value !== "object") {
		return false;
	}
	const row = value as Partial<Record<keyof MigrationRow, unknown>>;
	return (
		(typeof row.version === "number" || typeof row.version === "bigint")
		&& typeof row.name === "string"
		&& typeof row.checksum === "string"
		&& typeof row.applied_at === "string"
	);
}

function readAppliedMigrations(db: DatabaseSync): AppliedMigrationRecord[] {
	db.exec(CREATE_MIGRATIONS_TABLE_SQL);
	const rawRows = db
		.prepare("SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version ASC")
		.all();
	return rawRows.map((row) => {
		if (!isMigrationRow(row)) {
			throw new MigrationError("Malformed row returned from schema_migrations.");
		}
		return {
			version: Number(row.version),
			name: row.name,
			checksum: row.checksum,
			appliedAt: row.applied_at,
		};
	});
}

function createPreMigrationBackup(db: DatabaseSync, dbPath: string, currentVersion: number): string {
	try {
		db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
	}
	catch {
		// Ignore checkpoint errors if database has no WAL yet.
	}
	const stamp = new Date().toISOString().replace(/[:.]/g, "-");
	const backupPath = `${dbPath}.v${currentVersion}-${stamp}.bak`;
	fs.copyFileSync(dbPath, backupPath);
	return backupPath;
}

/** Return applied and pending migration status without mutating schema state. */
export function getMigrationStatus(
	db: DatabaseSync,
	migrations: readonly SqlMigration[] = MIGRATIONS,
): MigrationStatus {
	validateMigrationDefinitions(migrations);
	const applied = readAppliedMigrations(db);
	const latestApplied = applied[applied.length - 1]?.version ?? 0;
	const userVersion = readUserVersion(db);
	const currentVersion = Math.max(latestApplied, userVersion);
	const appliedSet = new Set(applied.map(m => m.version));
	const latestVersion = migrations[migrations.length - 1]?.version ?? 0;

	return {
		currentVersion,
		latestVersion,
		applied,
		pending: migrations
			.filter(m => !appliedSet.has(m.version))
			.map(m => ({ version: m.version, name: m.name })),
	};
}

/**
 * Run forward-only SQL migrations inside explicit transactions.
 * Creates an automatic `.bak` snapshot when upgrading an existing on-disk database.
 */
export function runMigrations(
	db: DatabaseSync,
	options: {
		dbPath?: string;
		migrations?: readonly SqlMigration[];
	} = {},
): MigrationRunResult {
	const migrations = options.migrations ?? MIGRATIONS;
	validateMigrationDefinitions(migrations);

	const applied = readAppliedMigrations(db);
	const latestCodeVersion = migrations[migrations.length - 1]?.version ?? 0;
	const latestAppliedVersion = applied[applied.length - 1]?.version ?? 0;
	const userVersion = readUserVersion(db);
	const currentVersion = Math.max(latestAppliedVersion, userVersion);

	if (currentVersion > latestCodeVersion) {
		throw new MigrationError(
			`Database schema version v${currentVersion} is newer than max supported v${latestCodeVersion}.`,
			currentVersion,
		);
	}

	const appliedByVersion = new Map(applied.map(item => [item.version, item]));
	for (const migration of migrations) {
		const recorded = appliedByVersion.get(migration.version);
		if (!recorded) {
			continue;
		}
		const expectedChecksum = computeMigrationChecksum(migration.sql);
		if (recorded.checksum !== expectedChecksum) {
			throw new MigrationError(
				`Checksum mismatch for applied migration v${migration.version} (${migration.name}).`,
				migration.version,
			);
		}
	}

	const pending = migrations.filter(m => !appliedByVersion.has(m.version));
	if (pending.length === 0) {
		return {
			currentVersion,
			appliedVersions: [],
		};
	}

	let backupPath: string | undefined;
	if (
		applied.length > 0
		&& options.dbPath
		&& options.dbPath !== ":memory:"
		&& fs.existsSync(options.dbPath)
	) {
		backupPath = createPreMigrationBackup(db, options.dbPath, currentVersion);
	}

	const insertStmt = db.prepare(
		"INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
	);
	const appliedVersions: number[] = [];

	for (const migration of pending) {
		const checksum = computeMigrationChecksum(migration.sql);
		const appliedAt = new Date().toISOString();
		db.exec("BEGIN IMMEDIATE");
		try {
			db.exec(migration.sql);
			insertStmt.run(migration.version, migration.name, checksum, appliedAt);
			db.exec(`PRAGMA user_version = ${migration.version}`);
			db.exec("COMMIT");
			appliedVersions.push(migration.version);
		}
		catch (err) {
			try {
				db.exec("ROLLBACK");
			}
			catch {
				// Ignore rollback failure if transaction was already aborted by SQLite.
			}
			throw new MigrationError(
				`Failed to apply migration v${migration.version} (${migration.name}): ${
					err instanceof Error ? err.message : String(err)
				}`,
				migration.version,
				{ cause: err },
			);
		}
	}

	return {
		currentVersion: pending[pending.length - 1]?.version ?? currentVersion,
		appliedVersions,
		backupPath,
	};
}
