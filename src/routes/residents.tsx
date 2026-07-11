import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	AlertCircle,
	AlertTriangle,
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	Eye,
	Map,
	Search,
	Trash2,
	UserPlus,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { Checkbox } from "../components/ui/checkbox";
import { ManagePuroksModal } from "../components/ManagePuroksModal";
import { AddResidentModal } from "../components/AddResidentModal";

import {
	deleteResident,
	getResidents,
	getUniquePuroks,
	bulkDeleteResidents,
	bulkUpdatePurok,
	markResidentDeceased,
	type ResidentInput,
} from "../lib/residents-service";

type ResidentsSearch = {
	action?: "add";
	householdId?: string;
	filterVoter?: boolean;
	filterSenior?: boolean;
	filterPwd?: boolean;
	filterSingleParent?: boolean;
	filterUnemployed?: boolean;
	filterDeceased?: boolean;
	purok?: string;
};

import Draggable from "react-draggable";
import { ResidentProfilePane } from "#/components/ResidentProfilePane.tsx";
import { invalidateHouseholdsCache } from "./households";

export const Route = createFileRoute("/residents")({
	component: ResidentsView,
	validateSearch: (search: Record<string, unknown>): ResidentsSearch => {
		return {
			action: search.action === "add" ? "add" : undefined,
			householdId: search.householdId as string | undefined,
			filterVoter: search.filterVoter === true || search.filterVoter === 'true' ? true : undefined,
			filterSenior: search.filterSenior === true || search.filterSenior === 'true' ? true : undefined,
			filterPwd: search.filterPwd === true || search.filterPwd === 'true' ? true : undefined,
			filterSingleParent: search.filterSingleParent === true || search.filterSingleParent === 'true' ? true : undefined,
			filterUnemployed: search.filterUnemployed === true || search.filterUnemployed === 'true' ? true : undefined,
			filterDeceased: search.filterDeceased === true || search.filterDeceased === 'true' ? true : undefined,
			purok: search.purok as string | undefined,
		};
	},
});

export interface Resident extends ResidentInput {
	id: number;
	createdAt: Date;
	updatedAt: Date;
	block: string | null;
	lot: string | null;
	residentId: string | null;
	isDeceased: boolean | null;
}
let cachedResidentsList: { items: Resident[]; total: number } | null = null;
let cachedPurokOptions: string[] | null = null;

export const invalidateResidentsCache = () => {
	cachedResidentsList = null;
	cachedPurokOptions = null;
};

