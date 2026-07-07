import { createServerFn } from "@tanstack/react-start";
import { desc, eq, sql } from "drizzle-orm";
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

	const ageSql = sql`cast(strftime('%Y.%m%d', 'now') - strftime('%Y.%m%d', ${residents.birthDate}) as int)`;

	const metricsQuery = db.select({
		totalResidents: sql<number>`count(*)`,
		totalPwd: sql<number>`sum(case when ${residents.isPwd} = 1 then 1 else 0 end)`,
		totalSeniors: sql<number>`sum(case when ${residents.isSeniorCitizen} = 1 then 1 else 0 end)`,
		totalVoters: sql<number>`sum(case when ${residents.isRegisteredVoter} = 1 then 1 else 0 end)`,
		totalSingleParents: sql<number>`sum(case when ${residents.isSingleParent} = 1 then 1 else 0 end)`,
		totalMale: sql<number>`sum(case when lower(${residents.gender}) = 'male' then 1 else 0 end)`,
		totalFemale: sql<number>`sum(case when lower(${residents.gender}) = 'female' then 1 else 0 end)`,
		totalOtherGender: sql<number>`sum(case when ${residents.gender} is not null and trim(${residents.gender}) != '' and lower(${residents.gender}) not in ('male', 'female') then 1 else 0 end)`,
		totalWithHousehold: sql<number>`sum(case when ${residents.householdId} is not null then 1 else 0 end)`,
		completeProfiles: sql<number>`sum(case when ${residents.contactNumber} is not null and trim(${residents.contactNumber}) != '' and ${residents.birthDate} is not null and trim(${residents.birthDate}) != '' then 1 else 0 end)`,
		totalWithBirthdate: sql<number>`sum(case when ${residents.birthDate} is not null and trim(${residents.birthDate}) != '' then 1 else 0 end)`,
		
		age0_5: sql<number>`sum(case when ${ageSql} <= 5 then 1 else 0 end)`,
		age6_12: sql<number>`sum(case when ${ageSql} between 6 and 12 then 1 else 0 end)`,
		age13_17: sql<number>`sum(case when ${ageSql} between 13 and 17 then 1 else 0 end)`,
		age18_35: sql<number>`sum(case when ${ageSql} between 18 and 35 then 1 else 0 end)`,
		age36_50: sql<number>`sum(case when ${ageSql} between 36 and 50 then 1 else 0 end)`,
		age51_65: sql<number>`sum(case when ${ageSql} >= 51 then 1 else 0 end)`
	}).from(residents);

	if (purokFilter) {
		metricsQuery.where(eq(residents.purok, purokFilter));
	}

	const rawMetrics = metricsQuery.get();
	const metrics = {
		totalResidents: rawMetrics?.totalResidents || 0,
		totalPwd: rawMetrics?.totalPwd || 0,
		totalSeniors: rawMetrics?.totalSeniors || 0,
		totalVoters: rawMetrics?.totalVoters || 0,
		totalSingleParents: rawMetrics?.totalSingleParents || 0,
		totalMale: rawMetrics?.totalMale || 0,
		totalFemale: rawMetrics?.totalFemale || 0,
		totalOtherGender: rawMetrics?.totalOtherGender || 0,
		totalWithHousehold: rawMetrics?.totalWithHousehold || 0,
		completeProfiles: rawMetrics?.completeProfiles || 0,
		totalWithBirthdate: rawMetrics?.totalWithBirthdate || 0,
		age0_5: rawMetrics?.age0_5 || 0,
		age6_12: rawMetrics?.age6_12 || 0,
		age13_17: rawMetrics?.age13_17 || 0,
		age18_35: rawMetrics?.age18_35 || 0,
		age36_50: rawMetrics?.age36_50 || 0,
		age51_65: rawMetrics?.age51_65 || 0,
	};

	const hhQuery = db.select({ count: sql<number>`count(*)` }).from(households);
	if (purokFilter) {
		hhQuery.where(eq(households.purok, purokFilter));
	}
	const totalHouseholds = hhQuery.get()?.count || 0;
	
	const avgHouseholdSize = totalHouseholds > 0 ? metrics.totalWithHousehold / totalHouseholds : 0;
	const dataCompletenessPct = metrics.totalResidents > 0 ? (metrics.completeProfiles / metrics.totalResidents) * 100 : 0;

	// Group by Purok
	const purokQuery = db.select({
		purok: sql<string>`coalesce(${residents.purok}, 'Unknown')`,
		count: sql<number>`count(*)`
	}).from(residents);
	
	if (purokFilter) {
		purokQuery.where(eq(residents.purok, purokFilter));
	}
	purokQuery.groupBy(sql`coalesce(${residents.purok}, 'Unknown')`);
	
	const purokStats: PurokStat[] = purokQuery.all().sort((a, b) => b.count - a.count);

	// Recent activity: last 8 records by updatedAt
	const recent = db
		.select()
		.from(residents)
		.orderBy(desc(residents.updatedAt))
		.limit(8)
		.all();

	const recentActivity: RecentActivity[] = recent.map((r) => {
		const createdTs = r.createdAt instanceof Date ? r.createdAt.getTime() : 0;
		const updatedTs = r.updatedAt instanceof Date ? r.updatedAt.getTime() : 0;
		const wasUpdated = updatedTs > 0 && createdTs > 0 && updatedTs - createdTs > 5000;
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
		totalResidents: metrics.totalResidents,
		totalPwd: metrics.totalPwd,
		totalSeniors: metrics.totalSeniors,
		totalVoters: metrics.totalVoters,
		totalSingleParents: metrics.totalSingleParents,
		totalHouseholds,
		totalMale: metrics.totalMale,
		totalFemale: metrics.totalFemale,
		totalOtherGender: metrics.totalOtherGender,
		ageBrackets: {
			"0-5": metrics.age0_5,
			"6-12": metrics.age6_12,
			"13-17": metrics.age13_17,
			"18-35": metrics.age18_35,
			"36-50": metrics.age36_50,
			"51-65+": metrics.age51_65,
		},
		totalWithBirthdate: metrics.totalWithBirthdate,
		avgHouseholdSize,
		dataCompletenessPct,
		purokStats,
		recentActivity,
		serverIp,
	};
});
