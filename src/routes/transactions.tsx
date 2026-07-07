import { createFileRoute } from "@tanstack/react-router";
import {
	type ColumnDef,
	flexRender,
	getCoreRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
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
					<span className="font-mono font-medium text-emerald-400">
						TRX-{row.original.id?.toString().padStart(5, "0")}
					</span>
				),
				filterFn: (row, id, value) => {
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
							? format(new Date(row.original.createdAt), "MMM d, yyyy • h:mm a")
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

	const filteredData = useMemo(() => {
		if (!globalFilter) return transactions;
		const query = globalFilter.toLowerCase();
		return transactions.filter((tx) => {
			const txId = `TRX-${tx.id?.toString().padStart(5, "0")}`;
			const name = `${tx.resident?.firstName} ${tx.resident?.lastName}`.toLowerCase();
			return txId.toLowerCase().includes(query) || name.includes(query);
		});
	}, [transactions, globalFilter]);

	const table = useReactTable({
		data: filteredData,
		columns,
		state: {
			sorting,
		},
		onSortingChange: setSorting,
		getCoreRowModel: getCoreRowModel(),
		getSortedRowModel: getSortedRowModel(),
	});

	return (
		<div className="flex-1 p-6 md:p-10 max-w-[1600px] w-full mx-auto animate-in fade-in duration-500">
			<div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
				<div>
					<h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-2">
						Transactions History
					</h1>
					<p className="text-neutral-400 text-lg">
						View and search all document requests and their statuses.
					</p>
				</div>
			</div>

			<div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col h-[calc(100vh-220px)]">
				<div className="p-4 border-b border-neutral-800 bg-neutral-950/50 flex items-center justify-between gap-4">
					<div className="relative w-full max-w-md">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
						<Input
							placeholder="Search by Resident Name or Transaction ID..."
							value={globalFilter}
							onChange={(e) => setGlobalFilter(e.target.value)}
							className="pl-9 bg-neutral-900 border-neutral-800 h-10 w-full focus-visible:ring-emerald-500/20"
						/>
					</div>
				</div>

				<div className="flex-1 overflow-auto custom-scrollbar">
					<Table>
						<TableHeader className="bg-neutral-950/80 sticky top-0 z-10 backdrop-blur-md">
							{table.getHeaderGroups().map((headerGroup) => (
								<TableRow key={headerGroup.id} className="border-neutral-800 hover:bg-transparent">
									{headerGroup.headers.map((header) => (
										<TableHead key={header.id} className="text-neutral-400 font-semibold tracking-wide whitespace-nowrap">
											{header.isPlaceholder
												? null
												: flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									))}
								</TableRow>
							))}
						</TableHeader>
						<TableBody>
							{isLoading ? (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-48 text-center text-neutral-500">
										Loading transactions...
									</TableCell>
								</TableRow>
							) : table.getRowModel().rows?.length ? (
								table.getRowModel().rows.map((row) => (
									<TableRow
										key={row.id}
										className="border-neutral-800/50 hover:bg-neutral-800/20 transition-colors"
									>
										{row.getVisibleCells().map((cell) => (
											<TableCell key={cell.id} className="py-4">
												{flexRender(cell.column.columnDef.cell, cell.getContext())}
											</TableCell>
										))}
									</TableRow>
								))
							) : (
								<TableRow>
									<TableCell colSpan={columns.length} className="h-48 text-center text-neutral-500">
										No transactions found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
					</Table>
				</div>
			</div>
		</div>
	);
}
