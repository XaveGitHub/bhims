import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createFirstAdmin } from "../lib/auth-service";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2, ShieldCheck } from "lucide-react";
import { cn } from "../lib/utils";

export const Route = createFileRoute("/setup")({
	component: SetupScreen,
});

function SetupScreen() {
	return (
		<div className="grid min-h-screen lg:grid-cols-2 bg-background font-sans text-foreground selection:bg-primary">
			{/* Left side: Setup Form Panel */}
			<div className="relative flex flex-col p-6 md:p-10 justify-center">
				<div
					className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
					style={{
						backgroundImage:
							"linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
						backgroundSize: "24px 24px",
						maskImage: "radial-gradient(circle at center, black 40%, transparent 80%)",
						WebkitMaskImage: "radial-gradient(circle at center, black 40%, transparent 80%)",
					}}
				/>
				<div className="flex flex-1 items-center justify-center relative z-10">
					<div className="w-full max-w-sm">
						<SetupForm />
					</div>
				</div>
			</div>

			{/* Right side: Branding Panel */}
			<div className="relative hidden lg:flex flex-col justify-end bg-card border-l border-border p-12 overflow-hidden">
				<img
					src="/community_bg.png"
					alt="Community Background"
					className="absolute inset-0 h-full w-full object-cover filter brightness-[0.4] saturate-[0.8]"
				/>
				<div className="absolute inset-0 bg-background pointer-events-none z-0" />
				<div className="relative z-10">
					<h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-foreground mb-4 drop-shadow-xl">
						First Time<br />
						<span className="text-primary">Setup</span>
					</h2>
					<p className="text-lg text-foreground/80 max-w-md leading-relaxed drop-shadow-md">
						Create the first administrator account to get started. This setup screen will not appear again after an admin account exists.
					</p>
				</div>
			</div>
		</div>
	);
}

function SetupForm() {
	const [name, setName] = useState("");
	const [username, setUsername] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [generalError, setGeneralError] = useState("");
	const [loading, setLoading] = useState(false);

	const validate = () => {
		const e: Record<string, string> = {};
		if (!name.trim()) e.name = "Full name is required";
		if (!username.trim() || username.length < 3) e.username = "Username must be at least 3 characters";
		if (!password || password.length < 6) e.password = "Password must be at least 6 characters";
		if (password !== confirmPassword) e.confirmPassword = "Passwords do not match";
		return e;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setGeneralError("");
		const errs = validate();
		if (Object.keys(errs).length > 0) {
			setErrors(errs);
			return;
		}
		setErrors({});
		setLoading(true);
		try {
			const res = await createFirstAdmin({ data: { name, username, password } });
			if (res.success) {
				window.location.href = "/login";
			} else {
				setGeneralError(res.error || "Setup failed. Please try again.");
			}
		} catch {
			setGeneralError("An error occurred. Please try again.");
		} finally {
			setLoading(false);
		}
	};

	const field = (
		label: string,
		id: string,
		type: string,
		value: string,
		onChange: (v: string) => void,
		errorKey: string,
		placeholder?: string,
	) => (
		<div className="flex flex-col gap-1.5">
			<label htmlFor={id} className="text-sm font-medium text-foreground/80">{label}</label>
			<Input
				id={id}
				type={type}
				value={value}
				placeholder={placeholder}
				onChange={(e) => { onChange(e.target.value); if (errors[errorKey]) setErrors((prev) => ({ ...prev, [errorKey]: "" })); }}
				className={cn(errors[errorKey] && "border-red-500 focus-visible:ring-red-500")}
			/>
			{errors[errorKey] && <p className="text-xs text-red-500 font-medium">{errors[errorKey]}</p>}
		</div>
	);

	return (
		<form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
			<div className="flex flex-col items-center text-center -mb-2">
				<div className="relative">
					<img src="/barangay_logo.png" alt="Barangay Logo" className="relative z-10 w-24 h-24 object-contain drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
				</div>
				<h1 className="text-3xl font-bold tracking-[0.15em] text-foreground drop-shadow-sm leading-none pt-2">BHIMS</h1>
				<div className="mt-3 flex items-center gap-2 bg-primary border border-primary/20 rounded-lg px-3 py-1.5">
					<ShieldCheck className="h-4 w-4 text-primary" />
					<span className="text-xs font-semibold text-primary">Create First Administrator</span>
				</div>
			</div>

			{field("Full Name", "name", "text", name, setName, "name", "e.g. Juan dela Cruz")}
			{field("Username", "username", "text", username, setUsername, "username", "At least 3 characters")}
			{field("Password", "password", "password", password, setPassword, "password", "At least 6 characters")}
			{field("Confirm Password", "confirmPassword", "password", confirmPassword, setConfirmPassword, "confirmPassword", "Repeat your password")}

			{generalError && <p className="text-sm text-red-500 font-medium text-center">{generalError}</p>}

			<Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
				{loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Administrator Account"}
			</Button>
		</form>
	);
}
