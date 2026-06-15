import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { SqlExecutor } from "../repositories/PostgresRepositories.js";

export interface RunPostgresMigrationsInput {
  executor: SqlExecutor;
  migrationsDir: string;
  now?: Date;
}

export interface PostgresMigrationRunResult {
  name: string;
  status: "applied" | "skipped";
}

interface AppliedMigrationRow {
  name: string;
}

export async function runPostgresMigrations(
  input: RunPostgresMigrationsInput
): Promise<PostgresMigrationRunResult[]> {
  await input.executor.query(`
    create table if not exists schema_migrations (
      name text primary key,
      applied_at timestamptz not null
    )
  `);

  const appliedRows = await input.executor.query<AppliedMigrationRow>("select name from schema_migrations");
  const applied = new Set(appliedRows.rows.map((row) => row.name));
  const files = await listMigrationFiles(input.migrationsDir);
  const results: PostgresMigrationRunResult[] = [];

  for (const file of files) {
    if (applied.has(file)) {
      results.push({ name: file, status: "skipped" });
      continue;
    }

    const sql = (await readFile(resolve(input.migrationsDir, file), "utf-8")).trim();
    await input.executor.query("begin");
    try {
      if (sql.length > 0) {
        await input.executor.query(sql);
      }
      await input.executor.query(
        "insert into schema_migrations (name, applied_at) values ($1, $2)",
        [file, (input.now ?? new Date()).toISOString()]
      );
      await input.executor.query("commit");
      results.push({ name: file, status: "applied" });
    } catch (error) {
      await input.executor.query("rollback");
      throw error;
    }
  }

  return results;
}

async function listMigrationFiles(migrationsDir: string): Promise<string[]> {
  const entries = await readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));
}
