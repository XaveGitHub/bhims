import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { 
	Plus, 
	Download, 
	Upload, 
	ScanBarcode, 
	Search, 
	CheckCircle2, 
	Clock,
	X,
	Trash2,
	ChevronLeft,
	Calendar as CalendarIcon,
	Loader2
} from "lucide-react";
import { toast } from "sonner";
import { read, utils, writeFile } from "xlsx";

import { 
	getDistributionPrograms, 
	getBeneficiariesByProgram, 
	createDistributionProgram,
	deleteDistributionProgram,
	importScannedExcel,
	markClaimedViaScan
} from "../lib/distribution-service";
import { getUniquePuroks } from "../lib/residents-service";
import { extractResidents } from "../lib/reports-service";

import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { 
	Select, 
	SelectContent, 
	SelectItem, 
	SelectTrigger, 
	SelectValue 
} from "../components/ui/select";
import { Progress } from "../components/ui/progress";
import { Checkbox } from "../components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { Calendar } from "../components/ui/calendar";

// Optimization: Memoized row for rendering up to 5k residents smoothly
const ResidentRow = React.memo(({ r, i, isSelected, onToggle }: { r: any, i: number, isSelected: boolean, onToggle: (id: number) => void }) => {
	return (
		<TableRow className="border-border hover:bg-muted/30">
			<TableCell className="text-center py-2">
				<Checkbox 
					checked={isSelected}
					onCheckedChange={() => onToggle(r.id)}
					className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
				/>
			</TableCell>
			<TableCell className="text-muted-foreground text-sm py-2">{i + 1}</TableCell>
			<TableCell className="text-muted-foreground text-xs font-mono py-2">{r.residentId || "—"}</TableCell>
			<TableCell className="text-foreground text-sm py-2">{r.lastName || "-"}</TableCell>
			<TableCell className="text-foreground text-sm py-2">{r.firstName || "-"}</TableCell>
			<TableCell className="text-muted-foreground text-sm py-2 text-center">{r.purok}</TableCell>
			<TableCell className="py-2 text-center">
				<div className="flex gap-1 justify-center flex-wrap">
					{r.isPwd && <Badge variant="outline" className="text-[10px] py-0 h-5 bg-purple-100 text-purple-700 border-purple-200">PWD</Badge>}
					{r.isSingleParent && <Badge variant="outline" className="text-[10px] py-0 h-5 bg-pink-100 text-pink-700 border-pink-200">Solo Parent</Badge>}
					{r.isSeniorCitizen && <Badge variant="outline" className="text-[10px] py-0 h-5 bg-amber-100 text-amber-700 border-amber-200">Senior</Badge>}
				</div>
			</TableCell>
		</TableRow>
	);
});

export const Route = createFileRoute("/distributions")({
	loader: async () => {
		const programs = await getDistributionPrograms();
		return { programs };
	},
	component: DistributionsPage,
});

