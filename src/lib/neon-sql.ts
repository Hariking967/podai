import { getNeonPool } from "./neon-pool";

const LOG_PREFIX = "[Neon-SQL]";

interface NeonSqlRequest {
  connectionString: string;
  query: string;
  params?: unknown[];
}

interface NeonSqlResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: string[];
}

// Allowed SQL operations: DDL (Data Definition) and DML (Data Manipulation)
const ALLOWED_QUERY_REGEX =
  /^\s*(select|with|show|explain|values|insert|update|delete|create|alter|drop|truncate)\b/i;

const normalizeQuery = (query: string) => {
  console.log(`${LOG_PREFIX} Normalizing query: ${query.substring(0, 100)}...`);

  const trimmed = query.trim();
  if (!trimmed) {
    console.error(`${LOG_PREFIX} ERROR: Empty query`);
    throw new Error("SQL query is empty.");
  }
  const withoutTrailingSemicolon = trimmed.replace(/;\s*$/, "");
  if (withoutTrailingSemicolon.includes(";")) {
    console.error(`${LOG_PREFIX} ERROR: Multiple statements detected`);
    throw new Error("Only a single SQL statement is allowed.");
  }
  if (!ALLOWED_QUERY_REGEX.test(withoutTrailingSemicolon)) {
    console.error(`${LOG_PREFIX} ERROR: Disallowed SQL operation`);
    throw new Error("This SQL operation is not allowed.");
  }

  console.log(`${LOG_PREFIX} Query normalized successfully`);
  return withoutTrailingSemicolon;
};

export const runSqlOnNeon = async ({
  connectionString,
  query,
  params = [],
}: NeonSqlRequest): Promise<NeonSqlResult> => {
  console.log(`${LOG_PREFIX} runSqlOnNeon called`);
  console.log(
    `${LOG_PREFIX} Connection string length: ${connectionString?.length ?? 0}`,
  );
  console.log(
    `${LOG_PREFIX} Connection string starts with: ${connectionString?.substring(0, 30)}...`,
  );
  console.log(`${LOG_PREFIX} Query: ${query}`);
  console.log(`${LOG_PREFIX} Params: ${JSON.stringify(params)}`);

  if (!connectionString) {
    console.error(`${LOG_PREFIX} ERROR: No connection string provided`);
    throw new Error("Database connection string is required.");
  }

  const sql = normalizeQuery(query);

  console.log(`${LOG_PREFIX} Getting connection pool...`);
  const pool = getNeonPool(connectionString);

  console.log(`${LOG_PREFIX} Executing query...`);

  try {
    // Create a timeout promise
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error("Query execution timeout (30 seconds)")),
        30000,
      );
    });

    // Race between query execution and timeout
    const result = await Promise.race([
      pool.query<Record<string, unknown>>(sql, params),
      timeoutPromise,
    ]);

    console.log(`${LOG_PREFIX} Query executed successfully`);
    console.log(
      `${LOG_PREFIX} Row count: ${result.rowCount ?? result.rows.length}`,
    );
    console.log(
      `${LOG_PREFIX} Fields: ${result.fields.map((f) => f.name).join(", ")}`,
    );

    return {
      rows: result.rows,
      rowCount: result.rowCount ?? result.rows.length,
      fields: result.fields.map((field) => field.name),
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown SQL error";
    console.error(`${LOG_PREFIX} SQL execution failed: ${errorMessage}`);
    throw error;
  }
};
