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
										"bg-accent text-accent-foreground font-medium",
								}}
								inactiveProps={{
									className:
										"text-muted-foreground hover:bg-accent/50 hover:text-foreground",
								}}
								className="flex w-full items-center gap-3 transition-all group/link duration-200"
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
