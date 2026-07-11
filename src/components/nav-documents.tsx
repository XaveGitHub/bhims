import type { TablerIcon } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";

interface DocumentItem {
	name: string;
	url: string;
	icon: TablerIcon;
}

export function NavDocuments({ items }: { items: DocumentItem[] }) {
	if (!items?.length) return null;

	return (
		<SidebarGroup>
			<SidebarGroupLabel className="normal-case text-muted-foreground font-semibold text-xs mt-2">
				Data Management
			</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<SidebarMenuItem key={item.name}>
						<SidebarMenuButton asChild>
							<Link
								to={item.url}
								activeProps={{
									className:
										"bg-primary text-primary-foreground font-medium shadow-sm",
								}}
								inactiveProps={{
									className:
										"text-muted-foreground hover:bg-accent hover:text-accent-foreground",
								}}
								className="flex w-full items-center gap-3 transition-all group/link duration-200 !rounded-full"
							>
								<item.icon className="h-4 w-4 shrink-0 transition-transform group-hover/link:scale-110" />
								<span className="group-data-[collapsible=icon]:hidden">
									{item.name}
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
