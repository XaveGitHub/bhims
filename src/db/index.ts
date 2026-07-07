import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { eq, sql } from "drizzle-orm";
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

export const sqlite = new Database(dbPath);

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

		// Initialize default Puroks if empty (for fresh app installs)
		const existingPuroks = db.select({ count: sql<number>`count(*)` }).from(schema.puroks).get();
		if (existingPuroks && existingPuroks.count === 0) {
			const puroksList = [
				"Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5", "Zone 6", "Zone 7", "Zone 8", "Zone 9", "Zone 10", "Zone 11", "Zone 12",
				"Lucky Homes", "NGO", "NEDF", "St Ezekiel", "Villasor", "Paho", "Ceres", "Lubi", "Chico", "Mahogany", "Golden Risary",
				"Narra", "Datiles", "Tapulanga", "Paghidaet", "Maniville", "Rosebell", "Cadena De Amor", "San Antonio", "Mabinuligon",
				"GK Village", "Saturn", "Sto Niño", "Sto Domingo", "San Rowue 1", "San Roque2", "Kawayanan 1", "Kawayan 2"
			];
			console.log("[Database] Seeding default Puroks...");
			for (let i = 0; i < puroksList.length; i++) {
				db.insert(schema.puroks).values({ name: puroksList[i], orderIndex: i + 1 }).run();
			}
			console.log("[Database] Default Puroks seeded successfully.");
		}

	} catch (error) {
		console.error("[Database] Migration failed:", error);
	}
}

// Automatically run migrations on database module load
runMigrations();
// Trigger reload comment to apply new schema v2

