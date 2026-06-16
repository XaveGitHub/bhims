import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { residents } from "../db/schema";

export interface HouseholdMember {
	id: number;
	fullName: string;
	birthDate: string | null;
	gender: string | null;
	relationshipToHead: string | null;
	isHeadOfHousehold: boolean;
	isPwd: boolean;
	pwdType: string | null;
	isSeniorCitizen: boolean;
	isVoter: boolean;
	isSingleParent: boolean;
	contactNumber: string | null;
	purok: string;
	householdId: string | null;
}

export interface HouseholdDetail {
	householdId: string;
	purok: string;
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
		const members = db
			.select()
			.from(residents)
			.where(eq(residents.householdId, householdId))
			.all();

		if (members.length === 0) return null;

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
				id: m.id,
				fullName: m.fullName,
				birthDate: m.birthDate,
				gender: m.gender,
				relationshipToHead: m.relationshipToHead,
				isHeadOfHousehold: m.id === headId,
				isPwd: m.isPwd ?? false,
				pwdType: m.pwdType ?? null,
				isSeniorCitizen: m.isSeniorCitizen ?? false,
				isVoter: m.isVoter ?? false,
				isSingleParent: m.isSingleParent ?? false,
				contactNumber: m.contactNumber,
				purok: m.purok,
				householdId: m.householdId,
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

		const purok = head ? head.purok : members[0]?.purok || "Unknown";

		return {
			householdId,
			purok,
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
