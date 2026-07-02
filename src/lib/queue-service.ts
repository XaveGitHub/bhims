import { createServerFn } from "@tanstack/react-start";
import { eq, inArray, asc } from "drizzle-orm";
import { db } from "../db";
import { transactions } from "../db/schema";
import { residents } from "../db/schema";
import { documentTemplates } from "../db/schema";

export const getActiveQueue = createServerFn({
	method: "GET",
}).handler(async () => {
	const activeTransactions = db
		.select({
			id: transactions.id,
			queueNumber: transactions.queueNumber,
			status: transactions.status,
			purpose: transactions.purpose,
			totalPrice: transactions.totalPrice,
			createdAt: transactions.createdAt,
			resident: {
				id: residents.id,
				firstName: residents.firstName,
				lastName: residents.lastName,
				birthDate: residents.birthDate,
				purok: residents.purok,
				gender: residents.gender,
			},
			template: {
				id: documentTemplates.id,
				name: documentTemplates.name,
				imageBase64: documentTemplates.imageBase64,
				fieldMappings: documentTemplates.fieldMappings,
			}
		})
		.from(transactions)
		.leftJoin(residents, eq(transactions.residentId, residents.id))
		.leftJoin(documentTemplates, eq(transactions.templateId, documentTemplates.id))
		.where(inArray(transactions.status, ["Pending", "Processing", "Ready to Claim"]))
		.orderBy(asc(transactions.createdAt))
		.all();

	const grouped = activeTransactions.reduce((acc, curr) => {
		const qn = curr.queueNumber;
		if (!acc[qn]) {
			acc[qn] = {
				queueNumber: qn,
				resident: curr.resident,
				createdAt: curr.createdAt,
				status: curr.status,
				items: []
			};
		}
		acc[qn].items.push(curr);
		return acc;
	}, {} as Record<number, any>);

	const result = Object.values(grouped).map((group: any) => {
		const allReady = group.items.every((i: any) => i.status === "Ready to Claim");
		const anyProcessing = group.items.some((i: any) => i.status === "Processing");
		if (allReady) group.status = "Ready to Claim";
		else if (anyProcessing) group.status = "Processing";
		else group.status = "Pending";
		return group;
	});

	return result.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
});

export const updateTransactionStatus = createServerFn({
	method: "POST",
})
	.validator((data: { transactionIds: number[]; newStatus: string }) => data)
	.handler(async ({ data: { transactionIds, newStatus } }) => {
		db.update(transactions)
			.set({ status: newStatus, updatedAt: new Date() })
			.where(inArray(transactions.id, transactionIds))
			.run();

		return { success: true };
	});

export const updateResidentAndTransaction = createServerFn({
	method: "POST",
})
	.validator((data: { 
		transactionId: number; 
		purpose: string; 
		residentId: number; 
		firstName: string; 
		lastName: string; 
		birthDate: string; 
		purok: string; 
		gender: string;
		civilStatus?: string;
		occupation?: string;
		monthlyIncome?: string;
	}) => data)
	.handler(async ({ data }) => {
		db.update(residents)
			.set({
				firstName: data.firstName,
				lastName: data.lastName,
				birthDate: data.birthDate,
				purok: data.purok,
				gender: data.gender,
				civilStatus: data.civilStatus,
				occupation: data.occupation,
				monthlyIncome: data.monthlyIncome,
				updatedAt: new Date()
			})
			.where(eq(residents.id, data.residentId))
			.run();

		db.update(transactions)
			.set({
				purpose: data.purpose,
				updatedAt: new Date()
			})
			.where(eq(transactions.id, data.transactionId))
			.run();

		return { success: true };
	});
