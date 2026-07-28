
import { ChevronsUpDown, LogOut, Shield } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu.tsx";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "#/components/ui/sidebar.tsx";
import { logout } from "#/lib/auth-service.ts";
import { clearClientAuth } from "#/lib/client-auth.ts";

interface UserInfo {
	name: string;
	email: string;
	avatar?: string;
}

export function NavUser({ user }: { user: UserInfo }) {
	const handleLogout = async () => {
		await logout();
		clearClientAuth();
		window.location.href = "/login";
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-primary/5 data-[state=open]:text-primary hover:!text-primary hover:bg-primary/5 transition-all duration-200"
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
								<Shield className="size-4" />
							</div>
							<div className="flex flex-1 items-center">
								<span className="font-semibold text-[13.5px] tracking-tight whitespace-nowrap">{user.name}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-40 rounded-xl bg-card border border-border text-foreground/90 p-1.5 shadow-xl"
						side="bottom"
						align="end"
						sideOffset={8}
					>
						<DropdownMenuItem
							onClick={handleLogout}
							className="cursor-pointer text-sidebar-foreground focus:text-red-600 focus:bg-red-50 rounded-lg font-semibold text-[13px] py-2 px-3 flex items-center transition-colors group"
						>
							<LogOut className="mr-2.5 h-4 w-4 text-current" />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
