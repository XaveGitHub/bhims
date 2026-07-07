
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
							className="data-[state=open]:bg-neutral-900/50 data-[state=open]:text-neutral-200 text-neutral-300 hover:bg-neutral-900/50 hover:text-neutral-100 rounded-xl mb-2 transition-all p-2 h-auto"
						>
							<div className="flex aspect-square size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
								<Shield className="size-4.5" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight ml-1">
								<span className="truncate font-bold text-[13px]">{user.name}</span>
								<span className="truncate text-[11px] text-neutral-500">{user.email || "Local Server"}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4 text-neutral-600" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-xl bg-neutral-900 border border-white/10 text-neutral-200 p-2 shadow-xl"
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
