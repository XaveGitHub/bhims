import { useState } from "react";
import { Check, ChevronsUpDown, Search, PlusCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export interface PurokComboboxProps {
	value: string;
	onChange: (value: string) => void;
	options: string[];
	error?: boolean;
	disabled?: boolean;
	className?: string;
	placeholder?: string;
}

export function PurokCombobox({
	value,
	onChange,
	options,
	error,
	disabled,
	className,
	placeholder = "Select or type Purok...",
}: PurokComboboxProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	const filteredOptions = options.filter((o) =>
		o.toLowerCase().includes(searchQuery.toLowerCase())
	);

	const isCustomMatch = searchQuery.trim() !== "" && !options.some(o => o.toLowerCase() === searchQuery.trim().toLowerCase());

	return (
		<Popover open={open} onOpenChange={setOpen} modal={true}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled}
					className={cn(
						"flex w-full items-center justify-between rounded-xl border bg-card px-3 py-2 text-sm text-foreground transition-all",
						error ? "border-red-500 focus:ring-red-500" : "border-border focus:ring-primary/50",
						disabled && "opacity-50 cursor-not-allowed",
						open && "ring-2 ring-primary/50 border-primary/20",
						className || "h-9"
					)}
				>
					<span className={cn("truncate", !value && "text-muted-foreground")}>
						{value || placeholder}
					</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>

			<PopoverContent 
				className="p-0 w-[var(--radix-popover-trigger-width)] border-border bg-card shadow-xl overflow-hidden rounded-xl flex flex-col" 
				align="start"
				style={{ maxHeight: 'var(--radix-popover-content-available-height)' }}
			>
				<div className="flex flex-col flex-1 overflow-hidden">
					<div className="flex items-center border-b border-border/60 px-3 pb-1 pt-2 shrink-0">
						<Search className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
						<input
							autoFocus
							className="flex h-9 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
							placeholder="Search or type new Purok..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
					</div>
					<div 
						className="overflow-y-auto p-1 overscroll-contain flex-1 min-h-0"
						style={{ maxHeight: 'min(250px, calc(var(--radix-popover-content-available-height) - 45px))' }}
					>
						{isCustomMatch && (
							<button
								type="button"
								className="relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary text-primary font-medium transition-colors"
								onClick={() => {
									onChange(searchQuery.trim());
									setOpen(false);
									setSearchQuery("");
								}}
							>
								<PlusCircle className="mr-2 h-4 w-4" />
								Use "{searchQuery.trim()}"
							</button>
						)}

						{filteredOptions.length === 0 && !isCustomMatch && (
							<div className="py-6 text-center text-sm text-muted-foreground">
								No Puroks found.
							</div>
						)}

						{filteredOptions.map((opt) => {
							const isSelected = value === opt;
							return (
								<button
									key={opt}
									type="button"
									className="relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-primary/10 hover:text-primary focus:bg-primary/10 focus:text-primary text-foreground transition-colors"
									onClick={() => {
										onChange(opt);
										setOpen(false);
										setSearchQuery("");
									}}
								>
									<span className="truncate">{opt}</span>
									{isSelected && (
										<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
											<Check className="h-4 w-4" />
										</span>
									)}
								</button>
							);
						})}
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
