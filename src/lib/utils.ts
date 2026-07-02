import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatHouseholdId(id: string | null | undefined): string {
	if (!id) return "—";
	return id
		.replace(/^HH-/, "")
		.replace(/[_-]+/g, " ")
		.toLowerCase()
		.split(" ")
		.map(word => word.charAt(0).toUpperCase() + word.slice(1))
		.join(" ")
		.replace(/\bFam\b/g, "Family");
}
