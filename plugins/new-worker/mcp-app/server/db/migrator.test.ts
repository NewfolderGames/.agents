import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { MigrationError } from "../repositories/errors.js";
import { openDatabase } from "./client.js";
import { MIGRATION_0001_INITIAL, type SqlMigration } from "./migrations";
import { getMigrationStatus, runMigrations } from "./migrator.js";
import { sessionGroups, sessions, tasks, timelineEvents, timelineLinks } from "./schema.js";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nw-sqlite-migrator-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) {
			fs.rmSync(dir, { recursive: true, force: true });
		}
	}
});

describe("SQLite migrator & Drizzle node:sqlite integration", () => {
	it("initializes v1 schema cleanly on a fresh database and stays idempotent", () => {
		const dir = makeTempDir();
		const first = openDatabase(dir);
		expect(first.migrationResult.currentVersion).toBe(1);
		expect(first.migrationResult.appliedVersions).toEqual([1]);
		expect(first.migrationResult.backupPath).toBeUndefined();

		const status = getMigrationStatus(first.sqlite);
		expect(status.currentVersion).toBe(1);
		expect(status.latestVersion).toBe(1);
		expect(status.pending).toEqual([]);
		expect(status.applied).toHaveLength(1);
		first.close();

		const second = openDatabase(dir);
		expect(second.migrationResult.currentVersion).toBe(1);
		expect(second.migrationResult.appliedVersions).toEqual([]);
		expect(second.migrationResult.backupPath).toBeUndefined();
		second.close();
	});

	it("creates an automatic .bak snapshot before applying v2 migrations to an existing DB", () => {
		const dir = makeTempDir();
		const initial = openDatabase(dir);
		const now = new Date().toISOString();
		initial.db
			.insert(sessions)
			.values({
				id: "s-1",
				title: "Initial Session",
				createdAt: now,
				updatedAt: now,
			})
			.run();
		initial.close();

		const v2Migration: SqlMigration = {
			version: 2,
			name: "add_session_notes",
			sql: "ALTER TABLE sessions ADD COLUMN notes TEXT;",
		};
		const upgraded = openDatabase(dir, {
			migrations: [MIGRATION_0001_INITIAL, v2Migration],
		});

		expect(upgraded.migrationResult.currentVersion).toBe(2);
		expect(upgraded.migrationResult.appliedVersions).toEqual([2]);
		expect(upgraded.migrationResult.backupPath).toBeDefined();
		expect(fs.existsSync(upgraded.migrationResult.backupPath!)).toBe(true);

		const columns = upgraded.sqlite
			.prepare("PRAGMA table_info(sessions)")
			.all() as Array<{ name: string }>;
		expect(columns.some(c => c.name === "notes")).toBe(true);
		upgraded.close();
	});

	it("rejects checksum mismatches on previously applied migrations", () => {
		const dir = makeTempDir();
		const first = openDatabase(dir);
		first.close();

		const tamperedV1: SqlMigration = {
			version: 1,
			name: "initial_schema",
			sql: "CREATE TABLE IF NOT EXISTS bogus (id INTEGER PRIMARY KEY);",
		};

		expect(() => openDatabase(dir, { migrations: [tamperedV1] })).toThrow(MigrationError);
	});

	it("rejects opening a database from a newer unsupported schema version", () => {
		const dir = makeTempDir();
		const first = openDatabase(dir);
		first.sqlite.exec("PRAGMA user_version = 99;");
		first.close();

		expect(() => openDatabase(dir)).toThrow(/newer than max supported/i);
	});

	it("rolls back failed migration SQL atomically without recording version", () => {
		const dir = makeTempDir();
		const first = openDatabase(dir);
		first.close();

		const badV2: SqlMigration = {
			version: 2,
			name: "broken_sql",
			sql: `
				CREATE TABLE temp_ok (id INTEGER PRIMARY KEY);
				THIS IS INVALID SQL SYNTAX;
			`,
		};

		expect(() =>
			openDatabase(dir, { migrations: [MIGRATION_0001_INITIAL, badV2] })).toThrow(MigrationError);

		const reopened = openDatabase(dir);
		const tables = reopened.sqlite
			.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'temp_ok'")
			.all();
		expect(tables).toEqual([]);
		expect(getMigrationStatus(reopened.sqlite).currentVersion).toBe(1);
		reopened.close();
	});

	it("supports Drizzle node:sqlite sync transactions, AUTOINCREMENT task IDs, and polymorphic links", () => {
		const handle = openDatabase(":memory:");
		const now = new Date().toISOString();

		const created = handle.db.transaction((tx) => {
			tx.insert(sessionGroups)
				.values({
					id: "grp-1",
					name: "Core Rewrite",
					description: "Multi-session group",
					createdAt: now,
					updatedAt: now,
				})
				.run();

			tx.insert(sessions)
				.values({
					id: "sess-a",
					groupId: "grp-1",
					title: "Session A",
					rootDir: "/tmp/repo-a",
					createdAt: now,
					updatedAt: now,
				})
				.run();

			const insertedTask = tx
				.insert(tasks)
				.values({
					sessionId: "sess-a",
					slug: "sqlite-setup",
					title: "SQLite Setup",
					status: "in_progress",
					summary: "Configure Drizzle with node:sqlite",
					createdAt: now,
					updatedAt: now,
				})
				.returning()
				.get();

			const event = tx
				.insert(timelineEvents)
				.values({
					sessionId: "sess-a",
					groupId: "grp-1",
					eventType: "task_created",
					actor: "agent",
					title: `Created Task #${insertedTask.id}`,
					createdAt: now,
				})
				.returning()
				.get();

			tx.insert(timelineLinks)
				.values([
					{
						eventId: event.id,
						entityType: "task",
						entityId: String(insertedTask.id),
						role: "subject",
						label: `Task #${insertedTask.id}`,
					},
					{
						eventId: event.id,
						entityType: "session",
						entityId: "sess-a",
						role: "parent",
						label: "Session A",
					},
				])
				.run();

			return { taskId: insertedTask.id, eventId: event.id };
		});

		expect(created.taskId).toBe(1);

		const fetchedLinks = handle.db
			.select()
			.from(timelineLinks)
			.where(eq(timelineLinks.eventId, created.eventId))
			.all();
		expect(fetchedLinks).toHaveLength(2);
		expect(runMigrations(handle.sqlite).appliedVersions).toEqual([]);
		handle.close();
	});
});
