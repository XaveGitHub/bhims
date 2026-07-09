import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "#/components/login-form.tsx";

// Define the route
export const Route = createFileRoute("/login")({
	component: LoginScreen,
});

function LoginScreen() {
	return (
		<div className="grid min-h-screen lg:grid-cols-2 bg-neutral-950 font-sans dark text-neutral-100 selection:bg-blue-500/30">
			{/* Left side: Branding Panel */}
			<div className="relative hidden lg:flex flex-col justify-end bg-neutral-900 border-r border-white/5 p-12 overflow-hidden">
				{/* Background Image */}
				<img 
					src="/community_bg.png" 
					alt="Community Background" 
					className="absolute inset-0 h-full w-full object-cover filter brightness-[0.4] saturate-[0.8]"
				/>
				
				{/* Gradients to blend image and text */}
				<div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-blue-950/30 pointer-events-none z-0" />
				<div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-blue-800/10 blur-[100px] rounded-full z-0" />
				
				{/* Text positioned at the bottom left */}
				<div className="relative z-10">
					<h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-white mb-4 drop-shadow-xl">
						Empowering<br/>
						<span className="text-blue-400">Barangay Handumanan</span>
					</h2>
					<p className="text-lg text-neutral-300 max-w-md leading-relaxed drop-shadow-md">
						The central hub for resident records, household analytics, and streamlined community services.
					</p>
				</div>
			</div>

			{/* Right side: Login Form Panel */}
			<div className="relative flex flex-col p-6 md:p-10 justify-center">
				{/* Background Grid for Right Side */}
				<div
					className="absolute inset-0 opacity-[0.025] pointer-events-none z-0"
					style={{
						backgroundImage:
							"linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)",
						backgroundSize: "24px 24px",
						maskImage:
							"radial-gradient(circle at center, black 40%, transparent 80%)",
						WebkitMaskImage:
							"radial-gradient(circle at center, black 40%, transparent 80%)",
					}}
				/>

				
				<div className="flex flex-1 items-center justify-center relative z-10">
					<div className="w-full max-w-sm">
						<LoginForm />
					</div>
				</div>
			</div>
		</div>
	);
}
