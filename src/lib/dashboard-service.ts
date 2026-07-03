import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { db } from "../db";
import { households, residents } from "../db/schema";

export interface PurokStat {
	purok: string;
	count: number;
}

export interface RecentActivity {
	id: number;
	fullName: string;
	action: "added" | "updated";
	timestamp: number; // unix epoch ms
	purok: string;
}

export interface DashboardStats {
	totalResidents: number;
	totalPwd: number;
	totalSeniors: number; // boolean flag (isSeniorCitizen)
	totalVoters: number;
	totalSingleParents: number;
	totalHouseholds: number;
	totalMale: number;
	totalFemale: number;
	totalOtherGender: number;
	ageBrackets: {
		"0-5": number;
		"6-12": number;
		"13-17": number;
		"18-35": number;
		"36-50": number;
		"51-65+": number;
	};
	totalWithBirthdate: number; // residents with a birth date set
	avgHouseholdSize: number;
	dataCompletenessPct: number;
	purokStats: PurokStat[];
	recentActivity: RecentActivity[];
	serverIp: string;
}

export const getDashboardData = createServerFn({
	method: "POST",
})
	.validator((params: { purok?: string } | void) => params || {})
	.handler(async ({ data }): Promise<DashboardStats> => {
	const purokFilter = data?.purok;

	// Get residents
	const allResidents = purokFilter 
		? db.select().from(residents).where(eq(residents.purok, purokFilter)).all()
		: db.select().from(residents).all();

	// Get households
	const allHouseholds = purokFilter
		? db.select().from(households).where(eq(households.purok, purokFilter)).all()
		: db.select().from(households).all();

	const totalResidents = allResidents.length;
	const totalPwd = allResidents.filter((r) => r.isPwd).length;
	const totalSeniors = allResidents.filter((r) => r.isSeniorCitizen).length;
	const totalVoters = allResidents.filter((r) => r.isRegisteredVoter).length;
	const totalSingleParents = allResidents.filter(
		(r) => r.isSingleParent,
	).length;

	// Gender breakdown
	const totalMale = allResidents.filter(
		(r) => r.gender?.toLowerCase() === "male",
	).length;
	const totalFemale = allResidents.filter(
		(r) => r.gender?.toLowerCase() === "female",
	).length;
	const totalOtherGender = allResidents.filter(
		(r) => r.gender != null && r.gender.trim() !== "" && r.gender?.toLowerCase() !== "male" && r.gender?.toLowerCase() !== "female",
	).length;

	// Total households from the households table
	const totalHouseholds = allHouseholds.length;

	// Average Household Size
	const residentsInHouseholds = allResidents.filter(
		(r) => r.householdId,
	).length;
	const avgHouseholdSize =
		totalHouseholds > 0 ? residentsInHouseholds / totalHouseholds : 0;

	// Age Demographics & Data Completeness
	const ageBrackets = {
		"0-5": 0,
		"6-12": 0,
		"13-17": 0,
		"18-35": 0,
		"36-50": 0,
		"51-65+": 0,
	};
	let completeProfiles = 0;
	let totalWithBirthdate = 0;

	const today = new Date();
	for (const r of allResidents) {
		// Completeness check
		if (r.contactNumber && r.birthDate) {
			completeProfiles++;
		}

		// Age check
		if (r.birthDate) {
			totalWithBirthdate++;
			const birthDate = new Date(r.birthDate);
			let age = today.getFullYear() - birthDate.getFullYear();
			const m = today.getMonth() - birthDate.getMonth();
			if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
				age--;
			}

			if (age <= 5) {
				ageBrackets["0-5"]++;
			} else if (age <= 12) {
				ageBrackets["6-12"]++;
			} else if (age <= 17) {
				ageBrackets["13-17"]++;
			} else if (age <= 35) {
				ageBrackets["18-35"]++;
			} else if (age <= 50) {
				ageBrackets["36-50"]++;
			} else {
				ageBrackets["51-65+"]++;
			}
		}
	}

	const dataCompletenessPct =
		totalResidents > 0 ? (completeProfiles / totalResidents) * 100 : 0;

	// Group by Purok
	const purokCounts: Record<string, number> = {};
	for (const r of allResidents) {
		const p = r.purok || "Unknown";
		purokCounts[p] = (purokCounts[p] || 0) + 1;
	}
	const purokStats: PurokStat[] = Object.entries(purokCounts)
		.map(([purok, count]) => ({ purok, count }))
		.sort((a, b) => b.count - a.count);

	// Recent activity: last 8 records by updatedAt then createdAt
	const recent = db
		.select()
		.from(residents)
		.orderBy(desc(residents.updatedAt))
		.limit(8)
		.all();

	const recentActivity: RecentActivity[] = recent.map((r) => {
		const createdTs = r.createdAt instanceof Date ? r.createdAt.getTime() : 0;
		const updatedTs = r.updatedAt instanceof Date ? r.updatedAt.getTime() : 0;
		// If updatedAt is significantly later than createdAt, it was updated
		const wasUpdated =
			updatedTs > 0 && createdTs > 0 && updatedTs - createdTs > 5000;
		return {
			id: r.id,
			fullName: r.fullName,
			action: wasUpdated ? "updated" : "added",
			timestamp: updatedTs || createdTs,
			purok: r.purok,
		};
	});

	// Dynamically resolve server LAN IP address
	let serverIp = "127.0.0.1";
	try {
		const os = await import("node:os");
		const interfaces = os.networkInterfaces();
		let foundIp = "";
		for (const name of Object.keys(interfaces)) {
			const iface = interfaces[name];
			if (!iface) continue;
			for (const net of iface) {
				if (net.family === "IPv4" && !net.internal) {
					if (
						net.address.startsWith("192.168.") ||
						net.address.startsWith("10.")
					) {
						foundIp = net.address;
						break;
					}
					if (!foundIp) {
						foundIp = net.address;
					}
				}
			}
			if (
				foundIp &&
				(foundIp.startsWith("192.168.") || foundIp.startsWith("10."))
			) {
				break;
			}
		}
		serverIp = foundIp || "127.0.0.1";
	} catch (_err) {
		// fallback silently
	}

	return {
		totalResidents,
		totalPwd,
		totalSeniors,
		totalVoters,
		totalSingleParents,
		totalHouseholds,
		totalMale,
		totalFemale,
		totalOtherGender,
		ageBrackets,
		totalWithBirthdate,
		avgHouseholdSize,
		dataCompletenessPct,
		purokStats,
		recentActivity,
		serverIp,
	};
});
