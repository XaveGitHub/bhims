import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users, settings } from "../db/schema";
import { z } from "zod";
import {
	verifyPassword,
	hashPassword,
	isPasswordHash,
	setSessionCookie,
	clearSessionCookie,
	verifySessionToken,
} from "./security";

const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

// ── In-memory rate limiter ──
const failedAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(key: string): { locked: boolean; secondsLeft?: number } {
	const now = Date.now();
	const record = failedAttempts.get(key);
	if (!record || now > record.resetAt) return { locked: false };
	if (record.count >= MAX_ATTEMPTS) {
		const secondsLeft = Math.ceil((record.resetAt - now) / 1000);
		return { locked: true, secondsLeft };
	}
	return { locked: false };
}

function recordFailure(key: string) {
	const now = Date.now();
	const record = failedAttempts.get(key);
	if (!record || now > record.resetAt) {
		failedAttempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
	} else {
		record.count++;
	}
}

function clearFailures(key: string) {
	failedAttempts.delete(key);
}

// ── Server function: check if first-run (no users) ──
export const isFirstRun = createServerFn({ method: "GET" }).handler(async () => {
	const count = db.select().from(users).all().length;
	return count === 0;
});

// ── Server function: create first admin (only if no users exist) ──
const createFirstAdminSchema = z.object({
	name: z.string().min(1),
	username: z.string().min(3),
	password: z.string().min(6),
});

export const createFirstAdmin = createServerFn({ method: "POST" })
	.validator(createFirstAdminSchema)
	.handler(async ({ data: { name, username, password } }) => {
		const existing = db.select().from(users).all();
		if (existing.length > 0) {
			return { success: false, error: "Setup already complete. An admin account already exists." };
		}
		const hashed = await hashPassword(password);
		db.insert(users)
			.values({ username, name, password: hashed, role: "admin", createdAt: new Date(), updatedAt: new Date() })
			.run();
		return { success: true };
	});

// ── Server function: login ──
export const login = createServerFn({ method: "POST" })
	.validator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
		console.log("Login attempt for:", username);
		// Rate limit check
		const limit = checkRateLimit(username);
		if (limit.locked) {
			console.log("Login rate limited for:", username);
			return {
				success: false,
				error: `Too many failed attempts. Please wait ${limit.secondsLeft} seconds before trying again.`,
			};
		}

		const user = db.select().from(users).where(eq(users.username, username)).get();

		if (!user) {
			console.log("Login failed: User not found");
			recordFailure(username);
			return { success: false, error: "Invalid username or password" };
		}

		const passwordValid = await verifyPassword(password, user.password);
		if (!passwordValid) {
			console.log("Login failed: Invalid password");
			recordFailure(username);
			return { success: false, error: "Invalid username or password" };
		}

		// ── Plaintext migration: if stored as plaintext, re-hash on successful login ──
		if (!isPasswordHash(user.password)) {
			console.log("Migrating plaintext password for:", username);
			const hashed = await hashPassword(password);
			db.update(users)
				.set({ password: hashed, updatedAt: new Date() })
				.where(eq(users.id, user.id))
				.run();
		}

		clearFailures(username);

		console.log("Setting session cookie for:", username);
		await setSessionCookie({ id: user.id, role: user.role as "admin" | "staff", name: user.name, username: user.username });
		console.log("Login successful for:", username);
		return { success: true };
	});

// ── Server function: logout ──
export const logout = createServerFn({ method: "POST" }).handler(async () => {
	await clearSessionCookie();
	return { success: true };
});

// ── Server function: check auth (used by root loader) ──
export const checkAuth = createServerFn({ method: "POST" }).handler(async () => {
	const { getCookie } = await import("@tanstack/react-start/server");
	const cookie = getCookie("bhims_session_v2");
	console.log("checkAuth cookie:", cookie ? "present" : "missing");
	const session = await verifySessionToken(cookie);
	console.log("checkAuth session:", session ? "valid" : "invalid");
	if (!session) return { isAuthenticated: false, user: null };
	return { isAuthenticated: true, user: { id: session.id, role: session.role, name: session.name, username: session.username } };
});

// ── Server function: get current barangay branding ──
export const getBarangayName = createServerFn({ method: "GET" }).handler(async () => {
	const nameSetting = db
		.select()
		.from(settings)
		.where(eq(settings.key as any, "barangay_name"))
		.all();
	return nameSetting[0]?.value || "Barangay Handumanan";
});

async function requireAdmin() {
	const { getCookie } = await import("@tanstack/react-start/server");
	const cookie = getCookie("bhims_session_v2");
	const session = await verifySessionToken(cookie);
	if (!session || session.role !== "admin") {
		throw new Error("Unauthorized");
	}
}

// ── Account management (admin-only — guarded at call site in accounts route) ──
export const getUsers = createServerFn({ method: "GET" }).handler(async () => {
	await requireAdmin();
	const allUsers = db
		.select({ id: users.id, username: users.username, role: users.role, name: users.name })
		.from(users)
		.all();
	return allUsers;
});

const updateAccountSchema = z.object({
	id: z.number(),
	username: z.string().min(1, "Username cannot be empty"),
	name: z.string().min(1, "Name cannot be empty"),
	newPassword: z.string().optional(),
});

export const updateUserAccount = createServerFn({ method: "POST" })
	.validator(updateAccountSchema)
	.handler(async ({ data: { id, username, name, newPassword } }) => {
		try {
			await requireAdmin();
			const existingUser = db.select().from(users).where(eq(users.username, username)).get();
			if (existingUser && existingUser.id !== id) {
				return { success: false, error: "Username is already taken" };
			}
			const updateData: any = { username, name, updatedAt: new Date() };
			if (newPassword) {
				updateData.password = await hashPassword(newPassword);
			}
			db.update(users).set(updateData).where(eq(users.id, id)).run();
			return { success: true };
		} catch (error) {
			console.error("Failed to update account", error);
			return { success: false, error: "Failed to update account details" };
		}
	});

const createAccountSchema = z.object({
	username: z.string().min(1, "Username cannot be empty"),
	name: z.string().min(1, "Name cannot be empty"),
	password: z.string().min(1, "Password cannot be empty"),
	role: z.enum(["admin", "staff"]),
});

export const createUserAccount = createServerFn({ method: "POST" })
	.validator(createAccountSchema)
	.handler(async ({ data: { username, name, password, role } }) => {
		try {
			await requireAdmin();
			const existingUser = db.select().from(users).where(eq(users.username, username)).get();
			if (existingUser) {
				return { success: false, error: "Username is already taken" };
			}
			const hashed = await hashPassword(password);
			db.insert(users)
				.values({ username, name, password: hashed, role, createdAt: new Date(), updatedAt: new Date() })
				.run();
			return { success: true };
		} catch (error) {
			console.error("Failed to create account", error);
			return { success: false, error: "Failed to create account" };
		}
	});

export const deleteUserAccount = createServerFn({ method: "POST" })
	.validator(z.object({ id: z.number() }))
	.handler(async ({ data: { id } }) => {
		try {
			await requireAdmin();
			const targetUser = db.select().from(users).where(eq(users.id, id)).get();
			if (!targetUser) return { success: false, error: "User not found" };
			if (targetUser.role === "admin") {
				const allAdmins = db.select().from(users).where(eq(users.role, "admin")).all();
				if (allAdmins.length <= 1) {
					return { success: false, error: "Cannot delete the last administrator account." };
				}
			}
			db.delete(users).where(eq(users.id, id)).run();
			return { success: true };
		} catch (error) {
			console.error("Failed to delete account", error);
			return { success: false, error: "Failed to delete account" };
		}
	});

