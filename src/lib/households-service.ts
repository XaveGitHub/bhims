import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
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
}

// Helper to determine age based on birthDate
function getAge(birthDate: string | null): number | null {
	if (!birthDate) return null;
	const birth = new Date(birthDate);
	return new Date().getFullYear() - birth.getFullYear();
}

// Get list of all households summaries
export const getHouseholds = createServerFn({
	method: "POST",
}).handler(async (): Promise<HouseholdSummary[]> => {
	const allResidents = db.select().from(residents).all();

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
			};

			if (headId && m.id === headId) {
				head = formattedMember;
			} else if (m.relationshipToHead?.toLowerCase() === "spouse") {
				spouse = formattedMember;
			} else if (m.relationshipToHead?.toLowerCase() === "child") {
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
			newHouseholdId: string;
			purok: string;
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
					householdId: data.newHouseholdId,
					purok: data.purok,
					isHeadOfHousehold: isHead,
					relationshipToHead: relationship,
					updatedAt: new Date(),
				})
				.where(eq(residents.id, member.id))
				.run();
		}

		return { success: true };
	});
