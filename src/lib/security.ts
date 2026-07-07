
export type UserRole = "admin" | "staff";

export interface SessionUser {
	id: number;
	role: UserRole;
	name: string;
	username?: string;
	exp: number;
}

const SESSION_COOKIE = "bhims_session_v2";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const PASSWORD_PREFIX = "scrypt$";

function base64UrlEncode(value: string | Uint8Array) {
	const buffer = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
	return buffer
		.toString("base64")
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
	const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
	return Buffer.from(padded.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

async function getSessionSecret() {
	const { eq } = await import("drizzle-orm");
	const { db } = await import("../db");
	const { settings } = await import("../db/schema");

	const existing = db
		.select()
		.from(settings)
		.where(eq(settings.key as any, "session_secret"))
		.get();
	if (existing?.value) return existing.value;

	const { randomBytes } = await import("node:crypto");
	const secret = randomBytes(32).toString("hex");
	db.insert(settings)
		.values({ key: "session_secret", value: secret })
		.onConflictDoNothing()
		.run();

	const saved = db
		.select()
		.from(settings)
		.where(eq(settings.key as any, "session_secret"))
		.get();
	return saved?.value || secret;
}

async function hmac(data: string, secret: string) {
	const { createHmac } = await import("node:crypto");
	return base64UrlEncode(createHmac("sha256", secret).update(data).digest());
}

export async function createSessionToken(user: Omit<SessionUser, "exp">) {
	const payload: SessionUser = {
		...user,
		exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
	};
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	const signature = await hmac(encodedPayload, await getSessionSecret());
	return `${encodedPayload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined) {
	if (!token) return null;
	const [encodedPayload, signature] = token.split(".");
	if (!encodedPayload || !signature) return null;

	const expected = await hmac(encodedPayload, await getSessionSecret());
	const { timingSafeEqual } = await import("node:crypto");
	const actualBuffer = Buffer.from(signature);
	const expectedBuffer = Buffer.from(expected);
	if (
		actualBuffer.length !== expectedBuffer.length ||
		!timingSafeEqual(actualBuffer, expectedBuffer)
	) {
		return null;
	}

	try {
		const session = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8")) as SessionUser;
		if (!session.id || !session.role || session.exp < Date.now()) return null;
		if (session.role !== "admin" && session.role !== "staff") return null;
		return session;
	} catch {
		return null;
	}
}

export async function setSessionCookie(user: Omit<SessionUser, "exp">) {
	const { setCookie } = await import("@tanstack/react-start/server");
	setCookie(SESSION_COOKIE, await createSessionToken(user), {
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		path: "/",
		maxAge: SESSION_MAX_AGE_SECONDS,
	});
}

export async function clearSessionCookie() {
	const { setCookie } = await import("@tanstack/react-start/server");
	setCookie(SESSION_COOKIE, "", {
		httpOnly: true,
		secure: false,
		sameSite: "lax",
		path: "/",
		maxAge: 0,
	});
}

export async function getSessionUser() {
	const { getCookie } = await import("@tanstack/react-start/server");
	return verifySessionToken(getCookie(SESSION_COOKIE));
}

export async function requireAuth() {
	const user = await getSessionUser();
	if (!user) throw new Error("Unauthorized");
	return user;
}

export async function requireStaff() {
	const user = await requireAuth();
	if (user.role !== "staff" && user.role !== "admin") {
		throw new Error("Forbidden");
	}
	return user;
}

export async function requireAdmin() {
	const user = await requireAuth();
	if (user.role !== "admin") throw new Error("Forbidden");
	return user;
}

export function isPasswordHash(value: string) {
	return value.startsWith(PASSWORD_PREFIX);
}

export async function hashPassword(password: string) {
	const { randomBytes, scrypt } = await import("node:crypto");
	const salt = randomBytes(16).toString("hex");
	const key = await new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, 64, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey as Buffer);
		});
	});
	return `${PASSWORD_PREFIX}${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
	if (!isPasswordHash(stored)) {
		return password === stored;
	}

	const [, salt, hash] = stored.split("$");
	if (!salt || !hash) return false;
	const { scrypt, timingSafeEqual } = await import("node:crypto");
	const key = await new Promise<Buffer>((resolve, reject) => {
		scrypt(password, salt, 64, (err, derivedKey) => {
			if (err) reject(err);
			else resolve(derivedKey as Buffer);
		});
	});
	const storedBuffer = Buffer.from(hash, "hex");
	return storedBuffer.length === key.length && timingSafeEqual(storedBuffer, key);
}
