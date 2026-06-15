import pg from "pg";
import type { SqlExecutor } from "./PostgresRepositories.js";

export interface NodePostgresExecutorOptions {
  connectionString: string;
  ssl?: boolean;
  max?: number;
}

export class NodePostgresExecutor implements SqlExecutor {
  readonly pool: pg.Pool;

  constructor(options: NodePostgresExecutorOptions) {
    this.pool = new pg.Pool({
      connectionString: options.connectionString,
      ssl: options.ssl ? { rejectUnauthorized: true } : undefined,
      max: options.max
    });
  }

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
    const result = await this.pool.query(sql, params);
    return {
      rows: result.rows as T[],
      rowCount: result.rowCount ?? undefined
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
