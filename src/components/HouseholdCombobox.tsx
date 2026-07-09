import { Check, ChevronsUpDown, Loader2, PlusCircle, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn, formatHouseholdId } from "../lib/utils";
import { searchHouseholds, type HouseholdSummary } from "../lib/households-service";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

export interface HouseholdComboboxProps {
	purok: string;
	value: string | undefined;
	onChange: (value: string) => void;
	error?: boolean;
	disabled?: boolean;
	className?: string;
}

export function HouseholdCombobox({
	purok,
	value,
	onChange,
	error,
	disabled,
	className,
}: HouseholdComboboxProps) {
	const [open, setOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [loading, setLoading] = useState(false);
	const [options, setOptions] = useState<HouseholdSummary[]>([]);
	const [selectedValue, setSelectedValue] = useState<HouseholdSummary | null>(null);

	const searchRef = useRef<NodeJS.Timeout | null>(null);

	// Fetch initial value if exists
	useEffect(() => {
		if (value && value !== "NEW" && !selectedValue && purok) {
			searchHouseholds({ data: { purok, query: value } }).then((res) => {
				const found = res.find((r) => r.householdId === value);
				if (found) setSelectedValue(found);
			});
		} else if (value === "NEW") {
			setSelectedValue({
				householdId: "NEW",
				purok: purok,
				headName: "New Household",
				memberCount: 0,
				adultsCount: 0,
				childrenCount: 0,
			});
		} else if (!value) {
			setSelectedValue(null);
		}
	}, [value, purok]);

	// Fetch options based on search query
	useEffect(() => {
		if (!open || !purok) return;

		setLoading(true);
		if (searchRef.current) clearTimeout(searchRef.current);

		searchRef.current = setTimeout(() => {
			searchHouseholds({ data: { purok, query: searchQuery } })
				.then((res) => setOptions(res))
				.catch(console.error)
				.finally(() => setLoading(false));
		}, 300);

		return () => {
			if (searchRef.current) clearTimeout(searchRef.current);
		};
	}, [searchQuery, open, purok]);

	// Reset if purok changes
	useEffect(() => {
		setOptions([]);
		setSearchQuery("");
	}, [purok]);

	const displayValue = selectedValue
		? selectedValue.householdId === "NEW"
			? "New Household"
			: selectedValue.block || selectedValue.lot
				? `Blk ${selectedValue.block || "-"} Lot ${selectedValue.lot || "-"} (${selectedValue.headName})`
				: formatHouseholdId(selectedValue.householdId)
		: "Select a household...";

	return (
		<Popover open={open} onOpenChange={setOpen} modal={true}>
			<PopoverTrigger asChild>
				<button
					type="button"
					disabled={disabled || !purok}
					className={cn(
						"flex w-full items-center justify-between rounded-xl border bg-neutral-900 px-3 py-2 text-sm text-neutral-200 transition-all",
						error ? "border-red-500 focus:ring-red-500" : "border-neutral-800 focus:ring-blue-500/20",
						(!purok || disabled) && "opacity-50 cursor-not-allowed",
						open && "ring-2 ring-blue-500/20 border-blue-500/50",
						className || "h-9"
					)}
				>
					<span className={cn("truncate", !selectedValue && "text-neutral-500")}>
						{!purok ? "Select a Purok first..." : displayValue}
					</span>
					<ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
				</button>
			</PopoverTrigger>

			<PopoverContent 
				className="p-0 w-[var(--radix-popover-trigger-width)] border-neutral-800 bg-neutral-900 shadow-xl overflow-hidden rounded-xl" 
				align="start"
			>
				<div className="flex flex-col">
					<div className="flex items-center border-b border-neutral-800/60 px-3 pb-1 pt-2 shrink-0">
						<Search className="mr-2 h-4 w-4 shrink-0 text-neutral-500" />
						<input
							autoFocus
							className="flex h-9 w-full bg-transparent text-sm text-neutral-200 outline-none placeholder:text-neutral-500"
							placeholder="Search family name..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
						/>
						{loading && <Loader2 className="h-4 w-4 animate-spin text-neutral-500 ml-2" />}
					</div>
					<div className="overflow-y-auto p-1 max-h-[250px] overscroll-contain">
						<button
							type="button"
							className="relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-neutral-800 hover:text-neutral-50 focus:bg-neutral-800 text-blue-400 font-medium transition-colors"
							onClick={() => {
								onChange("NEW");
								setOpen(false);
							}}
						>
							<PlusCircle className="mr-2 h-4 w-4" />
							New Household
							{value === "NEW" && (
								<span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
									<Check className="h-4 w-4" />
								</span>
							)}
						</button>

						{options.length === 0 && !loading && (
							<div className="py-6 text-center text-sm text-neutral-500">
								No households found.
							</div>
						)}

						{options.map((hh) => {
							const isSelected = value === hh.householdId;
							const label = hh.block || hh.lot
								? `Blk ${hh.block || "-"} Lot ${hh.lot || "-"} (${hh.headName})`
								: formatHouseholdId(hh.householdId);

							return (
								<button
									key={hh.householdId}
									type="button"
									className="relative flex w-full cursor-default select-none items-center rounded-lg py-1.5 pl-2 pr-8 text-sm outline-none hover:bg-neutral-800 hover:text-neutral-50 focus:bg-neutral-800 text-neutral-200 transition-colors"
									onClick={() => {
										setSelectedValue(hh);
										onChange(hh.householdId);
										setOpen(false);
									}}
								>
									<span className="truncate">{label}</span>
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
