import fs from "node:fs";
import path from "node:path";
import { createServerFn } from "@tanstack/react-start";
import Database from "better-sqlite3";
import { db, sqlite } from "../db";
import { households, residents, settings } from "../db/schema";

export interface SettingsData {
	barangayName: string;
}

// Fetch current settings
export const getSettings = createServerFn({
	method: "POST",
}).handler(async (): Promise<SettingsData> => {
	const allSettings = db.select().from(settings).all();
	const barangayName =
		allSettings.find((s: { key: string }) => s.key === "barangay_name")
			?.value || "Barangay Handumanan";
	return { barangayName };
});

// Update settings
export const updateSettings = createServerFn({
	method: "POST",
})
	.validator((data: SettingsData) => data)
	.handler(async ({ data }) => {
		// Upsert Barangay Name
		db.insert(settings)
			.values({ key: "barangay_name", value: data.barangayName })
			.onConflictDoUpdate({
				target: settings.key,
				set: { value: data.barangayName },
			})
			.run();

		return { success: true };
	});

// Download database backup as base64 string
export const downloadBackup = createServerFn({
	method: "GET",
}).handler(async () => {
	const dbPath = process.env.DATABASE_PATH
		? path.resolve(process.env.DATABASE_PATH)
		: path.resolve(process.cwd(), "bhims.db");

	if (!fs.existsSync(dbPath)) {
		throw new Error("Database file not found.");
	}

	const tempBackupPath = path.resolve(process.cwd(), `bhims_backup_temp_${Date.now()}.db`);

	// Use better-sqlite3's native backup to safely flush WAL and consolidate into a single file
	await sqlite.backup(tempBackupPath);

	// Read the consolidated backup file and convert to base64
	const fileBuffer = fs.readFileSync(tempBackupPath);
	const base64 = fileBuffer.toString("base64");

	// Clean up the temporary backup file
	fs.unlinkSync(tempBackupPath);

	return {
		filename: `bhims_backup_${new Date().toISOString().split("T")[0]}.db`,
		data: base64,
	};
});

// Restore database from base64 string safely using SQLite backup API
export const restoreBackup = createServerFn({
	method: "POST",
})
	.validator((base64Data: string) => base64Data)
	.handler(async ({ data: base64 }) => {
		const liveDbPath = process.env.DATABASE_PATH
			? path.resolve(process.env.DATABASE_PATH)
			: path.resolve(process.cwd(), "bhims.db");

		const tempRestorePath = path.join(
			path.dirname(liveDbPath),
			"bhims_restore.db",
		);

		try {
			// 1. Write the uploaded base64 data to a temporary SQLite file
			const fileBuffer = Buffer.from(base64, "base64");
			fs.writeFileSync(tempRestorePath, fileBuffer);

			// 2. Open the temporary backup database
			const tempDb = new Database(tempRestorePath);

			// 3. Use SQLite's native backup API to copy schemas & records safely
			// into the live database. This avoids lock / file replacement issues!
			await tempDb.backup(liveDbPath);

			// 4. Close and clean up the temporary database
			tempDb.close();
			fs.unlinkSync(tempRestorePath);

			console.log("[Database] Restored from backup successfully.");
			return { success: true };
		} catch (error) {
			console.error("[Database] Restore failed:", error);

			// Clean up temp file if it exists
			if (fs.existsSync(tempRestorePath)) {
				try {
					fs.unlinkSync(tempRestorePath);
				} catch {}
			}

			return {
				success: false,
				error: "Database restore failed. Verify backup file integrity.",
			};
		}
	});

// Clear all residents and households data (keeps settings intact)
export const clearAllData = createServerFn({
	method: "POST",
})
	.validator((confirmation: string) => confirmation)
	.handler(async ({ data: confirmation }) => {
		if (confirmation !== "DELETE ALL") {
			return { success: false, error: "Invalid confirmation phrase." };
		}

		try {
			// Delete all residents first (no FK constraints, but order is cleaner)
			db.delete(residents).run();
			// Delete all households
			db.delete(households).run();

			console.log("[Database] All resident and household data cleared.");
			return { success: true, message: "All data has been deleted." };
		} catch (error) {
			console.error("[Database] Clear all data failed:", error);
			return {
				success: false,
				error: "Failed to clear data. Please try again.",
			};
		}
	});
