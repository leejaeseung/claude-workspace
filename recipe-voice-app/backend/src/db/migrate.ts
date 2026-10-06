import { readFileSync } from "fs";
import path from "path";
import { pool } from "./pool";

async function migrate() {
  const sql = readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
  await pool.query(sql);
  console.log("Migration complete.");
  await pool.end();
}

migrate().catch((error) => {
  console.error(error);
  process.exit(1);
});
