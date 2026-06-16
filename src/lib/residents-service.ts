import { createServerFn } from "@tanstack/react-start";
import { and, eq, like, sql } from "drizzle-orm";
import { db } from "../db";
import { residents } from "../db/schema";

export interface ResidentInput {
	fullName: string;
	birthDate: string | null;
	gender: string | null;
	contactNumber: string | null;
	purok: string;
	householdId: string | null;
	isHeadOfHousehold: boolean;
	relationshipToHead: string | null;
	isPwd: boolean;
	pwdType: string | null;
	isSeniorCitizen: boolean;
	isVoter: boolean;
	isSingleParent: boolean;
}

// Get all residents with optional filters and pagination
export const getResidents = createServerFn({
	method: "POST",
})
	.validator(
		(params: {
			search?: string;
			purok?: string;
			isPwd?: boolean;
			isSenior?: boolean;
			isVoter?: boolean;
			isSingleParent?: boolean;
			gender?: string;
			page?: number;
			limit?: number;
		}) => params,
	)
	.handler(async ({ data: params }) => {
		const page = params.page || 1;
		const limit = params.limit || 10;
		const offset = (page - 1) * limit;

		const baseQuery = db.select().from(residents);
		const conditions = [];

		if (params.search) {
			conditions.push(like(residents.fullName, `%${params.search}%`));
		}
		if (params.purok) {
			conditions.push(eq(residents.purok, params.purok));
		}
		if (params.isPwd !== undefined) {
			conditions.push(eq(residents.isPwd, params.isPwd));
		}
		if (params.isSenior !== undefined) {
			conditions.push(eq(residents.isSeniorCitizen, params.isSenior));
		}
		if (params.isVoter !== undefined) {
			conditions.push(eq(residents.isVoter, params.isVoter));
		}
		if (params.isSingleParent !== undefined) {
			conditions.push(eq(residents.isSingleParent, params.isSingleParent));
		}
		if (params.gender) {
			conditions.push(eq(residents.gender, params.gender));
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// 1. Fetch total matching records count
		const totalQuery = db
			.select({ count: sql<number>`count(*)` })
			.from(residents);
		const totalResult = whereClause
			? totalQuery.where(whereClause).all()
			: totalQuery.all();
		const total = totalResult[0]?.count || 0;

		// 2. Fetch paginated records
		const itemsQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
		const items = itemsQuery
			.orderBy(residents.fullName)
			.limit(limit)
			.offset(offset)
			.all();

		return {
			items,
			total,
		};
	});

// Add a resident
export const addResident = createServerFn({
	method: "POST",
})
	.validator((data: ResidentInput) => data)
	.handler(async ({ data }) => {
		// Determine if they are senior citizen based on birthdate if age is > 60
		let isSenior = data.isSeniorCitizen;
		if (data.birthDate) {
			const birth = new Date(data.birthDate);
			const age = new Date().getFullYear() - birth.getFullYear();
			if (age >= 60) {
				isSenior = true;
			}
		}

		const result = db
			.insert(residents)
			.values({
				...data,
				isSeniorCitizen: isSenior,
				createdAt: new Date(),
				updatedAt: new Date(),
			})
			.returning()
			.get(); // Drizzle SQLite `.returning().get()` gets the inserted row

		return { success: true, resident: result };
	});

// Update a resident
export const updateResident = createServerFn({
	method: "POST",
})
	.validator((params: { id: number; data: Partial<ResidentInput> }) => params)
	.handler(async ({ data: { id, data } }) => {
		let isSenior = data.isSeniorCitizen;
		if (data.birthDate) {
			const birth = new Date(data.birthDate);
			const age = new Date().getFullYear() - birth.getFullYear();
			if (age >= 60) {
				isSenior = true;
			}
		}

		const updateData = {
			...data,
			...(isSenior !== undefined ? { isSeniorCitizen: isSenior } : {}),
			updatedAt: new Date(),
		};

		db.update(residents).set(updateData).where(eq(residents.id, id)).run();

		return { success: true };
	});

// Delete a resident
export const deleteResident = createServerFn({
	method: "POST",
})
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		db.delete(residents).where(eq(residents.id, id)).run();
		return { success: true };
	});

// Fetch list of unique puroks currently in the database
export const getUniquePuroks = createServerFn({
	method: "POST",
}).handler(async () => {
	const results = db.select({ purok: residents.purok }).from(residents).all();
	const uniquePuroks = Array.from(
		new Set(results.map((r) => r.purok).filter(Boolean)),
	);
	return uniquePuroks.sort();
});
