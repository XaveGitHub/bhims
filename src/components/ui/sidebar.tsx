import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { PanelLeft } from "lucide-react";
import * as React from "react";
import { Button } from "#/components/ui/button.tsx";
import { cn } from "#/lib/utils.ts";

const SIDEBAR_COOKIE_NAME = "sidebar:state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = "16rem";
const SIDEBAR_WIDTH_MOBILE = "18rem";
const SIDEBAR_WIDTH_ICON = "4rem";
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

type SidebarContext = {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}
	return context;
}

const SidebarProvider = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		defaultOpen?: boolean;
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	}
>(
	(
		{
			defaultOpen = true,
			open: openProp,
			onOpenChange: setOpenProp,
			className,
			style,
			children,
			...props
		},
		ref,
	) => {
		const [isMobile, setIsMobile] = React.useState(false);
		const [openMobile, setOpenMobile] = React.useState(false);

		// Internal open state if not controlled
		const [_open, _setOpen] = React.useState(defaultOpen);
		const open = openProp !== undefined ? openProp : _open;
		const setOpen = React.useCallback(
			(value: boolean | ((value: boolean) => boolean)) => {
				const nextOpen = typeof value === "function" ? value(open) : value;
				if (setOpenProp) {
					setOpenProp(nextOpen);
				} else {
					_setOpen(nextOpen);
				}

				// Set cookie for persistence (mocked in offline environment)
				document.cookie = `${SIDEBAR_COOKIE_NAME}=${nextOpen}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
			},
			[setOpenProp, open],
		);

		// Helper to toggle sidebar
		const toggleSidebar = React.useCallback(() => {
			return isMobile
				? setOpenMobile((prev) => !prev)
				: setOpen((prev) => !prev);
		}, [isMobile, setOpenMobile, setOpen]);

		// Handle mobile screen check
		React.useEffect(() => {
			const checkMobile = () => {
				setIsMobile(window.innerWidth < 768);
			};
			checkMobile();
			window.addEventListener("resize", checkMobile);
			return () => window.removeEventListener("resize", checkMobile);
		}, []);

		// Handle keyboard shortcut (Ctrl+B / Meta+B)
		React.useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				if (
					event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
					(event.metaKey || event.ctrlKey)
				) {
					event.preventDefault();
					toggleSidebar();
				}
			};

			window.addEventListener("keydown", handleKeyDown);
			return () => window.removeEventListener("keydown", handleKeyDown);
		}, [toggleSidebar]);

		const state = open ? "expanded" : "collapsed";

		const contextValue = React.useMemo<SidebarContext>(
			() => ({
				state,
				open,
				setOpen,
				isMobile,
				openMobile,
				setOpenMobile,
				toggleSidebar,
			}),
			[
				state,
				open,
				setOpen,
				isMobile,
				openMobile,
				setOpenMobile,
				toggleSidebar,
			],
		);

		return (
			<SidebarContext.Provider value={contextValue}>
				<div
					style={
						{
							"--sidebar-width": SIDEBAR_WIDTH,
							"--sidebar-width-icon": SIDEBAR_WIDTH_ICON,
							"--sidebar-width-mobile": SIDEBAR_WIDTH_MOBILE,
							...style,
						} as React.CSSProperties
					}
					className={cn(
						"group/sidebar-wrapper flex min-h-screen w-full text-neutral-100",
						className,
					)}
					ref={ref}
					{...props}
				>
					{children}
				</div>
			</SidebarContext.Provider>
		);
	},
);
SidebarProvider.displayName = "SidebarProvider";

const Sidebar = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div"> & {
		side?: "left" | "right";
		variant?: "sidebar" | "floating" | "inset";
		collapsible?: "offcanvas" | "icon" | "none";
	}
>(
	(
		{
			side = "left",
			variant = "sidebar",
			collapsible = "offcanvas",
			className,
			children,
			...props
		},
		ref,
	) => {
		const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

		if (collapsible === "none") {
			return (
				<div
					className={cn(
						"flex h-full w-[var(--sidebar-width)] flex-col bg-neutral-950/40 backdrop-blur-2xl border-r border-white/5 text-neutral-100",
						className,
					)}
					ref={ref}
					{...props}
				>
					{children}
				</div>
			);
		}

		if (isMobile) {
			if (!openMobile) return null;
			return (
				<div className="fixed inset-0 z-50 flex md:hidden">
					<div
						className="fixed inset-0 bg-black/60 backdrop-blur-sm"
						onClick={() => setOpenMobile(false)}
					/>
					<div
						ref={ref}
						className={cn(
							"relative flex w-[var(--sidebar-width-mobile)] max-w-xs flex-col bg-neutral-950/50 backdrop-blur-2xl border-r border-white/5 h-full p-4 animate-in slide-in-from-left duration-250",
							side === "right" &&
								"ml-auto border-l border-r-0 slide-in-from-right",
							className,
						)}
						{...props}
					>
						{children}
					</div>
				</div>
			);
		}

		return (
			<div
				ref={ref}
				className="group peer hidden md:block"
				data-state={state}
				data-collapsible={state === "collapsed" ? collapsible : ""}
				data-variant={variant}
				data-side={side}
			>
				{/* Sidebar wrapper space layout placeholder */}
				<div
					className={cn(
						"duration-200 relative h-screen w-[var(--sidebar-width)] bg-transparent transition-all",
						"group-data-[collapsible=offcanvas]:w-0",
						"group-data-[side=right]:rotate-180",
						variant === "floating" || variant === "inset"
							? "p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+calc(var(--spacing)*4))]"
							: "group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]",
					)}
				/>
				<div
					className={cn(
						"duration-200 fixed inset-y-0 z-10 hidden h-screen w-[var(--sidebar-width)] flex-col bg-neutral-950/40 backdrop-blur-2xl border-r border-white/5 text-neutral-100 transition-all md:flex",
						side === "left" ? "left-0" : "right-0 border-l border-r-0",
						// Collapsible offcanvas
						"group-data-[collapsible=offcanvas]:translate-x-[-100%]",
						side === "right" &&
							"group-data-[collapsible=offcanvas]:translate-x-[100%]",
						// Collapsible icon
						"group-data-[collapsible=icon]:w-[var(--sidebar-width-icon)]",
						variant === "floating"
							? "m-2 h-[calc(100vh-1rem)] rounded-2xl border border-white/10 shadow-lg"
							: "",
						className,
					)}
					{...props}
				>
					{children}
				</div>
			</div>
		);
	},
);
Sidebar.displayName = "Sidebar";

const SidebarTrigger = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<typeof Button>
>(({ className, onClick, ...props }, ref) => {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			ref={ref}
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
			className={cn(
				"h-7 w-7 text-neutral-400 hover:text-neutral-200",
				className,
			)}
			onClick={(event) => {
				onClick?.(event);
				toggleSidebar();
			}}
			{...props}
		>
			<PanelLeft className="h-4 w-4" />
			<span className="sr-only">Toggle Sidebar</span>
		</Button>
	);
});
SidebarTrigger.displayName = "SidebarTrigger";

const SidebarRail = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
	const { toggleSidebar } = useSidebar();

	return (
		<button
			ref={ref}
			data-slot="sidebar-rail"
			aria-label="Toggle Sidebar"
			tabIndex={-1}
			onClick={toggleSidebar}
			title="Toggle Sidebar"
			className={cn(
				"absolute inset-y-0 z-20 hidden w-1.5 -translate-x-1/2 transition-all hover:bg-neutral-800/80 cursor-ew-resize group-data-[side=left]:-right-3 group-data-[side=right]:-left-3 md:block",
				className,
			)}
			{...props}
		/>
	);
});
SidebarRail.displayName = "SidebarRail";

const SidebarInset = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"main">
>(({ className, ...props }, ref) => {
	return (
		<main
			ref={ref}
			className={cn(
				"relative flex min-h-screen flex-1 flex-col bg-transparent",
				"peer-data-[variant=inset]:min-h-[calc(100vh-1rem)] md:peer-data-[variant=inset]:m-2 md:peer-data-[state=collapsed]:peer-data-[variant=inset]:ml-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-2xl md:peer-data-[variant=inset]:border md:peer-data-[variant=inset]:shadow",
				className,
			)}
			{...props}
		/>
	);
});
SidebarInset.displayName = "SidebarInset";

const SidebarHeader = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-header"
			className={cn(
				"flex flex-col gap-2 p-4 border-b border-white/5",
				className,
			)}
			{...props}
		/>
	);
});
SidebarHeader.displayName = "SidebarHeader";

const SidebarFooter = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-footer"
			className={cn(
				"flex flex-col gap-2 p-4 border-t border-white/5",
				className,
			)}
			{...props}
		/>
	);
});
SidebarFooter.displayName = "SidebarFooter";

const SidebarContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-content"
			className={cn(
				"flex flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-3",
				className,
			)}
			{...props}
		/>
	);
});
SidebarContent.displayName = "SidebarContent";

const SidebarGroup = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-group"
			className={cn("flex flex-col gap-1.5 py-2", className)}
			{...props}
		/>
	);
});
SidebarGroup.displayName = "SidebarGroup";

const SidebarGroupLabel = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-group-label"
			className={cn(
				"px-2 text-[10px] font-bold uppercase tracking-wider text-neutral-500 truncate group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
});
SidebarGroupLabel.displayName = "SidebarGroupLabel";

const SidebarGroupContent = React.forwardRef<
	HTMLDivElement,
	React.ComponentProps<"div">
>(({ className, ...props }, ref) => {
	return (
		<div
			ref={ref}
			data-slot="sidebar-group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
});
SidebarGroupContent.displayName = "SidebarGroupContent";

const SidebarMenu = React.forwardRef<
	HTMLUListElement,
	React.ComponentProps<"ul">
>(({ className, ...props }, ref) => {
	return (
		<ul
			ref={ref}
			data-slot="sidebar-menu"
			className={cn(
				"flex w-full min-w-0 flex-col gap-1 list-none p-0 m-0",
				className,
			)}
			{...props}
		/>
	);
});
SidebarMenu.displayName = "SidebarMenu";

const SidebarMenuItem = React.forwardRef<
	HTMLLIElement,
	React.ComponentProps<"li">
>(({ className, ...props }, ref) => {
	return (
		<li
			ref={ref}
			data-slot="sidebar-menu-item"
			className={cn("relative", className)}
			{...props}
		/>
	);
});
SidebarMenuItem.displayName = "SidebarMenuItem";

const sidebarMenuButtonVariants = cva(
	"peer/menu-button flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all hover:bg-neutral-800/60 hover:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-neutral-400 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:size-10 group-data-[collapsible=icon]:rounded-xl select-none cursor-pointer",
	{
		variants: {
			variant: {
				default: "hover:bg-neutral-800/60 hover:text-neutral-100",
				outline: "border border-neutral-800 hover:bg-neutral-800/60",
			},
			size: {
				default: "h-10 text-sm",
				sm: "h-8 text-xs",
				lg: "h-12 text-base",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

const SidebarMenuButton = React.forwardRef<
	HTMLButtonElement,
	React.ComponentProps<"button"> & {
		asChild?: boolean;
		isActive?: boolean;
		tooltip?: string;
	} & VariantProps<typeof sidebarMenuButtonVariants>
>(
	(
		{ asChild = false, isActive = false, variant, size, className, ...props },
		ref,
	) => {
		const Comp = asChild ? Slot : "button";

		return (
			<Comp
				ref={ref}
				data-slot="sidebar-menu-button"
				className={cn(
					sidebarMenuButtonVariants({ variant, size }),
					isActive &&
						"bg-emerald-950/40 text-emerald-400 border border-emerald-900/30",
					className,
				)}
				{...props}
			/>
		);
	},
);
SidebarMenuButton.displayName = "SidebarMenuButton";

export {
	SidebarProvider,
	Sidebar,
	SidebarTrigger,
	SidebarRail,
	SidebarInset,
	SidebarHeader,
	SidebarFooter,
	SidebarContent,
	SidebarGroup,
	SidebarGroupLabel,
	SidebarGroupContent,
	SidebarMenu,
	SidebarMenuItem,
	SidebarMenuButton,
	useSidebar,
};
