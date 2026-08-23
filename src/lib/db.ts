import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema";
import { seedIfEmpty } from "./seed";

// dev の HMR でコネクションが増殖しないよう globalThis に保持する。
const globalForDb = globalThis as unknown as { __shiftDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__shiftDb) return globalForDb.__shiftDb;

  const dbPath = process.env.SHIFT_DB_PATH ?? path.join(process.cwd(), "data", "shift.db");
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);

  globalForDb.__shiftDb = db;
  return db;
}
