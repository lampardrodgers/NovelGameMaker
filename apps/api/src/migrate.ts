import { resolve } from "node:path";
import {
  NodePostgresExecutor,
  runPostgresMigrations
} from "@novel-game-maker/vn-platform";
import { loadConfig } from "./config.js";

const config = loadConfig();

if (!config.databaseUrl) {
  throw new Error("DATABASE_URL is required to run Postgres migrations.");
}

const migrationsDir = resolve(import.meta.dirname, "../../../packages/vn-platform/migrations");
const executor = new NodePostgresExecutor({
  connectionString: config.databaseUrl,
  ssl: config.postgresSsl
});

try {
  const results = await runPostgresMigrations({
    executor,
    migrationsDir
  });
  const applied = results.filter((result) => result.status === "applied").length;
  const skipped = results.filter((result) => result.status === "skipped").length;
  console.log(`Postgres migrations complete: ${applied} applied, ${skipped} skipped.`);
  for (const result of results) {
    console.log(`${result.status}: ${result.name}`);
  }
} finally {
  await executor.close();
}
