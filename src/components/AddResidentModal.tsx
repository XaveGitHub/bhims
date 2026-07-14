import { format, parseISO } from "date-fns";
import { Calendar as CalendarIcon, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { addResident, getUniquePuroks } from "../lib/residents-service";
import { cn } from "../lib/utils";
import type { Resident } from "#/routes/residents.tsx";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { HouseholdCombobox } from "./HouseholdCombobox";
import { PurokCombobox } from "./PurokCombobox";
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
	isNewHousehold: z.boolean().optional(),
	newHouseholdBlock: z.string().nullable().optional(),
	newHouseholdLot: z.string().nullable().optional(),
});

type ResidentInputForm = z.infer<typeof residentSchema>;

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
	const [purokOptions, setPurokOptions] = useState<string[]>([]);
	const [formData, setFormData] = useState<Partial<ResidentInputForm>>({});
	const [errors, setErrors] = useState<Record<string, string>>({});
	const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);

	useEffect(() => {
		if (isOpen) {
			setFormData({
				firstName: "",
				lastName: "",
				purok: "",
				householdId: initialHouseholdId || "",
			});
			setErrors({});

			if (purokOptions.length === 0) {
				getUniquePuroks()
					.then(setPurokOptions)
					.catch((err) => console.error("Failed to load puroks", err));
			}
		}
	}, [isOpen, initialHouseholdId, purokOptions.length]);

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

			const result = await addResident({ data: payload });
			if (result.success && result.resident) {
				toast.success("Resident added successfully!");
				onSuccess(result.resident as unknown as Resident);
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
			<DialogContent className="max-w-3xl bg-background border-border/60 shadow-2xl text-foreground p-0 sm:rounded-2xl overflow-hidden h-[85vh] flex flex-col gap-0">
				<DialogHeader className="px-6 py-5 shrink-0">
					<DialogTitle className="text-xl font-bold tracking-tight text-foreground">
						Add New Resident Profile
					</DialogTitle>
				</DialogHeader>

				<form
					onSubmit={handleSubmit}
					className="flex-1 overflow-hidden flex flex-col min-h-0"
				>
					<Tabs
						defaultValue="personal"
						className="w-full flex-1 flex flex-col min-h-0 overflow-hidden"
					>
						<TabsList className="flex w-[calc(100%-3rem)] bg-card border border-border px-2 py-[26px] rounded-xl mx-6 mt-2 mb-0 shrink-0">
							<TabsTrigger value="personal" className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all">
								<span className="flex items-center justify-center gap-2">
									Personal
									{hasPersonalErrors && (
										<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
									)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="health" className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all">
								<span className="flex items-center justify-center gap-2">
									Health & Status
									{hasHealthErrors && (
										<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
									)}
								</span>
							</TabsTrigger>
							<TabsTrigger value="economic" className="!h-10 flex-1 rounded-lg !border-none !shadow-none font-medium text-muted-foreground hover:bg-accent hover:text-primary data-[state=active]:!bg-primary data-[state=active]:hover:!bg-primary/90 data-[state=active]:!text-primary-foreground transition-all">
								<span className="flex items-center justify-center gap-2">
									Household & Economic
									{hasEconomicErrors && (
										<span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0" />
									)}
								</span>
							</TabsTrigger>
						</TabsList>

						<div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 min-h-0">
							<TabsContent value="personal" className="m-0 space-y-6 bg-card/30 p-6 rounded-xl border border-border shadow-inner">
								<div className="space-y-4">
									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												First Name *
											</Label>
											<Input
												value={formData.firstName || ""}
												onChange={(e) =>
													updateField("firstName", e.target.value)
												}
												className={cn(
													"bg-background border-border h-10 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
													errors.firstName &&
														"border-red-500 focus-visible:ring-red-500",
												)}
											/>
											{errors.firstName && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.firstName}</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Last Name *
											</Label>
											<Input
												value={formData.lastName || ""}
												onChange={(e) =>
													updateField("lastName", e.target.value)
												}
												className={cn(
													"bg-background border-border h-10 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
													errors.lastName &&
														"border-red-500 focus-visible:ring-red-500",
												)}
											/>
											{errors.lastName && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.lastName}</p>
											)}
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Middle Name
											</Label>
											<Input
												value={formData.middleName || ""}
												onChange={(e) =>
													updateField("middleName", e.target.value)
												}
												className="bg-background border-border h-10 text-foreground"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">Suffix</Label>
											<Input
												value={formData.suffix || ""}
												onChange={(e) => updateField("suffix", e.target.value)}
												placeholder="Jr, Sr, III"
												className="bg-background border-border h-10 text-foreground"
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Birthdate
											</Label>
											<Popover open={isDatePopoverOpen} onOpenChange={setIsDatePopoverOpen}>
												<PopoverTrigger asChild>
													<Button
														type="button"
														variant="outline"
														className={cn(
															"w-full justify-start text-left font-normal bg-background border-border text-foreground h-10",
															!formData.birthDate &&
																"text-muted-foreground",
														)}
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
												<SelectTrigger className="bg-card border-border h-10 text-foreground rounded-xl">
													<SelectValue placeholder="Select gender" />
												</SelectTrigger>
												<SelectContent className="bg-card border-border text-foreground">
													<SelectItem value="Male">Male</SelectItem>
													<SelectItem value="Female">Female</SelectItem>
												</SelectContent>
											</Select>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Civil Status
											</Label>
											<Select
												value={formData.civilStatus || undefined}
												onValueChange={(val) => updateField("civilStatus", val)}
											>
												<SelectTrigger className="bg-card border-border h-10 text-foreground rounded-xl">
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
											<Label className="text-xs text-muted-foreground">
												Religion
											</Label>
											<Input
												value={formData.religion || ""}
												onChange={(e) =>
													updateField("religion", e.target.value)
												}
												className="bg-background border-border h-10 text-foreground"
											/>
										</div>
									</div>

									<div className="grid grid-cols-2 gap-4">
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">
												Contact Number
											</Label>
											<Input
												value={formData.contactNumber || ""}
												onChange={(e) =>
													updateField("contactNumber", e.target.value)
												}
												className="bg-background border-border h-10 text-foreground"
											/>
										</div>
										<div className="space-y-1.5">
											<Label className="text-xs text-muted-foreground">Email</Label>
											<Input
												value={formData.email || ""}
												onChange={(e) => updateField("email", e.target.value)}
												className={cn(
													"bg-background border-border h-10 text-foreground transition-all duration-200 focus-visible:ring-primary/50",
													errors.email &&
														"border-red-500 focus-visible:ring-red-500",
												)}
											/>
											{errors.email && (
												<p className="text-xs text-red-500 font-medium mt-1">{errors.email}</p>
											)}
										</div>
									</div>
								</div>
							</TabsContent>

							<TabsContent value="health" className="m-0 space-y-6 bg-card/30 p-6 rounded-xl border border-border shadow-inner">
								<div className="grid grid-cols-2 gap-8">
									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-foreground mb-2">
											Health Flags
										</h4>
										<div className="space-y-4 bg-background/50 p-4 rounded-xl border border-border/80">
											<div className="flex items-center justify-between">
												<Label className="text-sm text-foreground/80">
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
												className="bg-background border-border h-10 text-foreground"
											/>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-foreground mb-2">
											Special Status
										</h4>
										<div className="space-y-4 bg-background/50 p-4 rounded-xl border border-border/80">
											<div className="flex flex-col space-y-2">
												<div className="flex items-center justify-between">
													<Label className="text-sm text-foreground/80">
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
														className="bg-card border-border h-8 text-xs text-foreground mt-2"
													/>
												)}
											</div>
											<div className="flex items-center justify-between">
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
									</div>
								</div>
							</TabsContent>

							<TabsContent value="economic" className="m-0 space-y-6 bg-card/30 p-6 rounded-xl border border-border shadow-inner">
								<div className="space-y-6">
									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-foreground mb-3">
											Location & Household
										</h4>
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
														className="bg-background border-border h-10"
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
														className="h-10 bg-background"
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
															className="bg-background border-border h-10 text-foreground"
														/>
													</div>
													<div className="space-y-1.5">
														<Label className="text-xs text-muted-foreground">Lot</Label>
														<Input
															value={formData.newHouseholdLot || ""}
															onChange={(e) => updateField("newHouseholdLot", e.target.value)}
															className="bg-background border-border h-10 text-foreground"
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
													<SelectTrigger className="bg-card border-border h-10 text-foreground rounded-xl">
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
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-foreground mb-3">
											Education & Work
										</h4>
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
													className="bg-background border-border h-10 text-foreground"
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
													<SelectTrigger className="bg-card border-border h-10 text-foreground rounded-xl">
														<SelectValue placeholder="Select status" />
													</SelectTrigger>
													<SelectContent className="bg-card border-border text-foreground">
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
												<Label className="text-xs text-muted-foreground">
													Occupation
												</Label>
												<Input
													value={formData.occupation || ""}
													onChange={(e) =>
														updateField("occupation", e.target.value)
													}
													className="bg-background border-border h-10 text-foreground"
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
													className="bg-background border-border h-10 text-foreground"
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
													className="bg-background border-border h-10 text-foreground"
												/>
											</div>
										</div>
									</div>

									<div className="space-y-4">
										<h4 className="text-sm font-semibold text-foreground mb-3">
											Other Statuses
										</h4>
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">
													Resident Voter
												</Label>
												<Switch
													checked={formData.isResidentVoter}
													onCheckedChange={(val) =>
														updateField("isResidentVoter", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">
													Registered Voter
												</Label>
												<Switch
													checked={formData.isRegisteredVoter}
													onCheckedChange={(val) =>
														updateField("isRegisteredVoter", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">OFW</Label>
												<Switch
													checked={formData.isOfw}
													onCheckedChange={(val) => updateField("isOfw", val)}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">OSY</Label>
												<Switch
													checked={formData.isOsy}
													onCheckedChange={(val) => updateField("isOsy", val)}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">
													Migrant
												</Label>
												<Switch
													checked={formData.isMigrant}
													onCheckedChange={(val) =>
														updateField("isMigrant", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">
													National Pensioner
												</Label>
												<Switch
													checked={formData.isNationalPensioner}
													onCheckedChange={(val) =>
														updateField("isNationalPensioner", val)
													}
												/>
											</div>
											<div className="flex items-center justify-between bg-background/50 p-2 rounded-lg border border-border/80">
												<Label className="text-xs text-foreground/80">
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

					<div className="px-6 py-4 border-t border-border/60 bg-card/40 flex justify-between items-center shrink-0">
						<div className="text-sm font-medium text-muted-foreground">
							Complete all required fields (*)
						</div>
						<div className="flex gap-3">
							<Button
								type="button"
								variant="ghost"
								onClick={onClose}
								className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={isSaving}
								className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 shadow-sm"
							>
								{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
								Save Resident
							</Button>
						</div>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
