import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "#/lib/utils.ts";

const tagVariants = cva(
	"inline-flex items-center justify-center font-semibold border transition-colors",
	{
		variants: {
			color: {
				blue: "bg-secondary text-secondary-foreground",
				amber: "bg-secondary text-secondary-foreground",
				emerald: "bg-secondary text-secondary-foreground",
				purple: "bg-secondary text-secondary-foreground",
				pink: "bg-secondary text-secondary-foreground",
				red: "bg-secondary text-secondary-foreground",
				orange: "bg-secondary text-secondary-foreground",
				rose: "bg-secondary text-secondary-foreground",
				teal: "bg-secondary text-secondary-foreground",
				indigo: "bg-secondary text-secondary-foreground",
				yellow: "bg-secondary text-secondary-foreground",
				lime: "bg-secondary text-secondary-foreground",
				cyan: "bg-secondary text-secondary-foreground",
				muted: "bg-secondary text-secondary-foreground",
			},
			size: {
				sm: "text-[10px] px-2 py-0.5 rounded-full",
				md: "text-xs px-2.5 py-1 rounded-full",
				lg: "text-sm px-3 py-1.5 rounded-full",
			},
		},
		defaultVariants: {
			color: "muted",
			size: "md",
		},
	},
);

export interface TagProps
	extends Omit<React.HTMLAttributes<HTMLSpanElement>, "color">,
		VariantProps<typeof tagVariants> {
	icon?: React.ElementType;
}

export function Tag({
	className,
	color,
	size,
	icon: Icon,
	children,
	...props
}: TagProps) {
	return (
		<span className={cn(tagVariants({ color, size }), className)} {...props}>
			{Icon && <Icon className={cn("mr-1", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
			{children}
		</span>
	);
}
