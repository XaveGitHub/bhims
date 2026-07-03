import { useNavigate } from "@tanstack/react-router";
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
import { clearClientAuth, logout } from "#/lib/auth-service.ts";

interface UserInfo {
	name: string;
	email: string;
	avatar?: string;
}

export function NavUser({ user }: { user: UserInfo }) {
	const navigate = useNavigate();

	const handleLogout = async () => {
		await logout();
		clearClientAuth();
		navigate({ to: "/login" });
	};

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							size="lg"
							className="data-[state=open]:bg-neutral-900 data-[state=open]:text-neutral-200 text-neutral-200 border border-neutral-800 bg-neutral-950/20 hover:bg-white/5 rounded-xl mb-2"
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-400 border border-emerald-900/30">
								<Shield className="size-4" />
							</div>
							<div className="grid flex-1 text-left text-sm leading-tight">
								<span className="truncate font-bold text-xs">{user.name}</span>
							</div>
							<ChevronsUpDown className="ml-auto size-4 text-neutral-500" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						className="w-[--radix-dropdown-menu-trigger-width] min-w-40 rounded-xl bg-neutral-900 border-neutral-800 text-neutral-200 p-1"
						side="bottom"
						align="end"
						sideOffset={8}
					>
						<DropdownMenuItem
							onClick={handleLogout}
							className="cursor-pointer text-red-400 hover:text-red-300 focus:text-red-300 focus:bg-red-950/30 rounded-lg font-semibold text-xs py-2"
						>
							<LogOut className="mr-2 h-4 w-4" />
							Log out
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
