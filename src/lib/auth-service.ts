import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "../db/schema";

// Server function to validate login PIN
export const login = createServerFn({
	method: "POST",
})
	.validator((pin: string) => pin)
	.handler(async ({ data: pin }) => {
		// Query actual PIN from database
		const pinSetting = db
			.select()
			.from(settings)
			.where(eq(settings.key as any, "pin"))
			.all();

		const correctPin = pinSetting[0]?.value || "1234";

		if (pin === correctPin) {
			// Dynamically import server-only cookie helpers to prevent client bundle errors
			const { setCookie } = await import("@tanstack/react-start/server");

			// Set session cookie (must NOT be secure:true since local offline app runs on HTTP)
			setCookie("bhims_session", "authenticated", {
				httpOnly: true,
				secure: false, // false because offline/localhost app runs over HTTP, not HTTPS
				path: "/",
				maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
			});
			return { success: true };
		}

		return { success: false, error: "Invalid PIN" };
	});

// Server function to logout (clear cookie)
export const logout = createServerFn({
	method: "POST",
}).handler(async () => {
	const { deleteCookie } = await import("@tanstack/react-start/server");
	deleteCookie("bhims_session");
	return { success: true };
});

// Server function to check if user is authenticated
export const checkAuth = createServerFn({
	method: "GET",
}).handler(async () => {
	const { getCookie } = await import("@tanstack/react-start/server");
	const cookie = getCookie("bhims_session");
	return { isAuthenticated: cookie === "authenticated" };
});

// Server function to get current Barangay branding
export const getBarangayName = createServerFn({
	method: "GET",
}).handler(async () => {
	const nameSetting = db
		.select()
		.from(settings)
		.where(eq(settings.key as any, "barangay_name"))
		.all();
	return nameSetting[0]?.value || "Barangay Handumanan";
});

// Server function to get correct PIN length for UI rendering
export const getPinLength = createServerFn({
	method: "GET",
}).handler(async () => {
	const pinSetting = db
		.select()
		.from(settings)
		.where(eq(settings.key as any, "pin"))
		.all();
	return (pinSetting[0]?.value || "1234").length;
});

let clientAuthCache: boolean | null = null;

export async function getClientAuth() {
	if (typeof window === "undefined") {
		const res = await checkAuth();
		return res.isAuthenticated;
	}
	if (clientAuthCache !== null) {
		return clientAuthCache;
	}
	try {
		const res = await checkAuth();
		clientAuthCache = res.isAuthenticated;
		return clientAuthCache;
	} catch (err) {
		return false;
	}
}

export function setClientAuth(value: boolean) {
	clientAuthCache = value;
}

export function clearClientAuth() {
	clientAuthCache = null;
}
