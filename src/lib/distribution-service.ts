import { createServerFn } from "@tanstack/react-start";
import { eq, desc, and } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { requireStaff } from "./security";

// Fetch all distribution programs
export const getDistributionPrograms = createServerFn({
	method: "GET",
}).handler(async () => {
	await requireStaff();
	return db
		.select()
		.from(schema.distributionPrograms)
		.orderBy(desc(schema.distributionPrograms.createdAt))
		.all();
});

// Fetch a single distribution program by ID
export const getDistributionProgramById = createServerFn({
	method: "GET",
})
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		await requireStaff();
		const result = db
			.select()
			.from(schema.distributionPrograms)
			.where(eq(schema.distributionPrograms.id, id))
			.all();
		return result[0] || null;
	});

// Create a new program and auto-populate beneficiaries
export const createDistributionProgram = createServerFn({
	method: "POST",
})
	.validator(
		(data: {
			name: string;
			date: string;
			description?: string;
			targetDemographic: string;
			selectedResidentIds: number[];
		}) => data,
	)
	.handler(async ({ data }) => {
		await requireStaff();

		// 1. Insert the Program
		const insertResult = db
			.insert(schema.distributionPrograms)
			.values({
				name: data.name,
				date: data.date,
				description: data.description,
				targetDemographic: data.targetDemographic,
				status: "Active",
			})
			.returning({ id: schema.distributionPrograms.id })
			.all();

		const programId = insertResult[0]?.id;
		if (!programId) throw new Error("Failed to create program");

		if (!data.selectedResidentIds || data.selectedResidentIds.length === 0) {
			throw new Error("No residents selected for this program");
		}

		// Insert beneficiaries
		const beneficiariesData = data.selectedResidentIds.map((residentId) => ({
			programId,
			residentId,
			status: "Pending" as const,
		}));

		// SQLite has a parameter limit (usually 999 or 32766). We chunk it to be safe.
		const chunkSize = 100;
		for (let i = 0; i < beneficiariesData.length; i += chunkSize) {
			const chunk = beneficiariesData.slice(i, i + chunkSize);
			db.insert(schema.distributionBeneficiaries).values(chunk).run();
		}

		return { success: true, programId, count: data.selectedResidentIds.length };
	});

// Get beneficiaries for a program joined with resident details
export const getBeneficiariesByProgram = createServerFn({
	method: "GET",
})
	.validator((programId: number) => programId)
	.handler(async ({ data: programId }) => {
		await requireStaff();
		return db
			.select({
				id: schema.distributionBeneficiaries.id,
				programId: schema.distributionBeneficiaries.programId,
				residentId: schema.distributionBeneficiaries.residentId,
				status: schema.distributionBeneficiaries.status,
				claimedAt: schema.distributionBeneficiaries.claimedAt,
				notes: schema.distributionBeneficiaries.notes,
				// Resident details
				fullName: schema.residents.fullName,
				lastName: schema.residents.lastName,
				firstName: schema.residents.firstName,
				middleName: schema.residents.middleName,
				residentCode: schema.residents.residentId,
				purok: schema.residents.purok,
				photoBase64: schema.residents.photoBase64,
				birthDate: schema.residents.birthDate,
				gender: schema.residents.gender,
				isPwd: schema.residents.isPwd,
				isSingleParent: schema.residents.isSingleParent,
				isSeniorCitizen: schema.residents.isSeniorCitizen,
			})
			.from(schema.distributionBeneficiaries)
			.innerJoin(
				schema.residents,
				eq(schema.distributionBeneficiaries.residentId, schema.residents.id),
			)
			.where(eq(schema.distributionBeneficiaries.programId, programId))
			.all();
	});

// Delete a program
export const deleteDistributionProgram = createServerFn({
	method: "POST",
})
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		await requireStaff();
		
		db.delete(schema.distributionBeneficiaries)
			.where(eq(schema.distributionBeneficiaries.programId, id))
			.run();
			
		db.delete(schema.distributionPrograms)
			.where(eq(schema.distributionPrograms.id, id))
			.run();
			
		return { success: true };
	});

// Process uploaded Excel data (Offline OCR Workflow)
export const importScannedExcel = createServerFn({
	method: "POST",
})
	.validator(
		(data: {
			programId: number;
			records: Array<{ residentCode: string; signatureText: string }>;
		}) => data,
	)
	.handler(async ({ data }) => {
		await requireStaff();
		let updatedCount = 0;

		for (const record of data.records) {
			// Skip if OCR didn't detect any signature ink
			if (!record.signatureText || record.signatureText.trim() === "") continue;

			// Find resident by string code
			const residentMatch = db
				.select({ id: schema.residents.id })
				.from(schema.residents)
				.where(eq(schema.residents.residentId, record.residentCode))
				.all();

			if (residentMatch.length > 0) {
				const residentDbId = residentMatch[0].id;
				// Mark as claimed
				db.update(schema.distributionBeneficiaries)
					.set({
						status: "Claimed",
						claimedAt: new Date(),
						notes: "Claimed via Scanned Excel Signature",
					})
					.where(
						and(
							eq(schema.distributionBeneficiaries.programId, data.programId),
							eq(schema.distributionBeneficiaries.residentId, residentDbId),
							eq(schema.distributionBeneficiaries.status, "Pending"),
						),
					)
					.run();
				updatedCount++;
			}
		}

		return { success: true, updatedCount };
	});

// Mark single claim via ID Barcode Scanner (Real-time Workflow)
export const markClaimedViaScan = createServerFn({
	method: "POST",
})
	.validator(
		(data: {
			programId: number;
			residentCode: string; // The 8-digit scanned code
		}) => data,
	)
	.handler(async ({ data }) => {
		await requireStaff();
		
		// Find resident by string code
		const residentMatch = db
			.select()
			.from(schema.residents)
			.where(eq(schema.residents.residentId, data.residentCode))
			.all();

		if (residentMatch.length === 0) {
			return { success: false, error: "Resident not found in database." };
		}

		const resident = residentMatch[0];

		// Check if they are a beneficiary in this program
		const beneficiaryMatch = db
			.select()
			.from(schema.distributionBeneficiaries)
			.where(
				and(
					eq(schema.distributionBeneficiaries.programId, data.programId),
					eq(schema.distributionBeneficiaries.residentId, resident.id),
				),
			)
			.all();

		if (beneficiaryMatch.length === 0) {
			return { success: false, error: "Resident is not eligible for this distribution program." };
		}

		const beneficiary = beneficiaryMatch[0];
		if (beneficiary.status === "Claimed") {
			return { success: false, error: "Resident has already claimed this distribution.", resident };
		}

		// Mark as claimed
		db.update(schema.distributionBeneficiaries)
			.set({
				status: "Claimed",
				claimedAt: new Date(),
				notes: "Claimed via ID Scanner",
			})
			.where(eq(schema.distributionBeneficiaries.id, beneficiary.id))
			.run();

		return { success: true, resident };
	});
