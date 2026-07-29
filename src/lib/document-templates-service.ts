import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../db";
import { documentTemplates } from "../db/schema";
import { requireAdmin } from "./security";

export const getTemplates = createServerFn({
	method: "POST",
}).handler(async () => {
	const templates = db.select().from(documentTemplates).all();
	return templates.map(t => ({
		...t,
		fieldMappings: t.fieldMappings as any
	}));
});

export const createTemplate = createServerFn({
	method: "POST",
})
	.validator((data: { name: string; price: number; imageBase64: string; isActive?: boolean; originalFileName?: string; fieldMappings?: any[] }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		let finalFilename = data.imageBase64;
		if (data.imageBase64.startsWith("data:image")) {
			const matches = data.imageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
			if (matches && matches.length === 3) {
				const mimeType = matches[1].toLowerCase();
				if (!['png', 'jpeg', 'jpg', 'webp'].includes(mimeType)) {
					throw new Error("Invalid image format. Only PNG, JPEG, and WebP are allowed.");
				}
				const buffer = Buffer.from(matches[2], "base64");
				
				// Clean the original filename or fallback to 'template'
				const baseName = data.originalFileName 
					? data.originalFileName.replace(/\.[^/.]+$/, "") // Remove extension
					: "template";
					
				// Keep the original name but add a small timestamp so files don't overwrite each other
				finalFilename = `${baseName}_${Date.now()}.${mimeType}`;
				
				const templatesDir = process.env.USER_DATA_PATH 
					? path.join(process.env.USER_DATA_PATH, "templates") 
					: path.join(process.cwd(), "public/templates");
				await fs.mkdir(templatesDir, { recursive: true });
				await fs.writeFile(path.join(templatesDir, finalFilename), buffer);
			} else {
				throw new Error("Invalid image data");
			}
		}

		db.insert(documentTemplates).values({
			name: data.name,
			price: data.price,
			isActive: data.isActive ?? true,
			imageBase64: finalFilename,
			fieldMappings: data.fieldMappings || [],
		}).run();
		return { success: true };
	});

export const updateTemplate = createServerFn({
	method: "POST",
})
	.validator((data: { id: number; name: string; price: number; imageBase64: string; isActive?: boolean; originalFileName?: string, fieldMappings?: any[] }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		let finalFilename = data.imageBase64;
		if (data.imageBase64.startsWith("data:image")) {
			const matches = data.imageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
			if (matches && matches.length === 3) {
				const mimeType = matches[1].toLowerCase();
				if (!['png', 'jpeg', 'jpg', 'webp'].includes(mimeType)) {
					throw new Error("Invalid image format. Only PNG, JPEG, and WebP are allowed.");
				}
				const buffer = Buffer.from(matches[2], "base64");
				
				// Clean the original filename or fallback to 'template'
				const baseName = data.originalFileName 
					? data.originalFileName.replace(/\.[^/.]+$/, "") // Remove extension
					: "template";
					
				// Keep the original name but add a small timestamp so files don't overwrite each other
				finalFilename = `${baseName}_${Date.now()}.${mimeType}`;
				
				const templatesDir = process.env.USER_DATA_PATH 
					? path.join(process.env.USER_DATA_PATH, "templates") 
					: path.join(process.cwd(), "public/templates");
				await fs.mkdir(templatesDir, { recursive: true });
				await fs.writeFile(path.join(templatesDir, finalFilename), buffer);
			} else {
				throw new Error("Invalid image data");
			}
		}

		db.update(documentTemplates)
			.set({
				name: data.name,
				price: data.price,
				isActive: data.isActive ?? true,
				imageBase64: finalFilename,
				fieldMappings: data.fieldMappings,
			})
			.where(eq(documentTemplates.id, data.id))
			.run();
		return { success: true };
	});

export const toggleTemplateActive = createServerFn({
	method: "POST",
})
	.validator((data: { id: number; isActive: boolean }) => data)
	.handler(async ({ data }) => {
		await requireAdmin();
		db.update(documentTemplates)
			.set({ isActive: data.isActive })
			.where(eq(documentTemplates.id, data.id))
			.run();
		return { success: true };
	});

export const deleteTemplate = createServerFn({
	method: "POST",
})
	.validator((id: number) => id)
	.handler(async ({ data: id }) => {
		await requireAdmin();
		const tpl = db.select().from(documentTemplates).where(eq(documentTemplates.id, id)).get();
		if (tpl && tpl.imageBase64 && !tpl.imageBase64.startsWith("data:image")) {
			try {
				await fs.unlink(path.join(process.cwd(), "public/templates", tpl.imageBase64));
			} catch (err) {
				console.error("Failed to delete template image file:", err);
			}
		}
		db.delete(documentTemplates).where(eq(documentTemplates.id, id)).run();
		return { success: true };
	});
