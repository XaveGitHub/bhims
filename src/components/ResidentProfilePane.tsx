import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Clock, Edit2, FileText, GripHorizontal, Home, Loader2, MapPin, Package, User, X, Printer, Download } from "lucide-react";
import { getResidentTransactions } from "../lib/queue-service";
import { ResidentIdCard } from "./residents/resident-id-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import type { Resident } from "#/routes/residents.tsx";
import type { z } from "zod";
import { residentSchema } from "./AddResidentModal";
import { getUniquePuroks, updateResident } from "../lib/residents-service";
import { cn } from "../lib/utils";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { HouseholdCombobox } from "./HouseholdCombobox";
import { PurokCombobox } from "./PurokCombobox";
type ResidentInputForm = z.infer<typeof residentSchema>;

import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Calendar as CalendarComponent } from "./ui/calendar";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./ui/select";
import { Switch } from "./ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface ResidentProfilePaneProps {
	resident: Resident | null;
	onClose: () => void;
	hideFamilyTreeButton?: boolean;
	onUpdateComplete?: (updatedResident: Resident) => void;
}

export function ResidentProfilePane({
	resident,
	onClose,
	hideFamilyTreeButton = false,
	onUpdateComplete,
}: ResidentProfilePaneProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [purokOptions, setPurokOptions] = useState<string[]>([]);
	const [formData, setFormData] = useState<Partial<ResidentInputForm>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
	const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);

	useEffect(() => {
		if (resident) {
			setFormData({
				...resident,
				firstName: resident.firstName || "",
				lastName: resident.lastName || "",
				purok: resident.purok || "",
			});
			setErrors({});
			// Prefetch history
			getResidentTransactions({ data: { residentId: resident.id } })
				.then(setHistoryTransactions)
				.catch(() => setHistoryTransactions([]));
		}
	}, [resident, isEditing]);

	useEffect(() => {
		if (isEditing && purokOptions.length === 0) {
			getUniquePuroks()
				.then(setPurokOptions)
				.catch((err) => console.error("Failed to load puroks", err));
		}
	}, [isEditing, purokOptions.length]);

	// Close on Escape key (skip if editing to prevent accidental data loss)
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isEditing) {
				onClose();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [onClose, isEditing]);

	if (!resident) return null;

	const handleSave = async () => {
		if (!resident) return;
		setErrors({});

		const parseResult = residentSchema.safeParse(formData);
		if (!parseResult.success) {
			const newErrors: Record<string, string> = {};
			for (const issue of parseResult.error.issues) {
				const path = issue.path[0] as string;
				newErrors[path] = issue.message;
			}
			
			if (!formData.isNewHousehold && !formData.householdId) {
				newErrors.householdId = "Household is required";
			}
			if (formData.isNewHousehold && !formData.purok) {
				newErrors.purok = "Purok is required";
			}

			setErrors(newErrors);
			toast.error("Please fill in all required fields correctly.");
			return;
		}

		setIsSaving(true);
		try {
			const validatedData = parseResult.data;
			const computedFullName = [
				validatedData.firstName,
				validatedData.middleName,
				validatedData.lastName,
				validatedData.suffix,
			]
				.filter(Boolean)
				.join(" ");

			const payload = {
				...formData,
				...validatedData,
				fullName: computedFullName,
				isHeadOfHousehold:
					validatedData.relationshipToHead === "Head" ||
					validatedData.relationshipToHead === "Self",
				pwdType: validatedData.isPwd ? validatedData.pwdType : null,
			} as any;

			const result = await updateResident({
				data: {
					id: resident.id,
					data: payload,
				},
			});
			if (result.success) {
				toast.success("Profile updated successfully");
				setIsEditing(false);
				onUpdateComplete?.({ ...resident, ...payload } as Resident);
			}
		} catch (error) {
			toast.error("Failed to update profile");
		} finally {
			setIsSaving(false);
		}
	};

	const updateField = (key: keyof ResidentInputForm, value: any) => {
		setFormData((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) {
			setErrors((prev) => {
				const copy = { ...prev };
				delete copy[key];
				return copy;
			});
		}
	};

	const [isDownloading, setIsDownloading] = useState(false);
	const [showPreview, setShowPreview] = useState(false);

	const downloadID = async () => {
		try {
			setIsDownloading(true);
			const element = document.getElementById(`id-card-${resident.id}`);
			if (!element) return;
			
			const { toPng } = await import('html-to-image');
			const image = await toPng(element, { pixelRatio: 2 });
			
			const link = document.createElement('a');
			link.download = `ID_${resident.firstName}_${resident.lastName}.png`.replace(/\s+/g, '_');
			link.href = image;
			link.click();
			toast.success("ID Card downloaded successfully!");
		} catch (error) {
			console.error("Failed to generate ID:", error);
			toast.error("Failed to generate ID card image");
		} finally {
			setIsDownloading(false);
		}
	};

	const hasPersonalErrors = Object.keys(errors).some((key) =>
		[
			"firstName",
			"lastName",
			"middleName",
			"suffix",
			"birthDate",
			"gender",
			"civilStatus",
			"religion",
			"contactNumber",
			"email",
		].includes(key),
	);
	const hasHealthErrors = Object.keys(errors).some((key) =>
		["debilitatingDiseases", "pwdType"].includes(key),
	);
	const hasEconomicErrors = Object.keys(errors).some((key) =>
		[
			"purok",
			"householdId",
			"relationshipToHead",
			"educationalAttainment",
			"employmentStatus",
			"occupation",
			"monthlyIncome",
			"sourceOfLivelihood",
		].includes(key),
	);

	// ── VIEW MODE RENDERING ──
	const renderViewMode = () => (
		<Tabs defaultValue="personal" className="w-full h-full flex flex-col">
			<TabsList className="flex w-[calc(100%-3rem)] bg-card border border-border px-2 py-[26px] rounded-xl mx-6 mt-4 mb-0 shrink-0">
				<TabsTrigger
					value="personal"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all"
				>
					Personal
				</TabsTrigger>
				<TabsTrigger
					value="health"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all"
				>
					Health
				</TabsTrigger>
				<TabsTrigger
					value="economic"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all"
				>
					Household
				</TabsTrigger>
				<TabsTrigger
					value="history"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all"
				>
					History
				</TabsTrigger>
			</TabsList>

			<div className="flex-1 overflow-y-auto p-7">
				<TabsContent value="personal" className="m-0 space-y-6">
					<div className="grid grid-cols-2 gap-4">
						<Card className="bg-card/40 border-border/60 shadow-none col-span-2">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Basic Info
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-[11px] text-muted-foreground mb-0.5">
											First Name
										</p>
										<p className="text-sm font-medium text-foreground">
											{resident.firstName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-muted-foreground mb-0.5">
											Last Name
										</p>
										<p className="text-sm font-medium text-foreground">
											{resident.lastName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-muted-foreground mb-0.5">
											Middle Name
										</p>
										<p className="text-sm font-medium text-foreground">
											{resident.middleName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-muted-foreground mb-0.5">
											Suffix
										</p>
										<p className="text-sm font-medium text-foreground">
											{resident.suffix || "—"}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card/40 border-border/60 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Demographics
								</h3>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Birthdate
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.birthDate
											? format(parseISO(resident.birthDate), "MMMM d, yyyy")
											: "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Gender / Sex
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.gender || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Civil Status
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.civilStatus || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Religion
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.religion || "—"}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-card/40 border-border/60 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Contact
								</h3>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Contact Number
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.contactNumber || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">Email</p>
									<p className="text-sm font-medium text-foreground">
										{resident.email || "—"}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="health" className="m-0 space-y-6">
					<Card className="bg-card/40 border-border/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
								Health Indicators
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<div className="flex items-center gap-2">
									<Badge
										variant={resident.isBedBound ? "default" : "outline"}
										className={
											resident.isBedBound
												? "bg-red-500/20 text-red-400 border-red-500/30"
												: "text-muted-foreground border-border"
										}
									>
										Bed Bound
									</Badge>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={resident.isWheelchairBound ? "default" : "outline"}
										className={
											resident.isWheelchairBound
												? "bg-amber-500/20 text-amber-400 border-amber-500/30"
												: "text-muted-foreground border-border"
										}
									>
										Wheelchair
									</Badge>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={resident.isDialysisPatient ? "default" : "outline"}
										className={
											resident.isDialysisPatient
												? "bg-primary text-primary border-primary/20"
												: "text-muted-foreground border-border"
										}
									>
										Dialysis
									</Badge>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant={resident.isCancerPatient ? "default" : "outline"}
										className={
											resident.isCancerPatient
												? "bg-purple-500/20 text-purple-400 border-purple-500/30"
												: "text-muted-foreground border-border"
										}
									>
										Cancer
									</Badge>
								</div>
							</div>

							<div className="pt-2 mt-2">
								<p className="text-[11px] text-muted-foreground mb-1">
									Debilitating Diseases
								</p>
								<p className="text-sm font-medium text-foreground leading-relaxed">
									{resident.debilitatingDiseases || "None recorded"}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card/40 border-border/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
								Special Status
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<Badge
									variant={resident.isPwd ? "default" : "outline"}
									className={
										resident.isPwd
											? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
											: "text-muted-foreground border-border"
									}
								>
									PWD {resident.pwdType ? `(${resident.pwdType})` : ""}
								</Badge>
								<Badge
									variant={resident.isSeniorCitizen ? "default" : "outline"}
									className={
										resident.isSeniorCitizen
											? "bg-teal-500/20 text-teal-400 border-teal-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Senior Citizen
								</Badge>
								<Badge
									variant={resident.isSingleParent ? "default" : "outline"}
									className={
										resident.isSingleParent
											? "bg-pink-500/20 text-pink-400 border-pink-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Single Parent
								</Badge>
								<Badge
									variant={resident.isIp ? "default" : "outline"}
									className={
										resident.isIp
											? "bg-orange-500/20 text-orange-400 border-orange-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Indigenous Person
								</Badge>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="economic" className="m-0 space-y-6">
					<Card className="bg-card/40 border-border/60 shadow-none">
						<CardContent className="p-4 space-y-3">
							<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
								Location & Household
							</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">Purok</p>
									<p className="text-sm font-medium text-foreground">
										{resident.purok}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Block & Lot
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.block || resident.lot
											? `Blk ${resident.block || "-"} Lot ${resident.lot || "-"}`
											: "—"}
									</p>
								</div>
								<div className="col-span-2">
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Relationship to Head
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.relationshipToHead || "—"}{" "}
										{resident.isHeadOfHousehold && (
											<span className="text-primary text-xs ml-1">
												(Head)
											</span>
										)}
									</p>
								</div>
							</div>

							{!hideFamilyTreeButton && resident.householdId && (
								<div className="pt-2 mt-2">
									<Button
										asChild
										variant="outline"
										className="w-full bg-card border-border hover:bg-muted hover:text-foreground rounded-xl h-10 font-medium cursor-pointer transition-colors"
									>
										<Link
											to="/households"
											search={{ householdId: resident.householdId }}
											className="flex items-center justify-center text-foreground"
										>
											<Home className="h-4 w-4 mr-2 text-muted-foreground" />
											View Full Family Tree
										</Link>
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="bg-card/40 border-border/60 shadow-none">
						<CardContent className="p-4 space-y-3">
							<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
								Economic Status
							</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Educational Attainment
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.educationalAttainment || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Employment Status
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.employmentStatus || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Occupation
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.occupation || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Monthly Income
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.monthlyIncome || "—"}
									</p>
								</div>
								<div className="col-span-2">
									<p className="text-[11px] text-muted-foreground mb-0.5">
										Source of Livelihood
									</p>
									<p className="text-sm font-medium text-foreground">
										{resident.sourceOfLivelihood || "—"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-card/40 border-border/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
								Other Statuses
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<Badge
									variant={resident.isResidentVoter ? "default" : "outline"}
									className={
										resident.isResidentVoter
											? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Resident Voter
								</Badge>
								<Badge
									variant={resident.isRegisteredVoter ? "default" : "outline"}
									className={
										resident.isRegisteredVoter
											? "bg-primary text-primary border-primary/20"
											: "text-muted-foreground border-border"
									}
								>
									Registered Voter
								</Badge>
								<Badge
									variant={resident.isOfw ? "default" : "outline"}
									className={
										resident.isOfw
											? "bg-primary text-primary border-primary/20"
											: "text-muted-foreground border-border"
									}
								>
									OFW
								</Badge>
								<Badge
									variant={resident.isOsy ? "default" : "outline"}
									className={
										resident.isOsy
											? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Out of School Youth
								</Badge>
								<Badge
									variant={resident.isMigrant ? "default" : "outline"}
									className={
										resident.isMigrant
											? "bg-slate-500/20 text-slate-400 border-slate-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Migrant
								</Badge>
								<Badge
									variant={resident.isNationalPensioner ? "default" : "outline"}
									className={
										resident.isNationalPensioner
											? "bg-rose-500/20 text-rose-400 border-rose-500/30"
											: "text-muted-foreground border-border"
									}
								>
									National Pensioner
								</Badge>
								<Badge
									variant={resident.isLocalPensioner ? "default" : "outline"}
									className={
										resident.isLocalPensioner
											? "bg-rose-500/20 text-rose-400 border-rose-500/30"
											: "text-muted-foreground border-border"
									}
								>
									Local Pensioner
								</Badge>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="history" className="m-0">
					<ResidentHistoryTimeline transactions={historyTransactions} />
				</TabsContent>
			</div>
		</Tabs>
	);

	// ── EDIT MODE RENDERING ──
	const renderEditMode = () => (
		<Tabs defaultValue="personal" className="w-full h-full flex flex-col">
			<TabsList className="flex w-[calc(100%-3rem)] bg-card border border-border shadow-sm px-2 py-[26px] rounded-xl mx-6 mt-4 mb-0 shrink-0">
				<TabsTrigger
					value="personal"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground data-[state=active]:!shadow-md transition-all"
				>
					<span className="flex items-center justify-center gap-2">
						Personal
						{hasPersonalErrors && (
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
						)}
					</span>
				</TabsTrigger>
				<TabsTrigger
					value="health"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground data-[state=active]:!shadow-md transition-all"
				>
					<span className="flex items-center justify-center gap-2">
						Health
						{hasHealthErrors && (
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
						)}
					</span>
				</TabsTrigger>
				<TabsTrigger
					value="economic"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground data-[state=active]:!shadow-md transition-all"
				>
					<span className="flex items-center justify-center gap-2">
						Household
						{hasEconomicErrors && (
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
						)}
					</span>
				</TabsTrigger>
				<TabsTrigger
					value="history"
					className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground data-[state=active]:!shadow-md transition-all"
				>
					History
				</TabsTrigger>
			</TabsList>

			<div className="flex-1 overflow-y-auto p-6">
				<TabsContent value="personal" className="m-0 space-y-6">
					<div className="grid grid-cols-2 gap-4">
						<Card className="bg-background border-border shadow-none col-span-2">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Basic Info
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">First Name *</Label>
										<Input
											value={formData.firstName || ""}
											onChange={(e) => updateField("firstName", e.target.value)}
											className={cn(
												"bg-card border-border h-9 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
												errors.firstName &&
													"border-red-500 focus-visible:ring-red-500",
											)}
										/>
										{errors.firstName && (
											<p className="text-xs text-red-500 font-medium mt-1">{errors.firstName}</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Last Name *</Label>
										<Input
											value={formData.lastName || ""}
											onChange={(e) => updateField("lastName", e.target.value)}
											className={cn(
												"bg-card border-border h-9 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
												errors.lastName &&
													"border-red-500 focus-visible:ring-red-500",
											)}
										/>
										{errors.lastName && (
											<p className="text-xs text-red-500 font-medium mt-1">{errors.lastName}</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Middle Name</Label>
										<Input
											value={formData.middleName || ""}
											onChange={(e) => updateField("middleName", e.target.value)}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Suffix</Label>
										<Input
											value={formData.suffix || ""}
											onChange={(e) => updateField("suffix", e.target.value)}
											placeholder="Jr, Sr, III"
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Demographics
								</h3>
								<div className="space-y-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Birthdate</Label>
										<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
											<PopoverTrigger asChild>
												<Button
													type="button"
													variant="outline"
													className="w-full justify-start text-left font-normal bg-card border-border text-foreground hover:bg-muted hover:text-foreground h-9"
												>
													<CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
													{formData.birthDate ? (
														format(parseISO(formData.birthDate), "MMM d, yyyy")
													) : (
														<span>Pick a date</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0 bg-card border-border text-foreground" align="start">
												<CalendarComponent
													mode="single"
													selected={
														formData.birthDate
															? parseISO(formData.birthDate)
															: undefined
													}
													defaultMonth={
														formData.birthDate
															? parseISO(formData.birthDate)
															: undefined
													}
													captionLayout="dropdown"
													startMonth={new Date(1900, 0)}
													endMonth={new Date()}
													onSelect={(date) => {
														updateField(
															"birthDate",
															date ? format(date, "yyyy-MM-dd") : "",
														);
														setIsDatePopoverOpen(false);
													}}
												/>
											</PopoverContent>
										</Popover>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Gender</Label>
										<Select
											value={formData.gender || undefined}
											onValueChange={(val) => updateField("gender", val)}
										>
											<SelectTrigger className="bg-card border-border h-9 text-foreground">
												<SelectValue placeholder="Select gender" />
											</SelectTrigger>
											<SelectContent className="bg-card border-border text-foreground">
												<SelectItem value="Male">Male</SelectItem>
												<SelectItem value="Female">Female</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Civil Status</Label>
										<Select
											value={formData.civilStatus || undefined}
											onValueChange={(val) => updateField("civilStatus", val)}
										>
											<SelectTrigger className="bg-card border-border h-9 text-foreground">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent className="bg-card border-border text-foreground">
												<SelectItem value="Single">Single</SelectItem>
												<SelectItem value="Married">Married</SelectItem>
												<SelectItem value="Widowed">Widowed</SelectItem>
												<SelectItem value="Separated">Separated</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Religion</Label>
										<Input
											value={formData.religion || ""}
											onChange={(e) => updateField("religion", e.target.value)}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Contact
								</h3>
								<div className="space-y-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Contact Number
										</Label>
										<Input
											value={formData.contactNumber || ""}
											onChange={(e) => updateField("contactNumber", e.target.value)}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">Email</Label>
										<Input
											value={formData.email || ""}
											onChange={(e) => updateField("email", e.target.value)}
											className={cn(
												"bg-card border-border h-9 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
												errors.email &&
													"border-red-500 focus-visible:ring-red-500",
											)}
										/>
										{errors.email && (
											<p className="text-xs text-red-500 font-medium mt-1">{errors.email}</p>
										)}
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="health" className="m-0 space-y-6">
					<div className="grid gap-6">
						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Health Flags
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Bed Bound
										</Label>
										<Switch
											checked={formData.isBedBound}
											onCheckedChange={(val) => updateField("isBedBound", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Wheelchair Bound
										</Label>
										<Switch
											checked={formData.isWheelchairBound}
											onCheckedChange={(val) =>
												updateField("isWheelchairBound", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Dialysis Patient
										</Label>
										<Switch
											checked={formData.isDialysisPatient}
											onCheckedChange={(val) =>
												updateField("isDialysisPatient", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Cancer Patient
										</Label>
										<Switch
											checked={formData.isCancerPatient}
											onCheckedChange={(val) =>
												updateField("isCancerPatient", val)
											}
										/>
									</div>
								</div>
								<div className="space-y-1.5 pt-2">
									<Label className="text-xs text-muted-foreground">
										Debilitating Diseases
									</Label>
									<Input
										value={formData.debilitatingDiseases || ""}
										onChange={(e) =>
											updateField("debilitatingDiseases", e.target.value)
										}
										placeholder="e.g. Asthma, Hypertension"
										className="bg-card border-border h-9 text-foreground"
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Status Flags
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex flex-col space-y-2">
										<div className="flex items-center justify-between">
											<Label className="text-sm text-foreground/80">PWD</Label>
											<Switch
												checked={formData.isPwd}
												onCheckedChange={(val) => updateField("isPwd", val)}
											/>
										</div>
										{formData.isPwd && (
											<Input
												value={formData.pwdType || ""}
												onChange={(e) => updateField("pwdType", e.target.value)}
												placeholder="Disability Type"
												className="bg-card border-border h-8 text-xs text-foreground"
											/>
										)}
									</div>
									<div className="flex items-center justify-between h-fit mt-1">
										<Label className="text-sm text-foreground/80">
											Senior Citizen
										</Label>
										<Switch
											checked={formData.isSeniorCitizen}
											onCheckedChange={(val) =>
												updateField("isSeniorCitizen", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Single Parent
										</Label>
										<Switch
											checked={formData.isSingleParent}
											onCheckedChange={(val) =>
												updateField("isSingleParent", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Indigenous Person
										</Label>
										<Switch
											checked={formData.isIp}
											onCheckedChange={(val) => updateField("isIp", val)}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="economic" className="m-0 space-y-6">
					<div className="grid gap-6">
						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Location & Household
								</h3>
								<div className="space-y-4">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">Purok *</Label>
											<PurokCombobox
												value={formData.purok || ""}
												onChange={(val) => {
													updateField("purok", val);
													if (formData.householdId && formData.householdId !== "NEW") {
														updateField("householdId", undefined);
													}
												}}
												options={purokOptions}
												placeholder="Select or type Purok..."
												error={!!errors.purok}
												className="bg-card border-border h-9"
											/>
											{errors.purok && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.purok}</p>
											)}
										</div>

										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Household *
											</Label>
											<HouseholdCombobox
												purok={formData.purok || ""}
												value={formData.isNewHousehold ? "NEW" : (formData.householdId || undefined)}
												onChange={(val) => {
													if (val === "NEW") {
														updateField("isNewHousehold", true);
														updateField("householdId", undefined);
													} else {
														updateField("isNewHousehold", false);
														updateField("householdId", val);
													}
												}}
												error={!!errors.householdId}
											/>
											{errors.householdId && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.householdId}</p>
											)}
										</div>
									</div>
									
									{formData.isNewHousehold && (
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-background/50 p-3 rounded-lg border border-border/80">
											<div className="space-y-1.5">
												<Label className="text-xs text-muted-foreground">Block</Label>
												<Input
													value={formData.newHouseholdBlock || ""}
													onChange={(e) => updateField("newHouseholdBlock", e.target.value)}
													className="bg-card border-border h-9 text-foreground"
												/>
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs text-muted-foreground">Lot</Label>
												<Input
													value={formData.newHouseholdLot || ""}
													onChange={(e) => updateField("newHouseholdLot", e.target.value)}
													className="bg-card border-border h-9 text-foreground"
												/>
											</div>
										</div>
									)}

									<div className="space-y-1.5 mt-4">
										<Label className="text-xs text-muted-foreground">
											Relationship to Head
										</Label>
										<Select
											value={formData.relationshipToHead || undefined}
											onValueChange={(val) =>
												updateField("relationshipToHead", val)
											}
										>
											<SelectTrigger className="bg-card border-border h-9 text-foreground">
												<SelectValue placeholder="Select relationship" />
											</SelectTrigger>
											<SelectContent className="bg-card border-border text-foreground">
												<SelectItem value="Head">Head</SelectItem>
												<SelectItem value="Spouse">Spouse</SelectItem>
												<SelectItem value="Son">Son</SelectItem>
												<SelectItem value="Daughter">Daughter</SelectItem>
												<SelectItem value="Parent">Parent</SelectItem>
												<SelectItem value="Sibling">Sibling</SelectItem>
												<SelectItem value="Grandchild">Grandchild</SelectItem>
												<SelectItem value="Relative">Relative</SelectItem>
												<SelectItem value="Other">Other</SelectItem>
											</SelectContent>
										</Select>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Education & Work
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Educational Attainment
										</Label>
										<Input
											value={formData.educationalAttainment || ""}
											onChange={(e) =>
												updateField("educationalAttainment", e.target.value)
											}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Employment Status
										</Label>
										<Select
											value={formData.employmentStatus || ""}
											onValueChange={(val) =>
												updateField("employmentStatus", val)
											}
										>
											<SelectTrigger className="bg-card border-border h-9 text-foreground">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent className="bg-card border-border text-foreground">
												<SelectItem value="Employed">Employed</SelectItem>
												<SelectItem value="Unemployed">Unemployed</SelectItem>
												<SelectItem value="Self-Employed">
													Self-Employed
												</SelectItem>
												<SelectItem value="Student">Student</SelectItem>
												<SelectItem value="Retired">Retired</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Occupation
										</Label>
										<Input
											value={formData.occupation || ""}
											onChange={(e) =>
												updateField("occupation", e.target.value)
											}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Monthly Income
										</Label>
										<Input
											value={formData.monthlyIncome || ""}
											onChange={(e) =>
												updateField("monthlyIncome", e.target.value)
											}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
									<div className="col-span-2 space-y-1.5">
										<Label className="text-xs text-muted-foreground">
											Source of Livelihood
										</Label>
										<Input
											value={formData.sourceOfLivelihood || ""}
											onChange={(e) =>
												updateField("sourceOfLivelihood", e.target.value)
											}
											className="bg-card border-border h-9 text-foreground"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-background border-border shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-foreground/80 tracking-wide mb-3 flex items-center gap-2">
									Other Statuses
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Resident Voter
										</Label>
										<Switch
											checked={formData.isResidentVoter}
											onCheckedChange={(val) =>
												updateField("isResidentVoter", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Registered Voter
										</Label>
										<Switch
											checked={formData.isRegisteredVoter}
											onCheckedChange={(val) =>
												updateField("isRegisteredVoter", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">OFW</Label>
										<Switch
											checked={formData.isOfw}
											onCheckedChange={(val) => updateField("isOfw", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">OSY</Label>
										<Switch
											checked={formData.isOsy}
											onCheckedChange={(val) => updateField("isOsy", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">Migrant</Label>
										<Switch
											checked={formData.isMigrant}
											onCheckedChange={(val) => updateField("isMigrant", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											National Pensioner
										</Label>
										<Switch
											checked={formData.isNationalPensioner}
											onCheckedChange={(val) =>
												updateField("isNationalPensioner", val)
											}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-foreground/80">
											Local Pensioner
										</Label>
										<Switch
											checked={formData.isLocalPensioner}
											onCheckedChange={(val) =>
												updateField("isLocalPensioner", val)
											}
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>
				<TabsContent value="history" className="m-0">
					<ResidentHistoryTimeline transactions={historyTransactions} />
				</TabsContent>
			</div>
		</Tabs>
	);

	return (
		<>
		<Card className="flex flex-col bg-card border-border shadow-lg overflow-hidden rounded-xl h-[calc(100vh-16rem)] lg:h-[calc(100vh-12rem)] p-0 gap-0 w-full transition-all duration-300 pointer-events-auto">
			{/* Header */}
			<div
				className={cn(
					"p-6 pb-4 shrink-0 relative border-b group transition-colors duration-300",
					isEditing
						? "bg-background border-primary/20"
						: "bg-background border-border"
				)}
			>
				{/* Drag Indicator Icon */}
				<div className="drag-handle cursor-move absolute top-0 left-0 right-0 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<GripHorizontal className="h-4 w-4 text-muted-foreground" />
				</div>

				<div className="absolute top-4 right-4 flex items-center gap-1 no-drag">
					{!isEditing && (
						<>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setShowPreview(true)}
								className="text-muted-foreground hover:!text-primary hover:!bg-primary/15 rounded-full transition-all"
								title="Preview & Print ID Card"
							>
								<Printer className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								onClick={() => setIsEditing(true)}
								className="text-muted-foreground hover:!text-primary hover:!bg-primary/15 rounded-full transition-all"
								title="Edit Profile"
							>
								<Edit2 className="h-4 w-4" />
							</Button>
						</>
					)}
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onClose}
						className="text-muted-foreground hover:!text-red-600 hover:!bg-red-100 rounded-full transition-all"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-start gap-4 mt-6">
					<div className="h-16 w-16 rounded-2xl bg-background border border-primary/20 flex items-center justify-center shrink-0 shadow-inner">
						<User className="h-8 w-8 text-primary" />
					</div>
					<div className="pt-1 min-w-0 flex-1">
						{isEditing ? (
							<h2 className="text-lg font-bold text-foreground mb-1">
								Edit Profile
							</h2>
						) : (
							<>
								<h2 className="text-xl font-bold text-foreground leading-tight">
									{resident.fullName}
								</h2>
								<div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
									<Badge
										variant="outline"
										className="bg-card border-border text-foreground/80 font-normal px-2 py-0"
									>
										<span className="text-primary font-mono tracking-wider ml-1">
											ID: {resident.residentId || resident.id.toString().padStart(4, "0")}
										</span>
									</Badge>
									<span className="flex items-center">
										<MapPin className="h-3 w-3 mr-1 opacity-70" />
										{resident.purok}
									</span>
								</div>
								<div className="flex flex-wrap gap-1 mt-2">
									{resident.isHeadOfHousehold && (
										<Badge className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 px-2 py-0 text-[10px] rounded-full">
											Household Head
										</Badge>
									)}
									{resident.isSeniorCitizen && (
										<Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 px-2 py-0 text-[10px] rounded-full">
											Senior
										</Badge>
									)}
									{resident.isPwd && (
										<Badge className="bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200 px-2 py-0 text-[10px] rounded-full">
											PWD
										</Badge>
									)}
									{resident.isSingleParent && (
										<Badge className="bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200 px-2 py-0 text-[10px] rounded-full">
											Solo Parent
										</Badge>
									)}
									{resident.isRegisteredVoter && (
										<Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal bg-cyan-100 text-cyan-700 border-cyan-200 hover:bg-cyan-200">
											Voter
										</Badge>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			{/* Main Scrollable Content */}
			<div className="flex-1 overflow-hidden">
				{isEditing ? renderEditMode() : renderViewMode()}
			</div>

			{/* Footer Action */}
			{isEditing && (
				<div className="p-4 border-t border-border bg-background/80 backdrop-blur-md shrink-0 flex items-center justify-end gap-2">
					<Button
						variant="ghost"
						onClick={() => {
							setIsEditing(false);
							setFormData({
								...resident,
								firstName: resident.firstName || "",
								lastName: resident.lastName || "",
								purok: resident.purok || "",
							});
						}}
						className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={isSaving}
						className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 rounded-xl"
					>
						{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Save Changes
					</Button>
				</div>
			)}
		</Card>

		{/* ID Preview Dialog */}
		<Dialog open={showPreview} onOpenChange={setShowPreview}>
			<DialogContent className="max-w-6xl w-fit bg-background border-border p-0 overflow-hidden shadow-2xl">
				<DialogHeader className="p-4 border-b border-border bg-card/50 flex flex-row items-center justify-between">
					<DialogTitle className="text-2xl font-bold tracking-tight text-foreground/90 flex-1">
						ID Card Preview
					</DialogTitle>
					<div className="flex gap-2 mr-10 mt-0!">
						<Button 
							className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
							onClick={downloadID}
							disabled={isDownloading}
						>
							{isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
							Download PNG Image
						</Button>
					</div>
				</DialogHeader>
				
				<div className="p-8 bg-card/50 flex items-center justify-center overflow-auto min-h-[400px]">
					{/* The actual ID card element to be rendered and captured */}
					<div className="relative shadow-2xl rounded-sm overflow-hidden" style={{ width: 1012, height: 318 }}>
						<ResidentIdCard resident={resident} />
					</div>
				</div>
			</DialogContent>
		</Dialog>

		</>
	);
}

// ── HISTORY TIMELINE SUB-COMPONENT ──
function ResidentHistoryTimeline({ transactions }: { transactions: any[] }) {
	const [filter, setFilter] = useState<"all" | "document" | "ayuda">("all");

	const filteredTransactions = useMemo(() => {
		if (filter === "all") return transactions;
		return transactions.filter(t => t.type === filter);
	}, [transactions, filter]);

	if (filteredTransactions.length === 0) {
		return (
			<div className="flex flex-col h-full w-full">
				<div className="px-6 pt-0 shrink-0 flex justify-end">
					<Select value={filter} onValueChange={(v: "all" | "document" | "ayuda") => setFilter(v)}>
						<SelectTrigger className="bg-card/50 border-border h-9 text-foreground w-48">
							<SelectValue placeholder="Filter records" />
						</SelectTrigger>
						<SelectContent className="bg-card border-border text-foreground">
							<SelectItem value="all">All Records</SelectItem>
							<SelectItem value="document">Documents</SelectItem>
							<SelectItem value="ayuda">Ayuda</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="flex flex-col items-center justify-center flex-1 py-16 text-center min-h-[250px]">
					<div className="h-12 w-12 rounded-2xl bg-card border border-border flex items-center justify-center mb-3">
						<FileText className="h-6 w-6 text-muted-foreground" />
					</div>
					<p className="text-sm font-semibold text-muted-foreground">No Records Yet</p>
					<p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
						There are no records matching the selected filter.
					</p>
				</div>
			</div>
		);
	}

	// Group transactions by month
	const grouped: Record<string, any[]> = {};
	for (const tx of filteredTransactions) {
		const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
		const key = format(date, "MMMM yyyy");
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(tx);
	}

	const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
		"Ready to Claim": { dot: "bg-emerald-500 shadow-emerald-500/20", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Ready" },
		"Completed": { dot: "bg-emerald-500 shadow-emerald-500/20", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Completed" },
		"Released": { dot: "bg-emerald-500 shadow-emerald-500/20", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Released" },
		"Processing": { dot: "bg-primary shadow-primary/20", badge: "bg-primary/10 text-primary border-primary/20", label: "Processing" },
		"Pending": { dot: "bg-amber-500 shadow-amber-500/40", badge: "bg-amber-100 text-amber-700 border-amber-200", label: "Pending" },
		"Cancelled": { dot: "bg-red-500 shadow-red-500/40", badge: "bg-red-100 text-red-700 border-red-200", label: "Cancelled" },
		"Claimed": { dot: "bg-emerald-500 shadow-emerald-500/40", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", label: "Claimed" },
		"Unclaimed": { dot: "bg-red-500 shadow-red-500/40", badge: "bg-red-100 text-red-700 border-red-200", label: "Unclaimed" },
	};

	const getStatus = (status: string) =>
		statusConfig[status] || { dot: "bg-accent", badge: "bg-accent/15 text-muted-foreground border-neutral-500/30", label: status };

	return (
		<div className="flex flex-col h-full w-full">
			<div className="px-6 pt-0 pb-0 shrink-0 flex justify-end">
				<Select value={filter} onValueChange={(v: "all" | "document" | "ayuda") => setFilter(v)}>
					<SelectTrigger className="bg-card/50 border-border h-9 text-foreground w-48">
						<SelectValue placeholder="Filter records" />
					</SelectTrigger>
					<SelectContent className="bg-card border-border text-foreground">
						<SelectItem value="all">All Records</SelectItem>
						<SelectItem value="document">Documents</SelectItem>
						<SelectItem value="ayuda">Ayuda</SelectItem>
					</SelectContent>
				</Select>
			</div>
			<div className="flex-1 overflow-y-auto p-6 space-y-6">
			{Object.entries(grouped).map(([month, items]) => (
				<div key={month}>
					<div className="flex items-center gap-2 mb-4">
						<Clock className="h-3.5 w-3.5 text-muted-foreground" />
						<span className="text-[11px] font-bold text-muted-foreground tracking-wider">
							{month}
						</span>
					</div>

					<div className="relative pl-6">
						{/* Vertical timeline line */}
						<div className="absolute left-[7px] top-2 bottom-2 w-px bg-background" />

						<div className="space-y-4">
							{items.map((tx: any) => {
								const config = getStatus(tx.status);
								const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
								return (
									<div key={tx.id} className="relative group">
										{/* Timeline dot */}
										<div className={`absolute -left-6 top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-neutral-950 ${config.dot} shadow-lg`} />

										<Card className="bg-card/40 border-border/60 shadow-none hover:bg-surface-strong transition-colors">
											<CardContent className="p-3.5">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															{tx.type === "ayuda" ? (
																<Package className="h-3.5 w-3.5 text-purple-400 shrink-0" />
															) : (
																<FileText className="h-3.5 w-3.5 text-primary shrink-0" />
															)}
															<span className={cn("text-sm font-semibold truncate", tx.type === "ayuda" ? "text-purple-300" : "text-foreground")}>
																{tx.templateName || (tx.type === "ayuda" ? "Ayuda Distribution" : "Document")}
															</span>
														</div>
														{tx.purpose && (
															<p className="text-xs text-muted-foreground mt-1.5 ml-5 line-clamp-2">
																{tx.purpose}
															</p>
														)}
														<div className="flex items-center gap-3 mt-2 ml-5">
															<span className="text-[11px] text-muted-foreground">
																{format(date, "MMM d, yyyy   h:mm a")}
															</span>
															{tx.totalPrice > 0 && (
																<span className="text-[11px] text-muted-foreground">
																	• ₱{tx.totalPrice.toFixed(2)}
																</span>
															)}
															<span className="text-[11px] text-muted-foreground font-mono">
																TRX-{tx.id?.toString().padStart(5, "0")}
															</span>
														</div>
													</div>
													<Badge
														variant="outline"
														className={`${config.badge} text-[10px] font-bold px-2 py-0.5 shrink-0 rounded-full`}
													>
														{config.label}
													</Badge>
												</div>
											</CardContent>
										</Card>
									</div>
								);
							})}
						</div>
					</div>
				</div>
			))}
			</div>
		</div>
	);
}
