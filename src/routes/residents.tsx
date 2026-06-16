import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
	type VisibilityState,
} from "@tanstack/react-table";
import {
	AlertCircle,
	ArrowUpDown,
	ChevronDown,
	ChevronUp,
	Download,
	Search,
	Trash2,
	UserPlus,
	Calendar as CalendarIcon,
} from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar as CalendarComponent } from "../components/ui/calendar";

import {
	addResident,
	deleteResident,
	getResidents,
	getUniquePuroks,
	type ResidentInput,
} from "../lib/residents-service";

type ResidentsSearch = {
	action?: "add";
	householdId?: string;
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
		};
	},
});

export interface Resident extends ResidentInput {
	id: number;
	createdAt: Date;
	updatedAt: Date;
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
		{ id: "fullName", desc: false },
	]);
	const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

	// Search and Filter states
	const [search, setSearch] = useState("");
	const [selectedPurok, setSelectedPurok] = useState("");
	const [filterPwd, setFilterPwd] = useState<boolean | undefined>(undefined);
	const [filterSenior, setFilterSenior] = useState<boolean | undefined>(
		undefined,
	);
	const [filterVoter, setFilterVoter] = useState<boolean | undefined>(
		undefined,
	);
	const [filterSingleParent, setFilterSingleParent] = useState<
		boolean | undefined
	>(undefined);
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
					target.closest("[data-radix-popper-content-wrapper]")
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

	// Form state
	const [formName, setFormName] = useState("");
	const [formBirthdate, setFormBirthdate] = useState("");
	const [formGender, setFormGender] = useState("Male");
	const [formContact, setFormContact] = useState("");
	const [formPurok, setFormPurok] = useState("");
	const [formHouseholdId, setFormHouseholdId] = useState("");
	const [formRelationship, setFormRelationship] = useState("Self");
	const [formIsPwd, setFormIsPwd] = useState(false);
	const [formPwdType, setFormPwdType] = useState("");
	const [formIsSenior, setFormIsSenior] = useState(false);
	const [formIsVoter, setFormIsVoter] = useState(false);
	const [formIsSingleParent, setFormIsSingleParent] = useState(false);

	const [formError, setFormError] = useState("");

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
					isVoter: filterVoter,
					isSingleParent: filterSingleParent,
					gender: selectedGender || undefined,
					page: currentPage,
					limit: pageSize,
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
		selectedGender,
		currentPage,
		pageSize,
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

	const resetForm = () => {
		setFormName("");
		setFormBirthdate("");
		setFormGender("Male");
		setFormContact("");
		setFormPurok("");
		setFormHouseholdId("");
		setFormRelationship("Self");
		setFormIsPwd(false);
		setFormPwdType("");
		setFormIsSenior(false);
		setFormIsVoter(false);
		setFormIsSingleParent(false);
		setFormError("");
	};

	const handleAddSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formName || !formPurok) {
			setFormError("Name and Purok are required fields.");
			return;
		}

		const payload: ResidentInput = {
			fullName: formName,
			birthDate: formBirthdate || null,
			gender: formGender || null,
			contactNumber: formContact || null,
			purok: formPurok,
			householdId: formHouseholdId || null,
			isHeadOfHousehold:
				formRelationship === "Head" || formRelationship === "Self",
			relationshipToHead: formRelationship,
			isPwd: formIsPwd,
			pwdType: formIsPwd ? formPwdType : null,
			isSeniorCitizen: formIsSenior,
			isVoter: formIsVoter,
			isSingleParent: formIsSingleParent,
		};

		try {
			const result = await addResident({ data: payload });
			if (result.success) {
				setIsAddModalOpen(false);
				resetForm();
				invalidateResidentsCache();
				invalidateHouseholdsCache();
				loadData();
				loadPuroks();
				toast.success("Resident added successfully");
			}
		} catch (err) {
			setFormError("Failed to add resident. Check your fields.");
			toast.error("Failed to add resident");
		}
	};

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

	const exportToExcel = () => {
		if (residentsList.length === 0) return;

		// Map list to human-friendly structure for Excel columns
		const mapped = residentsList.map((r) => ({
			"Full Name": r.fullName,
			Birthdate: r.birthDate || "",
			Gender: r.gender || "",
			"Contact Number": r.contactNumber || "",
			"Purok/Address": r.purok,
			"Household ID": r.householdId || "",
			"Relationship to Head": r.relationshipToHead || "",
			"Is PWD": r.isPwd ? "Yes" : "No",
			"Disability Type": r.pwdType || "",
			"Is Senior Citizen": r.isSeniorCitizen ? "Yes" : "No",
			"Registered Voter": r.isVoter ? "Yes" : "No",
			"Single Parent": r.isSingleParent ? "Yes" : "No",
		}));

		const worksheet = XLSX.utils.json_to_sheet(mapped);
		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Residents");

		// Auto-fit column widths
		const maxLens = Object.keys(mapped[0] || {}).map((key) => {
			const lengths = mapped.map(
				(row) => String(row[key as keyof typeof row]).length,
			);
			return { wch: Math.max(key.length, ...lengths) + 2 };
		});
		worksheet["!cols"] = maxLens;

		XLSX.writeFile(
			workbook,
			`BHIMS_Residents_${new Date().toISOString().split("T")[0]}.xlsx`,
		);
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
				id: "fullName",
				accessorKey: "fullName",
				header: "Name",
				enableSorting: true,
				enableHiding: false,
				sortingFn: "alphanumeric",
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col min-w-0">
							<span className="font-semibold text-neutral-100 text-sm leading-snug truncate">
								{r.fullName}
							</span>
							{r.contactNumber && (
								<span className="text-[11px] text-neutral-500 leading-none mt-0.5 sm:hidden">
									{r.contactNumber}
								</span>
							)}
						</div>
					);
				},
			},
			{
				id: "age",
				header: "Age / Gender",
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
						<div className="flex flex-col">
							<span className="text-sm text-neutral-200 leading-snug">
								{calculateAge(r.birthDate)} yrs
							</span>
							<span className="text-[11px] text-neutral-500 leading-none mt-0.5">
								{r.gender || "Unknown"}
							</span>
						</div>
					);
				},
			},
			{
				id: "purok",
				accessorKey: "purok",
				header: "Purok",
				enableSorting: true,
				enableHiding: true,
				sortingFn: "alphanumeric",
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col">
							<span className="text-sm font-medium text-neutral-200 leading-snug">
								{r.purok}
							</span>
							<span className="text-[11px] text-neutral-500 leading-none mt-0.5 hidden sm:block">
								{r.contactNumber || "No contact"}
							</span>
						</div>
					);
				},
			},
			{
				id: "household",
				header: "Household",
				enableSorting: false,
				enableHiding: true,
				cell: ({ row }) => {
					const r = row.original;
					return (
						<div className="flex flex-col">
							{r.householdId ? (
								<span className="text-sm font-medium text-neutral-200 leading-snug">
									Blk/Lot: {r.householdId}
								</span>
							) : (
								<span className="text-sm font-medium text-neutral-500 leading-snug">
									Unassigned
								</span>
							)}
							<span className="text-[11px] text-neutral-500 leading-none mt-0.5">
								{r.isHeadOfHousehold
									? "Head"
									: r.relationshipToHead || "Member"}
							</span>
						</div>
					);
				},
			},
			{
				id: "demographics",
				header: "Tags",
				enableSorting: false,
				enableHiding: true,
				cell: ({ row }) => {
					const r = row.original;
					const hasTag =
						r.isPwd || r.isSeniorCitizen || r.isVoter || r.isSingleParent;
					if (!hasTag)
						return <span className="text-neutral-600 text-xs">—</span>;
					return (
						<div className="flex flex-wrap gap-1">
							{r.isPwd && (
								<span
									className="rounded-full bg-purple-950/40 border border-purple-800/30 px-2 py-0.5 text-[10px] font-semibold text-purple-400"
									title={r.pwdType || "PWD"}
								>
									PWD
								</span>
							)}
							{r.isSeniorCitizen && (
								<span className="rounded-full bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
									Senior
								</span>
							)}
							{r.isVoter && (
								<span className="rounded-full bg-emerald-950/40 border border-emerald-800/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
									Voter
								</span>
							)}
							{r.isSingleParent && (
								<span className="rounded-full bg-pink-950/40 border border-pink-800/30 px-2 py-0.5 text-[10px] font-semibold text-pink-400">
									Solo Parent
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
					return (
						<div className="flex items-center justify-end gap-1">
							{/* The row itself is clickable to view the profile */}
							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => {
									e.stopPropagation();
									handleDeleteClick(r.id);
								}}
								className="h-8 px-2 text-red-400/80 hover:text-red-400 hover:bg-red-950/40 rounded-lg gap-1.5"
							>
								<Trash2 className="h-3.5 w-3.5" />
								<span className="sr-only sm:not-sr-only sm:text-xs">
									Delete
								</span>
							</Button>
						</div>
					);
				},
			},
		],
		[handleDeleteClick, calculateAge],
	);

	const table = useReactTable({
		data: residentsList,
		columns,
		state: { sorting, columnVisibility },
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		manualPagination: true,
	});

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Page header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Residents
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Manage resident records
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						onClick={exportToExcel}
						disabled={residentsList.length === 0}
						variant="outline"
						className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 rounded-xl px-4"
					>
						<Download className="h-4 w-4" />
						<span className="hidden sm:inline">Export</span>
					</Button>
					<Button
						onClick={() => {
							resetForm();
							setIsAddModalOpen(true);
						}}
						className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-4"
					>
						<UserPlus className="h-4 w-4" />
						<span>Add Resident</span>
					</Button>
				</div>
			</div>
			{/* Search + filter bar */}
			<div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:p-4 space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					{/* Search — debounced */}
					<div className="relative flex-1">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 pointer-events-none">
							<Search className="h-4 w-4" />
						</span>
						<Input
							placeholder="Search by name…"
							value={searchInput}
							onChange={(e) => handleSearchChange(e.target.value)}
							className="pl-9 bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-600 focus:border-emerald-500 rounded-xl h-9 text-sm"
						/>
					</div>
					{/* Purok Filter */}
					<Select
						value={selectedPurok || "ALL"}
						onValueChange={(v) => setSelectedPurok(v === "ALL" ? "" : v)}
					>
						<SelectTrigger className="w-full sm:w-36 bg-neutral-950 border-neutral-800 text-neutral-300 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Puroks" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
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
						<SelectTrigger className="w-full sm:w-32 bg-neutral-950 border-neutral-800 text-neutral-300 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Genders" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
							<SelectItem value="ALL">All Genders</SelectItem>
							<SelectItem value="Male">Male</SelectItem>
							<SelectItem value="Female">Female</SelectItem>
							<SelectItem value="Other">Other</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Quick filter pills */}
				<div className="flex flex-wrap gap-1.5 pt-2 border-t border-neutral-800/60">
					{(
						[
							{
								label: "PWD",
								active: filterPwd === true,
								color: "purple",
								fn: () => setFilterPwd(filterPwd === true ? undefined : true),
							},
							{
								label: "Senior",
								active: filterSenior === true,
								color: "amber",
								fn: () =>
									setFilterSenior(filterSenior === true ? undefined : true),
							},
							{
								label: "Voter",
								active: filterVoter === true,
								color: "emerald",
								fn: () =>
									setFilterVoter(filterVoter === true ? undefined : true),
							},
							{
								label: "Solo Parent",
								active: filterSingleParent === true,
								color: "pink",
								fn: () =>
									setFilterSingleParent(
										filterSingleParent === true ? undefined : true,
									),
							},
						] as const
					).map(({ label, active, color, fn }) => (
						<button
							type="button"
							key={label}
							onClick={fn}
							className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
								active
									? `bg-${color}-950/40 text-${color}-400 border-${color}-800/50`
									: "bg-neutral-950 text-neutral-400 border-neutral-800 hover:border-neutral-700"
							}`}
						>
							{label}
						</button>
					))}
					{(selectedPurok ||
						search ||
						filterPwd !== undefined ||
						filterSenior !== undefined ||
						filterVoter !== undefined ||
						filterSingleParent !== undefined ||
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
								setSelectedGender("");
							}}
							className="px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-neutral-400 border border-neutral-700"
						>
							Clear all
						</button>
					)}
				</div>
			</div>
			{/* Table and Split Pane */}
			<div
				ref={containerRef}
				className="flex flex-col md:flex-row gap-6 h-[calc(100vh-16rem)] overflow-hidden"
			>
				<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden h-full p-0 gap-0 flex-1 min-w-0">
					{loading ? (
						<div className="flex h-48 items-center justify-center">
							<div className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-600 border-t-transparent" />
						</div>
					) : residentsList.length > 0 ? (
						<>
							<Table>
								<TableHeader className="bg-neutral-900/80 border-b border-neutral-800">
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
														className="px-3 sm:px-5 py-3 text-xs font-semibold text-neutral-400 select-none whitespace-nowrap"
													>
														{header.isPlaceholder ? null : canSort ? (
															<button
																type="button"
																onClick={header.column.getToggleSortingHandler()}
																className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors outline-none"
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
																{sorted === "asc" ? (
																	<ChevronUp className="h-3 w-3 text-emerald-500" />
																) : sorted === "desc" ? (
																	<ChevronDown className="h-3 w-3 text-emerald-500" />
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
											className={`border-b border-neutral-800/60 transition-colors cursor-pointer ${
												drawerResident?.id === row.original.id
													? "bg-neutral-800/60 hover:bg-neutral-800/60"
													: row.getIsSelected()
														? "bg-emerald-950/20"
														: "hover:bg-neutral-900/40"
											}`}
											onClick={() => setDrawerResident(row.original)}
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
								<div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-neutral-800/60 bg-neutral-900/10">
									<div className="text-xs text-neutral-400 select-none">
										<span className="font-semibold text-neutral-200">
											{(currentPage - 1) * pageSize + 1}–
											{Math.min(currentPage * pageSize, totalCount)}
										</span>{" "}
										of{" "}
										<span className="font-semibold text-neutral-200">
											{totalCount}
										</span>{" "}
										residents
									</div>

									<div className="flex items-center gap-2">
										<Select
											value={String(pageSize)}
											onValueChange={(val) => {
												setPageSize(Number(val));
												setCurrentPage(1);
											}}
										>
											<SelectTrigger
												size="sm"
												className="bg-neutral-950 border-neutral-800 text-xs text-neutral-400 rounded-lg px-2.5 py-1 focus:outline-none focus:border-emerald-500 cursor-pointer w-[110px]"
											>
												<SelectValue placeholder="10 per page" />
											</SelectTrigger>
											<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
												<SelectItem value="10">10 per page</SelectItem>
												<SelectItem value="25">25 per page</SelectItem>
												<SelectItem value="50">50 per page</SelectItem>
												<SelectItem value="100">100 per page</SelectItem>
											</SelectContent>
										</Select>

										<div className="flex items-center gap-1">
											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													setCurrentPage((prev) => Math.max(1, prev - 1))
												}
												disabled={currentPage === 1}
												className="bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 px-3 py-1.5 h-8 text-xs disabled:opacity-30 rounded-xl cursor-pointer"
											>
												Previous
											</Button>

											<div className="text-xs text-neutral-400 px-2 select-none">
												Page{" "}
												<span className="font-semibold text-neutral-200">
													{currentPage}
												</span>{" "}
												of{" "}
												<span className="font-semibold text-neutral-200">
													{Math.ceil(totalCount / pageSize)}
												</span>
											</div>

											<Button
												variant="outline"
												size="sm"
												onClick={() =>
													setCurrentPage((prev) =>
														Math.min(
															Math.ceil(totalCount / pageSize),
															prev + 1,
														),
													)
												}
												disabled={
													currentPage === Math.ceil(totalCount / pageSize) ||
													totalCount === 0
												}
												className="bg-neutral-950 border-neutral-800 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 px-3 py-1.5 h-8 text-xs disabled:opacity-30 rounded-xl cursor-pointer"
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
							<AlertCircle className="h-10 w-10 text-neutral-600 mb-2" />
							<p className="text-sm font-semibold text-neutral-400">
								No Residents Found
							</p>
							<p className="text-xs text-neutral-500 max-w-xs mt-1">
								No records match your search or filters. Try adjusting your
								query or adding a new resident.
							</p>
						</div>
					)}
				</Card>

				{/* Resident Profile Pane */}
				{drawerResident && (
					<Draggable nodeRef={dragNodeRef} handle=".drag-handle" cancel=".no-drag">
						<div ref={dragNodeRef} className="fixed top-20 right-4 w-[380px] lg:w-[420px] shadow-2xl z-50 pointer-events-none [&>*]:pointer-events-auto">
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
			<Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
				<DialogContent className="max-w-2xl bg-neutral-900 border-neutral-800 text-neutral-100 p-6 max-h-[90vh] overflow-y-auto sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100 mb-2">
							Add New Resident Profile
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleAddSubmit} className="space-y-6 mt-4">
						{formError && (
							<div className="p-3 bg-red-950/40 border border-red-900/50 rounded-xl text-xs text-red-400 flex items-center gap-2">
								<AlertCircle className="h-4 w-4 shrink-0" />
								<span>{formError}</span>
							</div>
						)}

						{/* Form columns */}
						<div className="grid gap-4 sm:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="add-name">Full Name *</Label>
								<Input
									id="add-name"
									value={formName}
									onChange={(e) => setFormName(e.target.value)}
									className="bg-neutral-950 border-neutral-800 text-neutral-100"
									placeholder="e.g. Juan dela Cruz"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="add-birthdate">Birthdate</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant={"outline"}
											className={`w-full justify-start text-left font-normal bg-neutral-950 border-neutral-800 text-neutral-100 h-10 px-3 py-2 text-sm ${!formBirthdate ? "text-neutral-500" : ""}`}
										>
											<CalendarIcon className="mr-2 h-4 w-4" />
											{formBirthdate ? (
												format(parseISO(formBirthdate), "PPP")
											) : (
												<span>Pick a date</span>
											)}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-100" align="start">
										<CalendarComponent
											mode="single"
											captionLayout="dropdown"
											startMonth={new Date(1900, 0)}
											endMonth={new Date()}
											selected={formBirthdate && isValid(parseISO(formBirthdate)) ? parseISO(formBirthdate) : undefined}
											onSelect={(date) => setFormBirthdate(date ? format(date, "yyyy-MM-dd") : "")}
											className="bg-neutral-900 text-neutral-100"
										/>
									</PopoverContent>
								</Popover>
							</div>

							<div className="space-y-2">
								<Label htmlFor="add-gender">Gender</Label>
								<Select value={formGender} onValueChange={setFormGender}>
									<SelectTrigger
										id="add-gender"
										className="w-full bg-neutral-950 border-neutral-800 text-neutral-300 rounded-lg focus:border-emerald-500 h-10 px-3 py-2 text-sm"
									>
										<SelectValue placeholder="Select Gender" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
										<SelectItem value="Male">Male</SelectItem>
										<SelectItem value="Female">Female</SelectItem>
										<SelectItem value="Other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>

							<div className="space-y-2">
								<Label htmlFor="add-contact">Contact Number</Label>
								<Input
									id="add-contact"
									value={formContact}
									onChange={(e) => setFormContact(e.target.value)}
									className="bg-neutral-950 border-neutral-800 text-neutral-100"
									placeholder="e.g. 0917XXXXXXX"
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="add-purok">Purok / Address *</Label>
								<Input
									id="add-purok"
									value={formPurok}
									onChange={(e) => setFormPurok(e.target.value)}
									className="bg-neutral-950 border-neutral-800 text-neutral-100"
									placeholder="e.g. Purok 3"
									required
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="add-household">Household ID</Label>
								<Input
									id="add-household"
									value={formHouseholdId}
									onChange={(e) => setFormHouseholdId(e.target.value)}
									className="bg-neutral-950 border-neutral-800 text-neutral-100"
									placeholder="e.g. hh-102"
								/>
							</div>
						</div>

						<div className="border-t border-neutral-800/80 pt-4 space-y-4">
							<div className="space-y-2 max-w-sm">
								<Label htmlFor="add-relationship">Relationship to Head</Label>
								<Select
									value={formRelationship}
									onValueChange={setFormRelationship}
								>
									<SelectTrigger
										id="add-relationship"
										className="w-full bg-neutral-950 border-neutral-800 text-neutral-300 rounded-lg focus:border-emerald-500 h-10 px-3 py-2 text-sm"
									>
										<SelectValue placeholder="Select Relationship" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
										<SelectItem value="Head">Head / Self</SelectItem>
										<SelectItem value="Spouse">Spouse</SelectItem>
										<SelectItem value="Child">Child</SelectItem>
										<SelectItem value="Parent">Parent</SelectItem>
										<SelectItem value="Sibling">Sibling</SelectItem>
										<SelectItem value="Relative">Relative</SelectItem>
										<SelectItem value="Other">Other</SelectItem>
									</SelectContent>
								</Select>
							</div>
						</div>

						{/* Status Toggles (PWD, Voter, Solo Parent) */}
						<div className="border-t border-neutral-800/80 pt-4 space-y-4">
							<h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
								Demographic Flags
							</h4>

							<div className="grid gap-4 sm:grid-cols-3">
								{/* Voter toggle */}
								<div className="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-950/30">
									<Label className="text-xs font-semibold text-neutral-300">
										Registered Voter
									</Label>
									<Switch
										checked={formIsVoter}
										onCheckedChange={setFormIsVoter}
									/>
								</div>

								{/* Single parent toggle */}
								<div className="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-950/30">
									<Label className="text-xs font-semibold text-neutral-300">
										Single Parent
									</Label>
									<Switch
										checked={formIsSingleParent}
										onCheckedChange={setFormIsSingleParent}
									/>
								</div>

								{/* PWD toggle */}
								<div className="flex items-center justify-between p-3 rounded-xl border border-neutral-800 bg-neutral-950/30">
									<Label className="text-xs font-semibold text-neutral-300">
										PWD Status
									</Label>
									<Switch checked={formIsPwd} onCheckedChange={setFormIsPwd} />
								</div>
							</div>

							{formIsPwd && (
								<div className="space-y-2 max-w-sm animate-in slide-in-from-top-1 duration-150">
									<Label htmlFor="add-pwd-type">
										Disability Type / Details
									</Label>
									<Input
										id="add-pwd-type"
										value={formPwdType}
										onChange={(e) => setFormPwdType(e.target.value)}
										className="bg-neutral-950 border-neutral-800 text-neutral-100"
										placeholder="e.g. Visual Impairment"
									/>
								</div>
							)}
						</div>

						{/* Actions */}
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								onClick={() => setIsAddModalOpen(false)}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5"
							>
								Save Profile
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
			{/* DELETE CONFIRMATION DIALOG */}
			<Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
				<DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100 flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-red-500" />
							<span>Confirm Deletion</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-neutral-300">
							Are you sure you want to delete this resident record? This action
							is permanent and cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								onClick={() => {
									setIsDeleteModalOpen(false);
									setResidentToDelete(null);
								}}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
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
		</div>
	);
}
