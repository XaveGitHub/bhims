import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings, users } from "../db/schema";
import { z } from "zod";

const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1),
});

// Server function to validate login
export const login = createServerFn({
	method: "POST",
})
	.validator(loginSchema)
	.handler(async ({ data: { username, password } }) => {
		// Auto-seed admin and staff if users table is completely empty
		const allUsers = db.select().from(users).all();
		if (allUsers.length === 0) {
			db.insert(users).values([
				{ username: "admin", password: "123", role: "admin", name: "Administrator" },
				{ username: "staff", password: "123", role: "staff", name: "Barangay Staff" }
			]).run();
		}

		// Query user
		const user = db
			.select()
			.from(users)
			.where(eq(users.username, username))
			.get();

		// In a real app, use bcrypt to compare passwords. We're using plain text for this local prototype.
		if (user && user.password === password) {
			// Dynamically import server-only cookie helpers
			const { setCookie } = await import("@tanstack/react-start/server");

			// Set session cookie with the user's role and id
			const sessionData = JSON.stringify({ id: user.id, role: user.role, name: user.name });
			setCookie("bhims_session", sessionData, {
				httpOnly: true,
				secure: false, // local HTTP
				path: "/",
				maxAge: 30 * 24 * 60 * 60,
			});
			return { success: true };
		}

		return { success: false, error: "Invalid username or password" };
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
	if (!cookie) return { isAuthenticated: false, user: null };
	
	try {
		const sessionData = JSON.parse(cookie);
		return { isAuthenticated: true, user: sessionData };
	} catch (e) {
		return { isAuthenticated: true, user: null }; // Legacy cookie fallback
	}
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

// Server function to get users for management
export const getUsers = createServerFn({
	method: "GET",
}).handler(async () => {
	// Return users without passwords
	const allUsers = db
		.select({
			id: users.id,
			username: users.username,
			role: users.role,
			name: users.name,
		})
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

// Server function to update a user's account details (username, name, and optionally password)
export const updateUserAccount = createServerFn({
	method: "POST",
})
	.validator(updateAccountSchema)
	.handler(async ({ data: { id, username, name, newPassword } }) => {
		try {
			// Check if username is already taken by another user
			const existingUser = db
				.select()
				.from(users)
				.where(eq(users.username, username))
				.get();
			
			if (existingUser && existingUser.id !== id) {
				return { success: false, error: "Username is already taken" };
			}

			const updateData: any = {
				username,
				name,
				updatedAt: new Date(),
			};

			if (newPassword) {
				updateData.password = newPassword;
			}

			db.update(users)
				.set(updateData)
				.where(eq(users.id, id))
				.run();
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

// Server function to create a new user account
export const createUserAccount = createServerFn({
	method: "POST",
})
	.validator(createAccountSchema)
	.handler(async ({ data: { username, name, password, role } }) => {
		try {
			// Check if username is already taken
			const existingUser = db
				.select()
				.from(users)
				.where(eq(users.username, username))
				.get();
			
			if (existingUser) {
				return { success: false, error: "Username is already taken" };
			}

			db.insert(users)
				.values({
					username,
					name,
					password,
					role,
					createdAt: new Date(),
					updatedAt: new Date(),
				})
				.run();

			return { success: true };
		} catch (error) {
			console.error("Failed to create account", error);
			return { success: false, error: "Failed to create account" };
		}
	});

// Server function to delete a user account
export const deleteUserAccount = createServerFn({
	method: "POST",
})
	.validator(z.object({ id: z.number() }))
	.handler(async ({ data: { id } }) => {
		try {
			// Prevent deleting the very last admin
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
