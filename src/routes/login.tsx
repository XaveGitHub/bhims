import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "#/components/login-form.tsx";

// Define the route
export const Route = createFileRoute("/login")({
	component: LoginScreen,
});

function LoginScreen() {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center p-4 md:p-8 bg-neutral-950 text-neutral-100 select-none relative overflow-hidden font-sans">
			{/* Premium ambient mesh background behind the centered form */}
			<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/20 via-neutral-950 to-neutral-950 pointer-events-none z-0" />
			<div className="absolute top-[-10%] left-[-10%] h-[350px] w-[350px] rounded-full bg-emerald-950/5 blur-[100px] pointer-events-none z-0" />
			<div className="absolute bottom-[-10%] right-[-10%] h-[350px] w-[350px] rounded-full bg-emerald-950/5 blur-[100px] pointer-events-none z-0" />

			{/* Grid overlay */}
			<div
				className="absolute inset-0 opacity-[0.015] bg-[linear-gradient(to_right,#808080_1px,transparent_1px),linear-gradient(to_bottom,#808080_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"
				style={{
					maskImage:
						"radial-gradient(circle at center, black 40%, transparent 80%)",
					WebkitMaskImage:
						"radial-gradient(circle at center, black 40%, transparent 80%)",
				}}
			/>

			{/* Split-pane card container with rich frosted glass effect (no shadows) */}
			<div className="relative z-10 grid w-full max-w-4xl grid-cols-1 overflow-hidden rounded-3xl border border-white/10 border-t-white/20 bg-neutral-950/40 backdrop-blur-2xl md:grid-cols-2 min-h-[520px]">
				{/* Left Showcase Panel: Dazzling community showcase */}
				<div className="hidden md:flex flex-col justify-between p-10 relative overflow-hidden bg-neutral-950/80 border-r border-white/5">
					<img
						src="/login_banner.png"
						className="absolute inset-0 object-cover opacity-25 filter mix-blend-luminosity brightness-90 saturate-50 pointer-events-none select-none h-full w-full"
						alt="Community Banner"
					/>
					<div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/90 via-neutral-950/90 to-transparent z-0 pointer-events-none" />

					{/* Logo Header */}
					<div className="relative z-10 flex items-center gap-2">
						<div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs shadow-md shadow-emerald-900/50">
							B
						</div>
						<span className="font-bold text-sm tracking-tight text-neutral-200">
							BHIMS
						</span>
					</div>

					{/* Center Typography Content */}
					<div className="relative z-10 my-auto py-8">
						<h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-neutral-100 leading-tight">
							Empowering Barangay Handumanan
						</h2>
						<p className="mt-4 text-xs lg:text-sm text-neutral-400 max-w-md leading-relaxed">
							Welcome to BHIMS, your secure local portal for resident records,
							household analytics, and community services.
						</p>
					</div>

					{/* Bullet point list at the bottom */}
					<div className="relative z-10 flex flex-col gap-2 pt-4 border-t border-neutral-900/60 text-[11px] lg:text-xs text-neutral-400 font-medium">
						<div className="flex items-center gap-2">
							<span className="text-emerald-400 font-bold">✓</span>
							<span>Secure Offline Local Node</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-emerald-400 font-bold">✓</span>
							<span>Resident & Household Management</span>
						</div>
						<div className="flex items-center gap-2">
							<span className="text-emerald-400 font-bold">✓</span>
							<span>Purok & Demographic Analytics</span>
						</div>
					</div>
				</div>

				{/* Right Credentials Form Panel */}
				<div className="flex flex-col justify-center p-8 sm:p-10 bg-neutral-900/10">
					<LoginForm />
				</div>
			</div>
		</div>
	);
}
