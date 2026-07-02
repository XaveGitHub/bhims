import { createServerFn } from "@tanstack/react-start";
import { eq, like, and, or } from "drizzle-orm";
import { db } from "../db";
import { households, residents } from "../db/schema";

export interface HouseholdMember {
	id: number;
	// Name
	fullName: string;
	lastName: string | null;
	firstName: string | null;
	middleName: string | null;
	suffix: string | null;
	// Demographics
	birthDate: string | null;
	gender: string | null;
	civilStatus: string | null;
	religion: string | null;
	// Contact
	contactNumber: string | null;
	email: string | null;
	// Household
	relationshipToHead: string | null;
	isHeadOfHousehold: boolean;
	purok: string;
	block: string | null;
	lot: string | null;
	householdId: string | null;
	// Education & Work
	educationalAttainment: string | null;
	occupation: string | null;
	employmentStatus: string | null;
	monthlyIncome: string | null;
	sourceOfLivelihood: string | null;
	// Status Flags
	isPwd: boolean;
	pwdType: string | null;
	isSeniorCitizen: boolean;
	isResidentVoter: boolean;
	isRegisteredVoter: boolean;
	isSingleParent: boolean;
	isOfw: boolean;
	isOsy: boolean;
	isIp: boolean;
	isMigrant: boolean;
	isNationalPensioner: boolean;
	isLocalPensioner: boolean;
	// Health
	debilitatingDiseases: string | null;
	isBedBound: boolean;
	isWheelchairBound: boolean;
	isDialysisPatient: boolean;
	isCancerPatient: boolean;
	isDeceased: boolean | null;
}

export interface HouseholdDetail {
	householdId: string;
	purok: string;
	block: string | null;
	lot: string | null;
	phase: string | null;
	tenureStatus: string | null;
	housingType: string | null;
	constructionType: string | null;
	sanitationMethod: string | null;
	head: HouseholdMember | null;
	spouse: HouseholdMember | null;
	children: HouseholdMember[];
	others: HouseholdMember[];
}

export interface HouseholdSummary {
	householdId: string;
	purok: string;
	headName: string;
	memberCount: number;
	adultsCount: number;
	childrenCount: number;
	block?: string | null;
	lot?: string | null;
}

const currentYear = new Date().getFullYear();
// Fast helper to determine age without creating Date objects
function getAge(birthDate: string | null): number | null {
	if (!birthDate || birthDate.length < 4) return null;
	const birthYear = parseInt(birthDate.substring(0, 4), 10);
	if (isNaN(birthYear)) return null;
	return currentYear - birthYear;
}

// Get list of all households summaries
export const getHouseholds = createServerFn({
	method: "POST",
}).handler(async (): Promise<HouseholdSummary[]> => {
	const allResidents = db.select({
		id: residents.id,
		householdId: residents.householdId,
		birthDate: residents.birthDate,
		relationshipToHead: residents.relationshipToHead,
		fullName: residents.fullName,
		purok: residents.purok,
	}).from(residents).all();
	const allHouseholds = db.select().from(households).all();
	const hhMap = new Map(allHouseholds.map((h) => [h.id, h]));

	// Group residents by householdId
	const groups: Record<string, typeof allResidents> = {};
	for (const r of allResidents) {
		if (!r.householdId) continue;
		groups[r.householdId] = groups[r.householdId] || [];
		groups[r.householdId].push(r);
	}

	const summaries: HouseholdSummary[] = [];

	for (const [householdId, members] of Object.entries(groups)) {
		let adultsCount = 0;
		let childrenCount = 0;

		for (const m of members) {
			const age = getAge(m.birthDate);
			if (age !== null && age < 18) {
				childrenCount++;
			} else {
				adultsCount++; // Treat missing birthDate as adult by default
			}
		}

		const isHead = (m: any) =>
			m.relationshipToHead?.toLowerCase() === "head" ||
			m.relationshipToHead?.toLowerCase() === "self";
		const head = members.find(isHead);
		const headName = head
			? head.fullName
			: members[0]?.fullName
				? `${members[0].fullName} (No Head)`
				: "Unknown";
		const purok = head ? head.purok : members[0]?.purok || "Unknown";

		summaries.push({
			householdId,
			purok,
			headName,
			memberCount: members.length,
			adultsCount,
			childrenCount,
			block: hhMap.get(householdId)?.block || null,
			lot: hhMap.get(householdId)?.lot || null,
		});
	}

	// Sort by Purok then Head Name
	return summaries.sort((a, b) => {
		const pComp = a.purok.localeCompare(b.purok);
		if (pComp !== 0) return pComp;
		return a.headName.localeCompare(b.headName);
	});
});

