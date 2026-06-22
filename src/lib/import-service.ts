import { createServerFn } from "@tanstack/react-start";
import { db } from "../db";
import { households, residents } from "../db/schema";
import type { ResidentInput } from "./residents-service";

// Define the full payload that comes from the Excel mapping
export interface ImportRow extends ResidentInput {
	block?: string;
	lot?: string;
	phase?: string;
	tenureStatus?: string;
	housingType?: string;
	constructionType?: string;
	sanitationMethod?: string;
}

// ─── Normalisation Helpers ────────────────────────────────────────────────────

/**
 * Convert ALL-CAPS or mixed-case text to Title Case.
 * Handles Filipino particles (de, del, delos, san, etc.) gracefully.
 */
export function toTitleCase(str: string | null | undefined): string {
	if (!str) return "";
	const lower = str.trim().toLowerCase();
	// Words that should stay lowercase unless they're the first word
	const particles = new Set(["de", "del", "delos", "dela", "ng", "ni", "si"]);
	return lower
		.split(/\s+/)
		.map((word, idx) => {
			if (idx !== 0 && particles.has(word)) return word;
			// Handle hyphenated names: Juan-Miguel → Juan-Miguel
			return word.replace(/(-?)(\w)/g, (_m, hyphen, letter) => hyphen + letter.toUpperCase());
		})
		.join(" ");
}

/**
 * Parse a birth date from multiple possible formats:
 *  - Excel serial number (e.g. 22076)
 *  - MM/DD/YYYY or MM-DD-YYYY
 *  - YYYY-MM-DD (pass-through)
 *  - Invalid → null
 */
export function parseBirthDate(raw: any): string | null {
	if (raw === null || raw === undefined || raw === "") return null;

	// Numeric → Excel serial date (days since Dec 30, 1899)
	const num = typeof raw === "number" ? raw : Number(raw);
	if (!Number.isNaN(num) && num > 1000 && num < 200000) {
		// Excel epoch: Jan 1, 1900 = serial 1 (with bug: serial 60 = Feb 29 1900 never existed)
		const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
		const date = new Date(excelEpoch.getTime() + num * 86400000);
		if (Number.isNaN(date.getTime())) return null;
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, "0");
		const d = String(date.getDate()).padStart(2, "0");
		// Sanity check: year must be between 1900 and current year
		if (y < 1900 || y > new Date().getFullYear()) return null;
		return `${y}-${m}-${d}`;
	}

	const s = String(raw).trim();
	if (!s) return null;

	// Already YYYY-MM-DD
	if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
		const [y, m, d] = s.split("-").map(Number);
		if (y >= 1900 && m >= 1 && m <= 12 && d >= 1 && d <= 31) return s;
		return null;
	}

	// MM/DD/YYYY or MM-DD-YYYY or M/D/YYYY
	const mdyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
	if (mdyMatch) {
		const m = mdyMatch[1].padStart(2, "0");
		const d = mdyMatch[2].padStart(2, "0");
		const y = mdyMatch[3];
		const yearNum = Number(y);
		const monthNum = Number(m);
		const dayNum = Number(d);
		if (yearNum >= 1900 && yearNum <= new Date().getFullYear() && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
			return `${y}-${m}-${d}`;
		}
		return null;
	}

	// DD/MM/YYYY fallback (if year is first two digits look wrong for MM/DD, not used here since user confirmed MM/DD/YYYY)
	// Try parsing as a natural date string
	const parsed = new Date(s);
	if (!Number.isNaN(parsed.getTime())) {
		const y = parsed.getFullYear();
		const m = String(parsed.getMonth() + 1).padStart(2, "0");
		const d = String(parsed.getDate()).padStart(2, "0");
		if (y >= 1900 && y <= new Date().getFullYear()) return `${y}-${m}-${d}`;
	}

	return null;
}

/**
 * Expand gender abbreviations.
 * M → Male, F → Female
 */
export function normalizeGender(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = raw.trim().toLowerCase();
	if (s === "m" || s === "male") return "Male";
	if (s === "f" || s === "female") return "Female";
	if (s === "other" || s === "o") return "Other";
	// Return title-cased version if unknown
	return toTitleCase(raw) || null;
}

/**
 * Expand civil status abbreviations.
 * S → Single, M → Married, W/WID → Widowed, SEP → Separated, etc.
 */
