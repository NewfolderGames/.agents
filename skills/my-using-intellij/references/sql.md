# Using IntelliJ Database and SQL MCP Tools

Use your default agent tools (`read_file`, `edit_file`, `rg`) first when inspecting or editing local `.sql` scripts, schema migrations, and ORM models. Escalate to these Database tools when querying live IDE data sources, testing JDBC connections, introspecting schemas, joining data across databases, or importing and exporting tabular data.

Parameters marked with `*` are required. Always pass `projectPath` on every tool call.

> [!WARNING]
> Never ask the user for database usernames or passwords in chat. Let the user enter credentials inside the IDE UI when authentication is required, unless the user already supplied credentials in the active conversation.

> [!CAUTION]
> Obtain explicit user confirmation before executing `DROP`, `TRUNCATE`, irreversible DDL or DML writes, or `import_data` writes (see `AGENTS.md` Section 4).

---

## 1. Connection Setup and Diagnostics

- `list_database_connections` (optional `projectPath` only): Call this tool first to obtain exact `connectionId` and `name` values. Inspect `isDDL` and `readOnly` before calling DBMS-only or write tools.
- `create_database_connection` (`dbms`*, `name`*, `needToCheckDs`*, `url`*): Create a data source using a predefined DBMS driver and an assembled JDBC URL. Never guess `localhost` or default ports. Set `needToCheckDs: false` for batch setup or `true` to probe immediately.
- `edit_database_connection` (`connectionId`*, `dbms`*, `needToCheckDs`*, `url`*): Update a non-DDL connection's driver and JDBC URL while keeping its `name` (cannot rename connections). Pass `driverName` as `dbms` when keeping the driver, and stop after 2 sequential failures without new user input.
- `test_database_connection` (`id`*): Verify driver, credentials, and network reachability for one non-DDL `connectionId`.

---

## 2. Schema Introspection and Object Metadata

- `list_database_schemas` (`connectionId`*): List schemas and `isIntrospected` flags. Preserve exact `databaseName` values (even `""`). If empty, call `test_database_connection` to distinguish connection failure from an empty database.
- `introspect_schema` (`connectionId`*, `databaseName`*, `schemaName`*): Load tables, columns, and indexes into the IDE model when `isIntrospected` is `false`. Call once per schema rather than before every query.
- `list_schema_object_kinds` (`connectionId`*): Retrieve hyphenated schema object kind codes (`table`, `view`, `materialized-view`, `foreign-table`, `routine`).
- `list_schema_objects` (`connectionId`*, `databaseName`*, `schemaName`*, `kind`): List database objects inside an introspected schema, optionally filtered by `kind`.
- `get_database_object_description` (`connectionId`*, `databaseName`*, `kind`*, `objectName`*, `schemaName`*): Retrieve columns, types, keys, and indexes as hierarchical text (returns an empty `definitions` list when missing or unintrospected).

---

## 3. Table Preview, SQL Queries, and Execution Control

- `preview_table_data` (`connectionId`*, `databaseName`*, `schemaName`*, `tableName`*, `maxRowCount`): Preview CSV rows using dialect-specific paging (`maxRowCount` default `10`, must be `>= 1`) without writing SQL. Requires an introspected schema and non-DDL connection.
- `execute_sql_query` (`connectionId`*, `databaseName`*, `queryText`*, `schemaName`*): Run one SQL statement on one non-DDL connection (10-row CSV cap, returns `resultSetId` or `"Query executed successfully"`). Format each major clause (`SELECT`, `FROM`, `WHERE`, `JOIN`, `GROUP BY`, `ORDER BY`) on its own indented line.
- `execute_cross_db_query` (`queryText`*): Join data across 2 or more IDE connections using DuckDB SQL and `dg_cross('<connection name>', '<read-only SQL>' [, search_path := '<db>.<schema>'])` with doubled single quotes `''`. Push filters, aggregations, and limits inside `<query>`.
- `fetch_query_result` (`offset`*, `resultSetId`*): Paginate additional CSV rows from an earlier `execute_sql_query`, `execute_cross_db_query`, or `preview_table_data` `resultSetId` starting at 0-based `offset`.
- `list_recent_sql_queries` (`connectionId`*): Inspect recent and currently running SQL queries (`sessionId`, status, elapsed time, SQL text) on a non-DDL connection.
- `cancel_sql_query` (`sessionId`*): Cancel a stalled or long-running SQL query using its integer `sessionId` from `list_recent_sql_queries`.

