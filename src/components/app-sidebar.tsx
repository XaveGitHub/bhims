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
			<SidebarHeader className="group-data-[collapsible=icon]:p-0">
				<Link to="/" className="flex items-center gap-2 px-2 py-2">
					<img src="/barangay_logo.png" alt="BHIMS Logo" className="w-11 h-11 shrink-0 object-contain" />
					<span className="text-lg font-semibold tracking-tight text-sidebar-foreground whitespace-nowrap break-normal group-data-[collapsible=icon]:hidden">
						Brgy Handumanan
					</span>
				</Link>
			</SidebarHeader>
			<SidebarContent className="-mt-3">
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
