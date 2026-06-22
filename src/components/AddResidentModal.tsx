import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { addResident } from "../lib/residents-service";
import type { Resident } from "#/routes/residents.tsx";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { cn } from "#/lib/utils.ts";

export const residentSchema = z.object({
	firstName: z.string().min(1, "First Name is required"),
	lastName: z.string().min(1, "Last Name is required"),
	middleName: z.string().nullable().optional(),
	suffix: z.string().nullable().optional(),
	birthDate: z.string().nullable().optional(),
	gender: z.string().nullable().optional(),
	civilStatus: z.string().nullable().optional(),
	religion: z.string().nullable().optional(),
	contactNumber: z.string().nullable().optional(),
	email: z
		.string()
		.email("Invalid email format")
		.or(z.literal(""))
		.nullable()
		.optional(),
	purok: z.string().min(1, "Purok is required"),
	householdId: z.string().nullable().optional(),
	relationshipToHead: z.string().nullable().optional(),
	educationalAttainment: z.string().nullable().optional(),
	occupation: z.string().nullable().optional(),
	employmentStatus: z.string().nullable().optional(),
	monthlyIncome: z.string().nullable().optional(),
	sourceOfLivelihood: z.string().nullable().optional(),
	isPwd: z.boolean().optional(),
	pwdType: z.string().nullable().optional(),
	isSeniorCitizen: z.boolean().optional(),
	isResidentVoter: z.boolean().optional(),
	isRegisteredVoter: z.boolean().optional(),
	isSingleParent: z.boolean().optional(),
	isOfw: z.boolean().optional(),
	isOsy: z.boolean().optional(),
	isIp: z.boolean().optional(),
	isMigrant: z.boolean().optional(),
	isNationalPensioner: z.boolean().optional(),
	isLocalPensioner: z.boolean().optional(),
	debilitatingDiseases: z.string().nullable().optional(),
	isBedBound: z.boolean().optional(),
	isWheelchairBound: z.boolean().optional(),
	isDialysisPatient: z.boolean().optional(),
	isCancerPatient: z.boolean().optional(),
});

interface AddResidentModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess: (newResident: Resident) => void;
	initialHouseholdId?: string;
}

