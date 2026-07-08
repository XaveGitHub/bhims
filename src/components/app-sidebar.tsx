import {
	IconDashboard,
	IconDatabase,
	IconFileCertificate,
	IconInnerShadowTop,
	IconSettings,
	IconUsers,
	IconUserShield,
	IconClipboardList,
	IconHome,
	IconHistory,
	IconChartBar,
	IconGift,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { NavMain } from "#/components/nav-main.tsx";
import { NavSecondary } from "#/components/nav-secondary.tsx";
import { NavUser } from "#/components/nav-user.tsx";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";

export function AppSidebar({
	brgyName,
	userRole,
	...props
}: { brgyName: string; userRole?: string } & React.ComponentProps<typeof Sidebar>) {
	const data = {
		user: {
			name: brgyName,
			email: "local-node@bhims.gov",
		},
		overview: [] as any[],
		documentServices: [] as any[],
		dataTools: [] as any[],
		navSecondary: [] as any[],
	};

	if (userRole === "admin") {
		data.overview = [
			{
				title: "Dashboard",
				url: "/",
				icon: IconDashboard,
			},
			{
				title: "Residents",
				url: "/residents",
				icon: IconUsers,
			},
			{
				title: "Households",
				url: "/households",
				icon: IconHome,
			},
		];
		data.documentServices = [
			{
				title: "Document Metrics",
				url: "/document-metrics",
				icon: IconChartBar,
			},
			{
				title: "Transactions",
				url: "/transactions",
				icon: IconHistory,
			},
			{
				title: "Document Queue",
				url: "/queue",
				icon: IconClipboardList,
			},
			{
				title: "Document Templates",
				url: "/templates",
				icon: IconFileCertificate,
			},
		];
		data.dataTools = [
			{
				title: "Ayuda Distributions",
				url: "/distributions",
				icon: IconGift,
			},
			{
				title: "Data Extraction",
				url: "/extraction",
				icon: IconFileCertificate,
			},
			{
				title: "Excel Import",
				url: "/import",
				icon: IconDatabase,
			},
		];
		data.navSecondary = [
			{
				title: "Accounts",
				url: "/accounts",
				icon: IconUserShield,
			},
			{
				title: "Settings",
				url: "/settings",
				icon: IconSettings,
			},
		];
	} else if (userRole === "staff") {
		data.documentServices = [
			{
				title: "Staff Queue",
				url: "/queue",
				icon: IconClipboardList,
			},
			{
				title: "Transactions",
				url: "/transactions",
				icon: IconHistory,
			}
		];
		data.overview = [];
		data.dataTools = [];
		data.navSecondary = [];
	}

	return (
		<Sidebar collapsible="icon" {...props}>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							className="data-[slot=sidebar-menu-button]:p-1.5! w-auto group-data-[collapsible=icon]:justify-center"
						>
							<Link to="/">
								<IconInnerShadowTop className="size-5! shrink-0 text-emerald-500" />
								<span className="text-base font-bold bg-gradient-to-r from-neutral-100 to-neutral-400 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden">
									BHIMS
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{data.overview.length > 0 && <NavMain items={data.overview} label="Overview" />}
				{data.documentServices.length > 0 && <NavMain items={data.documentServices} label="Document Services" />}
				{data.dataTools.length > 0 && <NavMain items={data.dataTools} label="Data Tools" />}
				{data.navSecondary.length > 0 && <NavSecondary items={data.navSecondary} className="mt-auto" />}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