---

## 4. Data Export and Tabular Import

- `list_data_extractors` (optional `projectPath` only): Discover valid `extractorName` values (CSV, JSON, XLSX, SQL inserts, Groovy) and each extractor's `applicableOptions` before calling `export_query_result`.
- `export_query_result` (`exportConfig`*, `extractorName`*, `fileName`*, `resultSetId`*, `preview`): Export a `resultSetId` using `extractorName` and `exportConfig` (`{}` for defaults, omit extension from `fileName`). Test with `preview: true` first, then run `preview: false` for the full stream.
- `inspect_import_file` (`source`*, `sampleRowLimit`): Inspect CSV, TSV, delimited text, JSON, XLS, XLSX, or Parquet files via absolute `source.filePath` without touching the database. Returns `resultSet.resultSetId` and repaired `resultSet.columns[].name` headers.
- `inspect_import_query` (`resultSetId`*, `sampleRowLimit`): Inspect columns and sample rows from a read-only `execute_sql_query` or `preview_table_data` `resultSetId` to prepare `import_data`.
- `import_data` (`columnMappings`* (array of objects), `resultSetId`*, `target`*, `excludedSourceColumns` (array<string>), `options`): Import an inspected `resultSetId` into an existing target table using `columnMappings` from inspection (never runs DDL, asks `WRITE_DATA` consent after pre-validating `BLOCKER` mismatches).

---

## 5. Nested Export and Import Payloads

### 5.1 `export_query_result.exportConfig`

Pass `{}` to export all columns with extractor defaults. When specifying an explicit object, include all 8 required keys below (`excludedColumnIndices` always applies, while extractor-specific keys outside `applicableOptions` are ignored):

```json
{
  "excludedColumnIndices": [0, 3],
  "addColumnHeader": true,
  "addRowHeader": false,
  "addTableDdl": false,
  "isTransposed": false,
  "addComputedColumns": false,
  "addGeneratedColumns": false,
  "addQuery": false
}
```

### 5.2 `inspect_import_file.source`

`source.filePath` is required and must be an absolute filesystem path. Set `firstColumnIsHeader` to `null` for scripted loaders (JSON, XLS, XLSX, Parquet), and use `resultSet.columns[].name` from the response in `import_data` because blank or duplicate headers are repaired during inspection:

```json
{
  "filePath": "/abs/path/to/users.csv",
  "charset": "UTF-8",
  "firstRowIsHeader": true,
  "firstColumnIsHeader": null,
  "csvFormat": {
    "valueSeparator": ",",
    "recordSeparator": "\n",
    "quote": "\"",
    "quoteEscape": null,
    "nullText": "",
    "trimWhitespace": false
  }
}
```

### 5.3 `import_data` Nested Payloads

At least one entry in `columnMappings` must carry both `sourceColumn` and `targetColumn`. Omit a target column from `columnMappings` to keep its database default. Any `BLOCKER` mismatch (`TYPE_NOT_CONVERTIBLE`, `UNMAPPED_TARGET_COLUMN`, `MAPPED_TO_NONEXISTENT_TARGET`) fails pre-validation before consent or row insertion:

```json
{
  "resultSetId": "<id from inspect_import_file or inspect_import_query>",
  "target": {
    "connectionId": "<connectionId>",
    "databaseName": "<databaseName>",
    "schemaName": "<schemaName>",
    "tableName": "<existingTableName>"
  },
  "columnMappings": [
    {
      "sourceColumn": "email",
      "targetColumn": "email",
      "inferredTargetType": null,
      "mismatch": null
    }
  ],
  "excludedSourceColumns": ["internal_note"],
  "options": {
    "insertInconvertibleAsNull": false,
    "disableConstraintsAndLockTable": false
  }
}
```