export function normalizeCivilStatus(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = raw.trim().toLowerCase();
	const map: Record<string, string> = {
		s: "Single",
		single: "Single",
		m: "Married",
		married: "Married",
		w: "Widowed",
		wid: "Widowed",
		widow: "Widowed",
		widowed: "Widowed",
		widower: "Widowed",
		sep: "Separated",
		separated: "Separated",
		annulled: "Annulled",
		ann: "Annulled",
		"live-in": "Live-in",
		livein: "Live-in",
		"live in": "Live-in",
		cohabiting: "Live-in",
		d: "Divorced",
		divorced: "Divorced",
	};
	return map[s] ?? toTitleCase(raw) ?? null;
}

/**
 * Normalize educational attainment abbreviations used in barangay data.
 */
export function normalizeEducation(raw: string | null | undefined): string | null {
	if (!raw) return null;
	const s = raw.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
	const map: Record<string, string> = {
		// College
		"col grad": "College Graduate",
		"college grad": "College Graduate",
		"college graduate": "College Graduate",
		"col level": "College Level",
		"college level": "College Level",
		"college undergrad": "College Level",
		// High School
		"hs grad": "High School Graduate",
		"highschool grad": "High School Graduate",
		"high school grad": "High School Graduate",
		"high school graduate": "High School Graduate",
		"hs graduate": "High School Graduate",
		"hs level": "High School Level",
		"high school level": "High School Level",
		"high school": "High School Level",
		// Elementary
		"elem grad": "Elementary Graduate",
		"elementary grad": "Elementary Graduate",
		"elementary graduate": "Elementary Graduate",
		"elem level": "Elementary Level",
		"elementary level": "Elementary Level",
		"elementary": "Elementary Level",
		// Vocational
		"voc": "Vocational",
		"vocational": "Vocational",
		"tesda": "Vocational",
		"tech-voc": "Vocational",
		// Post-graduate
		"post grad": "Post Graduate",
		"post graduate": "Post Graduate",
		"masters": "Post Graduate",
		"phd": "Doctorate",
		"doctorate": "Doctorate",
		// None
		"none": "No Formal Education",
		"no formal education": "No Formal Education",
		"n/a": null as unknown as string,
		"na": null as unknown as string,
	};
	const result = map[s];
	if (result === undefined) return toTitleCase(raw) || null;
	return result || null;
}

/**
 * Normalize occupation / employment status to Title Case.
 */
export function normalizeText(raw: string | null | undefined): string | null {
	if (!raw) return null;
	return toTitleCase(raw) || null;
}

/**
 * Normalize purok/zone/phase values to a clean readable format.
 * "ZONE 11" → "Zone 11", "PHASE 6B" → "Phase 6B"
 */
export function normalizePurok(raw: string | null | undefined): string | null {
	if (!raw) return null;
	return toTitleCase(raw.trim()) || null;
}

// ─── Bulk Import ──────────────────────────────────────────────────────────────

