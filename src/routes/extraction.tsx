import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Download, Printer, UserCheck } from "lucide-react";
import { getPuroks } from "../lib/residents-service";
import { extractResidents } from "../lib/reports-service";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
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
import { Badge } from "../components/ui/badge";

export const Route = createFileRoute("/extraction")({
	component: ExtractionView,
});

function ExtractionView() {
	const [puroks, setPuroks] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [results, setResults] = useState<any[]>([]);
	const [page, setPage] = useState(1);
	const [rowsPerPage, setRowsPerPage] = useState<number>(100);
	
	// Filters
	const [purok, setPurok] = useState("ALL");
	const [ageBracket, setAgeBracket] = useState("ALL");
	const [gender, setGender] = useState("ALL");
	const [isPwd, setIsPwd] = useState(false);
	const [isSoloParent, setIsSoloParent] = useState(false);
	const [appliedFilters] = useState({ isPwd: false, isSoloParent: false });

	useEffect(() => {
		getPuroks().then(setPuroks).catch(console.error);
	}, []);

	const handleExtract = async () => {
		setIsLoading(true);
		try {
			const res = await extractResidents({
				data: {
					purok: purok === "ALL" ? undefined : purok,
					ageBracket: ageBracket === "ALL" ? undefined : ageBracket,
					gender: gender === "ALL" ? undefined : gender,
					isPwd: isPwd || undefined,
					isSoloParent: isSoloParent || undefined,
				}
			});
			if (res.success) {
				const dataWithAge = (res.data || []).map(r => {
					let age = "N/A";
					if (r.birthDate) {
						const birth = new Date(r.birthDate);
						const today = new Date();
						let a = today.getFullYear() - birth.getFullYear();
						if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) {
							a--;
						}
						age = a.toString();
					}
					return { ...r, calculatedAge: age };
				});
				setResults(dataWithAge);
				setPage(1); // Reset page on new search
				if (dataWithAge.length === 0) {
					toast.info("No residents found with these filters.");
				} else {
					toast.success(`Found ${dataWithAge.length} residents`);
				}
			} else {
				toast.error(res.error || "Failed to extract data");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsLoading(false);
		}
	};

	const exportToExcel = () => {
		if (results.length === 0) return;
		
		const data = results.map((r, i) => {
			const row: any = {
				"No.": i + 1,
				"Last Name": r.lastName || "",
				"First Name": r.firstName || "",
				"Middle Name": r.middleName || "",
				"Birth Date": r.birthDate || "N/A",
				"Age": r.calculatedAge || "N/A",
				"Purok": r.purok || "",
				"Gender": r.gender || "",
			};
			
			// Only include special status columns if they were part of the filter
			if (isPwd) row["PWD"] = r.isPwd ? "Yes" : "No";
			if (isSoloParent) row["Solo Parent"] = r.isSingleParent ? "Yes" : "No";
			
			return row;
		});

		// Create empty worksheet
		const worksheet = XLSX.utils.json_to_sheet([]);
		
		// Add header rows for Title, Total, and Date
		XLSX.utils.sheet_add_aoa(worksheet, [
			["BHIMS Data Extraction Report"],
			[`Total Residents: ${results.length}`, `Date Generated: ${new Date().toLocaleDateString()}`],
			[] // Empty row for spacing
		], { origin: "A1" });
		
		// Add the JSON data starting at row 4
		XLSX.utils.sheet_add_json(worksheet, data, { origin: "A4", skipHeader: false });
		
		// Auto-size columns
		const colWidths = Object.keys(data[0] || {}).map(key => ({
			wch: Math.max(key.length, ...data.map(row => String(row[key as keyof typeof row] || "").length))
		}));
		worksheet["!cols"] = colWidths;

		const workbook = XLSX.utils.book_new();
		XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Data");
		
		// Generate dynamic filename
		const parts = ["BHIMS"];
		if (purok !== "ALL") parts.push(purok.replace(/\s+/g, ""));
		if (ageBracket !== "ALL") {
			parts.push(ageBracket.replace(/\s+/g, "").replace(/[^a-zA-Z0-9+]/g, ""));
		}
		if (isPwd) parts.push("PWD");
		if (isSoloParent) parts.push("SoloParent");
		if (gender !== "ALL") parts.push(gender);
		parts.push("Extraction");
		
		const filename = `${parts.join("_")}.xlsx`;
		XLSX.writeFile(workbook, filename);
	};

	const printList = () => {
		window.print();
	};

	// Pagination logic
	const totalPages = rowsPerPage === -1 ? 1 : Math.ceil(results.length / rowsPerPage);
	const paginatedResults = rowsPerPage === -1 ? results : results.slice((page - 1) * rowsPerPage, page * rowsPerPage);

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between hide-on-print">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Data Extraction
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Generate targeted lists for distribution, programs, and reporting
					</p>
				</div>
			</div>

			{/* Filter Panel */}
			<Card className="p-5 bg-neutral-900/40 border-neutral-800/60 hide-on-print shadow-sm">
				<div className="flex flex-wrap items-center gap-4">
					<div className="space-y-0">
						<Select value={purok} onValueChange={setPurok}>
							<SelectTrigger className="bg-neutral-900/50 border-neutral-800 text-neutral-200 h-11 rounded-xl w-[160px]">
								<SelectValue placeholder="All Puroks" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 rounded-xl">
								<SelectItem value="ALL">All Puroks</SelectItem>
								{puroks.map(p => (
									<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-0">
						<Select value={ageBracket} onValueChange={setAgeBracket}>
							<SelectTrigger className="bg-neutral-900/50 border-neutral-800 text-neutral-200 h-11 rounded-xl w-[160px]">
								<SelectValue placeholder="All Ages" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 rounded-xl">
								<SelectItem value="ALL">All Ages</SelectItem>
								<SelectItem value="Children (0-5)">Children (0-5)</SelectItem>
								<SelectItem value="Children (6-12)">Children (6-12)</SelectItem>
								<SelectItem value="Children (13-17)">Children (13-17)</SelectItem>
								<SelectItem value="Adult (18-35)">Adult (18-35)</SelectItem>
								<SelectItem value="Adult (36-50)">Adult (36-50)</SelectItem>
								<SelectItem value="Adult (51-59)">Adult (51-59)</SelectItem>
								<SelectItem value="Senior (60+)">Senior (60+)</SelectItem>
								<SelectItem value="Senior (65+)">Senior (65+)</SelectItem>
							</SelectContent>
						</Select>
					</div>

					<div className="space-y-0">
						<Select value={gender} onValueChange={setGender}>
							<SelectTrigger className="bg-neutral-900/50 border-neutral-800 text-neutral-200 h-11 rounded-xl w-[140px]">
								<SelectValue placeholder="All Genders" />
							</SelectTrigger>
							<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 rounded-xl">
								<SelectItem value="ALL">All Genders</SelectItem>
								<SelectItem value="Male">Male</SelectItem>
								<SelectItem value="Female">Female</SelectItem>
							</SelectContent>
						</Select>
					</div>
					
					<div className="flex items-center gap-3 h-11">
						<button 
							onClick={() => setIsPwd(!isPwd)}
							className={`h-11 px-4 rounded-xl border text-sm font-medium transition-all ${
								isPwd 
								? "bg-blue-500/20 border-blue-500/50 text-blue-400" 
								: "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:bg-neutral-900"
							}`}
						>
							PWD
						</button>
						<button 
							onClick={() => setIsSoloParent(!isSoloParent)}
							className={`h-11 px-4 rounded-xl border text-sm font-medium transition-all ${
								isSoloParent 
								? "bg-purple-500/20 border-purple-500/50 text-purple-400" 
								: "bg-neutral-950/50 border-neutral-800 text-neutral-400 hover:bg-neutral-900"
							}`}
						>
							Solo Parent
						</button>
					</div>

					<div className="flex-1 flex justify-end">
						<Button 
							onClick={handleExtract} 
							disabled={isLoading} 
							className="bg-emerald-600 hover:bg-emerald-500 text-white min-w-[140px] h-11 shadow-md rounded-xl"
						>
							{isLoading ? (
								<>
									<div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white mr-2" />
									Extracting
								</>
							) : (
								"Extract Data"
							)}
						</Button>
					</div>
				</div>
			</Card>

			{/* Results Table (Used for Web and Print) */}
			{results.length > 0 ? (
				<div className="bg-neutral-900/40 rounded-xl border border-neutral-800 overflow-hidden print-container">
					<div className="p-5 bg-neutral-900 border-b border-neutral-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print-header-only">
						<div>
							<h3 className="text-lg font-bold text-neutral-100">Extracted Results</h3>
							<div className="flex items-center gap-3 mt-1.5 text-sm">
								<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-medium">
									{results.length} Residents Found
								</Badge>
								<span className="text-neutral-500 font-medium">{new Date().toLocaleDateString()}</span>
							</div>
						</div>
						
						<div className="flex items-center gap-2 w-full sm:w-auto hide-on-print">
							<Button
								onClick={exportToExcel}
								variant="outline"
								className="flex-1 sm:flex-none bg-neutral-950 border-neutral-800 text-emerald-400 hover:bg-neutral-800 hover:text-emerald-300 h-9 rounded-xl"
							>
								<Download className="h-4 w-4 mr-2" />
								Export
							</Button>
							<Button
								onClick={printList}
								variant="outline"
								className="flex-1 sm:flex-none bg-neutral-950 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-white h-9 rounded-xl"
							>
								<Printer className="h-4 w-4 mr-2" />
								Print
							</Button>
						</div>
					</div>
					<div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-22rem)] custom-scrollbar">
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md">
								<TableRow className="border-neutral-800 hover:bg-transparent">
									<TableHead className="w-16 text-neutral-400 font-medium h-10">No.</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10">Last Name</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10">First Name</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10">Middle Name</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10">Birth Date</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10 w-24 text-center">Age</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10 text-center">Purok</TableHead>
									<TableHead className="text-neutral-400 font-medium h-10 text-center">Gender</TableHead>
									{(appliedFilters.isPwd || appliedFilters.isSoloParent) && (
										<TableHead className="px-5 py-3 text-xs font-semibold text-neutral-400 w-32 text-center">Tags</TableHead>
									)}
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedResults.map((r, i) => (
									<TableRow key={r.id} className="border-neutral-800/50 hover:bg-neutral-800/30 print-row">
										<TableCell className="text-neutral-500 text-sm py-2">{(page - 1) * rowsPerPage + i + 1}</TableCell>
										<TableCell className="font-medium text-neutral-200 py-2">
											{r.lastName}
										</TableCell>
										<TableCell className="font-medium text-neutral-200 py-2">
											{r.firstName}
										</TableCell>
										<TableCell className="font-medium text-neutral-200 py-2">
											{r.middleName || ""}
										</TableCell>
										<TableCell className="text-neutral-400 text-sm py-2">{r.birthDate || "N/A"}</TableCell>
										<TableCell className="text-neutral-400 text-sm py-2 text-center">{r.calculatedAge}</TableCell>
										<TableCell className="text-neutral-400 text-sm py-2 text-center">{r.purok}</TableCell>
										<TableCell className="text-neutral-400 text-sm py-2 text-center">{r.gender}</TableCell>
										{(appliedFilters.isPwd || appliedFilters.isSoloParent) && (
											<TableCell className="py-2 text-center">
												<div className="flex gap-1 flex-wrap justify-center">
													{r.isPwd && <Badge variant="outline" className="text-xs py-0 h-5 border-blue-500/30 text-blue-400 bg-blue-500/10">PWD</Badge>}
													{r.isSingleParent && <Badge variant="outline" className="text-xs py-0 h-5 border-purple-500/30 text-purple-400 bg-purple-500/10">Solo Parent</Badge>}
												</div>
											</TableCell>
										)}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</div>
					
					{/* Pagination Controls */}
					{results.length > 0 && (
						<div className="p-4 border-t border-neutral-800 bg-neutral-900/50 flex flex-col sm:flex-row justify-between items-center gap-4 hide-on-print">
							<div className="flex items-center gap-2">
								<span className="text-sm text-neutral-400">Rows per page:</span>
								<Select 
									value={rowsPerPage.toString()} 
									onValueChange={(v) => {
										setRowsPerPage(parseInt(v, 10));
										setPage(1);
									}}
								>
									<SelectTrigger className="w-24 h-8 bg-neutral-900 border-neutral-800 text-neutral-300 rounded-xl">
										<SelectValue />
									</SelectTrigger>
									<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200 rounded-xl">
										<SelectItem value="50">50</SelectItem>
										<SelectItem value="100">100</SelectItem>
										<SelectItem value="500">500</SelectItem>
									</SelectContent>
								</Select>
							</div>
							
							{totalPages > 1 && (
								<div className="flex items-center gap-4">
									<div className="text-sm text-neutral-400">
										Page {page} of {totalPages}
									</div>
									<div className="flex gap-2">
										<Button 
											variant="outline" 
											size="sm" 
											onClick={() => setPage(p => Math.max(1, p - 1))}
											disabled={page === 1}
											className="bg-neutral-950 border-neutral-800 text-neutral-300 h-8 rounded-xl disabled:opacity-50 disabled:pointer-events-none hover:bg-neutral-800"
										>
											Previous
										</Button>
										<Button 
											variant="outline" 
											size="sm" 
											onClick={() => setPage(p => Math.min(totalPages, p + 1))}
											disabled={page === totalPages}
											className="bg-neutral-950 border-neutral-800 text-neutral-300 h-8 rounded-xl disabled:opacity-50 disabled:pointer-events-none hover:bg-neutral-800"
										>
											Next
										</Button>
									</div>
								</div>
							)}
						</div>
					)}
				</div>
			) : (
				<div className="py-20 text-center hide-on-print border border-dashed border-neutral-800 rounded-xl bg-neutral-900/20">
					<UserCheck className="w-12 h-12 text-neutral-700 mx-auto mb-3" />
					<h3 className="text-lg font-medium text-neutral-300">No data extracted yet</h3>
					<p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
						Select your filters above and click "Extract Data" to generate a printable, exportable list of residents.
					</p>
				</div>
			)}
			
			<style dangerouslySetInnerHTML={{__html: `
				@media print {
					body * {
						visibility: hidden;
					}
					.hide-on-print {
						display: none !important;
					}
					.print-hide {
						display: none !important;
					}
					.print-container, .print-container * {
						visibility: visible;
					}
					.print-container {
						position: absolute;
						left: 0;
						top: 0;
						width: 100%;
						border: none !important;
						background: transparent !important;
					}
					.print-header-only {
						border-bottom: 1px solid #000 !important;
						background: transparent !important;
						color: #000 !important;
					}
					.print-header-only * {
						color: #000 !important;
					}
					.print-row * {
						color: #000 !important;
						border-bottom: 1px solid #ddd !important;
					}
					@page {
						size: A4;
						margin: 1cm;
					}
				}
			`}} />
		</div>
	);
}
