import {
	IconDashboard,
	IconDatabase,
	IconFolder,
	IconFileCertificate,
	IconInnerShadowTop,
	IconSettings,
	IconUsers,
	IconUserShield,
	IconClipboardList,
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
	...props
}: { brgyName: string } & React.ComponentProps<typeof Sidebar>) {
	const data = {
		user: {
			name: brgyName,
			email: "local-node@bhims.gov",
		},
		navMain: [
			{
				title: "Dashboard",
				url: "/",
				icon: IconDashboard,
			},
			{
				title: "Staff Queue",
				url: "/queue",
				icon: IconClipboardList,
			},
			{
				title: "Residents",
				url: "/residents",
				icon: IconUsers,
			},
			{
				title: "Households",
				url: "/households",
				icon: IconFolder,
			},
			{
				title: "Document Templates",
				url: "/templates",
				icon: IconFileCertificate,
			},
		],
		documents: [
			{
				name: "Excel Import",
				url: "/import",
				icon: IconDatabase,
			},
		],
		navSecondary: [
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
		],
	};

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
				<NavDocuments items={data.documents} />
				<NavSecondary items={data.navSecondary} className="mt-auto" />
			</SidebarContent>
			<SidebarFooter>
				<NavUser user={data.user} />
			</SidebarFooter>
		</Sidebar>
	);
}