export const importResidents = createServerFn({
	method: "POST",
})
	.validator((data: ImportRow[]) => data)
	.handler(async ({ data: rows }) => {
		if (rows.length === 0) return { success: true, count: 0 };

		try {
			const result = db.transaction((tx) => {
				const householdsMap = new Map<string, any>();
				const processedResidents = [];

				for (let i = 0; i < rows.length; i++) {
					const row = rows[i];

					// ── Normalise all text fields ─────────────────────────
					const firstName = toTitleCase(row.firstName);
					const lastName = toTitleCase(row.lastName);
					const middleName = toTitleCase(row.middleName);
					const suffix = toTitleCase(row.suffix);

					// fullName: Last, First Middle Suffix
					const fullName =
						[firstName, middleName, lastName, suffix].filter(Boolean).join(" ") ||
						toTitleCase(row.fullName) ||
						"Unknown Name";

					const birthDate = parseBirthDate(row.birthDate);
					const gender = normalizeGender(row.gender);
					const civilStatus = normalizeCivilStatus(row.civilStatus);
					const educationalAttainment = normalizeEducation(row.educationalAttainment);
					const occupation = normalizeText(row.occupation);
					const employmentStatus = normalizeText(row.employmentStatus);
					const sourceOfLivelihood = normalizeText(row.sourceOfLivelihood);
					const religion = normalizeText(row.religion);

					// purok: prefer the `purok` field; fall back to `phase` if purok is empty
					const purokRaw = row.purok || row.phase || "Unknown";
					const purok = normalizePurok(purokRaw) || "Unknown";

					// phase: stored separately on the household only if both exist
					const phaseNorm = row.phase ? normalizePurok(row.phase) : null;

					// block / lot: normalize to strings
					const block = row.block ? String(row.block).trim() : null;
					const lot = row.lot ? String(row.lot).trim() : null;

					// ── Household grouping ────────────────────────────────
					// Key = block + lot + purok (same location = same household)
					// If block or lot is missing, each resident gets their own household
					let hhId: string;
					if (block && lot && purok !== "Unknown") {
						hhId = `HH-${purok}-BLK${block}-LOT${lot}`.replace(/\s+/g, "_").toUpperCase();
					} else {
						// No block/lot — unique per row (can be manually merged later)
						hhId = `HH-ROW-${i}-${Date.now()}`;
					}

					// Track unique households
					if (!householdsMap.has(hhId)) {
						householdsMap.set(hhId, {
							id: hhId,
							purok,
							block: block || null,
							lot: lot || null,
							phase: phaseNorm || null,
							tenureStatus: row.tenureStatus ? toTitleCase(row.tenureStatus) : null,
							housingType: row.housingType ? toTitleCase(row.housingType) : null,
							constructionType: row.constructionType ? toTitleCase(row.constructionType) : null,
							sanitationMethod: row.sanitationMethod ? toTitleCase(row.sanitationMethod) : null,
							createdAt: new Date(),
							updatedAt: new Date(),
						});
					}

					// ── Auto-detect senior from age ───────────────────────
					let isSenior = !!row.isSeniorCitizen;
					if (birthDate) {
						const birth = new Date(birthDate);
						const today = new Date();
						let age = today.getFullYear() - birth.getFullYear();
						const m = today.getMonth() - birth.getMonth();
						if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
						if (age >= 60) isSenior = true;
					}

					processedResidents.push({
						// Name (all title-cased)
						fullName,
						lastName: lastName || null,
						firstName: firstName || null,
						middleName: middleName || null,
						suffix: suffix || null,
						// Demographics
						birthDate: birthDate || null,
						gender: gender || null,
						civilStatus: civilStatus || null,
						religion: religion || null,
						// Contact
						contactNumber: row.contactNumber ? String(row.contactNumber).trim() : null,
						email: row.email ? String(row.email).trim().toLowerCase() : null,
						// Location & Household
						purok,
						householdId: hhId,
						isHeadOfHousehold: false, // No auto-assignment — manual later
						relationshipToHead: row.relationshipToHead
							? toTitleCase(row.relationshipToHead)
							: "Member",
						// Education & Work
						educationalAttainment: educationalAttainment || null,
						occupation: occupation || null,
						employmentStatus: employmentStatus || null,
						monthlyIncome: row.monthlyIncome ? String(row.monthlyIncome).trim() : null,
						sourceOfLivelihood: sourceOfLivelihood || null,
						// Status Flags
						isPwd: !!row.isPwd,
						pwdType: row.pwdType ? toTitleCase(row.pwdType) : null,
						isSeniorCitizen: isSenior,
						isResidentVoter: !!row.isResidentVoter,
						isRegisteredVoter: !!row.isRegisteredVoter,
						isSingleParent: !!row.isSingleParent,
						isOfw: !!row.isOfw,
						isOsy: !!row.isOsy,
						isIp: !!row.isIp,
						isMigrant: !!row.isMigrant,
						isNationalPensioner: !!row.isNationalPensioner,
						isLocalPensioner: !!row.isLocalPensioner,
						// Health
						debilitatingDiseases: row.debilitatingDiseases
							? String(row.debilitatingDiseases).trim()
							: null,
						isBedBound: !!row.isBedBound,
						isWheelchairBound: !!row.isWheelchairBound,
						isDialysisPatient: !!row.isDialysisPatient,
						isCancerPatient: !!row.isCancerPatient,
						// Timestamps
						createdAt: new Date(),
						updatedAt: new Date(),
					});
				}

				// Insert households
				const householdsArray = Array.from(householdsMap.values());
				for (let i = 0; i < householdsArray.length; i += 100) {
					const chunk = householdsArray.slice(i, i + 100);
					tx.insert(households)
						.values(chunk)
						.onConflictDoUpdate({
							target: households.id,
							set: { updatedAt: new Date() },
						})
						.run();
				}

				// Insert residents
				let insertedCount = 0;
				for (let i = 0; i < processedResidents.length; i += 100) {
					const chunk = processedResidents.slice(i, i + 100);
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
