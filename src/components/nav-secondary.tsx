import type { TablerIcon } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type * as React from "react";

import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";
import { prefetchSettingsData } from "#/routes/settings.tsx";

interface SecondaryItem {
	title: string;
	url: string;
	icon: TablerIcon;
}

export function NavSecondary({
	items,
	...props
}: { items: SecondaryItem[] } & React.ComponentProps<typeof SidebarGroup>) {
	if (!items?.length) return null;

	return (
		<SidebarGroup {...props}>
			<SidebarGroupContent>
				<SidebarMenu>
					{items.map((item) => (
						<SidebarMenuItem key={item.title}>
							<SidebarMenuButton asChild>
								<Link
									to={item.url}
									onMouseEnter={() => {
										if (item.url === "/settings") prefetchSettingsData();
									}}
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
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
