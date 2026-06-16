import { TanStackDevtools } from "@tanstack/react-devtools";
import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	HeadContent,
	Outlet,
	redirect,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { useEffect, useState } from "react";
import { AppSidebar } from "../components/app-sidebar";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "../components/ui/sidebar";
import { Toaster } from "../components/ui/sonner";
import TanStackQueryDevtools from "../integrations/tanstack-query/devtools";
import { getBarangayName, getClientAuth } from "../lib/auth-service";
import appCss from "../styles.css?url";
import { TooltipProvider } from "../components/ui/tooltip";

interface MyRouterContext {
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
	head: () => ({
		meta: [
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "Barangay Handumanan - BHIMS",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	loader: async ({ location }) => {
		// Bypass auth check for login page
		if (location.pathname === "/login") {
			return;
		}

		const isAuthenticated = await getClientAuth();
		if (!isAuthenticated) {
			throw redirect({
				to: "/login",
				search: {
					redirect: location.href,
				},
			});
		}
	},
	component: RootLayout,
});

function RootLayout() {
	const location = useLocation();
	const isLoginPage = location.pathname === "/login";
	const [brgyName, setBrgyName] = useState("Barangay Handumanan");

	useEffect(() => {
		if (!isLoginPage) {
			getBarangayName().then(setBrgyName);
		}
	}, [isLoginPage]);

	// If we are on the login page, just render the child route directly without the layout shell
	if (isLoginPage) {
		return (
			<RootDocument>
				<Outlet />
			</RootDocument>
		);
	}

	return (
		<RootDocument>
			{/* Fixed decorative background — outside the sidebar flex context so it doesn't break peer selectors */}
			<div className="fixed inset-0 bg-neutral-950 z-[-2]" />
			<div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/15 via-neutral-950/0 to-transparent pointer-events-none z-[-1]" />
			<div className="fixed top-0 left-0 h-[350px] w-[350px] rounded-full bg-emerald-950/8 blur-[120px] pointer-events-none z-[-1]" />
			<div className="fixed bottom-0 right-0 h-[350px] w-[350px] rounded-full bg-emerald-950/8 blur-[120px] pointer-events-none z-[-1]" />
			<div
				className="fixed inset-0 opacity-[0.025] pointer-events-none z-[-1]"
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

			{/* SidebarProvider must wrap ONLY the sidebar + content so peer selectors work */}
			<SidebarProvider defaultOpen={true}>
				<AppSidebar brgyName={brgyName} />

				{/* Main Content Area */}
				<SidebarInset className="flex flex-col bg-transparent">
					{/* Top Navbar */}
					<header className="flex h-16 items-center justify-between border-b border-white/5 bg-neutral-950/40 px-6 backdrop-blur-md shrink-0 sticky top-0 z-20">
						<div className="flex items-center gap-3">
							<SidebarTrigger className="text-neutral-400 hover:text-neutral-200" />
							<h1 className="text-lg font-bold tracking-tight text-neutral-100 hidden sm:block">
								{brgyName} BHIMS
							</h1>
						</div>

						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 rounded-full bg-emerald-950/30 border border-emerald-900/30 px-3 py-1 text-xs text-emerald-400">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
									<span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
								</span>
								<span className="font-semibold uppercase tracking-wider text-[10px]">
									Local Server Online
								</span>
							</div>
						</div>
					</header>

					{/* Page content */}
					<div className="flex-1 overflow-y-auto p-6 md:p-8">
						<Outlet />
					</div>
				</SidebarInset>
			</SidebarProvider>
		</RootDocument>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="dark" style={{ colorScheme: "dark" }}>
			<head>
				<HeadContent />
			</head>
			<body>
				<TooltipProvider delayDuration={150}>
					{children}
				</TooltipProvider>
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
						TanStackQueryDevtools,
					]}
				/>
				<Toaster theme="dark" />
				<Scripts />
			</body>
		</html>
	);
}
