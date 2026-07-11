import { createFileRoute } from "@tanstack/react-router";
import { LoginForm } from "#/components/login-form.tsx";

// Define the route
export const Route = createFileRoute("/login")({
	component: LoginScreen,
});

function LoginScreen() {
	return (
		<div className="grid min-h-screen lg:grid-cols-2 bg-background font-sans text-foreground selection:bg-primary">
			{/* Left side: Branding Panel */}
			<div className="relative hidden lg:flex flex-col justify-end bg-card border-r border-border p-12 overflow-hidden">
				{/* Background Image */}
				<img 
					src="/community_bg.png" 
					alt="Community Background" 
					className="absolute inset-0 h-full w-full object-cover filter brightness-[0.4] saturate-[0.8]"
				/>
				
				{/* Gradients to blend image and text */}
				<div className="absolute inset-0 bg-background pointer-events-none z-0" />
				
				{/* Text positioned at the bottom left */}
				<div className="relative z-10">
					<h2 className="text-4xl md:text-5xl font-extrabold tracking-tight leading-tight text-foreground mb-4 drop-shadow-xl">
						Empowering<br/>
						<span className="text-primary">Barangay Handumanan</span>
					</h2>
					<p className="text-lg text-foreground/80 max-w-md leading-relaxed drop-shadow-md">
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
