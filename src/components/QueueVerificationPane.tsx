import { useState, useEffect, useRef } from "react";
import { Printer, X, GripHorizontal, Calendar as CalendarIcon, CheckCircle2, Download, Loader2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar as CalendarComponent } from "./ui/calendar";
import { toPng } from 'html-to-image';
import { format, parseISO } from "date-fns";
import { cn } from "../lib/utils";

interface QueueVerificationPaneProps {
	batch: any;
	onClose: () => void;
	onStatusChange: (ids: number[], status: string) => Promise<void>;
}

export function QueueVerificationPane({ batch, onClose, onStatusChange }: QueueVerificationPaneProps) {
	const [isProcessing, setIsProcessing] = useState(false);
	const [isPrinting, setIsPrinting] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [printedItems, setPrintedItems] = useState<Record<number, boolean>>(() => {
		const saved = sessionStorage.getItem('queue_printed_items');
		return saved ? JSON.parse(saved) : {};
	});

	useEffect(() => {
		sessionStorage.setItem('queue_printed_items', JSON.stringify(printedItems));
	}, [printedItems]);
	
	const activeItem = batch?.items[selectedIndex];

	// Editable state
	const [editForm, setEditForm] = useState({
		firstName: "",
		lastName: "",
		birthDate: "",
		purok: "",
		gender: "",
		civilStatus: "",
		purpose: "",
		occupation: "",
		monthlyIncome: "",
		dateIssued: new Date().toISOString().split("T")[0],
		yearsResident: "",
		orNumber: "",
		commTaxNo: "",
		issuedAt: "Bacolod City",
		witness: ""
	});

	const previewContainerRef = useRef<HTMLDivElement>(null);
	const [previewScale, setPreviewScale] = useState<number | null>(null);

	useEffect(() => {
		if (!previewContainerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const availableWidth = entry.contentRect.width - 32;
				const newScale = Math.min(1, availableWidth / 794);
				setPreviewScale(newScale);
			}
		});
		observer.observe(previewContainerRef.current);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (batch && activeItem) {
			setEditForm({
				firstName: batch.resident?.firstName || "",
				lastName: batch.resident?.lastName || "",
				birthDate: batch.resident?.birthDate || "",
				purok: batch.resident?.purok || "",
				gender: batch.resident?.gender || "",
				civilStatus: batch.resident?.civilStatus || "",
				purpose: activeItem.purpose || "",
				occupation: batch.resident?.occupation || "",
				monthlyIncome: batch.resident?.monthlyIncome?.toString() || "",
				dateIssued: new Date().toISOString().split("T")[0],
				yearsResident: "",
				orNumber: "",
				commTaxNo: "",
				issuedAt: "Bacolod City",
				witness: ""
			});
		}
	}, [batch, activeItem]);

	// Close on Escape key (skip if processing to prevent interrupting operations)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isProcessing) {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, isProcessing]);

	if (!batch || !batch.items || batch.items.length === 0) return null;

	const fieldMappings = activeItem?.template?.fieldMappings 
		? (typeof activeItem.template.fieldMappings === 'string' 
			? JSON.parse(activeItem.template.fieldMappings) 
			: activeItem.template.fieldMappings) 
		: [];
	
	const hasField = (id: string) => fieldMappings.some((m: any) => m.id === id);

	const handlePrintSingle = async () => {
		if (!previewContainerRef.current) return;
		setIsProcessing(true);
		setIsPrinting(true);
		
		try {
			const element = document.getElementById('print-document');
			if (!element) throw new Error("Document not found");

			const dataUrl = await toPng(element, { 
				quality: 0.95,
				width: 794,
				height: 1123,
				pixelRatio: 1.5, // Balance of high quality and speed
				style: {
					transform: 'scale(1)',
					transformOrigin: 'top left'
				}
			});
			
			// Open a tiny invisible iframe to print the image
			const iframe = document.createElement('iframe');
			iframe.style.position = 'fixed';
			iframe.style.right = '0';
			iframe.style.bottom = '0';
			iframe.style.width = '0';
			iframe.style.height = '0';
			iframe.style.border = '0';
			document.body.appendChild(iframe);
			
			const contentWindow = iframe.contentWindow;
			if (contentWindow) {
				contentWindow.document.write(`
					<html>
						<head>
							<title>Print Document</title>
							<style>
								@page { size: A4; margin: 0; }
								body { margin: 0; padding: 0; }
								img { width: 210mm; height: 297mm; display: block; }
							</style>
						</head>
						<body>
							<img src="${dataUrl}" onload="window.print();" />
						</body>
					</html>
				`);
				contentWindow.document.close();
				
				// Clean up iframe after printing dialog closes
				setTimeout(() => {
					document.body.removeChild(iframe);
				}, 1000);
			}

			setPrintedItems((prev: any) => ({ ...prev, [activeItem.id]: true }));
			
			// Auto-advance if there are more
			if (selectedIndex < batch.items.length - 1) {
				setSelectedIndex(selectedIndex + 1);
			}
		} catch (error) {
			console.error("Print failed:", error);
			toast.error("Failed to print document");
		} finally {
			setIsProcessing(false);
			setIsPrinting(false);
		}
	};

	const handleDownloadImage = async () => {
		if (!previewContainerRef.current) return;
		
		setIsProcessing(true);
		setIsSaving(true);
		try {
			// Get the actual print document element, not the scaled container
			const element = document.getElementById('print-document');
			if (!element) throw new Error("Document not found");

			const dataUrl = await toPng(element, { 
				quality: 0.95,
				width: 794,
				height: 1123,
				pixelRatio: 1.5, // Balance of high quality and speed
				style: {
					transform: 'scale(1)',
					transformOrigin: 'top left'
				}
			});
			
			const link = document.createElement('a');
			link.download = `${batch.resident.lastName}_${activeItem.template?.name || 'Document'}.png`;
			link.href = dataUrl;
			link.click();
			
			toast.success("Downloaded successfully!");
			
		} catch (error) {
			console.error("Download failed:", error);
			toast.error("Failed to download image");
		} finally {
			setIsProcessing(false);
			setIsSaving(false);
		}
	};

	const handleMarkBatchReady = async () => {
		setIsProcessing(true);
		try {
			const ids = batch.items.map((i: any) => i.id);
			await onStatusChange(ids, "Ready to Claim");
			onClose();
		} catch (error) {
			toast.error("Failed to update status");
		} finally {
			setIsProcessing(false);
		}
	};

	const allPrinted = batch.items.every((i: any) => printedItems[i.id] || i.status === "Ready to Claim" || i.status === "Completed");
	const isSingleDocument = batch.items.length === 1;

	return (
		<>
			<style>{`
				@media print {
					@page { margin: 0; size: A4; }
					body * {
						visibility: hidden;
					}
					#print-document, #print-document * {
						visibility: visible;
					}
					#print-document {
						position: absolute !important;
						left: 0 !important;
						top: 0 !important;
						margin: 0 !important;
						padding: 0 !important;
						width: 794px !important;
						height: 1123px !important;
						transform: scale(1) !important;
						transform-origin: top left !important;
					}
				}
			`}</style>
			
			<div className="flex flex-col h-full bg-card border border-border rounded-xl shadow-lg overflow-hidden pointer-events-auto">
				{/* Header (Draggable) */}
				<div className="drag-handle bg-card p-5 flex flex-col border-b border-border shrink-0 cursor-grab active:cursor-grabbing rounded-t-xl relative group">
					<div className="absolute top-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
						<GripHorizontal className="w-8 h-8 text-muted-foreground" />
					</div>
					<div className="flex items-center justify-between mt-2 pl-2">
						<div className="flex items-center gap-4">
							<div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
								<Printer className="w-5 h-5 text-primary" />
							</div>
							<div>
								<h2 className="text-xl font-bold text-foreground tracking-tight">
									Queue {batch.queueNumber.toString().padStart(4, '0')}
								</h2>
								<p className="text-sm text-muted-foreground font-medium">
									{batch.resident?.firstName} {batch.resident?.lastName}
								</p>
							</div>
						</div>
						<Button variant="ghost" size="icon-sm" onClick={onClose} className="rounded-full shrink-0 text-muted-foreground transition-all hover:!bg-red-100 hover:!text-red-600">
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>

				<div className="flex flex-1 overflow-hidden">
					{/* Sidebar */}
					<div className="w-64 bg-card/50 border-r border-border overflow-y-auto p-4 space-y-2 shrink-0">
						<h3 className="text-xs font-medium text-muted-foreground mb-3 pl-2">Documents ({batch.items.length})</h3>
						{batch.items.map((item: any, idx: number) => {
							const isPrinted = printedItems[item.id] || item.status === "Ready to Claim" || item.status === "Completed";
							return (
								<button
									key={item.id}
									onClick={() => setSelectedIndex(idx)}
									className={`w-full text-left px-3 py-2.5 rounded-[var(--radius)] transition-all border border-transparent group font-medium ${
										selectedIndex === idx 
											? 'bg-primary text-primary-foreground shadow-sm' 
											: 'bg-transparent text-muted-foreground hover:bg-accent hover:text-primary'
									}`}
								>
									<div className="flex justify-between items-center">
										<span className="text-sm truncate pr-2 capitalize">{item.template?.name?.toLowerCase()}</span>
										{isPrinted && <CheckCircle2 className={`w-4 h-4 shrink-0 transition-colors ${selectedIndex === idx ? 'text-primary-foreground' : 'text-primary group-hover:text-primary'}`} />}
									</div>
								</button>
							);
						})}
					</div>

					{/* Main Content Area */}
					<div className="flex-1 flex overflow-hidden">
						{/* Left: Document Preview */}
						<div ref={previewContainerRef} className="w-7/12 bg-card/30 p-4 flex justify-center items-start border-r border-border overflow-y-auto">
							<div style={{ width: previewScale ? 794 * previewScale : 'auto', height: previewScale ? 1123 * previewScale : 'auto', opacity: previewScale ? 1 : 0, transition: 'opacity 0.2s' }} className="shrink-0 relative">
								<div 
									id="print-document"
									className="w-[794px] h-[1123px] bg-white text-black shadow-2xl relative"
									style={{
										transform: `scale(${previewScale || 1})`,
										transformOrigin: 'top left',
										backgroundImage: activeItem.template?.imageBase64 ? `url('${activeItem.template.imageBase64.startsWith('data:image') ? activeItem.template.imageBase64 : `/templates/${activeItem.template.imageBase64}`}')` : undefined,
										backgroundSize: '100% 100%',
										backgroundRepeat: 'no-repeat'
									}}
								>
								{/* Only show the HTML text if there is NO background image uploaded */}
								{!activeItem.template?.imageBase64 && (
									<div className="p-12 font-serif w-full h-full">
										<div className="text-center mb-10 pb-6 border-b-2 border-black/80">
											<p className="text-sm font-bold uppercase tracking-widest">Republic of the Philippines</p>
											<p className="text-sm font-bold uppercase tracking-widest">Province of Laguna</p>
											<p className="text-sm font-bold uppercase tracking-widest">Municipality of Los Baños</p>
											<h2 className="text-2xl font-black uppercase mt-4">Barangay San Antonio</h2>
											<h1 className="text-4xl font-black mt-8 underline decoration-4 underline-offset-8 capitalize">
												{activeItem.template?.name?.toLowerCase()}
											</h1>
										</div>

										<div className="text-xl leading-relaxed text-justify px-8">
											<p className="font-bold mb-8 text-2xl">TO WHOM IT MAY CONCERN:</p>
											<p className="mb-8 indent-12">
												This is to certify that <span className="font-bold capitalize px-2 text-2xl border-b border-black">{batch.resident?.firstName?.toLowerCase()} {batch.resident?.lastName?.toLowerCase()}</span>, 
												of legal age, {batch.resident?.gender?.toLowerCase() || 'single'}, is a bona fide resident of <span className="font-bold border-b border-black px-2">{batch.resident?.purok || '____________'}</span>, 
												Barangay San Antonio, Los Baños, Laguna.
											</p>
											<p className="mb-8 indent-12">
												This certification is being issued upon the request of the above-named person for <span className="font-bold border-b border-black px-2">{activeItem.purpose || 'general purposes'}</span>.
											</p>
											<p className="mb-12 indent-12">
												Issued this <span className="font-bold">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span> at Barangay San Antonio, Los Baños, Laguna.
											</p>
										</div>

										<div className="mt-40 px-8 flex justify-between items-end">
											<div className="text-center">
												<div className="w-64 h-px bg-black mb-2" />
												<p className="font-bold capitalize text-lg">{batch.resident?.firstName?.toLowerCase()} {batch.resident?.lastName?.toLowerCase()}</p>
												<p className="text-sm text-muted-foreground">Signature of Applicant</p>
											</div>
											<div className="text-center">
												<div className="w-64 h-px bg-black mb-2" />
												<p className="font-bold uppercase text-lg">Hon. Juan Dela Cruz</p>
												<p className="text-sm text-muted-foreground">Punong Barangay</p>
											</div>
										</div>
									</div>
								)}
								{activeItem.template?.imageBase64 && activeItem.template.fieldMappings && (
									<>
										{(activeItem.template.fieldMappings as any[]).map((field) => {
											let value = "";
											switch (field.id) {
												case "fullName":
													value = `${editForm.firstName || ""} ${editForm.lastName || ""}`.trim();
													break;
												case "age":
													if (editForm.birthDate) {
														const birthDate = new Date(editForm.birthDate);
														const ageDiffMs = Date.now() - birthDate.getTime();
														const ageDate = new Date(ageDiffMs);
														value = Math.abs(ageDate.getUTCFullYear() - 1970).toString();
													}
													break;
												case "gender":
													value = editForm.gender || "";
													break;
												case "purok":
													value = editForm.purok || "";
													break;
												case "occupation":
													value = editForm.occupation || "None";
													break;
												case "monthlyIncome":
													value = editForm.monthlyIncome ? `₱${parseFloat(editForm.monthlyIncome).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "0.00";
													break;
												case "purpose":
													value = editForm.purpose || "";
													break;
												case "dateIssued":
													if (editForm.dateIssued) {
														value = new Date(editForm.dateIssued).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
													}
													break;
												case "civilStatus":
													value = editForm.civilStatus || "";
													break;
												case "yearsResident":
													value = editForm.yearsResident || "";
													break;
												case "orNumber":
													value = editForm.orNumber || "";
													break;
												case "commTaxNo":
													value = editForm.commTaxNo || "";
													break;
												case "issuedAt":
													value = editForm.issuedAt || "";
													break;
												case "witness":
													value = editForm.witness || "";
													break;
											}
											
											return (
												<div
													key={field.id}
													className="absolute whitespace-nowrap leading-none"
													style={{
														left: `${field.x}px`,
														top: `${field.y}px`,
														fontSize: `${field.fontSize}px`,
														fontWeight: field.fontWeight,
														fontFamily: field.fontFamily === 'serif' ? 'serif' : field.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
													}}
												>
													{value}
												</div>
											);
										})}
									</>
								)}
								</div>
							</div>
						</div>

						{/* Right: Actions */}
						<div className="w-5/12 bg-background p-6 flex flex-col overflow-y-auto">
							<div className="space-y-4 flex-1">
								<div className="flex items-center justify-between">
									<div>
										<h3 className="text-lg font-bold text-foreground mb-1">Fill & Verify</h3>
										<p className="text-sm text-muted-foreground">Fill in required fields and correct typos before printing.</p>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-4 bg-card/50 p-4 rounded-2xl border border-border">
									{(hasField('fullName') || hasField('firstName')) && (
										<>
											<div className="space-y-2">
												<Label className="text-sm font-medium text-foreground/80 mb-1">First Name</Label>
												<Input 
													value={editForm.firstName}
													onChange={(e) => setEditForm({...editForm, firstName: e.target.value})}
													className="bg-background border-border text-foreground h-11"
												/>
											</div>
											<div className="space-y-2">
												<Label className="text-sm font-medium text-foreground/80 mb-1">Last Name</Label>
												<Input 
													value={editForm.lastName}
													onChange={(e) => setEditForm({...editForm, lastName: e.target.value})}
													className="bg-background border-border text-foreground h-11"
												/>
											</div>
										</>
									)}
									
									{hasField('purok') && (
										<div className="space-y-2">
											<Label className="text-sm font-medium text-foreground/80 mb-1">Purok</Label>
											<Input 
												value={editForm.purok}
												onChange={(e) => setEditForm({...editForm, purok: e.target.value})}
												className="bg-background border-border text-foreground h-11"
											/>
										</div>
									)}
									
									{(hasField('age') || hasField('birthDate')) && (
										<div className="space-y-2 flex flex-col justify-end">
											<Label className="text-sm font-medium text-foreground/80 mb-1">Birthdate</Label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"bg-background border-border text-foreground h-11 w-full justify-start text-left font-normal",
														!editForm.birthDate && "text-muted-foreground"
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
													{editForm.birthDate ? format(parseISO(editForm.birthDate), "MMM d, yyyy") : <span>Pick a date</span>}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0 bg-background border-border" align="start">
												<CalendarComponent
													mode="single"
													selected={editForm.birthDate ? parseISO(editForm.birthDate) : undefined}
													onSelect={(date) => {
														if (date) {
															const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
															setEditForm({ ...editForm, birthDate: localDate.toISOString().split("T")[0] });
														}
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>
									)}

									{hasField('purpose') && (
									<div className="space-y-2 col-span-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Purpose</Label>
										<Input 
											value={editForm.purpose}
											onChange={(e) => setEditForm({...editForm, purpose: e.target.value})}
											className="bg-background border-border text-foreground h-11"
										/>
									</div>
									)}

									{hasField('occupation') && (
									<div className="space-y-2 col-span-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Occupation</Label>
										<Input 
											value={editForm.occupation}
											onChange={(e) => setEditForm({...editForm, occupation: e.target.value})}
											className="bg-background border-border text-foreground h-11"
											placeholder="e.g. Farmer, Student, None"
										/>
									</div>
									)}

									{hasField('monthlyIncome') && (
									<div className="space-y-2 col-span-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Monthly Income (₱)</Label>
										<Input 
											type="number"
											value={editForm.monthlyIncome}
											onChange={(e) => setEditForm({...editForm, monthlyIncome: e.target.value})}
											className="bg-background border-border text-foreground h-11"
											placeholder="0.00"
										/>
									</div>
									)}

									{hasField('civilStatus') && (
									<div className="space-y-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Civil Status</Label>
										<Input 
											value={editForm.civilStatus}
											onChange={(e) => setEditForm({...editForm, civilStatus: e.target.value})}
											className="bg-background border-border text-foreground h-11"
											placeholder="e.g. Single"
										/>
									</div>
									)}

									{hasField('yearsResident') && (
									<div className="space-y-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Years Resident</Label>
										<Input 
											type="number"
											value={editForm.yearsResident}
											onChange={(e) => setEditForm({...editForm, yearsResident: e.target.value})}
											className="bg-background border-border text-foreground h-11"
										/>
									</div>
									)}

									{hasField('orNumber') && (
									<div className="space-y-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">OR #</Label>
										<Input 
											value={editForm.orNumber}
											onChange={(e) => setEditForm({...editForm, orNumber: e.target.value})}
											className="bg-background border-border text-foreground h-11"
										/>
									</div>
									)}

									{hasField('commTaxNo') && (
									<div className="space-y-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Comm. Tax No.</Label>
										<Input 
											value={editForm.commTaxNo}
											onChange={(e) => setEditForm({...editForm, commTaxNo: e.target.value})}
											className="bg-background border-border text-foreground h-11"
										/>
									</div>
									)}

									{hasField('witness') && (
									<div className="space-y-2 col-span-2">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Witness Name</Label>
										<Input 
											value={editForm.witness}
											onChange={(e) => setEditForm({...editForm, witness: e.target.value})}
											className="bg-background border-border text-foreground h-11"
										/>
									</div>
									)}

									{hasField('dateIssued') && (
									<div className="space-y-2 col-span-2 flex flex-col justify-end">
										<Label className="text-sm font-medium text-foreground/80 mb-1">Date Issued</Label>
										<Popover>
											<PopoverTrigger asChild>
												<Button
													variant="outline"
													className={cn(
														"bg-background border-border text-foreground h-11 w-full justify-start text-left font-normal",
														!editForm.dateIssued && "text-muted-foreground"
													)}
												>
													<CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
													{editForm.dateIssued ? format(parseISO(editForm.dateIssued), "MMM d, yyyy") : <span>Pick a date</span>}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0 bg-background border-border" align="start">
												<CalendarComponent
													mode="single"
													selected={editForm.dateIssued ? parseISO(editForm.dateIssued) : undefined}
													onSelect={(date) => {
														if (date) {
															const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
															setEditForm({ ...editForm, dateIssued: localDate.toISOString().split("T")[0] });
														}
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>
									)}
								</div>
							</div>

							<div className="space-y-3 mt-4">
								<div className="flex gap-3">
									<Button 
										variant="secondary"
										className="flex-1 rounded-xl text-sm font-semibold transition-all h-11"
										onClick={handlePrintSingle}
										disabled={isProcessing}
									>
										{isPrinting ? <Loader2 className="w-5 h-5 mr-2 shrink-0 animate-spin" /> : <Printer className="w-5 h-5 mr-2 shrink-0" />}
										{isPrinting ? "Printing" : (printedItems[activeItem.id] || activeItem.status === "Ready to Claim" || activeItem.status === "Completed") ? "Reprint" : "Print"}
									</Button>
									
									<Button 
										className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm text-sm font-semibold transition-all h-11"
										onClick={handleDownloadImage}
										disabled={isProcessing}
									>
										{isSaving ? <Loader2 className="w-5 h-5 mr-2 shrink-0 animate-spin" /> : <Download className="w-5 h-5 mr-2 shrink-0" />}
										{isSaving ? "Saving" : "Save PNG"}
									</Button>
								</div>

								<Button 
									className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-sm text-sm font-semibold transition-all group disabled:opacity-50 h-11"
									onClick={handleMarkBatchReady}
									disabled={isProcessing || !allPrinted}
								>
									<span className="relative flex items-center justify-center gap-2">
										{allPrinted 
											? (isSingleDocument ? "Mark Document Ready" : "Mark Entire Batch Ready") 
											: "Print all documents first"}
									</span>
								</Button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
