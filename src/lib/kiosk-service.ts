import { createServerFn } from "@tanstack/react-start";
import { eq, and, like } from "drizzle-orm";
import { db } from "../db";
import { residents, transactions } from "../db/schema";
import { z } from "zod";

// Schema for barcode login
const barcodeSchema = z.object({
	barcode: z.string().min(1),
});

export const kioskLoginByBarcode = createServerFn({
	method: "POST",
})
	.validator(barcodeSchema)
	.handler(async ({ data: { barcode } }) => {
		const resident = db
			.select()
			.from(residents)
			.where(eq(residents.residentId, barcode))
			.get();

		if (resident) {
			return { success: true, resident };
		}
		return { success: false, error: "Resident ID not found" };
	});

// Schema for manual name search
const manualSearchSchema = z.object({
	firstName: z.string().min(1),
	lastName: z.string().min(1),
	birthDate: z.string().min(1),
});

export const kioskLoginByName = createServerFn({
	method: "POST",
})
	.validator(manualSearchSchema)
	.handler(async ({ data: { firstName, lastName, birthDate } }) => {
		const cleanFirstName = firstName.trim();
		const cleanLastName = lastName.trim();
		
		const resident = db
			.select()
			.from(residents)
			.where(
				and(
					like(residents.firstName, cleanFirstName),
					like(residents.lastName, cleanLastName),
					eq(residents.birthDate, birthDate)
				)
			)
			.get();

		if (resident) {
			return { success: true, resident };
		}
		return { success: false, error: "No matching resident records found" };
	});

const submitRequestSchema = z.object({
	residentId: z.number(),
	purpose: z.string().min(1),
	items: z.array(z.object({
		templateId: z.number(),
		totalPrice: z.number()
	})).min(1)
});

export const submitKioskRequest = createServerFn({
	method: "POST",
})
	.validator(submitRequestSchema)
	.handler(async ({ data: { residentId, purpose, items } }) => {
		// Get max queue number for today
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		
		const txs = db.select().from(transactions).all();
		const todayTxs = txs.filter(t => new Date(t.createdAt || 0) >= today);
		
		let nextQueueNumber = 1;
		if (todayTxs.length > 0) {
			nextQueueNumber = Math.max(...todayTxs.map(t => t.queueNumber || 0)) + 1;
		}

		// Insert all items with the same queue number
		for (const item of items) {
			db.insert(transactions).values({
				queueNumber: nextQueueNumber,
				residentId,
				templateId: item.templateId,
				purpose,
				totalPrice: item.totalPrice,
				status: "Pending",
			}).run();
		}
		
		return { 
			success: true, 
			queueNumber: nextQueueNumber.toString().padStart(4, '0')
		};
	});
