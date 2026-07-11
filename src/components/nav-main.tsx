import type { TablerIcon } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";

interface NavItem {
	title: string;
	url: string;
	icon: TablerIcon;
}

export function NavMain({ items, label = "Core Operations" }: { items: NavItem[], label?: string }) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel className="normal-case text-sidebar-foreground/70 font-semibold text-xs mt-2">
				{label}
			</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.title}>
						<SidebarMenuButton asChild isActive={false}>
							<Link
								to={item.url}
								activeProps={{
									className:
										"!bg-primary !text-primary-foreground font-medium shadow-sm hover:!bg-primary hover:brightness-105 dark:hover:brightness-95 hover:!text-primary-foreground",
								}}
								inactiveProps={{
									className:
										"text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
								}}
								className="flex w-full items-center gap-3 transition-all group/link duration-200 !rounded-full"
							>
								<item.icon className="h-4 w-4 shrink-0 transition-transform group-hover/link:scale-110" />
								<span className="group-data-[collapsible=icon]:hidden">
									{item.title}
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
