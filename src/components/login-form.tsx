import { useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Lock, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button.tsx";
import { FieldGroup } from "#/components/ui/field.tsx";
import {
	getBarangayName,
	getClientAuth,
	login,
	setClientAuth,
} from "#/lib/auth-service.ts";
import { cn } from "#/lib/utils.ts";

export function LoginForm({
	className,
	...props
}: React.ComponentProps<"div">) {
	const navigate = useNavigate();
	const inputRef = useRef<HTMLInputElement>(null);

	const [pin, setPin] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);
	const [brgyName, setBrgyName] = useState("Barangay Handumanan");
	const [shake, setShake] = useState(false);
	const [showPin, setShowPin] = useState(false);

	// Focus helper
	const focusInput = useCallback(() => {
		if (!loading) {
			inputRef.current?.focus();
		}
	}, [loading]);

	// Load state and check auth on load
	useEffect(() => {
		getBarangayName().then(setBrgyName);
		getClientAuth().then((isAuthenticated) => {
			if (isAuthenticated) {
				navigate({ to: "/" });
			}
		});
	}, [navigate]);

	// Handle focus
	useEffect(() => {
		focusInput();
	}, [focusInput]);

	// Handle login request
	const handleLoginSubmit = useCallback(
		async (currentPin: string) => {
			if (currentPin.length === 0) return;
			setLoading(true);
			setError("");

			try {
				const result = await login({ data: currentPin });
				if (result.success) {
					setClientAuth(true);
					navigate({ to: "/" });
				} else {
					setError(result.error || "Invalid login PIN");
					setShake(true);
					setTimeout(() => setShake(false), 500);
					setPin("");
					focusInput();
				}
			} catch (_err) {
				setError("Connection failed. Please try again.");
				setShake(true);
				setTimeout(() => setShake(false), 500);
				setPin("");
				focusInput();
			} finally {
				setLoading(false);
			}
		},
		[navigate, focusInput],
	);

	const handleSubmitForm = (e: React.FormEvent) => {
		e.preventDefault();
		handleLoginSubmit(pin);
	};

	return (
		<div className={cn("w-full max-w-sm mx-auto", className)} {...props}>
			<form
				onSubmit={handleSubmitForm}
				className={cn("space-y-6", shake && "animate-shake")}
			>
				<FieldGroup>
					{/* 1. Header Block */}
					<div className="flex flex-col items-center text-center space-y-3">
						<div className="relative group">
							{/* Glowing ring under Barangay seal */}
							<div className="absolute -inset-1.5 rounded-full bg-emerald-500/20 blur-lg group-hover:bg-emerald-500/35 transition duration-300" />
							<img
								src="/barangay_logo.png"
								alt="Barangay Handumanan Council Seal"
								className="relative size-20 rounded-full object-cover border border-white/10 drop-shadow-[0_4px_10px_rgba(16,185,129,0.25)] select-none"
							/>
						</div>

						<div className="space-y-1">
							<h1 className="text-lg font-bold tracking-tight text-neutral-100">
								{brgyName}
							</h1>
							<p className="text-xs text-neutral-400">
								Information Management System
							</p>
						</div>
					</div>

					{/* 2. Credentials Input Area */}
					<div className="space-y-4">
						<div className="space-y-2">
							<div className="flex items-center justify-between px-0.5">
								<label
									htmlFor="pin-input"
									className="text-xs font-semibold text-neutral-400"
								>
									Access Key
								</label>
							</div>

							<div className="relative">
								{/* Leading Lock Icon */}
								<div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500">
									<Lock className="size-4" />
								</div>

								<input
									id="pin-input"
									ref={inputRef}
									type={showPin ? "text" : "password"}
									maxLength={32}
									value={pin}
									onChange={(e) => setPin(e.target.value)}
									placeholder="Enter Access Key"
									disabled={loading}
									className="w-full bg-neutral-950/40 border border-white/5 border-t-white/10 rounded-xl py-3 pl-10 pr-10 text-center text-base font-semibold tracking-wide text-emerald-400 placeholder:text-neutral-600 placeholder:tracking-normal focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all outline-none disabled:opacity-50"
								/>

								{/* Trailing Eye/EyeOff toggle button */}
								<button
									type="button"
									onClick={() => setShowPin(!showPin)}
									className="absolute right-3 top-1/2 -translate-y-1/2 size-8 flex items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-800/50 hover:text-neutral-200 transition-colors focus:outline-none"
								>
									{showPin ? (
										<EyeOff className="size-4" />
									) : (
										<Eye className="size-4" />
									)}
								</button>
							</div>
						</div>

						{error && (
							<div className="flex items-center gap-2 rounded-xl bg-red-950/20 border border-red-900/30 p-3 text-xs text-red-400 animate-in fade-in slide-in-from-top-1 duration-150">
								<ShieldAlert className="h-4 w-4 shrink-0" />
								<span className="font-medium">{error}</span>
							</div>
						)}
					</div>

					{/* 3. Action Buttons */}
					<div className="space-y-4 pt-1">
						<Button
							type="submit"
							disabled={loading || pin.length === 0}
							className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-3.5 font-semibold transition-all duration-150 flex items-center justify-center gap-2 active:scale-[0.98] shadow-md shadow-emerald-950/40 disabled:opacity-50 disabled:pointer-events-none"
						>
							<span>{loading ? "Logging in..." : "Login"}</span>
							{loading && <Loader2 className="size-4 animate-spin" />}
						</Button>
					</div>
				</FieldGroup>
			</form>
		</div>
	);
}