function DistributionsPage() {
	const { programs: initialPrograms } = Route.useLoaderData();
	const [programs, setPrograms] = React.useState(initialPrograms);
	const [selectedProgram, setSelectedProgram] = React.useState<{id: number, name: string, date: string} | null>(null);
	const [isCreating, setIsCreating] = React.useState(false);
	const [isLoading, setIsLoading] = React.useState(false);
	const [isDeleting, setIsDeleting] = React.useState<number | null>(null);

	// Create Program State
	const [newName, setNewName] = React.useState("");
	const [newDescription, setNewDescription] = React.useState("");
	const [newDate, setNewDate] = React.useState<Date | undefined>(new Date());
	
	// Demographics Filters
	const [puroks, setPuroks] = React.useState<{ id: string; name: string }[]>([]);
	const [purok, setPurok] = React.useState<string>("ALL");
	const [ageBracket, setAgeBracket] = React.useState<string>("ALL");
	const [isPwd, setIsPwd] = React.useState(false);
	const [isSoloParent, setIsSoloParent] = React.useState(false);
	
	const [previewResidents, setPreviewResidents] = React.useState<any[]>([]);
	const [selectedResidentIds, setSelectedResidentIds] = React.useState<Set<number>>(new Set());
	const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
	const [hasFetched, setHasFetched] = React.useState(false);
	const [previewSearch, setPreviewSearch] = React.useState("");
	const [programToDelete, setProgramToDelete] = React.useState<{id: number, name: string} | null>(null);
	
	// Pagination
	const [page, setPage] = React.useState(1);
	const [rowsPerPage, setRowsPerPage] = React.useState(50);

	React.useEffect(() => {
		getUniquePuroks().then((res) => {
			setPuroks(res.map(name => ({ id: name, name })));
		});
	}, []);

	// Auto-fetch when search changes (debounced)
	React.useEffect(() => {
		if (!isCreating || (!hasFetched && !previewSearch)) return;

		const timeout = setTimeout(() => {
			fetchPreview();
		}, 400);

		return () => clearTimeout(timeout);
	}, [previewSearch]);

	const fetchPreview = async () => {
		if (isPreviewLoading) return;
		setIsPreviewLoading(true);

		try {
			const res = await extractResidents({
				data: {
					search: previewSearch || undefined,
					purok: purok === "ALL" ? undefined : purok,
					ageBracket: ageBracket === "ALL" ? undefined : ageBracket,
					isPwd: isPwd ? true : undefined,
					isSoloParent: isSoloParent ? true : undefined,
				}
			});
			const sortedItems = [...(res.data || [])].sort((a, b) => {
				if (a.purok !== b.purok) {
					const aNum = parseInt((a.purok || "").replace(/\D/g, '')) || 0;
					const bNum = parseInt((b.purok || "").replace(/\D/g, '')) || 0;
					if (aNum !== bNum) return aNum - bNum;
					return (a.purok || "").localeCompare(b.purok || "");
				}
				return (a.lastName || "").localeCompare(b.lastName || "");
			});
			
			setPreviewResidents(sortedItems);
			setPage(1);
			setHasFetched(true);
		} catch (err) {
			console.error(err);
		} finally {
			setIsPreviewLoading(false);
		}
	};

	const toggleResident = React.useCallback((id: number) => {
		setSelectedResidentIds(prev => {
			const next = new Set(prev);
			if (next.has(id)) {
				next.delete(id);
			} else {
				next.add(id);
			}
			return next;
		});
	}, []);

	const toggleAll = React.useCallback(() => {
		setSelectedResidentIds(prev => {
			const next = new Set(prev);
			// check if all currently visible are already selected
			const allVisibleSelected = previewResidents.length > 0 && previewResidents.every(r => next.has(r.id));
			
			if (allVisibleSelected) {
				// remove all visible from selection
				previewResidents.forEach(r => next.delete(r.id));
			} else {
				// add all visible to selection
				previewResidents.forEach(r => next.add(r.id));
			}
			return next;
		});
	}, [previewResidents]);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newName) {
			toast.error("Please enter a program name");
			return;
		}
		if (selectedResidentIds.size === 0) {
			toast.error("Please select at least one resident");
			return;
		}
		
		setIsLoading(true);
		try {
			// Compute an automatic target demographic string based on filters
			const tags = [];
			if (purok !== "ALL") tags.push(purok);
			if (ageBracket !== "ALL") tags.push(ageBracket);
			if (isPwd) tags.push("PWD");
			if (isSoloParent) tags.push("Solo Parent");
			
			const targetDemographic = tags.length > 0 ? tags.join(", ") : "Custom Selection";

			const res = await createDistributionProgram({
				data: {
					name: newName,
					date: newDate ? newDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
					description: newDescription || undefined,
					targetDemographic,
					selectedResidentIds: Array.from(selectedResidentIds)
				}
			});
			if (res.success) {
				toast.success(`Program created! ${res.count} residents selected.`);
				const updated = await getDistributionPrograms();
				setPrograms(updated);
				setIsCreating(false);
				setSelectedProgram({ 
					id: res.programId, 
					name: newName, 
					date: newDate ? newDate.toISOString().split("T")[0] : new Date().toISOString().split("T")[0] 
				});
				setNewName("");
			}
		} catch (err: any) {
			toast.error(err.message || "Failed to create program");
		} finally {
			setIsLoading(false);
		}
	};

	const confirmDelete = (id: number, name: string, e: React.MouseEvent) => {
		e.stopPropagation();
		setProgramToDelete({ id, name });
	};

	const executeDelete = async () => {
		if (!programToDelete) return;
		const id = programToDelete.id;
		
		setProgramToDelete(null);
		setIsDeleting(id);
		try {
			const res = await deleteDistributionProgram({ data: id });
			if (res.success) {
				toast.success("Program deleted");
				const updated = await getDistributionPrograms();
				setPrograms(updated);
			}
		} catch (err: any) {
			toast.error("Failed to delete program");
		} finally {
			setIsDeleting(null);
		}
	};

	if (selectedProgram) {
		return (
			<DistributionDetail 
				program={selectedProgram} 
				onBack={() => {
					setSelectedProgram(null);
					getDistributionPrograms().then(setPrograms);
				}} 
			/>
		);
	}

	return (
		<>
			<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between hide-on-print">
					<div>
						<h2 className="text-2xl font-bold tracking-tight text-foreground">
							Ayuda & Distributions
						</h2>
						<p className="text-sm text-muted-foreground mt-0.5">
							Manage relief goods, financial assistance, and targeted demographic programs.
						</p>
					</div>
					<Button onClick={() => setIsCreating(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-md px-4">
						<Plus className="w-4 h-4" />
						<span>New Program</span>
					</Button>
				</div>

				<div className="border border-border/60 rounded-xl bg-card/40 shadow-sm flex-1 flex flex-col overflow-hidden">
					<div className="flex-1 overflow-auto">
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-surface border-b border-border">
								<TableRow className="border-border hover:bg-transparent">
									<TableHead className="w-16 text-muted-foreground font-medium h-10">No.</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Program Name</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Description</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Date</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Target Demographic</TableHead>
									<TableHead className="w-24 text-right text-muted-foreground font-medium h-10">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{programs.map((prog: any, i: number) => (
									<TableRow 
										key={prog.id} 
										className="border-border hover:bg-muted/30 transition-colors cursor-pointer"
										onClick={() => setSelectedProgram({ id: prog.id, name: prog.name, date: prog.date })}
									>
										<TableCell className="text-muted-foreground text-sm py-2">{i + 1}</TableCell>
										<TableCell className="text-foreground text-sm py-2">
											{prog.name}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm py-2 max-w-[200px] truncate" title={prog.description || ""}>
											{prog.description || "—"}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm py-2">{prog.date}</TableCell>
										<TableCell className="py-2">
											<Badge variant="outline" className="text-primary border-primary/20">
												{prog.targetDemographic || "Custom Selection"}
											</Badge>
										</TableCell>
										<TableCell className="text-right py-2">
											<Button
												variant="ghost"
												size="sm"
												className="h-8 w-8 p-0 text-muted-foreground hover:!text-red-400 hover:!bg-red-500/10 rounded-full"
												onClick={(e) => confirmDelete(prog.id, prog.name, e)}
												disabled={isDeleting === prog.id}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</TableCell>
									</TableRow>
								))}
								{programs.length === 0 && (
									<TableRow>
										<TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
											No distribution programs found. Click "New Program" to start.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>
				</div>
			</div>

			{/* Create Modal */}
			<Dialog open={isCreating} onOpenChange={setIsCreating}>
				<DialogContent className="max-w-4xl bg-background border-border/60 p-0 shadow-md flex flex-col max-h-[85vh] overflow-hidden rounded-xl">
					<div className="px-6 pt-6">
						<DialogHeader>
							<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
								Create Distribution Program
							</DialogTitle>
						</DialogHeader>
						
						<div className="grid grid-cols-2 gap-4 mt-6">
							<div className="space-y-1.5">
								<Label className="text-muted-foreground text-xs font-semibold">Program Name</Label>
								<Input
									required
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									placeholder="e.g., Senior Citizen Allowance Q4"
									className="bg-card border-border focus-visible:ring-primary/50 rounded-xl h-10"
								/>
							</div>
							<div className="space-y-1.5">
								<Label className="text-muted-foreground text-xs font-semibold">Distribution Date</Label>
								<Popover>
									<PopoverTrigger asChild>
										<Button
											variant="outline"
											className="w-full justify-start text-left font-normal bg-card border-border text-foreground h-10 rounded-xl hover:bg-muted hover:text-foreground"
										>
											<CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
											{newDate ? newDate.toLocaleDateString() : <span>Pick a date</span>}
										</Button>
									</PopoverTrigger>
									<PopoverContent className="w-auto p-0 bg-card border-border text-foreground" align="start">
										<Calendar
											mode="single"
											selected={newDate}
											onSelect={setNewDate}
											className="bg-card rounded-xl"
										/>
									</PopoverContent>
								</Popover>
							</div>
						</div>
						
						<div className="mt-4 space-y-1.5">
							<Label className="text-muted-foreground text-xs font-semibold">Description (Optional)</Label>
							<Input
								value={newDescription}
								onChange={(e) => setNewDescription(e.target.value)}
								placeholder="Brief details about this distribution..."
								className="bg-card border-border focus-visible:ring-primary/50 rounded-xl h-10"
							/>
						</div>
					</div>

					{/* Filters Area */}
					<div className="px-6 pb-0 shrink-0">
						<div className="flex flex-wrap gap-3 items-center border border-border/60 rounded-xl p-2.5 bg-card/20">
							<div className="relative w-full max-w-[200px]">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
								<Input 
									placeholder="Search residents..."
									value={previewSearch}
									onChange={(e) => setPreviewSearch(e.target.value)}
									className="pl-9 bg-card border-border h-10 rounded-xl text-sm focus-visible:ring-primary/50"
								/>
							</div>

						<Select value={purok} onValueChange={setPurok}>
							<SelectTrigger className="bg-card/50 border-border text-foreground h-10 rounded-xl w-[120px]">
								<SelectValue placeholder="All Puroks" />
							</SelectTrigger>
							<SelectContent className="bg-card border-border text-foreground rounded-xl">
								<SelectItem value="ALL">All Puroks</SelectItem>
								{puroks.map(p => (
									<SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
						
						<Select value={ageBracket} onValueChange={setAgeBracket}>
							<SelectTrigger className="bg-card/50 border-border text-foreground h-10 rounded-xl w-[120px]">
								<SelectValue placeholder="All Ages" />
							</SelectTrigger>
							<SelectContent className="bg-card border-border text-foreground rounded-xl">
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

						<div className="flex gap-2">
							<button 
								onClick={() => setIsPwd(!isPwd)}
								className={`h-10 px-4 rounded-xl border text-sm font-medium transition-all ${
									isPwd 
									? "bg-purple-100 border-purple-200 text-purple-700" 
									: "bg-card border-border text-muted-foreground hover:bg-card"
								}`}
							>
								PWD
							</button>
							<button 
								onClick={() => setIsSoloParent(!isSoloParent)}
								className={`h-10 px-4 rounded-xl border text-sm font-medium transition-all ${
									isSoloParent 
									? "bg-pink-100 border-pink-200 text-pink-700" 
									: "bg-card border-border text-muted-foreground hover:bg-card"
								}`}
							>
								Solo Parent
							</button>
						</div>
						<div>
							<Button 
								onClick={fetchPreview}
								disabled={isPreviewLoading}
								className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10 px-6 font-medium shadow-sm"
							>
								{isPreviewLoading ? (
									<>
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										Fetching
									</>
								) : (
									"Apply Filters"
								)}
							</Button>
						</div>
					</div>
				</div>

					{/* Preview List */}
					<div className="px-6 pb-0 flex-1 flex flex-col overflow-hidden min-h-[400px]">
						<div className="flex flex-col flex-1 border border-border/60 rounded-xl bg-muted/20 overflow-hidden min-h-0">
							<div className="flex-1 overflow-auto custom-scrollbar">
								<Table>
									<TableHeader className="sticky top-0 z-10 bg-surface border-b border-border">
								<TableRow className="border-border hover:bg-transparent">
										<TableHead className="w-12 text-center h-10">
											<Checkbox 
												checked={hasFetched && previewResidents.length > 0 && previewResidents.every(r => selectedResidentIds.has(r.id))}
												onCheckedChange={toggleAll}
												className="border-border data-[state=checked]:bg-primary data-[state=checked]:border-primary"
											/>
										</TableHead>
										<TableHead className="w-16 text-muted-foreground font-medium h-10">No.</TableHead>
										<TableHead className="text-muted-foreground font-medium h-10">ID</TableHead>
										<TableHead className="text-muted-foreground font-medium h-10">Last Name</TableHead>
										<TableHead className="text-muted-foreground font-medium h-10">First Name</TableHead>
										<TableHead className="text-muted-foreground font-medium h-10 text-center">Purok</TableHead>
										<TableHead className="text-muted-foreground font-medium h-10 text-center">Tags</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{isPreviewLoading ? (
										<TableRow>
											<TableCell colSpan={7} className="h-40 text-center">
												<div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
													<Loader2 className="w-6 h-6 animate-spin" />
													<span className="text-sm">Fetching residents</span>
												</div>
											</TableCell>
										</TableRow>
									) : !hasFetched ? (
										<TableRow>
											<TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
												Apply filters to preview target residents
											</TableCell>
										</TableRow>
									) : previewResidents.length === 0 ? (
										<TableRow>
											<TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
												No residents found matching the criteria
											</TableCell>
										</TableRow>
									) : (
										previewResidents.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((r, i) => (
											<ResidentRow 
												key={r.id} 
												r={r} 
												i={(page - 1) * rowsPerPage + i} 
												isSelected={selectedResidentIds.has(r.id)} 
												onToggle={toggleResident} 
											/>
										))
									)}
								</TableBody>
							</Table>
						</div>

						{/* Pagination Footer */}
						{hasFetched && previewResidents.length > 0 && (
							<div className="p-3 bg-card/40 border-t border-border/60 flex items-center justify-between shrink-0">
								<div className="flex items-center gap-2">
									<span className="text-xs text-muted-foreground">Rows per page:</span>
									<Select 
										value={rowsPerPage.toString()} 
										onValueChange={(v) => {
											setRowsPerPage(parseInt(v, 10));
											setPage(1);
										}}
									>
										<SelectTrigger className="w-20 h-8 bg-card border-border text-foreground/80 rounded-lg text-xs">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border text-foreground rounded-xl text-xs">
											<SelectItem value="50">50</SelectItem>
											<SelectItem value="100">100</SelectItem>
											<SelectItem value="500">500</SelectItem>
										</SelectContent>
									</Select>
								</div>
								
								{Math.ceil(previewResidents.length / rowsPerPage) > 1 && (
									<div className="flex items-center gap-4">
										<div className="text-xs text-muted-foreground">
											Page {page} of {Math.ceil(previewResidents.length / rowsPerPage)}
										</div>
										<div className="flex gap-2">
											<Button 
												variant="outline" 
												size="sm" 
												onClick={() => setPage(p => Math.max(1, p - 1))}
												disabled={page === 1}
												className="bg-background border-border text-foreground/80 h-8 rounded-lg disabled:opacity-50 disabled:pointer-events-none hover:bg-muted text-xs px-3"
											>
												Previous
											</Button>
											<Button 
												variant="outline" 
												size="sm" 
												onClick={() => setPage(p => Math.min(Math.ceil(previewResidents.length / rowsPerPage), p + 1))}
												disabled={page === Math.ceil(previewResidents.length / rowsPerPage)}
												className="bg-background border-border text-foreground/80 h-8 rounded-lg disabled:opacity-50 disabled:pointer-events-none hover:bg-muted text-xs px-3"
											>
												Next
											</Button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>

				{/* Footer */}
					<div className="px-6 py-4 border-t border-border/60 bg-card/40 flex justify-between items-center shrink-0">
						<div className="text-sm font-medium text-muted-foreground">
							<span className="text-primary">{selectedResidentIds.size}</span> residents selected
						</div>
						<div className="flex gap-3">
							<Button type="button" variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5">
							Cancel
						</Button>
						<Button onClick={handleCreate} disabled={isLoading || selectedResidentIds.size === 0} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 shadow-sm">
							{isLoading ? (
								<div className="flex items-center gap-2">
									<Loader2 className="w-4 h-4 animate-spin" />
									Creating...
								</div>
							) : (
								`Create Program (${selectedResidentIds.size} beneficiaries)`
							)}
						</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<Dialog open={programToDelete !== null} onOpenChange={(open) => !open && setProgramToDelete(null)}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl z-[60]">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<Trash2 className="w-5 h-5 text-red-500" />
							<span>Confirm Deletion</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you sure you want to delete <strong className="text-foreground">{programToDelete?.name}</strong> and all its history? This action is permanent and cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 mt-6">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setProgramToDelete(null)}
								className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={executeDelete}
								className="bg-red-600 hover:bg-red-500 text-foreground rounded-xl px-5"
							>
								Delete Program
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}

function DistributionDetail({ program, onBack }: { program: {id: number, name: string, date: string}, onBack: () => void }) {
	const [beneficiaries, setBeneficiaries] = React.useState<any[]>([]);
	const [isScannerOpen, setIsScannerOpen] = React.useState(false);
	const [isImporting, setIsImporting] = React.useState(false);
	const [searchQuery, setSearchQuery] = React.useState("");

	const [page, setPage] = React.useState(1);
	const [rowsPerPage, setRowsPerPage] = React.useState(50);
	const fileInputRef = React.useRef<HTMLInputElement>(null);

	const loadData = React.useCallback(async () => {
		const data = await getBeneficiariesByProgram({ data: program.id });
		setBeneficiaries(data);
	}, [program.id]);

	React.useEffect(() => {
		loadData();
	}, [loadData]);

	// Metrics
	const total = beneficiaries.length;
	const claimed = beneficiaries.filter(b => b.status === "Claimed").length;
	const pending = total - claimed;
	const progress = total === 0 ? 0 : Math.round((claimed / total) * 100);

	// Export to Excel
	const handleExport = () => {
		if (beneficiaries.length === 0) {
			toast.error("No beneficiaries to export");
			return;
		}

		const exportData = beneficiaries.map((b, index) => ({
			"No.": index + 1,
			"Resident ID": b.residentCode,
			"Full Name": b.fullName,
			"Purok": b.purok,
			"Status": b.status,
			// Blank column for the physical signature
			"Signature": "",
			"Notes / Representative": ""
		}));

		const worksheet = utils.json_to_sheet(exportData);
		worksheet["!cols"] = [
			{ wch: 5 },  
			{ wch: 15 }, 
			{ wch: 30 }, 
			{ wch: 15 }, 
			{ wch: 10 }, 
			{ wch: 30 }, 
			{ wch: 25 }, 
		];

		const workbook = utils.book_new();
		utils.book_append_sheet(workbook, worksheet, "Checklist");
		
		writeFile(workbook, `Distribution_Checklist_${program.id}.xlsx`);
		toast.success("Excel checklist downloaded!");
	};

	// Import Scanned Excel
	const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setIsImporting(true);
		try {
			const buffer = await file.arrayBuffer();
			const workbook = read(buffer);
			const worksheet = workbook.Sheets[workbook.SheetNames[0]];
			
			const rawData: any[] = utils.sheet_to_json(worksheet);
			
			const records = rawData.map(row => ({
				residentCode: String(row["Resident ID"] || ""),
				signatureText: String(row["Signature"] || "")
			}));

			const result = await importScannedExcel({
				data: {
					programId: program.id,
					records
				}
			});

			if (result.success) {
				toast.success(`Import successful! Marked ${result.updatedCount} residents as claimed.`);
				loadData();
			}
		} catch (err: any) {
			console.error("Import error", err);
			toast.error("Failed to parse the Excel file. Please ensure it matches the exported format.");
		} finally {
			setIsImporting(false);
			if (fileInputRef.current) {
				fileInputRef.current.value = "";
			}
		}
	};

	const filteredBeneficiaries = React.useMemo(() => {
		let result = beneficiaries.filter(b => {
			if (searchQuery && !b.fullName.toLowerCase().includes(searchQuery.toLowerCase()) && !b.residentCode.includes(searchQuery)) return false;
			return true;
		});

		result.sort((a, b) => {
			if (a.purok !== b.purok) {
				const aNum = parseInt(a.purok.replace(/\D/g, '')) || 0;
				const bNum = parseInt(b.purok.replace(/\D/g, '')) || 0;
				if (aNum !== bNum) return aNum - bNum;
				return a.purok.localeCompare(b.purok);
			}
			return (a.lastName || "").localeCompare(b.lastName || "");
		});

		return result;
	}, [beneficiaries, searchQuery]);

	// Pagination logic
	const totalPages = rowsPerPage === -1 ? 1 : Math.ceil(filteredBeneficiaries.length / rowsPerPage);
	const paginatedResults = rowsPerPage === -1 
		? filteredBeneficiaries 
		: filteredBeneficiaries.slice((page - 1) * rowsPerPage, page * rowsPerPage);


	return (
		<>
			<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div className="flex flex-col gap-3 hide-on-print">
				<div className="w-full">
					<Button 
						variant="ghost" 
						onClick={onBack}
						className="mb-4 text-foreground/80 hover:text-foreground hover:bg-muted h-10 rounded-xl px-4 -ml-4 text-base font-medium transition-colors gap-1"
					>
						<ChevronLeft className="w-5 h-5" />
						Back to Programs
					</Button>
					
					<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
						<div className="w-full max-w-sm">
						</div>

					</div>
				</div>
			</div>

			{/* Main Table Area */}
			<div className="flex flex-col gap-6">
				{/* Search Panel */}
				{/* Control Panel (Search, Metrics, Actions) */}
				<div className="p-5 bg-card/40 border border-border/60 rounded-xl hide-on-print shadow-sm flex flex-col gap-4">
					<div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
						<div className="flex-1 w-full max-w-md">
							<div className="relative w-full">
								<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
								<Input
									placeholder="Search resident name or ID..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-9 h-11 bg-card border-border text-foreground rounded-xl focus-visible:ring-primary/50 w-full"
								/>
							</div>
						</div>

						<div className="flex flex-wrap items-center gap-3">
							<Button variant="outline" onClick={handleExport} className="gap-2 bg-background border-border text-foreground/80 hover:bg-card rounded-xl">
								<Download className="w-4 h-4" />
								Export Excel
							</Button>
							
							<input 
								type="file" 
								accept=".xlsx, .xls" 
								className="hidden" 
								ref={fileInputRef}
								onChange={handleImportFile}
							/>
							<Button 
								variant="outline" 
								onClick={() => fileInputRef.current?.click()}
								disabled={isImporting}
								className="gap-2 bg-background border-border text-foreground/80 hover:bg-card rounded-xl"
							>
								<Upload className="w-4 h-4" />
								{isImporting ? "Importing..." : "Import Scanned Results"}
							</Button>

							<Button onClick={() => setIsScannerOpen(true)} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md rounded-xl">
								<ScanBarcode className="w-4 h-4" />
								Scanner Mode
							</Button>
						</div>
					</div>
				</div>

				{/* Results Table */}
				<div className="bg-card/40 rounded-xl border border-border overflow-hidden print-container">
					<div className="p-5 bg-card border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print-header-only">
						<div>
							<h3 className="text-lg font-bold text-foreground">{program.name}</h3>
							<div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
								<span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-primary" /> {claimed} Claimed</span>
								<span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500" /> {pending} Pending</span>
								<span className="font-medium ml-2 text-muted-foreground">{new Date(program.date).toLocaleDateString()}</span>
							</div>
						</div>
						<div className="flex items-center gap-3 w-full sm:w-64">
							<Progress value={progress} className="h-2 bg-muted flex-1" />
							<span className="font-medium text-foreground text-sm w-9 text-right">{progress}%</span>
						</div>
					</div>
					<div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-22rem)] custom-scrollbar">
						<Table>
							<TableHeader className="sticky top-0 z-10 bg-surface border-b border-border">
								<TableRow className="border-border hover:bg-transparent">
									<TableHead className="w-16 text-muted-foreground font-medium h-10">No.</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">ID</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Last Name</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">First Name</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Middle Name</TableHead>
									<TableHead className="text-muted-foreground font-medium h-10">Birth Date</TableHead>
									<TableHead className="w-20 text-center text-muted-foreground font-medium h-10">Age</TableHead>
									<TableHead className="text-center text-muted-foreground font-medium h-10">Purok</TableHead>
									<TableHead className="text-center text-muted-foreground font-medium h-10">Gender</TableHead>
									<TableHead className="w-[120px] text-center text-muted-foreground font-medium h-10">Status</TableHead>
									<TableHead className="w-[180px] text-center text-muted-foreground font-medium h-10">Time Claimed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{paginatedResults.map((b, i) => {
									const age = b.birthDate ? Math.floor((new Date().getTime() - new Date(b.birthDate).getTime()) / 3.15576e+10) : null;
									return (
									<TableRow key={b.id} className="border-border hover:bg-muted/30 transition-colors print-row">
										<TableCell className="text-muted-foreground text-sm py-2">{(page - 1) * rowsPerPage + i + 1}</TableCell>
										<TableCell className="text-muted-foreground text-xs font-mono py-2">{b.residentCode || "—"}</TableCell>
										<TableCell className="text-foreground text-sm py-2">{b.lastName || "-"}</TableCell>
										<TableCell className="text-foreground text-sm py-2">{b.firstName || "-"}</TableCell>
										<TableCell className="text-muted-foreground py-2">{b.middleName || "—"}</TableCell>
										<TableCell className="text-muted-foreground text-sm py-2">{b.birthDate || "—"}</TableCell>
										<TableCell className="text-foreground text-center py-2">{age !== null ? age : "—"}</TableCell>
										<TableCell className="text-muted-foreground text-sm py-2 text-center">{b.purok}</TableCell>
										<TableCell className="text-muted-foreground text-sm py-2 text-center">{b.gender || "—"}</TableCell>
										
										<TableCell className="py-2 text-center w-[120px]">
											{b.status === "Claimed" ? (
												<Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 h-6">
													<CheckCircle2 className="w-3 h-3" />
													Claimed
												</Badge>
											) : (
												<Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200 gap-1.5 h-6 mx-auto">
													<Clock className="w-3 h-3" />
													Pending
												</Badge>
											)}
										</TableCell>
										<TableCell className="text-center text-muted-foreground text-xs font-mono py-2 w-[200px]">
											{b.claimedAt ? new Date(b.claimedAt).toLocaleString() : "-"}
										</TableCell>
									</TableRow>
									);
								})}
								{filteredBeneficiaries.length === 0 && (
									<TableRow>
										<TableCell colSpan={11} className="h-32 text-center text-muted-foreground">
											No beneficiaries found.
										</TableCell>
									</TableRow>
								)}
							</TableBody>
						</Table>
					</div>

					{/* Pagination Controls */}
						{filteredBeneficiaries.length > 0 && (
							<div className="p-4 border-t border-border/60 bg-card/50 flex flex-col sm:flex-row justify-between items-center gap-4">
								<div className="flex items-center gap-2">
									<span className="text-sm text-muted-foreground">Rows per page:</span>
									<Select 
										value={rowsPerPage.toString()} 
										onValueChange={(v: string) => {
											setRowsPerPage(parseInt(v, 10));
											setPage(1);
										}}
									>
										<SelectTrigger className="w-24 h-8 bg-card border-border text-foreground/80 rounded-xl">
											<SelectValue />
										</SelectTrigger>
										<SelectContent className="bg-card border-border text-foreground rounded-xl">
											<SelectItem value="50">50</SelectItem>
											<SelectItem value="100">100</SelectItem>
											<SelectItem value="500">500</SelectItem>
										</SelectContent>
									</Select>
								</div>
								
								{totalPages > 1 && (
									<div className="flex items-center gap-4">
										<div className="text-sm text-muted-foreground">
											Page {page} of {totalPages}
										</div>
										<div className="flex gap-2">
											<Button 
												variant="outline" 
												size="sm" 
												onClick={() => setPage(p => Math.max(1, p - 1))}
												disabled={page === 1}
												className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 hover:bg-muted"
											>
												Previous
											</Button>
											<Button 
												variant="outline" 
												size="sm" 
												onClick={() => setPage(p => Math.min(totalPages, p + 1))}
												disabled={page === totalPages}
												className="bg-background border-border text-foreground/80 h-8 rounded-xl disabled:opacity-50 hover:bg-muted"
											>
												Next
											</Button>
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			</div>

			{isScannerOpen && (
				<ScannerMode 
					programId={program.id} 
					onClose={() => {
						setIsScannerOpen(false);
						loadData();
					}} 
				/>
			)}
		</>
	);
}

function ScannerMode({ programId, onClose }: { programId: number, onClose: () => void }) {
	const [barcodeInput, setBarcodeInput] = React.useState("");
	const [lastResult, setLastResult] = React.useState<{success: boolean, message: string, resident?: any} | null>(null);
	const [isProcessing, setIsProcessing] = React.useState(false);
	const inputRef = React.useRef<HTMLInputElement>(null);

	React.useEffect(() => {
		const interval = setInterval(() => {
			if (inputRef.current && document.activeElement !== inputRef.current) {
				inputRef.current.focus();
			}
		}, 500);
		return () => clearInterval(interval);
	}, []);

	const handleScanSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const code = barcodeInput.trim();
		setBarcodeInput(""); 
		
		if (!code) return;
		setIsProcessing(true);

		try {
			const res = await markClaimedViaScan({ data: { programId, residentCode: code } });
			if (res.success) {
				setLastResult({
					success: true,
					message: "Successfully Claimed!",
					resident: res.resident
				});
				try {
					const ctx = new window.AudioContext();
					const osc = ctx.createOscillator();
					osc.connect(ctx.destination);
					osc.frequency.value = 800;
					osc.start();
					osc.stop(ctx.currentTime + 0.1);
				} catch {}
			} else {
				setLastResult({
					success: false,
					message: res.error || "Failed to process scan.",
					resident: res.resident
				});
				try {
					const ctx = new window.AudioContext();
					const osc = ctx.createOscillator();
					osc.connect(ctx.destination);
					osc.frequency.value = 200;
					osc.type = "square";
					osc.start();
					osc.stop(ctx.currentTime + 0.3);
				} catch {}
			}
		} catch (err: any) {
			setLastResult({ success: false, message: "Server error during scan." });
		} finally {
			setIsProcessing(false);
		}
	};

	return (
		<div className="fixed inset-0 z-50 bg-background/95 flex flex-col items-center justify-center p-6">
			<form onSubmit={handleScanSubmit} className="absolute opacity-0 pointer-events-none">
				<input
					ref={inputRef}
					type="text"
					value={barcodeInput}
					onChange={(e) => setBarcodeInput(e.target.value)}
					autoFocus
				/>
			</form>

			<Button 
				variant="outline"
				size="icon"
				onClick={onClose}
				className="absolute top-8 right-8 rounded-full bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
			>
				<X className="w-5 h-5" />
			</Button>

			<div className="text-center space-y-4 mb-12">
				<div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
					<ScanBarcode className="w-10 h-10" />
				</div>
				<h2 className="text-3xl font-semibold text-foreground">Scanner Mode Active</h2>
				<p className="text-muted-foreground max-w-sm mx-auto">
					Ready. Point your USB Barcode Scanner at the Resident ID to instantly mark them as claimed.
				</p>
			</div>

			<div className="w-full max-w-2xl h-80 flex items-center justify-center">
				{isProcessing ? (
					<div className="animate-pulse text-primary flex flex-col items-center gap-4">
						<ScanBarcode className="w-12 h-12 animate-bounce" />
						<span className="font-bold text-xl">Processing Scan...</span>
					</div>
				) : lastResult ? (
					<div className={`w-full p-8 rounded-xl border-2 flex items-center gap-8 shadow-md transition-all duration-300 transform scale-100 ${
						lastResult.success 
							? "bg-primary/10 border-primary/20 shadow-primary/20" 
							: "bg-rose-950/50 border-rose-500/50 shadow-rose-900/20"
					}`}>
						<div className="shrink-0">
							{lastResult.resident?.photoBase64 ? (
								<img 
									src={lastResult.resident.photoBase64} 
									alt="Resident" 
									className={`w-32 h-32 rounded-xl object-cover border-4 ${lastResult.success ? "border-primary/20" : "border-rose-500"}`} 
								/>
							) : (
								<div className={`w-32 h-32 rounded-xl flex items-center justify-center border-4 ${lastResult.success ? "border-primary/20 bg-primary/10" : "border-rose-500 bg-rose-950"}`}>
									<span className="text-4xl text-foreground font-semibold">?</span>
								</div>
							)}
						</div>
						
						<div>
							<h3 className={`text-4xl font-semibold mb-2 ${lastResult.success ? "text-primary" : "text-rose-400"}`}>
								{lastResult.message}
							</h3>
							{lastResult.resident && (
								<>
									<p className="text-2xl text-foreground font-bold">{lastResult.resident.fullName}</p>
									<p className="text-muted-foreground font-mono text-lg mt-1">{lastResult.resident.residentId}</p>
								</>
							)}
						</div>
					</div>
				) : (
					<div className="w-full h-full border-2 border-dashed border-border rounded-xl flex items-center justify-center text-muted-foreground font-medium text-xl">
						Waiting for scan...
					</div>
				)}
			</div>
		</div>
	);
}
