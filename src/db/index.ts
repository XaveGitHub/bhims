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
		const migrationsPath = process.env.MIGRATIONS_PATH
			? process.env.MIGRATIONS_PATH
			: process.env.NODE_ENV === "production"
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
				`[Database] Migrations folder not found at ${migrationsPath}. Running full schema initialization...`,
			);
			// Complete schema — creates ALL tables. Safe to run on existing DBs (IF NOT EXISTS).
			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS puroks (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL UNIQUE,
					order_index INTEGER NOT NULL DEFAULT 0,
					created_at INTEGER,
					updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS households (
					id TEXT PRIMARY KEY,
					purok TEXT NOT NULL,
					block TEXT,
					lot TEXT,
					phase TEXT,
					tenure_status TEXT,
					housing_type TEXT,
					construction_type TEXT,
					sanitation_method TEXT,
					created_at INTEGER,
					updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS users (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					username TEXT NOT NULL UNIQUE,
					password TEXT NOT NULL,
					role TEXT NOT NULL DEFAULT 'staff',
					name TEXT NOT NULL,
					created_at INTEGER,
					updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS residents (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					resident_id TEXT UNIQUE,
					full_name TEXT NOT NULL,
					last_name TEXT, first_name TEXT, middle_name TEXT, suffix TEXT,
					birth_date TEXT, gender TEXT, civil_status TEXT, religion TEXT,
					contact_number TEXT, email TEXT, purok TEXT NOT NULL,
					household_id TEXT, is_head_of_household INTEGER DEFAULT 0,
					relationship_to_head TEXT, educational_attainment TEXT,
					occupation TEXT, employment_status TEXT, monthly_income TEXT,
					source_of_livelihood TEXT, is_pwd INTEGER DEFAULT 0, pwd_type TEXT,
					is_senior_citizen INTEGER DEFAULT 0, is_resident_voter INTEGER DEFAULT 0,
					is_registered_voter INTEGER DEFAULT 0, is_single_parent INTEGER DEFAULT 0,
					is_ofw INTEGER DEFAULT 0, is_osy INTEGER DEFAULT 0,
					is_ip INTEGER DEFAULT 0, is_migrant INTEGER DEFAULT 0,
					is_national_pensioner INTEGER DEFAULT 0, is_local_pensioner INTEGER DEFAULT 0,
					debilitating_diseases TEXT, is_bed_bound INTEGER DEFAULT 0,
					is_wheelchair_bound INTEGER DEFAULT 0, is_dialysis_patient INTEGER DEFAULT 0,
					is_cancer_patient INTEGER DEFAULT 0, is_deceased INTEGER DEFAULT 0,
					created_at INTEGER, updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS settings (
					key TEXT PRIMARY KEY NOT NULL,
					value TEXT NOT NULL
				);
				CREATE TABLE IF NOT EXISTS document_templates (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL, price REAL DEFAULT 0,
					is_active INTEGER DEFAULT 1, image_base64 TEXT,
					field_mappings TEXT, created_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS transactions (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					queue_number INTEGER NOT NULL, resident_id INTEGER NOT NULL,
					template_id INTEGER NOT NULL, purpose TEXT,
					total_price REAL NOT NULL, status TEXT NOT NULL DEFAULT 'Pending',
					processed_by TEXT, remarks TEXT,
					created_at INTEGER, updated_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS distribution_programs (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					name TEXT NOT NULL, description TEXT, date TEXT,
					status TEXT NOT NULL DEFAULT 'Active', target_demographic TEXT,
					created_at INTEGER
				);
				CREATE TABLE IF NOT EXISTS distribution_beneficiaries (
					id INTEGER PRIMARY KEY AUTOINCREMENT,
					program_id INTEGER NOT NULL, resident_id INTEGER NOT NULL,
					status TEXT NOT NULL DEFAULT 'Pending', claimed_at INTEGER, notes TEXT
				);
				CREATE INDEX IF NOT EXISTS purok_idx ON residents(purok);
				CREATE INDEX IF NOT EXISTS household_idx ON residents(household_id);
				CREATE INDEX IF NOT EXISTS trans_resident_idx ON transactions(resident_id);
				CREATE INDEX IF NOT EXISTS trans_status_idx ON transactions(status);
				CREATE INDEX IF NOT EXISTS program_resident_idx ON distribution_beneficiaries(program_id, resident_id);
				CREATE INDEX IF NOT EXISTS dist_status_idx ON distribution_beneficiaries(status);
			`);
			console.log("[Database] Full schema initialization completed.");
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