function ResidentsView() {
	const searchParams = Route.useSearch();
	const navigate = Route.useNavigate();

	const [residentsList, setResidentsList] = useState<Resident[]>(
		cachedResidentsList?.items || [],
	);
	const [loading, setLoading] = useState(!cachedResidentsList);
	const [totalCount, setTotalCount] = useState(cachedResidentsList?.total || 0);
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(10);

	// TanStack Table state
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "lastName", desc: false },
	]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
	const [rowSelection, setRowSelection] = useState({});

	// Search and Filter states
	const [search, setSearch] = useState("");
	const [selectedPurok, setSelectedPurok] = useState(searchParams.purok || "");
	const [filterPwd, setFilterPwd] = useState<boolean | undefined>(searchParams.filterPwd);
	const [filterSenior, setFilterSenior] = useState<boolean | undefined>(searchParams.filterSenior);
	const [filterVoter, setFilterVoter] = useState<boolean | undefined>(searchParams.filterVoter);
	const [filterSingleParent, setFilterSingleParent] = useState<boolean | undefined>(searchParams.filterSingleParent);
	const [filterUnemployed, setFilterUnemployed] = useState<boolean | undefined>(searchParams.filterUnemployed);
	const [filterDeceased, setFilterDeceased] = useState<boolean | undefined>(searchParams.filterDeceased);
	const [selectedGender, setSelectedGender] = useState("");

	// Debounced search input (UI value) — fires setSearch after 300ms
	const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const handleSearchChange = useCallback((val: string) => {
		setSearchInput(val);
		if (searchRef.current) clearTimeout(searchRef.current);
		searchRef.current = setTimeout(() => setSearch(val), 300);
	}, []);

	const [purokOptions, setPurokOptions] = useState<string[]>([]);
	const [isManagePuroksOpen, setIsManagePuroksOpen] = useState(false);

	// Modals state
	const [isAddModalOpen, setIsAddModalOpen] = useState(false);
	const [drawerResident, setDrawerResident] = useState<Resident | null>(null);
	const dragNodeRef = useRef<HTMLDivElement>(null);

	const containerRef = useRef<HTMLDivElement>(null);

	// Click outside detection to close the profile pane
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				drawerResident &&
				containerRef.current &&
				!containerRef.current.contains(event.target as Node)
			) {
				// Don't close if they clicked a dialog/modal overlay (like sweetalert or shadcn dialog)
				const target = event.target as HTMLElement;
				if (
					target.closest('[role="dialog"]') ||
					target.closest('[data-slot="dialog-overlay"]') ||
					target.closest("[data-radix-popper-content-wrapper]") ||
					target.closest("[data-radix-select-content]") ||
					target.closest('[role="listbox"]')
				) {
					return;
				}
				setDrawerResident(null);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [drawerResident]);

	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [residentToDelete, setResidentToDelete] = useState<number | null>(null);

	useEffect(() => {
		if (searchParams.action === "add" && !isAddModalOpen) {
			setIsAddModalOpen(true);
			// Clean up URL to prevent re-opening on manual refresh
			navigate({
				search: (prev) => ({ ...prev, action: undefined }),
				replace: true,
			});
		}
	}, [searchParams.action, isAddModalOpen, navigate]);

	const loadData = useCallback(async () => {
		const isDefaultFilter =
			!search &&
			!selectedPurok &&
			filterPwd === undefined &&
			filterSenior === undefined &&
			filterVoter === undefined &&
			filterSingleParent === undefined &&
			filterUnemployed === undefined &&
			filterDeceased === undefined &&
			!selectedGender &&
			currentPage === 1;

		if (isDefaultFilter && cachedResidentsList) {
			setResidentsList(cachedResidentsList.items);
			setTotalCount(cachedResidentsList.total);
			setLoading(false);
		} else {
			setLoading(true);
		}

		try {
			const data = await getResidents({
				data: {
					search: search || undefined,
					purok: selectedPurok || undefined,
					isPwd: filterPwd,
					isSenior: filterSenior,
					isRegisteredVoter: filterVoter,
					isSingleParent: filterSingleParent,
					isUnemployed: filterUnemployed,
					isDeceased: filterDeceased,
					gender: selectedGender || undefined,
					page: currentPage,
					limit: pageSize,
					sortBy: sorting[0]?.id,
					sortDesc: sorting[0]?.desc,
				},
			});
			const result = data as unknown as { items: Resident[]; total: number };
			setResidentsList(result.items);
			setTotalCount(result.total);
			if (isDefaultFilter) {
				cachedResidentsList = result;
			}
		} catch (err) {
			console.error("Error loading residents:", err);
		} finally {
			setLoading(false);
		}
	}, [
		search,
		selectedPurok,
		filterPwd,
		filterSenior,
		filterVoter,
		filterSingleParent,
		filterUnemployed,
		filterDeceased,
		selectedGender,
		currentPage,
		pageSize,
		sorting,
	]);

	const loadPuroks = useCallback(async () => {
		if (cachedPurokOptions) {
			setPurokOptions(cachedPurokOptions);
		}
		try {
			const puroks = await getUniquePuroks();
			setPurokOptions(puroks);
			cachedPurokOptions = puroks;
		} catch (err) {
			console.error("Error loading puroks:", err);
		}
	}, []);

	// Load puroks on mount
	useEffect(() => {
		loadPuroks();
	}, [loadPuroks]);

	// Reset page to 1 when search or filters change
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on filter change
	useEffect(() => {
		setCurrentPage(1);
	}, [
		search,
		selectedPurok,
		filterPwd,
		filterSenior,
		filterVoter,
		filterSingleParent,
		selectedGender,
	]);

	// Reload when search/filters/page/pageSize change
	useEffect(() => {
		const delayDebounceFn = setTimeout(() => {
			loadData();
		}, 300);

		return () => clearTimeout(delayDebounceFn);
	}, [loadData]);

	const handleDeleteClick = useCallback((id: number) => {
		setResidentToDelete(id);
		setIsDeleteModalOpen(true);
	}, []);

	const confirmDelete = async () => {
		if (residentToDelete !== null) {
			try {
				await deleteResident({ data: residentToDelete });

				// Close the Profile Pane if the deleted resident was being viewed
				if (drawerResident?.id === residentToDelete) {
					setDrawerResident(null);
				}

				setResidentToDelete(null);
				setIsDeleteModalOpen(false);
				invalidateResidentsCache();
				invalidateHouseholdsCache();
				loadData();
				loadPuroks();
				toast.success("Resident deleted successfully");
			} catch (err) {
				toast.error("Failed to delete resident");
			}
		}
	};

	const calculateAge = useCallback((birthdateStr: string | null) => {
		if (!birthdateStr) return "N/A";
		const birth = new Date(birthdateStr);
		const diff = Date.now() - birth.getTime();
		const ageDate = new Date(diff);
		return Math.abs(ageDate.getUTCFullYear() - 1970);
	}, []);

	// TanStack column definitions — cell renderers live here so getVisibleCells() works
	const columns = useMemo<ColumnDef<Resident>[]>(
		() => [
			{
				id: "select",
				header: ({ table }) => (
					<Checkbox
						checked={
							table.getIsAllPageRowsSelected() ||
							(table.getIsSomePageRowsSelected() && "indeterminate")
						}
						onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
						aria-label="Select all"
						className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
					/>
				),
				cell: ({ row }) => (
					<Checkbox
						checked={row.getIsSelected()}
						onCheckedChange={(value) => row.toggleSelected(!!value)}
						aria-label="Select row"
						className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary mt-1"
					/>
				),
				enableSorting: false,
				enableHiding: false,
			},
			{
				id: "residentId",
				accessorKey: "residentId",
				header: "ID",
				enableSorting: false,
				enableHiding: false,
				cell: ({ row }) => (
					<span className="text-xs font-mono text-muted-foreground">
						{row.original.residentId || "—"}
					</span>
				),
			},
			{
				id: "lastName",
				accessorKey: "lastName",
				header: "Last Name",
				enableSorting: true,
				enableHiding: false,
				sortingFn: "alphanumeric",
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col min-w-0">
							<span className="font-semibold text-foreground text-sm leading-snug truncate">
								{r.lastName} {r.suffix ? ` ${r.suffix}` : ""}
							</span>
							{r.contactNumber && (
								<span className="text-[11px] text-muted-foreground leading-none mt-0.5 sm:hidden">
									{r.contactNumber}
								</span>
							)}
						</div>
					);
				},
			},
			{
				id: "firstName",
				accessorKey: "firstName",
				header: "First Name",
				enableSorting: true,
				enableHiding: false,
				sortingFn: "alphanumeric",
				cell: ({ row }) => (
					<span className="text-foreground text-sm">{row.original.firstName}</span>
				),
			},
			{
				id: "middleName",
				accessorKey: "middleName",
				header: "Middle Name",
				enableSorting: true,
				enableHiding: false,
				sortingFn: "alphanumeric",
				cell: ({ row }) => (
					<span className="text-foreground/80 text-sm">{row.original.middleName || "—"}</span>
				),
			},
			{
				id: "age",
				header: () => <div className="text-center">Age / Gender</div>,
				enableSorting: true,
				enableHiding: true,
				accessorFn: (row) =>
					row.birthDate
						? -new Date(row.birthDate).getTime()
						: Number.MAX_SAFE_INTEGER,
				sortingFn: "basic",
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col items-center">
							<span className="text-sm text-foreground leading-snug">
								{calculateAge(r.birthDate)} yrs
							</span>
							<span className="text-[11px] text-muted-foreground leading-none mt-0.5">
								{r.gender || "Unknown"}
							</span>
						</div>
					);
				},
			},
			{
				id: "purok",
				accessorKey: "purok",
				header: () => <div className="text-center">Purok</div>,
				enableSorting: true,
				enableHiding: true,
				sortingFn: "alphanumeric",
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col items-center">
							<span className="text-sm font-medium text-foreground leading-snug">
								{r.purok}
							</span>
						</div>
					);
				},
			},
			{
				id: "blkLot",
				header: () => <div className="text-center">Blk / Lot</div>,
				enableSorting: false,
				enableHiding: true,
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col items-center">
							{r.block || r.lot ? (
								<span className="text-sm font-medium text-foreground leading-snug">
									Blk {r.block || "-"} Lot {r.lot || "-"}
								</span>
							) : (
								<span className="text-sm font-medium text-muted-foreground italic">
									{r.householdId ? `Fam. ${r.lastName}` : "—"}
								</span>
							)}
						</div>
					);
				},
			},
			{
				id: "demographics",
				header: () => <div className="text-center">Tags</div>,
				enableSorting: false,
				enableHiding: true,
				cell: ({ row }) => {
					const r = row.original;
					const hasTag =
						r.isPwd ||
						r.isSeniorCitizen ||
						r.isRegisteredVoter ||
						r.isSingleParent ||
						r.isDeceased ||
						r.isBedBound ||
						r.isWheelchairBound ||
						r.isDialysisPatient ||
						r.isCancerPatient ||
						r.isNationalPensioner ||
						r.isLocalPensioner ||
						r.isOfw ||
						r.isOsy ||
						r.isIp ||
						r.isMigrant;
					if (!hasTag)
						return <div className="text-center"><span className="text-muted-foreground text-xs">—</span></div>;
					return (
						<div className="flex flex-wrap justify-center gap-1">
							{r.isDeceased && (
								<Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">Deceased</Badge>
							)}
							{r.isPwd && (
								<Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-400/10 dark:text-purple-400 dark:border-purple-400/20">PWD</Badge>
							)}
							{r.isSeniorCitizen && (
								<Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-400/10 dark:text-amber-400 dark:border-amber-400/20">Senior</Badge>
							)}
							{r.isRegisteredVoter && (
								<Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-400/10 dark:text-emerald-400 dark:border-emerald-400/20">Voter</Badge>
							)}
							{r.isSingleParent && (
								<Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-400/10 dark:text-pink-400 dark:border-pink-400/20">Solo Parent</Badge>
							)}
							{r.isBedBound && (
								<span className="rounded-full bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/30 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400">
									Bed Bound
								</span>
							)}
							{r.isWheelchairBound && (
								<span className="rounded-full bg-accent dark:bg-primary/10 border border-primary/20 dark:border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary dark:text-primary">
									Wheelchair
								</span>
							)}
							{r.isDialysisPatient && (
								<span className="rounded-full bg-orange-100 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/30 px-2 py-0.5 text-[10px] font-semibold text-orange-700 dark:text-orange-400">
									Dialysis
								</span>
							)}
							{r.isCancerPatient && (
								<span className="rounded-full bg-rose-100 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/30 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
									Cancer
								</span>
							)}
							{(r.isNationalPensioner || r.isLocalPensioner) && (
								<span className="rounded-full bg-teal-100 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/30 px-2 py-0.5 text-[10px] font-semibold text-teal-700 dark:text-teal-400">
									Pensioner
								</span>
							)}
							{r.isOfw && (
								<span className="rounded-full bg-indigo-100 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-400">
									OFW
								</span>
							)}
							{r.isOsy && (
								<span className="rounded-full bg-yellow-100 dark:bg-yellow-950/40 border border-yellow-200 dark:border-yellow-800/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-700 dark:text-yellow-400">
									OSY
								</span>
							)}
							{r.isIp && (
								<span className="rounded-full bg-lime-100 dark:bg-lime-950/40 border border-lime-200 dark:border-lime-800/30 px-2 py-0.5 text-[10px] font-semibold text-lime-700 dark:text-lime-400">
									IP
								</span>
							)}
							{r.isMigrant && (
								<span className="rounded-full bg-cyan-100 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 dark:text-cyan-400">
									Migrant
								</span>
							)}
						</div>
					);
				},
			},
			{
				id: "actions",
				header: "",
				enableSorting: false,
				enableHiding: false,
				cell: ({ row }) => {
					const r = row.original;
					const hasSelection = Object.keys(rowSelection).length > 0;
					return (
						<div className="flex items-center justify-end gap-1 group">
							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									setDrawerResident(r);
								}}
								disabled={hasSelection}
								className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30 transition-all"
							>
								<Eye className="h-3.5 w-3.5" />
							</Button>
							{!r.isDeceased && (
								<Button
									variant="ghost"
									size="sm"
									onClick={(e) => {
										e.stopPropagation();
										setArchiveModalIds([r.id]);
									}}
									disabled={hasSelection}
									title="Mark as Deceased"
									className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg disabled:opacity-30"
								>
									<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-archive-x"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="m9.5 17 5-5"/><path d="m9.5 12 5 5"/></svg>
								</Button>
							)}
							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteClick(r.id);
								}}
								disabled={hasSelection}
								className="h-7 w-7 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 rounded-lg gap-1.5 disabled:opacity-30"
							>
								<Trash2 className="h-3.5 w-3.5" />
							</Button>
						</div>
					);
				},
			},
		],
		[handleDeleteClick, calculateAge, rowSelection],
	);

	const table = useReactTable({
		data: residentsList,
		columns,
		state: { sorting, columnVisibility, rowSelection },
		enableRowSelection: true,
		onRowSelectionChange: setRowSelection,
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		manualPagination: true,
		manualSorting: true,
	});

	const selectedIds = useMemo(() => {
		return Object.keys(rowSelection)
			.filter((key) => rowSelection[key as keyof typeof rowSelection])
			.map((key) => residentsList[parseInt(key)]?.id)
			.filter(Boolean);
	}, [rowSelection, residentsList]);

	const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);
	const confirmBulkDelete = async () => {
		if (!selectedIds.length) return;
		
		const res = await bulkDeleteResidents({ data: selectedIds });
		if (res.success) {
			toast.success(`Deleted ${selectedIds.length} residents.`);
			setRowSelection({});
			setIsBulkDeleteModalOpen(false);
			invalidateResidentsCache();
			invalidateHouseholdsCache();
			loadData();
			loadPuroks();
		} else {
			toast.error("Failed to delete residents.");
		}
	};

	const [archiveModalIds, setArchiveModalIds] = useState<number[] | null>(null);
	const confirmArchive = async () => {
		if (!archiveModalIds?.length) return;
		
		const res = await markResidentDeceased({ data: archiveModalIds });
		if (res.success) {
			toast.success(`Marked ${archiveModalIds.length} resident(s) as deceased.`);
			setRowSelection({});
			setArchiveModalIds(null);
			invalidateResidentsCache();
			invalidateHouseholdsCache();
			loadData();
			loadPuroks();
		} else {
			toast.error("Failed to update residents.");
		}
	};

	const [bulkPurokToUpdate, setBulkPurokToUpdate] = useState<string | null>(null);
	const [bulkPurokOpen, setBulkPurokOpen] = useState(false);
	
	const confirmBulkUpdatePurok = async () => {
		if (!selectedIds.length || !bulkPurokToUpdate) return;
		const res = await bulkUpdatePurok({ data: { ids: selectedIds, purok: bulkPurokToUpdate } });
		if (res.success) {
			toast.success(`Moved ${selectedIds.length} residents to ${bulkPurokToUpdate}.`);
			setBulkPurokToUpdate(null);
			setRowSelection({});
			loadData();
		} else {
			toast.error("Failed to update Purok.");
		}
	};

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Page header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-foreground">
						Residents
					</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						Manage resident records
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="outline"
						onClick={() => setIsManagePuroksOpen(true)}
						className="bg-card border-border text-foreground/80 hover:bg-muted hover:text-foreground rounded-xl px-4"
					>
						<Map className="h-4 w-4 mr-2" />
						<span className="hidden sm:inline">Manage Puroks</span>
					</Button>
					<Button
						onClick={() => {
							setIsAddModalOpen(true);
						}}
						className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-4"
					>
						<UserPlus className="h-4 w-4" />
						<span>Add Resident</span>
					</Button>
				</div>
			</div>
			{/* Search + filter bar */}
			<div className="rounded-xl border border-border bg-card/40 p-3 sm:p-4 space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					{/* Search — debounced */}
					<div className="relative flex-1">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
							<Search className="h-4 w-4" />
						</span>
						<Input
							placeholder="Search by name…"
							value={searchInput}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/20 rounded-xl h-9 text-sm"
						/>
					</div>
					{/* Purok Filter */}
					<Select
						value={selectedPurok || "ALL"}
						onValueChange={(v) => setSelectedPurok(v === "ALL" ? "" : v)}
					>
						<SelectTrigger className="w-full sm:w-36 bg-card border-border text-foreground/80 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Puroks" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border text-foreground">
							<SelectItem value="ALL">All Puroks</SelectItem>
							{purokOptions.map((p) => (
								<SelectItem key={p} value={p}>
									{p}
								</SelectItem>
							))}
							{purokOptions.length === 0 &&
								[1, 2, 3, 4, 5, 6, 7].map((n) => (
									<SelectItem key={n} value={`Purok ${n}`}>
										Purok {n}
									</SelectItem>
								))}
						</SelectContent>
					</Select>
					{/* Gender Filter */}
					<Select
						value={selectedGender || "ALL"}
						onValueChange={(v) => setSelectedGender(v === "ALL" ? "" : v)}
					>
						<SelectTrigger className="w-full sm:w-32 bg-card border-border text-foreground/80 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Categories" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border text-foreground">
							<SelectItem value="ALL">All Genders</SelectItem>
							<SelectItem value="Male">Male</SelectItem>
							<SelectItem value="Female">Female</SelectItem>
							<SelectItem value="Other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Quick filter pills */}
				<div className="flex flex-wrap gap-1.5 mt-2">
					{(
						[
							{
								label: "PWD",
								active: filterPwd === true,
								color: "bg-purple-100 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/30 px-2 py-0.5 text-[10px] font-semibold text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/30",
								fn: () => setFilterPwd(filterPwd === true ? undefined : true),
							},
							{
								label: "Senior",
								active: filterSenior === true,
								color: "bg-amber-100 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/30 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/30",
								fn: () => setFilterSenior(filterSenior === true ? undefined : true),
							},
							{
								label: "Voter",
								active: filterVoter === true,
								color: "bg-accent dark:bg-primary/10 border border-primary/20 dark:border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary dark:text-primary border-primary/20 dark:border-primary/20",
								fn: () => setFilterVoter(filterVoter === true ? undefined : true),
							},
							{
								label: "Solo Parent",
								active: filterSingleParent === true,
								color: "bg-pink-100 dark:bg-pink-950/40 border border-pink-200 dark:border-pink-800/30 px-2 py-0.5 text-[10px] font-semibold text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800/30",
								fn: () => setFilterSingleParent(filterSingleParent === true ? undefined : true),
							},
							{
								label: "Unemployed",
								active: filterUnemployed === true,
								color: "bg-red-100 dark:bg-red-950/40 border border-red-200 dark:border-red-800/30 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30",
								fn: () => setFilterUnemployed(filterUnemployed === true ? undefined : true),
							},
							{
								label: "Deceased",
								active: filterDeceased === true,
								color: "bg-muted/80 text-foreground/80 border-border",
								fn: () => setFilterDeceased(filterDeceased === true ? undefined : true),
							},
						] as const
					).map(({ label, active, color, fn }) => (
						<button
							type="button"
							key={label}
							onClick={fn}
							className={`px-2.5 py-1 rounded-[calc(var(--radius)-2px)] text-xs font-semibold border transition-all ${
								active
									? color
									: "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
							}`}
						>
							{label}
						</button>
					))}
					{(search ||
						selectedPurok ||
						filterPwd !== undefined ||
						filterSenior !== undefined ||
						filterVoter !== undefined ||
						filterSingleParent !== undefined ||
						filterDeceased !== undefined ||
						filterUnemployed !== undefined ||
						selectedGender) && (
						<button
							type="button"
							onClick={() => {
								setSearch("");
								setSearchInput("");
								setSelectedPurok("");
								setFilterPwd(undefined);
								setFilterSenior(undefined);
								setFilterVoter(undefined);
								setFilterSingleParent(undefined);
								setFilterDeceased(undefined);
								setFilterUnemployed(undefined);
								setSelectedGender("");
							}}
							className="px-2.5 py-1 rounded-[calc(var(--radius)-2px)] text-xs font-semibold bg-muted hover:bg-border text-muted-foreground border border-border"
						>
							Clear all
						</button>
					)}
				</div>
			</div>
			{/* Table and Split Pane */}
			<div
				ref={containerRef}
				className="flex flex-col md:flex-row gap-6 max-h-[calc(100vh-16rem)]"
			>
				<Card className="rounded-xl border-border bg-card shadow-sm flex flex-col overflow-hidden p-0 gap-0 flex-1 min-w-0">
					{loading && residentsList.length === 0 ? (
						<div className="flex h-48 items-center justify-center">
							<div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
						</div>
					) : residentsList.length > 0 ? (
						<>
								<Table wrapperClassName={`flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200 ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
								<TableHeader className="sticky top-0 z-10 bg-surface border-b border-border">
									{table.getHeaderGroups().map((hg) => (
										<TableRow
											key={hg.id}
											className="border-0 hover:bg-transparent"
										>
											{hg.headers.map((header) => {
												const canSort = header.column.getCanSort();
												const sorted = header.column.getIsSorted();
												return (
													<TableHead
														key={header.id}
														style={{
															width: header.getSize() !== 150 ? header.getSize() : undefined,
														}}
														className={`text-muted-foreground font-medium h-10 px-5 whitespace-nowrap bg-card ${
															["age", "purok", "blkLot", "demographics"].includes(header.column.id) 
															? "text-center" 
															: "text-left"
														}`}
													>
														{header.isPlaceholder ? null : canSort ? (
															<button
																type="button"
																onClick={header.column.getToggleSortingHandler()}
																className={`flex items-center gap-1.5 hover:text-foreground transition-colors outline-none ${
																	["age", "purok", "blkLot"].includes(header.column.id) 
																	? "w-full justify-center" 
																	: ""
																}`}
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
																{sorted === "asc" ? (
																	<ChevronUp className="h-3 w-3 text-primary" />
																) : sorted === "desc" ? (
																	<ChevronDown className="h-3 w-3 text-primary" />
																) : (
																	<ArrowUpDown className="h-3 w-3 opacity-25" />
																)}
															</button>
														) : (
															flexRender(
																header.column.columnDef.header,
																header.getContext(),
															)
														)}
													</TableHead>
												);
											})}
										</TableRow>
									))}
								</TableHeader>
								<TableBody>
									{table.getRowModel().rows.map((row) => (
										<TableRow
											key={row.id}
											data-state={row.getIsSelected() ? "selected" : undefined}
											className={`border-b border-border/60 transition-colors cursor-pointer group ${
												drawerResident?.id === row.original.id
													? "bg-muted/60 hover:bg-muted/60"
													: row.getIsSelected()
														? "bg-accent dark:bg-primary/10"
														: "hover:bg-muted/50"
											}`}
											onClick={() => {
												if (Object.keys(rowSelection).length > 0) {
													row.toggleSelected();
												} else {
													setDrawerResident(row.original);
												}
											}}
										>
											{row.getVisibleCells().map((cell) => (
												<TableCell
													key={cell.id}
													className="px-3 sm:px-5 py-3 align-middle"
												>
													{flexRender(
														cell.column.columnDef.cell,
														cell.getContext(),
													)}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>

							{/* Pagination controls */}
							{totalCount > 0 && (
								<div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20 shrink-0">
									<div className="flex items-center gap-2">
										<span className="text-sm text-muted-foreground">Rows per page:</span>
										<Select
											value={String(pageSize)}
											onValueChange={(val) => {
												setPageSize(Number(val));
												setCurrentPage(1);
											}}
										>
											<SelectTrigger className="w-24 h-8 bg-card border-border text-foreground/80 rounded-xl">
												<SelectValue />
											</SelectTrigger>
											<SelectContent className="bg-card border-border text-foreground rounded-xl">
												<SelectItem value="10">10</SelectItem>
												<SelectItem value="25">25</SelectItem>
												<SelectItem value="50">50</SelectItem>
												<SelectItem value="100">100</SelectItem>
											</SelectContent>
										</Select>
									</div>

									<div className="flex items-center gap-4">
										<div className="text-sm text-muted-foreground">
											Page {currentPage} of {Math.ceil(totalCount / pageSize)}
										</div>
										<div className="flex gap-2">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
												disabled={currentPage === 1 || loading}
												className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 disabled:pointer-events-none hover:bg-muted"
											>
												Previous
											</Button>
											<Button
												variant="outline"
												size="sm"
												onClick={() => setCurrentPage((prev) => prev + 1)}
												disabled={currentPage === Math.ceil(totalCount / pageSize) || loading}
												className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 disabled:pointer-events-none hover:bg-muted"
											>
												Next
											</Button>
										</div>
									</div>
								</div>
							)}
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
							<p className="text-sm font-semibold text-muted-foreground">
								No Residents Found
							</p>
							<p className="text-xs text-muted-foreground max-w-xs mt-1">
								No records match your search or filters. Try adjusting your
								query or adding a new resident.
							</p>
						</div>
					)}
				</Card>

				{/* Resident Profile Pane */}
				{drawerResident && (
					<Draggable
						nodeRef={dragNodeRef}
						handle=".drag-handle"
						cancel=".no-drag"
					>
						<div
							ref={dragNodeRef}
							className="fixed top-20 right-4 w-[460px] lg:w-[520px] z-50 pointer-events-none [&>*]:pointer-events-auto"
						>
							<ResidentProfilePane
								resident={drawerResident}
								onClose={() => setDrawerResident(null)}
								onUpdateComplete={(updated) => {
									setDrawerResident(updated);
									invalidateResidentsCache();
									invalidateHouseholdsCache();
									loadData();
									loadPuroks();
								}}
							/>
						</div>
					</Draggable>
				)}
			</div>
			{/* ADD MODAL */}
			<AddResidentModal
				isOpen={isAddModalOpen}
				onClose={() => setIsAddModalOpen(false)}
				onSuccess={() => {
					setIsAddModalOpen(false);
					invalidateResidentsCache();
					invalidateHouseholdsCache();
					loadData();
					loadPuroks();
				}}
			/>
			{/* DELETE CONFIRMATION DIALOG */}
			<Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-red-500" />
							<span>Confirm Deletion</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you sure you want to delete this resident record? This action
							is permanent and cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => {
									setIsDeleteModalOpen(false);
									setResidentToDelete(null);
								}}
								className="bg-muted hover:bg-border dark:bg-muted text-foreground/80 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={confirmDelete}
								className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
							>
								Delete Profile
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Floating Bulk Action Bar */}
			{selectedIds.length > 0 && (
				<div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-10 fade-in duration-300">
					<div className="bg-card border border-border shadow-md rounded-xl px-4 py-3 flex items-center gap-4">
						<span className="text-sm font-medium text-foreground whitespace-nowrap">
							{selectedIds.length} selected
						</span>
						<div className="h-4 w-px bg-border dark:bg-muted"></div>
						<div className="flex items-center gap-2">
							<Select
								open={bulkPurokOpen}
								onOpenChange={setBulkPurokOpen}
								onValueChange={(val) => {
									setBulkPurokToUpdate(val);
									setBulkPurokOpen(false);
								}}
							>
								<SelectTrigger className="h-8 text-xs bg-muted border-border hover:bg-border dark:bg-muted w-[140px]">
									<SelectValue placeholder="Change Purok" />
								</SelectTrigger>
								<SelectContent className="bg-card border-border">
									{purokOptions.map((p) => (
										<SelectItem key={p} value={p} className="text-xs">
											{p}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								size="sm"
								variant="outline"
								onClick={() => setArchiveModalIds(selectedIds)}
								className="h-8 text-xs bg-accent/50 hover:bg-accent dark:hover:bg-muted text-foreground border border-border"
							>
								Archive
							</Button>
							<Button
								size="sm"
								variant="destructive"
								onClick={() => setIsBulkDeleteModalOpen(true)}
								className="h-8 text-xs bg-red-50 hover:bg-red-100 text-red-600 border-red-200 dark:bg-red-950/20 dark:hover:bg-red-900/30 dark:text-red-400 dark:border-red-500/20 border flex items-center gap-1.5"
							>
								<Trash2 className="w-3.5 h-3.5 mr-1.5" />
								Delete
							</Button>
							<Button
								size="sm"
								variant="ghost"
								onClick={() => setRowSelection({})}
								className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full ml-1"
							>
								<X className="w-4 h-4" />
							</Button>
						</div>
					</div>
				</div>
			)}
			
			{/* BULK DELETE CONFIRMATION DIALOG */}
			<Dialog open={isBulkDeleteModalOpen} onOpenChange={setIsBulkDeleteModalOpen}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl z-[60]">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-red-500" />
							<span>Confirm Bulk Deletion</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you sure you want to delete <strong className="text-foreground">{selectedIds.length}</strong> selected residents? This action is permanent and cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => setIsBulkDeleteModalOpen(false)}
								className="bg-muted hover:bg-border dark:bg-muted text-foreground/80 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={confirmBulkDelete}
								className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
							>
								Delete {selectedIds.length} Profiles
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			
			{/* BULK PUROK CONFIRMATION DIALOG */}
			<Dialog open={!!bulkPurokToUpdate} onOpenChange={(open) => !open && setBulkPurokToUpdate(null)}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl z-[60]">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<Map className="h-5 w-5 text-primary" />
							<span>Confirm Purok Update</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you sure you want to move <strong className="text-foreground">{selectedIds.length}</strong> residents to <strong className="text-foreground">{bulkPurokToUpdate}</strong>?
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => setBulkPurokToUpdate(null)}
								className="bg-muted hover:bg-border dark:bg-muted text-foreground/80 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={confirmBulkUpdatePurok}
								className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5"
							>
								Update Purok
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			
			{/* ARCHIVE CONFIRMATION DIALOG */}
			<Dialog open={!!archiveModalIds} onOpenChange={(open) => !open && setArchiveModalIds(null)}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl z-[60]">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-archive-x text-amber-500"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="m9.5 17 5-5"/><path d="m9.5 12 5 5"/></svg>
							<span>Confirm Archiving</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you sure you want to mark <strong className="text-foreground">{archiveModalIds?.length}</strong> resident(s) as deceased? They will be moved to the archive and hidden from standard statistics.
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => setArchiveModalIds(null)}
								className="bg-muted hover:bg-border dark:bg-muted text-foreground/80 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={confirmArchive}
								className="bg-amber-600 hover:bg-amber-500 text-foreground rounded-xl px-5"
							>
								Archive {archiveModalIds?.length} Profile(s)
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
			<ManagePuroksModal
				open={isManagePuroksOpen}
				onOpenChange={setIsManagePuroksOpen}
				onPuroksChanged={() => {
					loadPuroks();
					loadData();
				}}
			/>
		</div>
	);
}
