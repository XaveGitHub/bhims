import { createServerFn } from "@tanstack/react-start";
import { and, or, eq, like, sql, getTableColumns, desc, asc, inArray } from "drizzle-orm";
import { db } from "../db";
import { residents, households } from "../db/schema";

export interface ResidentInput {
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
	// Location & Household
	purok: string;
	householdId: string | null;
	isNewHousehold?: boolean;
	newHouseholdBlock?: string | null;
	newHouseholdLot?: string | null;
	isHeadOfHousehold: boolean;
	relationshipToHead: string | null;
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
			isResidentVoter?: boolean;
			isRegisteredVoter?: boolean;
			isSingleParent?: boolean;
			isUnemployed?: boolean;
			gender?: string;
			isDeceased?: boolean;
			page?: number;
			limit?: number;
			sortBy?: string;
			sortDesc?: boolean;
		}) => params,
	)
	.handler(async ({ data: params }) => {
		const page = params.page || 1;
		const limit = params.limit || 10;
		const offset = (page - 1) * limit;

		const baseQuery = db
			.select({
				...getTableColumns(residents),
				block: households.block,
				lot: households.lot,
			})
			.from(residents)
			.leftJoin(households, eq(residents.householdId, households.id));
			
		const conditions = [];

		if (params.search) {
			const searchTerms = params.search.trim().split(/\s+/);
			const termConditions = searchTerms.map(term => {
				const wildcardTerm = `%${term}%`;
				return or(
					like(residents.fullName, wildcardTerm),
					like(residents.firstName, wildcardTerm),
					like(residents.lastName, wildcardTerm),
					like(residents.middleName, wildcardTerm),
					like(residents.residentId, wildcardTerm)
				);
			});
			// All terms must match at least one of the fields (e.g. typing "Smith John" matches both)
			conditions.push(and(...termConditions));
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
		if (params.isResidentVoter !== undefined) {
			conditions.push(eq(residents.isResidentVoter, params.isResidentVoter));
		}
		if (params.isRegisteredVoter !== undefined) {
			conditions.push(eq(residents.isRegisteredVoter, params.isRegisteredVoter));
		}
		if (params.isSingleParent !== undefined) {
			conditions.push(eq(residents.isSingleParent, params.isSingleParent));
		}
		if (params.isUnemployed !== undefined) {
			if (params.isUnemployed) {
				conditions.push(eq(residents.employmentStatus, "Unemployed"));
			} else {
				conditions.push(sql`${residents.employmentStatus} != 'Unemployed' OR ${residents.employmentStatus} IS NULL`);
			}
		}
		if (params.gender) {
			conditions.push(eq(residents.gender, params.gender));
		}
		
		// By default, exclude deceased residents unless explicitly requested
		conditions.push(eq(residents.isDeceased, params.isDeceased ?? false));

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
		let sortColumn: any = residents.lastName;
		if (params.sortBy === "age") {
			// Age sort is inverse to birthDate (older = smaller birthDate)
			sortColumn = residents.birthDate;
		} else if (params.sortBy === "purok") {
			sortColumn = residents.purok;
		} else if (params.sortBy === "fullName") {
			sortColumn = residents.fullName;
		}

		// When sorting by age visually, we flip the desc since smaller birthDate = higher age
		let finalDesc = params.sortDesc;
		if (params.sortBy === "age") {
			finalDesc = !finalDesc;
		}

		const orderFn = finalDesc ? desc : asc;

		const itemsQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;
		const items = itemsQuery
			.orderBy(orderFn(sortColumn), orderFn(residents.firstName)) // Secondary sort by first name
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

		// Prevent duplicates based on firstName, lastName, and birthDate (case-insensitive)
		const existingResident = db.select({ id: residents.id })
			.from(residents)
			.where(
				and(
					sql`lower(${residents.firstName}) = lower(${data.firstName || ""})`,
					sql`lower(${residents.lastName}) = lower(${data.lastName || ""})`,
					eq(residents.birthDate, data.birthDate || "")
				)
			)
			.get();
			
		if (existingResident) {
			return { success: false, resident: null, error: "A resident with this exact name and birth date already exists." };
		}

		let finalHouseholdId = data.householdId;
		if (data.isNewHousehold) {
			let hhId = `HH-${data.purok}-BLK${data.newHouseholdBlock || ""}-LOT${data.newHouseholdLot || ""}`.replace(/[\s\/]+/g, "_").toUpperCase();
			if (!data.newHouseholdBlock && !data.newHouseholdLot) {
				hhId = `HH-${data.purok}-FAM-${data.lastName}`.replace(/[\s\/]+/g, "_").toUpperCase();
			}
			
			db.insert(households).values({
				id: hhId,
				purok: data.purok,
				block: data.newHouseholdBlock || null,
				lot: data.newHouseholdLot || null,
			}).onConflictDoNothing().run();
			
			finalHouseholdId = hhId;
		}

		// Remove the extra UI-only fields before inserting
		const { isNewHousehold, newHouseholdBlock, newHouseholdLot, ...insertData } = data;

		// Generate a unique 8-digit numeric ID
		const generateId = () => {
			return Math.floor(10000000 + Math.random() * 90000000).toString();
		};

		let residentId = generateId();
		let isUnique = false;
		while (!isUnique) {
			const existing = db.select({ id: residents.id }).from(residents).where(eq(residents.residentId, residentId)).get();
			if (!existing) {
				isUnique = true;
			} else {
				residentId = generateId();
			}
		}

		try {
			const result = db
				.insert(residents)
				.values({
					...insertData,
					residentId,
					householdId: finalHouseholdId,
					isSeniorCitizen: isSenior,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.returning()
				.get(); // Drizzle SQLite `.returning().get()` gets the inserted row

			return { success: true, resident: result, error: null as string | null };
		} catch (err: any) {
			return { success: false, resident: null, error: err.message || "Failed to add resident" };
		}
	});

// Bulk delete residents
export const bulkDeleteResidents = createServerFn({
	method: "POST",
})
	.validator((ids: number[]) => ids)
	.handler(async ({ data: ids }) => {
		if (!ids.length) return { success: false };
		try {
			db.delete(residents).where(inArray(residents.id, ids)).run();
			return { success: true };
		} catch (err: any) {
			return { success: false, error: err.message };
		}
	});

// Mark resident as deceased
export const markResidentDeceased = createServerFn({
	method: "POST",
})
	.validator((ids: number[]) => ids)
	.handler(async ({ data: ids }) => {
		if (!ids.length) return { success: false };
		try {
			db.update(residents)
				.set({ isDeceased: true, updatedAt: new Date() })
				.where(inArray(residents.id, ids))
				.run();
			return { success: true };
		} catch (err: any) {
			return { success: false, error: err.message };
		}
	});

// Bulk update purok
export const bulkUpdatePurok = createServerFn({
	method: "POST",
})
	.validator((params: { ids: number[]; purok: string }) => params)
	.handler(async ({ data: { ids, purok } }) => {
		if (!ids.length) return { success: false };
		try {
			db.update(residents)
				.set({ purok, updatedAt: new Date() })
				.where(inArray(residents.id, ids))
				.run();
			return { success: true };
		} catch (err: any) {
			return { success: false, error: err.message };
		}
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

		let finalHouseholdId = data.householdId;
		if (data.isNewHousehold) {
			let hhId = `HH-${data.purok || "UNKNOWN"}-BLK${data.newHouseholdBlock || ""}-LOT${data.newHouseholdLot || ""}`.replace(/[\s\/]+/g, "_").toUpperCase();
			if (!data.newHouseholdBlock && !data.newHouseholdLot) {
				hhId = `HH-${data.purok || "UNKNOWN"}-FAM-${data.lastName || "UNKNOWN"}`.replace(/[\s\/]+/g, "_").toUpperCase();
			}
			
			db.insert(households).values({
				id: hhId,
				purok: data.purok || "UNKNOWN",
				block: data.newHouseholdBlock || null,
				lot: data.newHouseholdLot || null,
			}).onConflictDoNothing().run();
			
			finalHouseholdId = hhId;
		}

		// Remove the extra UI-only fields before updating
		const { isNewHousehold, newHouseholdBlock, newHouseholdLot, ...restData } = data;

		const updateData = {
			...restData,
			...(isSenior !== undefined ? { isSeniorCitizen: isSenior } : {}),
			...(finalHouseholdId !== undefined ? { householdId: finalHouseholdId } : {}),
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
