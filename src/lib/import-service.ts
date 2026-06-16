import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { residents } from "../db/schema";
import type { ResidentInput } from "./residents-service";

// Bulk import residents inside a database transaction
export const importResidents = createServerFn({
	method: "POST",
})
	.validator((data: ResidentInput[]) => data)
	.handler(async ({ data: rows }) => {
		if (rows.length === 0) return { success: true, count: 0 };

		try {
			// Execute as a single transaction for speed and safety
			const result = db.transaction((tx) => {
				const processedRows = rows.map((row) => {
					// Auto-calculate senior citizen status based on birthdate
					let isSenior = row.isSeniorCitizen;
					if (row.birthDate) {
						const birth = new Date(row.birthDate);
						const age = new Date().getFullYear() - birth.getFullYear();
						if (age >= 60) {
							isSenior = true;
						}
					}

					return {
						fullName: row.fullName,
						birthDate: row.birthDate,
						gender: row.gender,
						contactNumber: row.contactNumber,
						purok: row.purok || "Unknown",
						householdId: row.householdId,
						isHeadOfHousehold:
							row.relationshipToHead?.toLowerCase() === "head" ||
							row.relationshipToHead?.toLowerCase() === "self",
						relationshipToHead: row.relationshipToHead || "Member",
						isPwd: row.isPwd,
						pwdType: row.pwdType,
						isSeniorCitizen: isSenior,
						isVoter: row.isVoter,
						isSingleParent: row.isSingleParent,
						createdAt: new Date(),
						updatedAt: new Date(),
					};
				});

				// Chunk insertions if there are too many variables (SQLite limits to 999 or 32766 parameters depending on version)
				// A safe chunk size is 100 rows at a time
				const chunkSize = 100;
				let insertedCount = 0;

				for (let i = 0; i < processedRows.length; i += chunkSize) {
					const chunk = processedRows.slice(i, i + chunkSize);
					tx.insert(residents).values(chunk).run();
					insertedCount += chunk.length;
				}

				return insertedCount;
			});

			return { success: true, count: result };
		} catch (error) {
			console.error("[Import] Failed to bulk import:", error);
			return {
				success: false,
				error: "Database transaction failed during bulk insert.",
			};
		}
	});
