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
											"bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-900/40 hover:text-emerald-300",
									}}
									inactiveProps={{
										className:
											"text-neutral-400 hover:bg-white/5 hover:text-neutral-100 border border-transparent",
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