// Get detailed household tree members
export const getHouseholdDetails = createServerFn({
	method: "POST",
})
	.validator((householdId: string) => householdId)
	.handler(async ({ data: householdId }): Promise<HouseholdDetail | null> => {
		// Fetch the dwelling info
		const dwelling = db
			.select()
			.from(households)
			.where(eq(households.id, householdId))
			.get();

		const members = db
			.select()
			.from(residents)
			.where(eq(residents.householdId, householdId))
			.all();

		if (members.length === 0 && !dwelling) return null;

		let head: HouseholdMember | null = null;
		let spouse: HouseholdMember | null = null;
		const children: HouseholdMember[] = [];
		const others: HouseholdMember[] = [];

		const isHead = (m: any) =>
			m.relationshipToHead?.toLowerCase() === "head" ||
			m.relationshipToHead?.toLowerCase() === "self";

		const headId = members.find(isHead)?.id;

		for (const m of members) {
			const formattedMember: HouseholdMember = {
				...m,
				block: dwelling?.block || null,
				lot: dwelling?.lot || null,
				isHeadOfHousehold: m.id === headId,
				isPwd: m.isPwd ?? false,
				isSeniorCitizen: m.isSeniorCitizen ?? false,
				isResidentVoter: m.isResidentVoter ?? false,
				isRegisteredVoter: m.isRegisteredVoter ?? false,
				isSingleParent: m.isSingleParent ?? false,
				isOfw: m.isOfw ?? false,
				isOsy: m.isOsy ?? false,
				isIp: m.isIp ?? false,
				isMigrant: m.isMigrant ?? false,
				isNationalPensioner: m.isNationalPensioner ?? false,
				isLocalPensioner: m.isLocalPensioner ?? false,
				isBedBound: m.isBedBound ?? false,
				isWheelchairBound: m.isWheelchairBound ?? false,
				isDialysisPatient: m.isDialysisPatient ?? false,
				isCancerPatient: m.isCancerPatient ?? false,
				isDeceased: m.isDeceased ?? false,
			};

			if (headId && m.id === headId) {
				head = formattedMember;
			} else if (m.relationshipToHead?.toLowerCase() === "spouse") {
				spouse = formattedMember;
			} else if (["child", "son", "daughter"].includes(m.relationshipToHead?.toLowerCase() || "")) {
				children.push(formattedMember);
			} else {
				others.push(formattedMember);
			}
		}

		const purok = dwelling?.purok || head?.purok || members[0]?.purok || "Unknown";

		return {
			householdId,
			purok,
			block: dwelling?.block || null,
			lot: dwelling?.lot || null,
			phase: dwelling?.phase || null,
			tenureStatus: dwelling?.tenureStatus || null,
			housingType: dwelling?.housingType || null,
			constructionType: dwelling?.constructionType || null,
			sanitationMethod: dwelling?.sanitationMethod || null,
			head,
			spouse,
			children,
			others,
		};
	});

