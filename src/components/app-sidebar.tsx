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
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import { NavDocuments } from "#/components/nav-documents.tsx";
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
		navMain: [] as any[],
		documents: [] as any[],
		navSecondary: [] as any[],
	};

	if (userRole === "admin") {
		data.navMain = [
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
		data.documents = [
			{
				name: "Data Extraction",
				url: "/extraction",
				icon: IconFileCertificate,
			},
			{
				name: "Excel Import",
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
		data.navMain = [
			{
				title: "Staff Queue",
				url: "/queue",
				icon: IconClipboardList,
			}
		];
		data.documents = [];
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
				<NavMain items={data.navMain} />
				{data.documents.length > 0 && <NavDocuments items={data.documents} />}
				{data.navSecondary.length > 0 && <NavSecondary items={data.navSecondary} className="mt-auto" />}
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
