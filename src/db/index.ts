import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";

// Resolve the database path
// In Electron, we will pass the AppData path via process.env.DATABASE_PATH
const dbPath = process.env.DATABASE_PATH
	? path.resolve(process.env.DATABASE_PATH)
	: path.resolve(process.cwd(), "bhims.db");

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
	fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`[Database] Connecting to SQLite at: ${dbPath}`);

const sqlite = new Database(dbPath);

// Enable WAL mode for performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// Run migrations programmatically
export function runMigrations() {
	try {
		const migrationsPath =
			process.env.NODE_ENV === "production"
				? path.resolve(
						(process as any).resourcesPath || process.cwd(),
						"drizzle",
					)
				: path.resolve(process.cwd(), "drizzle");

		console.log(`[Database] Running migrations from: ${migrationsPath}`);

		// Check if the migrations directory exists before attempting to run migrations
		if (fs.existsSync(migrationsPath)) {
			migrate(db, { migrationsFolder: migrationsPath });
			console.log("[Database] Migrations completed successfully.");
		} else {
			console.warn(
				`[Database] Migrations folder not found at ${migrationsPath}. Checking if tables need to be created...`,
			);

			// Fallback: simple table creation in case migrations folder is not packaged
			db.run(`
        CREATE TABLE IF NOT EXISTS residents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          full_name TEXT NOT NULL,
          birth_date TEXT,
          gender TEXT,
          contact_number TEXT,
          purok TEXT NOT NULL,
          household_id TEXT,
          is_head_of_household INTEGER DEFAULT 0,
          relationship_to_head TEXT,
          is_pwd INTEGER DEFAULT 0,
          pwd_type TEXT,
          is_senior_citizen INTEGER DEFAULT 0,
          is_voter INTEGER DEFAULT 0,
          is_single_parent INTEGER DEFAULT 0,
          created_at INTEGER,
          updated_at INTEGER
        );
      `);
			db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
			console.log("[Database] Fallback schema initialization completed.");
		}

		// Initialize default settings if missing
		const hasName = db
			.select()
			.from(schema.settings)
			.where(eq(schema.settings.key as any, "barangay_name"))
			.all();
		if (hasName.length === 0) {
			db.insert(schema.settings)
				.values({ key: "barangay_name", value: "Barangay Handumanan" })
				.run();
			console.log("[Database] Initialized default Barangay name settings.");
		}

		const hasPin = db
			.select()
			.from(schema.settings)
			.where(eq(schema.settings.key as any, "pin"))
			.all();
		if (hasPin.length === 0) {
			db.insert(schema.settings).values({ key: "pin", value: "1234" }).run();
			console.log("[Database] Initialized default PIN settings.");
		}
	} catch (error) {
		console.error("[Database] Migration failed:", error);
	}
}

// Automatically run migrations on database module load
runMigrations();
// Trigger reload comment to apply new schema