export const updateHouseholdDetails = createServerFn({
	method: "POST",
})
	.validator(
		(data: {
			oldHouseholdId: string;
			purok: string;
			block: string | null;
			lot: string | null;
			newHeadId?: number;
		}) => data,
	)
	.handler(async ({ data }) => {
		const members = db
			.select()
			.from(residents)
			.where(eq(residents.householdId, data.oldHouseholdId))
			.all();

		if (members.length === 0)
			return { success: false, error: "Household not found" };

		let headMember = members.find((m) => m.id === data.newHeadId);
		if (!headMember) {
			headMember = members.find(
				(m) =>
					m.isHeadOfHousehold ||
					m.relationshipToHead?.toLowerCase() === "head" ||
					m.relationshipToHead?.toLowerCase() === "self",
			);
		}
		if (!headMember) {
			headMember = members[0];
		}

		let newHouseholdId = `HH-${data.purok || "UNKNOWN"}-BLK${data.block || ""}-LOT${data.lot || ""}`.replace(/[\s\/]+/g, "_").toUpperCase();
		if (!data.block && !data.lot) {
			newHouseholdId = `HH-${data.purok || "UNKNOWN"}-FAM-${headMember.lastName || "UNKNOWN"}`.replace(/[\s\/]+/g, "_").toUpperCase();
		}

		// Upsert the household
		db.insert(households).values({
			id: newHouseholdId,
			purok: data.purok,
			block: data.block || null,
			lot: data.lot || null,
			updatedAt: new Date(),
		}).onConflictDoUpdate({
			target: households.id,
			set: {
				purok: data.purok,
				block: data.block || null,
				lot: data.lot || null,
				updatedAt: new Date(),
			}
		}).run();

		for (const member of members) {
			let isHead = member.isHeadOfHousehold;
			let relationship = member.relationshipToHead;

			if (data.newHeadId) {
				if (member.id === data.newHeadId) {
					isHead = true;
					relationship = "Head";
				} else if (
					isHead ||
					relationship?.toLowerCase() === "head" ||
					relationship?.toLowerCase() === "self"
				) {
					isHead = false;
					relationship = "Relative";
				}
			}

			db.update(residents)
				.set({
					householdId: newHouseholdId,
					purok: data.purok,
					isHeadOfHousehold: isHead,
					relationshipToHead: relationship,
					updatedAt: new Date(),
				})
				.where(eq(residents.id, member.id))
				.run();
		}

		return { success: true, newHouseholdId };
	});

// Fast search for households within a specific purok
export const searchHouseholds = createServerFn({
	method: "POST",
})
	.validator((params: { purok: string; query?: string }) => params)
	.handler(async ({ data: { purok, query } }) => {
		// First get matching households in the purok
		const conditions = [eq(households.purok, purok)];
		
		if (query && query.trim() !== "") {
			const searchTerm = `%${query.trim()}%`;
			conditions.push(
				or(
					like(households.id, searchTerm),
					like(households.block, searchTerm),
					like(households.lot, searchTerm)
				) as any
			);
		}

		// Find the households
		const hhQuery = db
			.select()
			.from(households)
			.where(and(...conditions))
			.limit(30)
			.all();

		if (hhQuery.length === 0) return [];

		// For each household, find the head to get their name
		const householdIds = hhQuery.map((h) => h.id);
		
		const heads = db
			.select({
				householdId: residents.householdId,
				firstName: residents.firstName,
				lastName: residents.lastName,
			})
			.from(residents)
			.where(
				and(
					eq(residents.isHeadOfHousehold, true),
					// Using or for IN clause since sqlite IN requires specific syntax in drizzle sometimes
					or(...householdIds.map(id => eq(residents.householdId, id)))
				)
			)
			.all();

		const headMap = new Map();
		for (const h of heads) {
			headMap.set(h.householdId, `${h.firstName || ""} ${h.lastName || ""}`.trim() || "Unknown");
		}

		// Map results
		const results: HouseholdSummary[] = hhQuery.map((h) => ({
			householdId: h.id,
			purok: h.purok,
			block: h.block,
			lot: h.lot,
			headName: headMap.get(h.id) || "Family",
			memberCount: 0, // Not needed for combobox
			adultsCount: 0,
			childrenCount: 0,
		}));

		// If there is a query, we should also search by resident head name directly
		if (query && query.trim() !== "") {
			const headNameSearch = db
				.select()
				.from(residents)
				.where(
					and(
						eq(residents.purok, purok),
						eq(residents.isHeadOfHousehold, true),
						like(residents.fullName, `%${query.trim()}%`)
					)
				)
				.limit(20)
				.all();

			for (const resident of headNameSearch) {
				if (resident.householdId && !results.some(r => r.householdId === resident.householdId)) {
					const hh = db.select().from(households).where(eq(households.id, resident.householdId)).get();
					if (hh) {
						results.push({
							householdId: hh.id,
							purok: hh.purok,
							block: hh.block,
							lot: hh.lot,
							headName: resident.fullName,
							memberCount: 0,
							adultsCount: 0,
							childrenCount: 0,
						});
					}
				}
			}
		}

		return results.slice(0, 30);
	});
