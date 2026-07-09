import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	getPaginationRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp, ArrowUpDown, AlertCircle } from "lucide-react";
import { format, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Input } from "../components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { getAllTransactions } from "../lib/queue-service";

export const Route = createFileRoute("/transactions")({
	component: TransactionsView,
});

function TransactionsView() {
	const [transactions, setTransactions] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [globalFilter, setGlobalFilter] = useState("");
	const [sorting, setSorting] = useState<SortingState>([
		{ id: "createdAt", desc: true },
	]);

	useEffect(() => {
		loadData();
	}, []);

	const loadData = async () => {
		setIsLoading(true);
		try {
			const data = await getAllTransactions();
			setTransactions(data);
		} catch (error) {
			console.error("Failed to load transactions", error);
		} finally {
			setIsLoading(false);
		}
	};

	const columns = useMemo<ColumnDef<any>[]>(
		() => [
			{
				accessorKey: "id",
				header: "Transaction ID",
				cell: ({ row }) => (
					<span className="font-mono font-medium text-neutral-300">
						TRX-{row.original.id?.toString().padStart(5, "0")}
					</span>
				),
				filterFn: (row, _id, value) => {
					const txId = `TRX-${row.original.id?.toString().padStart(5, "0")}`;
					return txId.toLowerCase().includes(value.toLowerCase());
				},
			},
			{
				accessorKey: "createdAt",
				header: "Date & Time",
				cell: ({ row }) => (
					<span className="text-neutral-300">
						{row.original.createdAt
							? format(new Date(row.original.createdAt), "MMM d, yyyy - h:mm a")
							: "—"}
					</span>
				),
			},
			{
				accessorFn: (row) => `${row.resident?.firstName} ${row.resident?.lastName}`,
				id: "residentName",
				header: "Resident Name",
				cell: ({ row }) => (
					<span className="font-medium text-neutral-200">
						{row.original.resident?.firstName} {row.original.resident?.lastName}
					</span>
				),
			},
			{
				accessorKey: "template.name",
				header: "Document Requested",
				cell: ({ row }) => (
					<span className="text-neutral-300 capitalize">
						{row.original.template?.name || "Unknown Document"}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = row.original.status;
					const styles: Record<string, string> = {
						"Ready to Claim": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
						Completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
						Released: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
						Processing: "bg-blue-500/15 text-blue-400 border-blue-500/30",
						Pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
						Cancelled: "bg-red-500/15 text-red-400 border-red-500/30",
					};
					return (
						<Badge variant="outline" className={`${styles[status] || "bg-neutral-500/15 text-neutral-400"} font-bold`}>
							{status}
						</Badge>
					);
				},
			},
			{
				accessorKey: "totalPrice",
				header: "Price",
				cell: ({ row }) => (
					<span className="text-neutral-300">
						{row.original.totalPrice > 0 ? `₱${row.original.totalPrice.toFixed(2)}` : "Free"}
					</span>
				),
			},
		],
		[]
	);

	const [statusFilter, setStatusFilter] = useState<string>("All");
	const [timeframeFilter, setTimeframeFilter] = useState<string>("All Time");

	const filteredData = useMemo(() => {
		let data = transactions;
		const today = new Date();

		// Apply Status Filter
		if (statusFilter !== "All") {
			if (statusFilter === "Completed") {
				data = data.filter(tx => tx.status === "Completed" || tx.status === "Released");
			} else {
				data = data.filter(tx => tx.status === statusFilter);
			}
		}

		// Apply Timeframe Filter
		if (timeframeFilter !== "All Time") {
			data = data.filter(tx => {
				const txDate = new Date(tx.createdAt);
				if (timeframeFilter === "Today") return isSameDay(txDate, today);
				if (timeframeFilter === "This Week") return isSameWeek(txDate, today);
				if (timeframeFilter === "This Month") return isSameMonth(txDate, today);
				return true;
			});
		}

		// Apply Global Search Filter
		if (globalFilter) {
			const query = globalFilter.toLowerCase();
			data = data.filter((tx) => {
				const txId = `TRX-${tx.id?.toString().padStart(5, "0")}`;
				const name = `${tx.resident?.firstName} ${tx.resident?.lastName}`.toLowerCase();
				return txId.toLowerCase().includes(query) || name.includes(query);
			});
		}

		return data;
	}, [transactions, globalFilter, statusFilter, timeframeFilter]);

	const table = useReactTable({
		data: filteredData,
		columns,
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: {
			pagination: {
				pageSize: 10,
			},
		},
	});

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Transactions History
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						View and search all document requests and their statuses
					</p>
				</div>
			</div>

			<div className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-3 sm:p-4 space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					<div className="relative flex-1">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500 pointer-events-none">
							<Search className="h-4 w-4" />
						</span>
						<Input
							placeholder="Search by Resident Name or Transaction ID..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9 bg-neutral-950 border-neutral-800 text-neutral-200 placeholder:text-neutral-600 focus:border-blue-500 rounded-xl h-9 text-sm w-full"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-full sm:w-40 bg-neutral-900 border-neutral-800 text-neutral-300 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
							<SelectItem value="All">All Status</SelectItem>
							<SelectItem value="Pending">Pending</SelectItem>
							<SelectItem value="Processing">Processing</SelectItem>
							<SelectItem value="Ready to Claim">Ready to Claim</SelectItem>
							<SelectItem value="Completed">Completed</SelectItem>
							<SelectItem value="Cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>
					<Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
						<SelectTrigger className="w-full sm:w-40 bg-neutral-900 border-neutral-800 text-neutral-300 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Time" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
							<SelectItem value="All Time">All Time</SelectItem>
							<SelectItem value="Today">Today</SelectItem>
							<SelectItem value="This Week">This Week</SelectItem>
							<SelectItem value="This Month">This Month</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="flex flex-col gap-6 max-h-[calc(100vh-16rem)]">
				<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg flex flex-col overflow-hidden p-0 gap-0 min-w-0">
					{isLoading && transactions.length === 0 ? (
						<div className="flex h-48 items-center justify-center">
							<div className="h-7 w-7 animate-spin rounded-full border-[3px] border-blue-600 border-t-transparent" />
						</div>
					) : table.getRowModel().rows.length > 0 ? (
						<>
							<Table wrapperClassName={`flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
								<TableHeader className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800">
									{table.getHeaderGroups().map((hg) => (
										<TableRow key={hg.id} className="border-0 hover:bg-transparent">
											{hg.headers.map((header) => {
												const canSort = header.column.getCanSort();
												const sorted = header.column.getIsSorted();
												return (
													<TableHead
														key={header.id}
														className="text-neutral-400 font-medium h-10 px-5 whitespace-nowrap bg-neutral-900/60 text-left"
													>
														{header.isPlaceholder ? null : canSort ? (
															<button
																type="button"
																onClick={header.column.getToggleSortingHandler()}
																className="flex items-center gap-1.5 hover:text-neutral-200 transition-colors outline-none"
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext()
																)}
																{sorted === "asc" ? (
																	<ChevronUp className="h-3 w-3 text-blue-500" />
																) : sorted === "desc" ? (
																	<ChevronDown className="h-3 w-3 text-blue-500" />
																) : (
																	<ArrowUpDown className="h-3 w-3 opacity-25" />
																)}
															</button>
														) : (
															flexRender(header.column.columnDef.header, header.getContext())
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
											className="border-b border-neutral-800/60 hover:bg-neutral-900/40 transition-colors"
										>
											{row.getVisibleCells().map((cell) => (
												<TableCell key={cell.id} className="px-5 py-3 align-middle">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</TableCell>
											))}
										</TableRow>
									))}
								</TableBody>
							</Table>

							<div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-neutral-800/60 bg-neutral-900/10 shrink-0">
								<div className="flex items-center gap-2">
									<span className="text-sm text-neutral-400">Rows per page:</span>
									<Select
										value={String(table.getState().pagination.pageSize)}
										onValueChange={(val) => {
											table.setPageSize(Number(val));
										}}
									>
										<SelectTrigger className="w-24 h-8 bg-neutral-900 border-neutral-800 text-neutral-300 rounded-xl">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 rounded-xl">
											{[10, 25, 50, 100].map(pageSize => (
												<SelectItem key={pageSize} value={String(pageSize)}>
													{pageSize}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center gap-4">
									<div className="text-sm text-neutral-400">
										Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.previousPage()}
											disabled={!table.getCanPreviousPage()}
											className="bg-neutral-950 border-neutral-800 text-neutral-300 h-8 rounded-xl disabled:opacity-50 hover:bg-neutral-800"
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.nextPage()}
											disabled={!table.getCanNextPage()}
											className="bg-neutral-950 border-neutral-800 text-neutral-300 h-8 rounded-xl disabled:opacity-50 hover:bg-neutral-800"
										>
											Next
										</Button>
									</div>
								</div>
							</div>
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<AlertCircle className="h-10 w-10 text-neutral-600 mb-2" />
							<p className="text-sm font-semibold text-neutral-400">
								No Transactions Found
							</p>
							<p className="text-xs text-neutral-500 max-w-xs mt-1">
								No records match your search query.
							</p>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