export function AddResidentModal({
	isOpen,
	onClose,
	onSuccess,
	initialHouseholdId,
}: AddResidentModalProps) {
	const [isSaving, setIsSaving] = useState(false);
	const [formData, setFormData] = useState<Partial<Resident>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});

	useEffect(() => {
		if (isOpen) {
			setFormData({
				firstName: "",
				lastName: "",
				purok: "",
				householdId: initialHouseholdId || "",
			});
			setErrors({});
		}
	}, [isOpen, initialHouseholdId]);

	const updateField = (key: keyof Resident, value: any) => {
		setFormData((prev) => ({ ...prev, [key]: value }));
		if (errors[key]) {
			setErrors((prev) => {
				const copy = { ...prev };
				delete copy[key];
				return copy;
			});
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setErrors({});

		const parseResult = residentSchema.safeParse(formData);
		if (!parseResult.success) {
			const newErrors: Record<string, string> = {};
			for (const issue of parseResult.error.issues) {
				const path = issue.path[0] as string;
				newErrors[path] = issue.message;
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

			const result = await addResident({ data: payload });
			if (result.success && result.resident) {
				toast.success("Resident added successfully!");
				onSuccess(result.resident as Resident);
			} else {
				toast.error(result.error || "Failed to add resident.");
			}
		} catch (err) {
			toast.error("An error occurred while saving.");
		} finally {
			setIsSaving(false);
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

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-3xl bg-neutral-900 border-neutral-800 text-neutral-100 p-0 sm:rounded-2xl overflow-hidden h-[85vh] flex flex-col gap-0">
				<DialogHeader className="px-6 py-4 border-b border-neutral-800 shrink-0">
					<DialogTitle className="text-xl font-bold text-neutral-100">
						Add New Resident Profile
					</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit}
					className="flex-1 overflow-hidden flex flex-col min-h-0"
				>
					<Tabs
						defaultValue="personal"
						className="w-full h-full flex flex-col min-h-0"
					>
						<TabsList className="w-full grid grid-cols-3 bg-neutral-950 !p-0 border-b border-neutral-800 !rounded-none !h-12 shrink-0 items-stretch">
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

						<div className="flex-1 overflow-y-auto p-6 min-h-0">
							<TabsContent value="personal" className="m-0 space-y-6">
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												First Name *
											</Label>
											<Input
												value={formData.firstName || ""}
												onChange={(e) =>
													updateField("firstName", e.target.value)
												}
												className={cn(
													"bg-neutral-950 border-neutral-800 h-10 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
													errors.firstName &&
														"border-rose-500/80 focus-visible:ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
												)}
											/>
											{errors.firstName && (
												<p className="text-sm text-rose-400 font-semibold mt-1.5">{errors.firstName}</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												Last Name *
											</Label>
											<Input
												value={formData.lastName || ""}
												onChange={(e) =>
													updateField("lastName", e.target.value)
												}
												className={cn(
													"bg-neutral-950 border-neutral-800 h-10 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
													errors.lastName &&
														"border-rose-500/80 focus-visible:ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
												)}
											/>
											{errors.lastName && (
												<p className="text-sm text-rose-400 font-semibold mt-1.5">{errors.lastName}</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												Middle Name
											</Label>
											<Input
												value={formData.middleName || ""}
												onChange={(e) =>
													updateField("middleName", e.target.value)
												}
												className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">Suffix</Label>
											<Input
												value={formData.suffix || ""}
												onChange={(e) => updateField("suffix", e.target.value)}
												placeholder="Jr, Sr, III"
												className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												Birthdate
											</Label>
											<Popover>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className="w-full justify-start text-left font-normal bg-neutral-950 border-neutral-800 text-neutral-200 hover:bg-neutral-800 hover:text-neutral-100 h-10"
													>
														<CalendarIcon className="mr-2 h-4 w-4 opacity-50" />
														{formData.birthDate ? (
															format(
																parseISO(formData.birthDate),
																"MMM d, yyyy",
															)
														) : (
															<span>Pick a date</span>
														)}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-200">
													<CalendarComponent
														mode="single"
														selected={
															formData.birthDate
																? parseISO(formData.birthDate)
																: undefined
														}
														onSelect={(date) =>
															updateField(
																"birthDate",
																date ? format(date, "yyyy-MM-dd") : "",
															)
														}
													/>
												</PopoverContent>
											</Popover>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">Gender</Label>
											<Select
												value={formData.gender || ""}
												onValueChange={(val) => updateField("gender", val)}
											>
												<SelectTrigger className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200">
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
												<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
													<SelectItem value="Male">Male</SelectItem>
													<SelectItem value="Female">Female</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												Civil Status
											</Label>
											<Select
												value={formData.civilStatus || ""}
												onValueChange={(val) => updateField("civilStatus", val)}
											>
												<SelectTrigger className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200">
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
											<Label className="text-xs text-neutral-400">
												Religion
											</Label>
											<Input
												value={formData.religion || ""}
												onChange={(e) =>
													updateField("religion", e.target.value)
												}
												className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">
												Contact Number
											</Label>
											<Input
												value={formData.contactNumber || ""}
												onChange={(e) =>
													updateField("contactNumber", e.target.value)
												}
												className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-neutral-400">Email</Label>
											<Input
												value={formData.email || ""}
												onChange={(e) => updateField("email", e.target.value)}
												className={cn(
													"bg-neutral-950 border-neutral-800 h-10 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
													errors.email &&
														"border-rose-500/80 focus-visible:ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
												)}
											/>
											{errors.email && (
												<p className="text-sm text-rose-400 font-semibold mt-1.5">{errors.email}</p>
											)}
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="health" className="m-0 space-y-6">
								<div className="grid grid-cols-2 gap-8">
									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-neutral-200 mb-2">
											Health Flags
										</h4>
										<div className="space-y-4 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/80">
											<div className="flex items-center justify-between">
												<Label className="text-sm text-neutral-300">
													Bed Bound
												</Label>
												<Switch
													checked={formData.isBedBound}
													onCheckedChange={(val) =>
														updateField("isBedBound", val)
													}
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
												className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
											/>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-neutral-200 mb-2">
											Special Status
										</h4>
										<div className="space-y-4 bg-neutral-950/50 p-4 rounded-xl border border-neutral-800/80">
											<div className="flex flex-col space-y-2">
												<div className="flex items-center justify-between">
													<Label className="text-sm text-neutral-300">
														PWD
													</Label>
													<Switch
														checked={formData.isPwd}
														onCheckedChange={(val) => updateField("isPwd", val)}
													/>
												</div>
												{formData.isPwd && (
													<Input
														value={formData.pwdType || ""}
														onChange={(e) =>
															updateField("pwdType", e.target.value)
														}
														placeholder="Disability Type"
														className="bg-neutral-900 border-neutral-800 h-8 text-xs text-neutral-200 mt-2"
													/>
												)}
											</div>
											<div className="flex items-center justify-between">
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
									</div>
								</div>
							</TabsContent>

							<TabsContent value="economic" className="m-0 space-y-6">
								<div className="space-y-6">
									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-neutral-200 mb-3">
											Location & Household
										</h4>
										<div className="grid grid-cols-2 gap-4">
											<div className="space-y-1.5">
												<Label className="text-xs text-neutral-400">
													Purok *
												</Label>
												<Input
													value={formData.purok || ""}
													onChange={(e) => updateField("purok", e.target.value)}
													placeholder="e.g. Purok 1"
													className={cn(
														"bg-neutral-950 border-neutral-800 h-10 text-neutral-200 transition-all duration-200 focus-visible:ring-emerald-500/20",
														errors.purok &&
															"border-rose-500/80 focus-visible:ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]",
													)}
												/>
												{errors.purok && (
													<p className="text-sm text-rose-400 font-semibold mt-1.5">{errors.purok}</p>
												)}
											</div>
											<div className="space-y-1.5">
												<Label className="text-xs text-neutral-400">
													Household ID
												</Label>
												<Input
													value={formData.householdId || ""}
													onChange={(e) =>
														updateField("householdId", e.target.value)
													}
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
												/>
											</div>
											<div className="col-span-2 space-y-1.5">
												<Label className="text-xs text-neutral-400">
													Relationship to Head
												</Label>
												<Input
													value={formData.relationshipToHead || ""}
													onChange={(e) =>
														updateField("relationshipToHead", e.target.value)
													}
													placeholder="Head, Spouse, Child, Member"
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
												/>
											</div>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-neutral-200 mb-3">
											Education & Work
										</h4>
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
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
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
													<SelectTrigger className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200">
														<SelectValue placeholder="Select status" />
													</SelectTrigger>
													<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
														<SelectItem value="Employed">Employed</SelectItem>
														<SelectItem value="Unemployed">
															Unemployed
														</SelectItem>
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
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
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
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
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
													className="bg-neutral-950 border-neutral-800 h-10 text-neutral-200"
												/>
											</div>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-neutral-300 uppercase tracking-wider">
											Other Statuses
										</h4>
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">
													Resident Voter
												</Label>
												<Switch
													checked={formData.isResidentVoter}
													onCheckedChange={(val) =>
														updateField("isResidentVoter", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">
													Registered Voter
												</Label>
												<Switch
													checked={formData.isRegisteredVoter}
													onCheckedChange={(val) =>
														updateField("isRegisteredVoter", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">OFW</Label>
												<Switch
													checked={formData.isOfw}
													onCheckedChange={(val) => updateField("isOfw", val)}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">OSY</Label>
												<Switch
													checked={formData.isOsy}
													onCheckedChange={(val) => updateField("isOsy", val)}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">
													Migrant
												</Label>
												<Switch
													checked={formData.isMigrant}
													onCheckedChange={(val) =>
														updateField("isMigrant", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">
													National Pensioner
												</Label>
												<Switch
													checked={formData.isNationalPensioner}
													onCheckedChange={(val) =>
														updateField("isNationalPensioner", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-neutral-950/50 p-2 rounded-lg border border-neutral-800/80">
												<Label className="text-xs text-neutral-300">
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
									</div>
								</div>
							</TabsContent>
						</div>
					</Tabs>

					<div className="p-4 border-t border-neutral-800 shrink-0 flex items-center justify-end gap-2 bg-neutral-950">
						<Button
							type="button"
							variant="ghost"
							onClick={onClose}
							className="text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
						>
							Cancel
						</Button>
						<Button
							type="submit"
							disabled={isSaving}
							className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20"
						>
							{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Resident
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
