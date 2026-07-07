import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { residents, puroks } from "../db/schema";
import { z } from "zod";
import { requireAdmin } from "./security";

const extractSchema = z.object({
	purok: z.string().optional(),
	ageBracket: z.string().optional(),
	gender: z.string().optional(),
	isPwd: z.boolean().optional(),
	isSoloParent: z.boolean().optional(),
});

export const extractResidents = createServerFn({
	method: "POST",
})
	.validator(extractSchema)
	.handler(async ({ data }) => {
		await requireAdmin();
		try {
			let query = db.select({
				id: residents.id,
				residentId: residents.residentId,
				lastName: residents.lastName,
				firstName: residents.firstName,
				middleName: residents.middleName,
				gender: residents.gender,
				birthDate: residents.birthDate,
				purok: residents.purok,
				isPwd: residents.isPwd,
				isSingleParent: residents.isSingleParent,
			}).from(residents)
			  .leftJoin(puroks, eq(residents.purok, puroks.name));
			
			const conditions = [];
			
			// We skip deceased residents by default
			conditions.push(eq(residents.isDeceased, false));

			if (data.purok && data.purok !== "ALL") {
				conditions.push(eq(residents.purok, data.purok));
			}
			
			if (data.gender && data.gender !== "ALL") {
				conditions.push(eq(residents.gender, data.gender));
			}
			
			if (data.isPwd) {
				conditions.push(eq(residents.isPwd, true));
			}
			
			if (data.isSoloParent) {
				conditions.push(eq(residents.isSingleParent, true));
			}
			
			if (conditions.length > 0) {
				query = query.where(and(...conditions)) as any;
			}
			
			// Order by Purok Smart Order first, then alphabetically by name
			query = query.orderBy(
				asc(puroks.orderIndex), 
				asc(residents.lastName), 
				asc(residents.firstName)
			) as any;
			
			let results = await query.all();
			
			// Now filter by exact age brackets (highly accurate parsing)
			if (data.ageBracket && data.ageBracket !== "ALL") {
				const currentYear = new Date().getFullYear();
				const currentMonth = new Date().getMonth() + 1; // 1-12
				const currentDay = new Date().getDate();

				results = results.filter(r => {
					if (!r.birthDate) return false;
					
					// Split YYYY-MM-DD safely to avoid Timezone Shift bugs
					const parts = r.birthDate.split('-');
					if (parts.length !== 3) return false;
					
					const birthYear = parseInt(parts[0], 10);
					const birthMonth = parseInt(parts[1], 10);
					const birthDay = parseInt(parts[2], 10);
					
					let age = currentYear - birthYear;
					if (
						currentMonth < birthMonth || 
						(currentMonth === birthMonth && currentDay < birthDay)
					) {
						age--;
					}

					switch (data.ageBracket) {
						case "Children (0-5)": return age >= 0 && age <= 5;
						case "Children (6-12)": return age >= 6 && age <= 12;
						case "Children (13-17)": return age >= 13 && age <= 17;
						case "Adult (18-35)": return age >= 18 && age <= 35;
						case "Adult (36-50)": return age >= 36 && age <= 50;
						case "Adult (51-59)": return age >= 51 && age <= 59;
						case "Senior (60+)": return age >= 60;
						case "Senior (65+)": return age >= 65;
						default: return true;
					}
				});
			}

			return { success: true, data: results };
		} catch (error: any) {
			console.error("Extraction error:", error);
			return { success: false, error: error.message };
		}
	});
