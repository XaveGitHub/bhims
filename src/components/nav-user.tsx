
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
							className="data-[state=open]:bg-card data-[state=open]:text-foreground/90 text-muted-foreground hover:bg-card hover:text-foreground rounded-xl mb-2 transition-all p-2 h-auto"
						>
							<div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Shield className="size-4.5" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight ml-1">
								<span className="truncate font-bold text-[13px]">{user.name}</span>
								<span className="truncate text-[11px] text-foreground0">{user.email || "Local Server"}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl bg-card border border-border text-foreground/90 p-2 shadow-xl"
						side="bottom"
						align="end"
						sideOffset={8}
					>
						<DropdownMenuItem
							onClick={handleLogout}
							className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-500/10 rounded-lg font-semibold text-[13px] py-2.5 px-3 flex items-center"
						>
							<LogOut className="mr-3 h-4 w-4" />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
