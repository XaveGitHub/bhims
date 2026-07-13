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
import { getBarangayName, isFirstRun } from "../lib/auth-service";
import { getClientAuth, getClientUser } from "../lib/client-auth";
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
		const firstRun = await isFirstRun();

		// If trying to access setup but not first run, redirect to login
		if (location.pathname === "/setup") {
			if (!firstRun) throw redirect({ to: "/login" });
			return;
		}

		// On first run (no users), redirect everything (except kiosk) to /setup
		if (firstRun && location.pathname !== "/kiosk") {
			throw redirect({ to: "/setup" });
		}

		const isAuthenticated = await getClientAuth();
		const user = await getClientUser();
		const isPublicRoute = location.pathname === "/kiosk" || location.pathname === "/monitor" || location.pathname === "/login";
		
		// If we are already on login and not authenticated, just return early to prevent infinite redirect
		if (location.pathname === "/login" && !isAuthenticated) {
			return;
		}
		if (!isAuthenticated && !isPublicRoute) {
			throw redirect({
				to: "/login",
				search: {
					redirect: location.href,
				},
			});
		}

		if (user?.role === "staff" && location.pathname !== "/queue") {
			throw redirect({ to: "/queue" });
		}

		return { user };
	},
	component: RootLayout,
});

function RootLayout() {
	const { user } = Route.useLoaderData() || { user: null };
	const location = useLocation();
	const isLoginPage = location.pathname === "/login";
	const isKioskPage = location.pathname === "/kiosk";
	const isMonitorPage = location.pathname === "/monitor";
	const isSetupPage = location.pathname === "/setup";
	const isFullscreenPage = isLoginPage || isKioskPage || isSetupPage || isMonitorPage;
	const [brgyName, setBrgyName] = useState("Barangay Handumanan");

	useEffect(() => {
		if (!isFullscreenPage) {
			getBarangayName().then(setBrgyName);
		}
	}, [isFullscreenPage]);

	// If we are on a fullscreen page (login/kiosk), just render the child route directly without the layout shell
	if (isFullscreenPage) {
		return (
			<RootDocument>
				<Outlet />
			</RootDocument>
		);
	}

	return (
		<RootDocument>
			{/* Fixed decorative background — outside the sidebar flex context so it doesn't break peer selectors */}
			<div className="fixed inset-0 bg-background z-[-2]" />
			<div className="fixed inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/5 via-neutral-950/0 to-transparent pointer-events-none z-[-1]" />
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
				<AppSidebar brgyName={brgyName} userRole={user?.role} />

				{/* Main Content Area */}
				<SidebarInset className="flex flex-col bg-transparent">
					{/* Top Navbar */}
					<header className="flex h-16 items-center justify-between border-b border-border bg-background px-6 shrink-0 sticky top-0 z-20">
						<div className="flex items-center gap-3">
							<SidebarTrigger className="text-muted-foreground hover:text-foreground/90" />
							<h1 className="text-lg font-bold tracking-tight text-foreground hidden sm:block">
								{brgyName} BHIMS
							</h1>
						</div>

						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2 rounded-full bg-accent border border-primary/20 px-3 py-1 text-xs text-primary dark:bg-primary/10 dark:border-primary/20 dark:text-primary">
								<span className="relative flex h-2 w-2">
									<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
									<span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
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
		<html lang="en" className="light">
			<head>
				<HeadContent />
			</head>
			<body className="font-sans antialiased">
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
				<Toaster />
				<Scripts />
			</body>
		</html>
	);
}
