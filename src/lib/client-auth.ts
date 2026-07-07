import { checkAuth } from "./auth-service";

// ── Client-side auth cache ──
let clientAuthCache: { isAuthenticated: boolean; user: any } | null = null;

export async function getClientAuth() {
	if (typeof window === "undefined") {
		const res = await checkAuth();
		return res.isAuthenticated;
	}
	if (clientAuthCache !== null) {
		return clientAuthCache.isAuthenticated;
	}
	try {
		const res = await checkAuth();
		clientAuthCache = res;
		return res.isAuthenticated;
	} catch {
		return false;
	}
}

export async function getClientUser() {
	if (typeof window === "undefined") {
		const res = await checkAuth();
		return res.user;
	}
	if (clientAuthCache !== null) return clientAuthCache.user;
	try {
		const res = await checkAuth();
		clientAuthCache = res;
		return res.user;
	} catch {
		return null;
	}
}

export function setClientAuth(value: boolean) {
	if (clientAuthCache) clientAuthCache.isAuthenticated = value;
	else clientAuthCache = { isAuthenticated: value, user: null };
}

export function clearClientAuth() {
	clientAuthCache = null;
}
