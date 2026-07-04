import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Clock, Edit2, FileText, GripHorizontal, Home, Loader2, MapPin, User, X, Printer, Download } from "lucide-react";
import { getResidentTransactions } from "../lib/queue-service";
import { ResidentIdCard } from "./residents/resident-id-card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { useEffect, useState } from "react";
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
			<TabsList className="w-full grid grid-cols-4 bg-neutral-950 p-0 border-b border-neutral-800 rounded-none h-12 shrink-0 items-stretch">
				<TabsTrigger
					value="personal"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					Personal
				</TabsTrigger>
				<TabsTrigger
					value="health"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					Health & Status
				</TabsTrigger>
				<TabsTrigger
					value="economic"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					Household & Economic
				</TabsTrigger>
				<TabsTrigger
					value="history"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					History
				</TabsTrigger>
			</TabsList>

			<div className="flex-1 overflow-y-auto p-6">
				<TabsContent value="personal" className="m-0 space-y-6">
					<div className="grid grid-cols-2 gap-4">
						<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none col-span-2">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Basic Info
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div>
										<p className="text-[11px] text-neutral-500 mb-0.5">
											First Name
										</p>
										<p className="text-sm font-medium text-neutral-200">
											{resident.firstName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-neutral-500 mb-0.5">
											Last Name
										</p>
										<p className="text-sm font-medium text-neutral-200">
											{resident.lastName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-neutral-500 mb-0.5">
											Middle Name
										</p>
										<p className="text-sm font-medium text-neutral-200">
											{resident.middleName || "—"}
										</p>
									</div>
									<div>
										<p className="text-[11px] text-neutral-500 mb-0.5">
											Suffix
										</p>
										<p className="text-sm font-medium text-neutral-200">
											{resident.suffix || "—"}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Demographics
								</h3>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Birthdate
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.birthDate
											? format(parseISO(resident.birthDate), "MMMM d, yyyy")
											: "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Gender / Sex
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.gender || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Civil Status
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.civilStatus || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Religion
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.religion || "—"}
									</p>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Contact
								</h3>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Contact Number
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.contactNumber || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">Email</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.email || "—"}
									</p>
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				<TabsContent value="health" className="m-0 space-y-6">
					<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-neutral-400 mb-2">
								Health Indicators
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<div className="flex items-center gap-2">
									<Badge
										variant={resident.isBedBound ? "default" : "outline"}
										className={
											resident.isBedBound
												? "bg-red-500/20 text-red-400 border-red-500/30"
												: "text-neutral-500 border-neutral-800"
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
												: "text-neutral-500 border-neutral-800"
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
												? "bg-blue-500/20 text-blue-400 border-blue-500/30"
												: "text-neutral-500 border-neutral-800"
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
												: "text-neutral-500 border-neutral-800"
										}
									>
										Cancer
									</Badge>
								</div>
							</div>

							<div className="pt-2 border-t border-neutral-800/60 mt-2">
								<p className="text-[11px] text-neutral-500 mb-1">
									Debilitating Diseases
								</p>
								<p className="text-sm font-medium text-neutral-200 leading-relaxed">
									{resident.debilitatingDiseases || "None recorded"}
								</p>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-neutral-400 mb-2">
								Special Status
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<Badge
									variant={resident.isPwd ? "default" : "outline"}
									className={
										resident.isPwd
											? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									PWD {resident.pwdType ? `(${resident.pwdType})` : ""}
								</Badge>
								<Badge
									variant={resident.isSeniorCitizen ? "default" : "outline"}
									className={
										resident.isSeniorCitizen
											? "bg-teal-500/20 text-teal-400 border-teal-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Senior Citizen
								</Badge>
								<Badge
									variant={resident.isSingleParent ? "default" : "outline"}
									className={
										resident.isSingleParent
											? "bg-pink-500/20 text-pink-400 border-pink-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Single Parent
								</Badge>
								<Badge
									variant={resident.isIp ? "default" : "outline"}
									className={
										resident.isIp
											? "bg-orange-500/20 text-orange-400 border-orange-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Indigenous Person
								</Badge>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="economic" className="m-0 space-y-6">
					<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
						<CardContent className="p-4 space-y-3">
							<h3 className="text-sm font-semibold text-neutral-400 mb-2">
								Location & Household
							</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">Purok</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.purok}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Block & Lot
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.block || resident.lot
											? `Blk ${resident.block || "-"} Lot ${resident.lot || "-"}`
											: "—"}
									</p>
								</div>
								<div className="col-span-2">
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Relationship to Head
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.relationshipToHead || "—"}{" "}
										{resident.isHeadOfHousehold && (
											<span className="text-emerald-400 text-xs ml-1">
												(Head)
											</span>
										)}
									</p>
								</div>
							</div>

							{!hideFamilyTreeButton && resident.householdId && (
								<div className="pt-3 border-t border-neutral-800/60 mt-3">
									<Button
										asChild
										variant="outline"
										className="w-full bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-100 rounded-xl h-10 font-medium cursor-pointer transition-colors"
									>
										<Link
											to="/households"
											search={{ householdId: resident.householdId }}
											className="flex items-center justify-center text-neutral-200"
										>
											<Home className="h-4 w-4 mr-2 text-neutral-400" />
											View Full Family Tree
										</Link>
									</Button>
								</div>
							)}
						</CardContent>
					</Card>

					<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
						<CardContent className="p-4 space-y-3">
							<h3 className="text-sm font-semibold text-neutral-400 mb-2">
								Economic Status
							</h3>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Educational Attainment
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.educationalAttainment || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Employment Status
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.employmentStatus || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Occupation
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.occupation || "—"}
									</p>
								</div>
								<div>
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Monthly Income
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.monthlyIncome || "—"}
									</p>
								</div>
								<div className="col-span-2">
									<p className="text-[11px] text-neutral-500 mb-0.5">
										Source of Livelihood
									</p>
									<p className="text-sm font-medium text-neutral-200">
										{resident.sourceOfLivelihood || "—"}
									</p>
								</div>
							</div>
						</CardContent>
					</Card>

					<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none">
						<CardContent className="p-4 space-y-4">
							<h3 className="text-sm font-semibold text-neutral-400 mb-2">
								Other Statuses
							</h3>
							<div className="grid grid-cols-2 gap-y-4 gap-x-2">
								<Badge
									variant={resident.isResidentVoter ? "default" : "outline"}
									className={
										resident.isResidentVoter
											? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Resident Voter
								</Badge>
								<Badge
									variant={resident.isRegisteredVoter ? "default" : "outline"}
									className={
										resident.isRegisteredVoter
											? "bg-blue-500/20 text-blue-400 border-blue-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Registered Voter
								</Badge>
								<Badge
									variant={resident.isOfw ? "default" : "outline"}
									className={
										resident.isOfw
											? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									OFW
								</Badge>
								<Badge
									variant={resident.isOsy ? "default" : "outline"}
									className={
										resident.isOsy
											? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Out of School Youth
								</Badge>
								<Badge
									variant={resident.isMigrant ? "default" : "outline"}
									className={
										resident.isMigrant
											? "bg-slate-500/20 text-slate-400 border-slate-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									Migrant
								</Badge>
								<Badge
									variant={resident.isNationalPensioner ? "default" : "outline"}
									className={
										resident.isNationalPensioner
											? "bg-rose-500/20 text-rose-400 border-rose-500/30"
											: "text-neutral-500 border-neutral-800"
									}
								>
									National Pensioner
								</Badge>
								<Badge
									variant={resident.isLocalPensioner ? "default" : "outline"}
									className={
										resident.isLocalPensioner
											? "bg-rose-500/20 text-rose-400 border-rose-500/30"
											: "text-neutral-500 border-neutral-800"
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
			<TabsList className="w-full grid grid-cols-3 bg-neutral-950 p-0 border-b border-neutral-800 rounded-none h-12 shrink-0 items-stretch">
				<TabsTrigger
					value="personal"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
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
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					<span className="flex items-center justify-center gap-2">
						Health & Status
						{hasHealthErrors && (
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
						)}
					</span>
				</TabsTrigger>
				<TabsTrigger
					value="economic"
					className="rounded-none text-xs font-bold text-neutral-400 data-[state=active]:!bg-neutral-900 data-[state=active]:!text-emerald-400 border-r border-neutral-800 last:border-r-0 border-b border-neutral-800 data-[state=active]:border-b-neutral-900 border-t-2 border-t-transparent data-[state=active]:!border-t-emerald-500 hover:text-neutral-300 hover:bg-neutral-900/40 transition-all select-none cursor-pointer !h-full flex items-center justify-center shadow-none"
				>
					<span className="flex items-center justify-center gap-2">
						Household & Economic
						{hasEconomicErrors && (
							<span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shrink-0" />
						)}
					</span>
				</TabsTrigger>
			</TabsList>

			<div className="flex-1 overflow-y-auto p-6">
				<TabsContent value="personal" className="m-0 space-y-6">
					<div className="grid grid-cols-2 gap-4">
						<Card className="bg-neutral-950 border-neutral-800 shadow-none col-span-2">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Basic Info
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">First Name *</Label>
										<Input
											value={formData.firstName || ""}
											onChange={(e) => updateField("firstName", e.target.value)}
											className={cn(
												"bg-neutral-900 border-neutral-800 h-9 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
												errors.firstName &&
													"border-red-500 focus-visible:ring-red-500",
											)}
										/>
										{errors.firstName && (
											<p className="text-xs text-red-500 font-medium mt-1">{errors.firstName}</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Last Name *</Label>
										<Input
											value={formData.lastName || ""}
											onChange={(e) => updateField("lastName", e.target.value)}
											className={cn(
												"bg-neutral-900 border-neutral-800 h-9 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
												errors.lastName &&
													"border-red-500 focus-visible:ring-red-500",
											)}
										/>
										{errors.lastName && (
											<p className="text-xs text-red-500 font-medium mt-1">{errors.lastName}</p>
										)}
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Middle Name</Label>
										<Input
											value={formData.middleName || ""}
											onChange={(e) => updateField("middleName", e.target.value)}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Suffix</Label>
										<Input
											value={formData.suffix || ""}
											onChange={(e) => updateField("suffix", e.target.value)}
											placeholder="Jr, Sr, III"
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Demographics
								</h3>
								<div className="space-y-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Birthdate</Label>
										<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
											<PopoverTrigger asChild>
												<Button
													type="button"
													variant="outline"
													className="w-full justify-start text-left font-normal bg-neutral-900 border-neutral-800 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-100 h-9"
												>
													<CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
													{formData.birthDate ? (
														format(parseISO(formData.birthDate), "MMM d, yyyy")
													) : (
														<span>Pick a date</span>
													)}
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-200" align="start">
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
										<Label className="text-xs text-neutral-400">Gender</Label>
										<Select
											value={formData.gender || undefined}
											onValueChange={(val) => updateField("gender", val)}
										>
											<SelectTrigger className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200">
												<SelectValue placeholder="Select gender" />
											</SelectTrigger>
											<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
												<SelectItem value="Male">Male</SelectItem>
												<SelectItem value="Female">Female</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Civil Status</Label>
										<Select
											value={formData.civilStatus || undefined}
											onValueChange={(val) => updateField("civilStatus", val)}
										>
											<SelectTrigger className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
												<SelectItem value="Single">Single</SelectItem>
												<SelectItem value="Married">Married</SelectItem>
												<SelectItem value="Widowed">Widowed</SelectItem>
												<SelectItem value="Separated">Separated</SelectItem>
											</SelectContent>
										</Select>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Religion</Label>
										<Input
											value={formData.religion || ""}
											onChange={(e) => updateField("religion", e.target.value)}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-3">
								<h3 className="text-sm font-semibold text-neutral-400 mb-2">
									Contact
								</h3>
								<div className="space-y-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">
											Contact Number
										</Label>
										<Input
											value={formData.contactNumber || ""}
											onChange={(e) => updateField("contactNumber", e.target.value)}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">Email</Label>
										<Input
											value={formData.email || ""}
											onChange={(e) => updateField("email", e.target.value)}
											className={cn(
												"bg-neutral-900 border-neutral-800 h-9 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
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
						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-neutral-400">
									Health Flags
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">
											Bed Bound
										</Label>
										<Switch
											checked={formData.isBedBound}
											onCheckedChange={(val) => updateField("isBedBound", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
									<Label className="text-xs text-neutral-400">
										Debilitating Diseases
									</Label>
									<Input
										value={formData.debilitatingDiseases || ""}
										onChange={(e) =>
											updateField("debilitatingDiseases", e.target.value)
										}
										placeholder="e.g. Asthma, Hypertension"
										className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-neutral-400">
									Status Flags
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex flex-col space-y-2">
										<div className="flex items-center justify-between">
											<Label className="text-sm text-neutral-300">PWD</Label>
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
												className="bg-neutral-900 border-neutral-800 h-8 text-xs text-neutral-200"
											/>
										)}
									</div>
									<div className="flex items-center justify-between h-fit mt-1">
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-neutral-400">
									Location & Household
								</h3>
								<div className="space-y-4">
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">Purok *</Label>
											<Input
												list="purok-options"
												value={formData.purok || ""}
												onChange={(e) => {
													updateField("purok", e.target.value);
													if (formData.householdId && formData.householdId !== "NEW") {
														updateField("householdId", undefined);
													}
												}}
												placeholder="Select or type Purok..."
												className={cn("bg-neutral-900 border-neutral-800 h-9 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20", errors.purok && "border-red-500 focus-visible:ring-red-500")}
											/>
											<datalist id="purok-options">
												{purokOptions.map((p) => <option key={p} value={p} />)}
											</datalist>
											{errors.purok && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.purok}</p>
											)}
										</div>

										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
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
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-neutral-950/50 p-3 rounded-lg border border-neutral-800/80">
											<div className="space-y-1.5">
												<Label className="text-xs text-neutral-400">Block</Label>
												<Input
													value={formData.newHouseholdBlock || ""}
													onChange={(e) => updateField("newHouseholdBlock", e.target.value)}
													className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
												/>
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs text-neutral-400">Lot</Label>
												<Input
													value={formData.newHouseholdLot || ""}
													onChange={(e) => updateField("newHouseholdLot", e.target.value)}
													className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
												/>
											</div>
										</div>
									)}

									<div className="space-y-1.5 mt-4">
										<Label className="text-xs text-neutral-400">
											Relationship to Head
										</Label>
										<Select
											value={formData.relationshipToHead || undefined}
											onValueChange={(val) =>
												updateField("relationshipToHead", val)
											}
										>
											<SelectTrigger className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200">
												<SelectValue placeholder="Select relationship" />
											</SelectTrigger>
											<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
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

						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-neutral-400">
									Education & Work
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">
											Educational Attainment
										</Label>
										<Input
											value={formData.educationalAttainment || ""}
											onChange={(e) =>
												updateField("educationalAttainment", e.target.value)
											}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">
											Employment Status
										</Label>
										<Select
											value={formData.employmentStatus || ""}
											onValueChange={(val) =>
												updateField("employmentStatus", val)
											}
										>
											<SelectTrigger className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200">
												<SelectValue placeholder="Select status" />
											</SelectTrigger>
											<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
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
										<Label className="text-xs text-neutral-400">
											Occupation
										</Label>
										<Input
											value={formData.occupation || ""}
											onChange={(e) =>
												updateField("occupation", e.target.value)
											}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
									<div className="space-y-1.5">
										<Label className="text-xs text-neutral-400">
											Monthly Income
										</Label>
										<Input
											value={formData.monthlyIncome || ""}
											onChange={(e) =>
												updateField("monthlyIncome", e.target.value)
											}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
									<div className="col-span-2 space-y-1.5">
										<Label className="text-xs text-neutral-400">
											Source of Livelihood
										</Label>
										<Input
											value={formData.sourceOfLivelihood || ""}
											onChange={(e) =>
												updateField("sourceOfLivelihood", e.target.value)
											}
											className="bg-neutral-900 border-neutral-800 h-9 text-neutral-200"
										/>
									</div>
								</div>
							</CardContent>
						</Card>

						<Card className="bg-neutral-950 border-neutral-800 shadow-none">
							<CardContent className="p-4 space-y-4">
								<h3 className="text-sm font-semibold text-neutral-400">
									Other Statuses
								</h3>
								<div className="grid grid-cols-2 gap-4">
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">OFW</Label>
										<Switch
											checked={formData.isOfw}
											onCheckedChange={(val) => updateField("isOfw", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">OSY</Label>
										<Switch
											checked={formData.isOsy}
											onCheckedChange={(val) => updateField("isOsy", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">Migrant</Label>
										<Switch
											checked={formData.isMigrant}
											onCheckedChange={(val) => updateField("isMigrant", val)}
										/>
									</div>
									<div className="flex items-center justify-between">
										<Label className="text-sm text-neutral-300">
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
										<Label className="text-sm text-neutral-300">
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
			</div>
		</Tabs>
	);

	return (
		<>
		<Card className="flex flex-col bg-neutral-950/80 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden rounded-2xl h-[calc(100vh-16rem)] lg:h-[calc(100vh-12rem)] p-0 gap-0 w-full transition-all duration-300 pointer-events-auto">
			{/* Header */}
			<div
				className={cn(
					"p-6 pb-4 shrink-0 relative border-b group transition-colors duration-300",
					isEditing
						? "bg-gradient-to-b from-emerald-950/20 to-transparent border-emerald-500/20"
						: "bg-gradient-to-b from-neutral-900/60 to-transparent border-white/5"
				)}
			>
				{/* Drag Indicator Icon */}
				<div className="drag-handle cursor-move absolute top-0 left-0 right-0 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
					<GripHorizontal className="h-4 w-4 text-neutral-500" />
				</div>

				<div className="absolute top-4 right-4 flex items-center gap-1 no-drag">
					{!isEditing && (
						<>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setShowPreview(true)}
								className="h-8 w-8 text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
								title="Preview & Print ID Card"
							>
								<Printer className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								onClick={() => setIsEditing(true)}
								className="h-8 w-8 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
								title="Edit Profile"
							>
								<Edit2 className="h-4 w-4" />
							</Button>
						</>
					)}
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-all"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="flex items-start gap-4 mt-6">
					<div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 shadow-inner">
						<User className="h-8 w-8 text-emerald-400" />
					</div>
					<div className="pt-1 min-w-0 flex-1">
						{isEditing ? (
							<h2 className="text-lg font-bold text-neutral-100 mb-1">
								Edit Profile
							</h2>
						) : (
							<>
								<h2 className="text-xl font-bold text-neutral-100 leading-tight">
									{resident.fullName}
								</h2>
								<div className="flex items-center gap-2 mt-1.5 text-xs text-neutral-400">
									<Badge
										variant="outline"
										className="bg-neutral-900 border-neutral-800 text-neutral-300 font-normal px-2 py-0"
									>
										<span className="text-emerald-400/90 font-mono tracking-wider ml-1">
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
										<Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 px-2 py-0 text-[10px] rounded-full">
											Household Head
										</Badge>
									)}
									{resident.isSeniorCitizen && (
										<Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20 px-2 py-0 text-[10px] rounded-full">
											Senior
										</Badge>
									)}
									{resident.isPwd && (
										<Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20 px-2 py-0 text-[10px] rounded-full">
											PWD
										</Badge>
									)}
									{resident.isSingleParent && (
										<Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20 px-2 py-0 text-[10px] rounded-full">
											Solo Parent
										</Badge>
									)}
									{resident.isRegisteredVoter && (
										<Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20 px-2 py-0 text-[10px] rounded-full">
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
				<div className="p-4 border-t border-white/5 bg-neutral-950/80 backdrop-blur-md shrink-0 flex items-center justify-end gap-2">
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
						className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl"
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={isSaving}
						className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 rounded-xl"
					>
						{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
						Save Changes
					</Button>
				</div>
			)}
		</Card>

		{/* ID Preview Dialog */}
		<Dialog open={showPreview} onOpenChange={setShowPreview}>
			<DialogContent className="max-w-6xl w-fit bg-neutral-950 border-white/10 p-0 overflow-hidden shadow-2xl">
				<DialogHeader className="p-4 border-b border-white/5 bg-neutral-900/50 flex flex-row items-center justify-between">
					<DialogTitle className="text-2xl font-bold tracking-tight text-white/90 flex-1">
						ID Card Preview
					</DialogTitle>
					<div className="flex gap-2 mr-6 mt-0!">
						<Button 
							className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl"
							onClick={downloadID}
							disabled={isDownloading}
						>
							{isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
							Download PNG Image
						</Button>
					</div>
				</DialogHeader>
				
				<div className="p-8 bg-neutral-900/50 flex items-center justify-center overflow-auto min-h-[400px]">
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
	if (transactions.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 text-center">
				<div className="h-12 w-12 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-3">
					<FileText className="h-6 w-6 text-neutral-600" />
				</div>
				<p className="text-sm font-semibold text-neutral-400">No Records Yet</p>
				<p className="text-xs text-neutral-500 mt-1 max-w-[200px]">
					This resident has no document request history.
				</p>
			</div>
		);
	}

	// Group transactions by month
	const grouped: Record<string, any[]> = {};
	for (const tx of transactions) {
		const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
		const key = format(date, "MMMM yyyy");
		if (!grouped[key]) grouped[key] = [];
		grouped[key].push(tx);
	}

	const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
		"Ready to Claim": { dot: "bg-emerald-500 shadow-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Ready" },
		"Completed": { dot: "bg-emerald-500 shadow-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Completed" },
		"Released": { dot: "bg-emerald-500 shadow-emerald-500/40", badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", label: "Released" },
		"Processing": { dot: "bg-blue-500 shadow-blue-500/40", badge: "bg-blue-500/15 text-blue-400 border-blue-500/30", label: "Processing" },
		"Pending": { dot: "bg-amber-500 shadow-amber-500/40", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", label: "Pending" },
		"Cancelled": { dot: "bg-red-500 shadow-red-500/40", badge: "bg-red-500/15 text-red-400 border-red-500/30", label: "Cancelled" },
	};

	const getStatus = (status: string) =>
		statusConfig[status] || { dot: "bg-neutral-500", badge: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30", label: status };

	return (
		<div className="space-y-6">
			{Object.entries(grouped).map(([month, items]) => (
				<div key={month}>
					<div className="flex items-center gap-2 mb-4">
						<Clock className="h-3.5 w-3.5 text-neutral-500" />
						<span className="text-[11px] font-bold text-neutral-500 tracking-wider">
							{month}
						</span>
					</div>

					<div className="relative pl-6">
						{/* Vertical timeline line */}
						<div className="absolute left-[7px] top-2 bottom-2 w-px bg-gradient-to-b from-emerald-500/40 via-emerald-500/20 to-transparent" />

						<div className="space-y-4">
							{items.map((tx: any, idx: number) => {
								const config = getStatus(tx.status);
								const date = tx.createdAt ? new Date(tx.createdAt) : new Date();
								return (
									<div key={tx.id} className="relative group">
										{/* Timeline dot */}
										<div className={`absolute -left-6 top-3 h-3.5 w-3.5 rounded-full border-2 border-neutral-950 ${config.dot} shadow-lg`} />

										<Card className="bg-neutral-900/40 border-neutral-800/60 shadow-none hover:bg-neutral-900/60 transition-colors">
											<CardContent className="p-3.5">
												<div className="flex items-start justify-between gap-3">
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															<FileText className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
															<span className="text-sm font-semibold text-neutral-200 truncate">
																{tx.templateName || "Document"}
															</span>
														</div>
														{tx.purpose && (
															<p className="text-xs text-neutral-400 mt-1.5 ml-5.5 line-clamp-2">
																{tx.purpose}
															</p>
														)}
														<div className="flex items-center gap-3 mt-2 ml-5.5">
															<span className="text-[11px] text-neutral-500">
																{format(date, "MMM d, yyyy • h:mm a")}
															</span>
															{tx.totalPrice > 0 && (
																<span className="text-[11px] text-neutral-500">
																	₱{tx.totalPrice.toFixed(2)}
																</span>
															)}
															<span className="text-[11px] text-neutral-600">
																Q-{tx.queueNumber?.toString().padStart(4, "0")}
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
	);
}
