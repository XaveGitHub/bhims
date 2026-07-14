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
import { ChevronDown, ChevronUp, ArrowUpDown, AlertCircle, CheckCircle2, Clock, Loader2, XCircle, CheckCircle, Search } from "lucide-react";
import { format, isSameDay, isSameWeek, isSameMonth } from "date-fns";
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
					<span className="font-mono text-sm text-foreground">
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
					<div className="text-center">
						<span className="text-sm text-foreground">
							{row.original.createdAt
								? format(new Date(row.original.createdAt), "MMM d, yyyy - h:mm a")
								: "—"}
						</span>
					</div>
				),
			},
			{
				accessorFn: (row) => `${row.resident?.firstName} ${row.resident?.lastName}`,
				id: "residentName",
				header: "Resident Name",
				cell: ({ row }) => (
					<span className="text-foreground text-sm">
						{row.original.resident?.firstName} {row.original.resident?.lastName}
					</span>
				),
			},
			{
				accessorKey: "template.name",
				header: "Document Requested",
				cell: ({ row }) => (
					<span className="text-sm text-foreground capitalize">
						{row.original.template?.name || "Unknown Document"}
					</span>
				),
			},
			{
				accessorKey: "status",
				header: "Status",
				cell: ({ row }) => {
					const status = row.original.status;
					const statusConfig: Record<string, { style: string; icon: any }> = {
						"Ready to Claim": { style: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200", icon: CheckCircle },
						Completed: { style: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200", icon: CheckCircle2 },
						Released: { style: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200", icon: CheckCircle2 },
						Claimed: { style: "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200", icon: CheckCircle2 },
						Processing: { style: "bg-primary/10 text-primary border-primary/20 hover:bg-primary/20", icon: Loader2 },
						Pending: { style: "bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200", icon: Clock },
						Cancelled: { style: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200", icon: XCircle },
						Unclaimed: { style: "bg-red-100 text-red-700 border-red-200 hover:bg-red-200", icon: AlertCircle },
					};
					const config = statusConfig[status] || { style: "bg-accent/15 text-muted-foreground", icon: AlertCircle };
					
					return (
						<div className="flex justify-center">
							<Badge variant="outline" className={`font-medium shadow-none ${config.style}`} icon={config.icon}>
								{status}
							</Badge>
						</div>
					);
				},
			},
			{
				accessorKey: "totalPrice",
				header: "Price",
				cell: ({ row }) => (
					<span className="text-sm text-foreground">
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
					<h2 className="text-2xl font-bold tracking-tight text-foreground">
						Transactions History
					</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						View and search all document requests and their statuses
					</p>
				</div>
			</div>

			<div className="rounded-xl border border-border bg-card shadow-sm p-3 sm:p-4 space-y-3">
				<div className="flex flex-col sm:flex-row gap-2">
					<div className="relative flex-1">
						<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground pointer-events-none">
							<Search className="h-4 w-4" />
						</span>
						<Input
							placeholder="Search by Resident Name or Transaction ID..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9 bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/20 rounded-xl h-9 text-sm w-full"
						/>
					</div>
					<Select value={statusFilter} onValueChange={setStatusFilter}>
						<SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground/80 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Status" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border text-foreground">
							<SelectItem value="All">All Status</SelectItem>
							<SelectItem value="Pending">Pending</SelectItem>
							<SelectItem value="Processing">Processing</SelectItem>
							<SelectItem value="Ready to Claim">Ready to Claim</SelectItem>
							<SelectItem value="Completed">Completed</SelectItem>
							<SelectItem value="Cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>
					<Select value={timeframeFilter} onValueChange={setTimeframeFilter}>
						<SelectTrigger className="w-full sm:w-40 bg-card border-border text-foreground/80 rounded-xl h-9 text-sm">
							<SelectValue placeholder="All Time" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border text-foreground">
							<SelectItem value="All Time">All Time</SelectItem>
							<SelectItem value="Today">Today</SelectItem>
							<SelectItem value="This Week">This Week</SelectItem>
							<SelectItem value="This Month">This Month</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="flex flex-col gap-6 max-h-[calc(100vh-16rem)]">
				<Card className="rounded-xl border-border bg-card shadow-sm flex flex-col overflow-hidden p-0 gap-0 min-w-0">
					{isLoading && transactions.length === 0 ? (
						<div className="flex h-48 items-center justify-center">
							<div className="h-7 w-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
						</div>
					) : table.getRowModel().rows.length > 0 ? (
						<>
							<Table wrapperClassName={`flex-1 overflow-y-auto custom-scrollbar transition-opacity duration-200 ${isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
								<TableHeader className="sticky top-0 z-10 bg-surface border-b border-border">
									{table.getHeaderGroups().map((hg) => (
										<TableRow key={hg.id} className="border-0 hover:bg-transparent">
											{hg.headers.map((header) => {
												const canSort = header.column.getCanSort();
												const sorted = header.column.getIsSorted();
												return (
													<TableHead
														key={header.id}
														className={`text-muted-foreground font-medium h-10 px-5 whitespace-nowrap bg-card ${
															["createdAt", "status"].includes(header.column.id) 
															? "text-center" 
															: "text-left"
														}`}
													>
														{header.isPlaceholder ? null : canSort ? (
															<button
																type="button"
																onClick={header.column.getToggleSortingHandler()}
																className={`flex items-center gap-1.5 hover:text-foreground transition-colors outline-none ${
																	["createdAt", "status"].includes(header.column.id) 
																	? "w-full justify-center" 
																	: ""
																}`}
															>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext()
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
											className="border-b border-border/60 hover:bg-muted/50 transition-colors"
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

							<div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/60 bg-muted/20 shrink-0">
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">Rows per page:</span>
									<Select
										value={String(table.getState().pagination.pageSize)}
										onValueChange={(val) => {
											table.setPageSize(Number(val));
										}}
									>
										<SelectTrigger className="w-24 h-8 bg-card border-border text-foreground/80 rounded-xl">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border text-foreground rounded-xl">
											{[10, 25, 50, 100].map(pageSize => (
												<SelectItem key={pageSize} value={String(pageSize)}>
													{pageSize}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="flex items-center gap-4">
									<div className="text-sm text-muted-foreground">
										Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
									</div>
									<div className="flex gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.previousPage()}
											disabled={!table.getCanPreviousPage()}
											className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 hover:bg-muted"
										>
											Previous
										</Button>
										<Button
											variant="outline"
											size="sm"
											onClick={() => table.nextPage()}
											disabled={!table.getCanNextPage()}
											className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 hover:bg-muted"
										>
											Next
										</Button>
									</div>
								</div>
							</div>
						</>
					) : (
						<div className="flex flex-col items-center justify-center py-20 text-center">
							<AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
							<p className="text-sm font-semibold text-muted-foreground">
								No Transactions Found
							</p>
							<p className="text-xs text-muted-foreground max-w-xs mt-1">
								No records match your search query.
							</p>
						</div>
					)}
				</Card>
			</div>
		</div>
	);
}
