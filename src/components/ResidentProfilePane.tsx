import { Link } from "@tanstack/react-router";
import { format, parseISO, isValid } from "date-fns";
import {
	Calendar as CalendarIcon,
	Check,
	Edit2,
	FileText,
	GripHorizontal,
	Loader2,
	Phone,
	ShieldCheck,
	User,
	X,
	Home,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { Resident } from "#/routes/residents.tsx";
import { getUniquePuroks, updateResident } from "../lib/residents-service";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
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
	const [activeTab, setActiveTab] = useState<"profile" | "transactions">(
		"profile",
	);

	const [isEditing, setIsEditing] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [purokOptions, setPurokOptions] = useState<string[]>([]);

	const [formName, setFormName] = useState("");
	const [formBirthdate, setFormBirthdate] = useState("");
	const [formGender, setFormGender] = useState("");
	const [formContact, setFormContact] = useState("");
	const [formPurok, setFormPurok] = useState("");
	const [formHouseholdId, setFormHouseholdId] = useState("");
	const [formRelationship, setFormRelationship] = useState("");
	const [formIsPwd, setFormIsPwd] = useState(false);
	const [formPwdType, setFormPwdType] = useState("");
	const [formIsSenior, setFormIsSenior] = useState(false);
	const [formIsVoter, setFormIsVoter] = useState(false);
	const [formIsSingleParent, setFormIsSingleParent] = useState(false);

	useEffect(() => {
		if (resident) {
			setFormName(resident.fullName);
			setFormBirthdate(resident.birthDate || "");
			setFormGender(resident.gender || "");
			setFormContact(resident.contactNumber || "");
			setFormPurok(resident.purok);
			setFormHouseholdId(resident.householdId || "");
			setFormRelationship(resident.relationshipToHead || "Member");
			setFormIsPwd(resident.isPwd);
			setFormPwdType(resident.pwdType || "");
			setFormIsSenior(resident.isSeniorCitizen);
			setFormIsVoter(resident.isVoter);
			setFormIsSingleParent(resident.isSingleParent);
		}
	}, [resident, isEditing]);

	useEffect(() => {
		if (isEditing && purokOptions.length === 0) {
			getUniquePuroks()
				.then(setPurokOptions)
				.catch((err) => console.error("Failed to load puroks", err));
		}
	}, [isEditing, purokOptions.length]);

	if (!resident) return null;

	const handleSave = async () => {
		if (!resident) return;
		if (!formName || !formPurok) {
			toast.error("Name and Purok are required");
			return;
		}

		setIsSaving(true);
		try {
			const payload = {
				fullName: formName,
				birthDate: formBirthdate || null,
				gender: formGender || null,
				contactNumber: formContact || null,
				purok: formPurok,
				householdId: formHouseholdId || null,
				isHeadOfHousehold:
					formRelationship === "Head" || formRelationship === "Self",
				relationshipToHead: formRelationship,
				isPwd: formIsPwd,
				pwdType: formIsPwd ? formPwdType : null,
				isSeniorCitizen: formIsSenior,
				isVoter: formIsVoter,
				isSingleParent: formIsSingleParent,
			};
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

	// Placeholder data for transactions
	const transactions = [
		{
			id: 1,
			type: "document",
			title: "Requested Barangay Clearance",
			date: "Oct 24, 2026",
			status: "Completed",
			icon: <FileText className="h-4 w-4 text-blue-400" />,
		},
		{
			id: 2,
			type: "ayuda",
			title: "Received Typhoon Relief Pack",
			date: "Sep 15, 2026",
			status: "Claimed",
			icon: <ShieldCheck className="h-4 w-4 text-emerald-400" />,
		},
		{
			id: 3,
			type: "document",
			title: "Requested Certificate of Indigency",
			date: "Jul 02, 2026",
			status: "Completed",
			icon: <FileText className="h-4 w-4 text-blue-400" />,
		},
	];

	return (
		<Card className="flex flex-col bg-neutral-950/80 backdrop-blur-2xl border-white/10 shadow-2xl overflow-hidden rounded-2xl h-[calc(100vh-16rem)] lg:h-[calc(100vh-12rem)] p-0 gap-0 w-full transition-colors duration-300">
			<div className="relative z-10 flex flex-col h-full overflow-hidden">
				{/* Header Section */}
				<div
					className={`p-6 pb-0 space-y-5 shrink-0 border-b relative group transition-colors duration-300 ${
						isEditing
							? "bg-gradient-to-b from-blue-900/40 to-transparent border-blue-900/50"
							: "bg-gradient-to-b from-neutral-900/80 to-transparent border-neutral-800/60"
					}`}
				>
					{/* Drag Indicator Icon */}
					<div className="drag-handle cursor-move absolute top-0 left-0 right-0 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
						<GripHorizontal className="h-4 w-4 text-neutral-500" />
					</div>

					<div className="flex items-start justify-between">
						<div className="flex gap-4 items-center flex-1 pr-4">
							{/* Avatar Placeholder */}
							<div
								className={`h-16 w-16 rounded-2xl border shadow-inner flex items-center justify-center shrink-0 transition-colors ${
									isEditing
										? "bg-gradient-to-br from-blue-900 to-neutral-900 border-blue-500/30 text-blue-400"
										: "bg-gradient-to-br from-neutral-800 to-neutral-900 border-white/10 text-neutral-400"
								}`}
							>
								<User className="h-7 w-7" />
							</div>
							<div className="space-y-1.5 flex-1 min-w-0">
								{isEditing ? (
									<Input
										value={formName}
										onChange={(e) => setFormName(e.target.value)}
										className="bg-neutral-950/50 border-blue-500/50 text-neutral-100 text-lg font-bold h-9 -ml-2 w-full max-w-[200px]"
										placeholder="Full Name"
									/>
								) : (
									<h2 className="text-xl font-bold text-neutral-100 tracking-tight leading-none drop-shadow-md truncate">
										{resident.fullName}
									</h2>
								)}
								<div className="flex flex-wrap gap-1.5 pt-1">
									{resident.isHeadOfHousehold && (
										<Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
											Household Head
										</Badge>
									)}
									{resident.isSeniorCitizen && (
										<Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20">
											Senior
										</Badge>
									)}
									{resident.isPwd && (
										<Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 hover:bg-purple-500/20">
											PWD
										</Badge>
									)}
									{resident.isSingleParent && (
										<Badge className="bg-pink-500/10 text-pink-400 border-pink-500/20 hover:bg-pink-500/20">
											Solo Parent
										</Badge>
									)}
									{resident.isVoter && (
										<Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20">
											Voter
										</Badge>
									)}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-1.5 no-drag shrink-0">
							{isEditing ? (
								<>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													handleSave();
												}}
												disabled={isSaving}
												className="h-8 w-8 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-400/20 rounded-full transition-colors bg-emerald-500/10"
											>
												{isSaving ? (
													<Loader2 className="h-4 w-4 animate-spin" />
												) : (
													<Check className="h-4 w-4" />
												)}
											</Button>
										</TooltipTrigger>
										<TooltipContent className="bg-neutral-800 text-neutral-100 border-neutral-700">
											<p>Save Changes</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													setIsEditing(false);
												}}
												disabled={isSaving}
												className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
											>
												<X className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent className="bg-neutral-800 text-neutral-100 border-neutral-700">
											<p>Cancel Edit</p>
										</TooltipContent>
									</Tooltip>
								</>
							) : (
								<>
									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													setIsEditing(true);
												}}
												className="h-8 w-8 text-neutral-400 hover:text-blue-400 hover:bg-blue-400/10 rounded-full transition-colors"
											>
												<Edit2 className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent className="bg-neutral-800 text-neutral-100 border-neutral-700">
											<p>Edit Resident</p>
										</TooltipContent>
									</Tooltip>

									<Tooltip>
										<TooltipTrigger asChild>
											<Button
												variant="ghost"
												size="icon"
												onClick={(e) => {
													e.stopPropagation();
													onClose();
												}}
												className="h-8 w-8 text-neutral-400 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
											>
												<X className="h-4 w-4" />
											</Button>
										</TooltipTrigger>
										<TooltipContent className="bg-neutral-800 text-neutral-100 border-neutral-700">
											<p>Close Profile</p>
										</TooltipContent>
									</Tooltip>
								</>
							)}
						</div>
					</div>

					{/* Custom Tabs */}
					<div className="flex gap-4 border-b border-neutral-800/60 pt-4 no-drag relative">
						<button
							type="button"
							onClick={() => setActiveTab("profile")}
							className={`pb-3 text-sm font-medium border-b-2 transition-all ${
								activeTab === "profile"
									? "border-emerald-500 text-emerald-400"
									: "border-transparent text-neutral-500 hover:text-neutral-300"
							}`}
						>
							Profile Details
						</button>
						<button
							type="button"
							onClick={() => setActiveTab("transactions")}
							className={`pb-3 text-sm font-medium border-b-2 transition-all flex items-center gap-2 ${
								activeTab === "transactions"
									? "border-blue-500 text-blue-400"
									: "border-transparent text-neutral-500 hover:text-neutral-300"
							}`}
						>
							Transactions
							<span
								className={`text-[10px] px-1.5 py-0.5 rounded-full ${
									activeTab === "transactions"
										? "bg-blue-500/20 text-blue-400"
										: "bg-neutral-800 text-neutral-400"
								}`}
							>
								3
							</span>
						</button>
					</div>
				</div>

				<ScrollArea className="flex-1 min-h-0 px-6 no-drag">
					<div className="py-6 space-y-6 pb-10">
						{activeTab === "profile" ? (
							<>
								{/* Demographics Card */}
								<div className="space-y-3">
									<h3 className="text-[13px] font-medium text-neutral-400 flex items-center gap-2">
										Demographics
									</h3>
									<Card
										className={`shadow-none transition-colors duration-300 ${isEditing ? "bg-neutral-950 border-blue-900/30" : "bg-neutral-900/50 border-neutral-800/60"}`}
									>
										<CardContent className="p-1">
											{/* Age / DOB */}
											<div className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-900/50 transition-colors">
												<div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
													<CalendarIcon className="h-4 w-4" />
												</div>
												<div className="flex-1 min-w-0 space-y-1">
													<p className="text-[11px] font-medium text-neutral-500">
														Age & Date of Birth
													</p>
													{isEditing ? (
														<Popover>
															<PopoverTrigger asChild>
																<Button
																	variant={"outline"}
																	className={`w-full justify-start text-left font-normal bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm ${!formBirthdate ? "text-neutral-500" : ""}`}
																>
																	<CalendarIcon className="mr-2 h-4 w-4" />
																	{formBirthdate ? (
																		format(parseISO(formBirthdate), "PPP")
																	) : (
																		<span>Pick a date</span>
																	)}
																</Button>
															</PopoverTrigger>
															<PopoverContent className="w-auto p-0 bg-neutral-900 border-neutral-800 text-neutral-100" align="start">
																<CalendarComponent
																	mode="single"
																	captionLayout="dropdown"
																	startMonth={new Date(1900, 0)}
																	endMonth={new Date()}
																	selected={formBirthdate && isValid(parseISO(formBirthdate)) ? parseISO(formBirthdate) : undefined}
																	onSelect={(date) => setFormBirthdate(date ? format(date, "yyyy-MM-dd") : "")}
																	className="bg-neutral-900 text-neutral-100"
																/>
															</PopoverContent>
														</Popover>
													) : (
														<p className="text-sm font-semibold text-neutral-200 truncate">
															{resident.birthDate
																? `${
																		new Date().getFullYear() -
																		new Date(resident.birthDate).getFullYear()
																	} yrs old `
																: "Age unknown"}
															<span className="text-neutral-500 font-normal text-xs ml-1">
																{resident.birthDate
																	? `(${new Date(resident.birthDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })})`
																	: ""}
															</span>
														</p>
													)}
												</div>
											</div>

											{/* Gender */}
											<div className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-900/50 transition-colors">
												<div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
													<User className="h-4 w-4" />
												</div>
												<div className="flex-1 min-w-0 space-y-1">
													<p className="text-[11px] font-medium text-neutral-500">
														Gender
													</p>
													{isEditing ? (
														<Select
															value={formGender}
															onValueChange={setFormGender}
														>
															<SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm">
																<SelectValue placeholder="Select Gender" />
															</SelectTrigger>
															<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
																<SelectItem value="Male">Male</SelectItem>
																<SelectItem value="Female">Female</SelectItem>
																<SelectItem value="Other">Other</SelectItem>
															</SelectContent>
														</Select>
													) : (
														<p className="text-sm font-semibold text-neutral-200 truncate">
															{resident.gender || "Not specified"}
														</p>
													)}
												</div>
											</div>

											{/* Contact */}
											<div className="flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-900/50 transition-colors">
												<div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
													<Phone className="h-4 w-4" />
												</div>
												<div className="flex-1 min-w-0 space-y-1">
													<p className="text-[11px] font-medium text-neutral-500">
														Contact Number
													</p>
													{isEditing ? (
														<Input
															value={formContact}
															onChange={(e) => setFormContact(e.target.value)}
															className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm"
															placeholder="0917XXXXXXX"
														/>
													) : (
														<p className="text-sm font-semibold text-neutral-200 truncate">
															{resident.contactNumber || "No contact number"}
														</p>
													)}
												</div>
											</div>
										</CardContent>
									</Card>
								</div>

								{/* Household Card */}
								<div className="space-y-3">
									<h3 className="text-[13px] font-medium text-neutral-400">
										Household
									</h3>
									<Card
										className={`shadow-none transition-colors duration-300 ${isEditing ? "bg-neutral-950 border-blue-900/30" : "bg-neutral-900/50 border-neutral-800/60"}`}
									>
										<CardContent className="p-3 space-y-3">
											<div className="grid grid-cols-2 gap-2">
												<div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/40 space-y-1">
													<p className="text-[11px] font-medium text-neutral-500 mb-1">
														Blk/Lot ID
													</p>
													{isEditing ? (
														<Input
															value={formHouseholdId}
															onChange={(e) =>
																setFormHouseholdId(e.target.value)
															}
															className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm"
															placeholder="e.g. hh-12"
														/>
													) : (
														<p className="text-sm font-semibold text-neutral-200 truncate">
															{resident.householdId || "Unassigned"}
														</p>
													)}
												</div>
												<div className="bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/40 space-y-1">
													<p className="text-[11px] font-medium text-neutral-500 mb-1">
														Purok
													</p>
													{isEditing ? (
														<Select
															value={formPurok}
															onValueChange={setFormPurok}
														>
															<SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm">
																<SelectValue placeholder="Select Purok" />
															</SelectTrigger>
															<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200 max-h-48">
																{purokOptions.map((p) => (
																	<SelectItem key={p} value={p}>
																		{p}
																	</SelectItem>
																))}
																{purokOptions.length === 0 &&
																	[1, 2, 3, 4, 5, 6, 7].map((n) => (
																		<SelectItem
																			key={n}
																			value={`Purok ${n}`}
																		>
																			Purok {n}
																		</SelectItem>
																	))}
															</SelectContent>
														</Select>
													) : (
														<p className="text-sm font-semibold text-neutral-200 truncate">
															{resident.purok}
														</p>
													)}
												</div>
											</div>

											<div className="flex items-center justify-between bg-neutral-900/50 p-3 rounded-xl border border-neutral-800/40">
												<div className="flex-1">
													<p className="text-[11px] font-medium text-neutral-500 mb-1">
														Role in Family
													</p>
													{isEditing ? (
														<Select
															value={formRelationship}
															onValueChange={setFormRelationship}
														>
															<SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm w-full">
																<SelectValue placeholder="Role" />
															</SelectTrigger>
															<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
																<SelectItem value="Head">
																	Household Head
																</SelectItem>
																<SelectItem value="Self">Self</SelectItem>
																<SelectItem value="Spouse">Spouse</SelectItem>
																<SelectItem value="Child">Child</SelectItem>
																<SelectItem value="Parent">Parent</SelectItem>
																<SelectItem value="Sibling">Sibling</SelectItem>
																<SelectItem value="Other">Other</SelectItem>
															</SelectContent>
														</Select>
													) : (
														<div className="flex items-center gap-2">
															<span className="text-sm font-semibold text-neutral-200">
																{resident.isHeadOfHousehold
																	? "Household Head"
																	: resident.relationshipToHead || "Member"}
															</span>
														</div>
													)}
												</div>
												{!isEditing && resident.isHeadOfHousehold && (
													<ShieldCheck className="h-5 w-5 text-emerald-500 opacity-80 shrink-0 ml-3" />
												)}
											</div>

											{!hideFamilyTreeButton &&
												!isEditing &&
												(resident.householdId ? (
													<Button
														asChild
														variant="outline"
														className="w-full bg-neutral-900 border-neutral-800 hover:bg-neutral-800 hover:text-neutral-100 rounded-xl mt-2 h-10 font-medium cursor-pointer transition-colors"
													>
														<Link
															to="/households"
															search={{ householdId: resident.householdId }}
															className="flex items-center justify-center text-neutral-200 !text-neutral-200"
														>
															<Home className="h-4 w-4 mr-2 text-neutral-400" />
															View Full Family Tree
														</Link>
													</Button>
												) : (
													<Button
														disabled
														variant="secondary"
														className="w-full bg-neutral-800 text-neutral-500 rounded-xl mt-2 h-10 font-medium"
													>
														<Home className="h-4 w-4 mr-2 text-neutral-600" />
														No Household Assigned
													</Button>
												))}
										</CardContent>
									</Card>
								</div>

								{/* Special Tags / Flags - Editable */}
								{isEditing && (
									<div className="space-y-3 pb-6">
										<h3 className="text-[13px] font-medium text-neutral-400">
											Special Designations
										</h3>
										<Card className="bg-neutral-950 border-blue-900/30 shadow-none">
											<CardContent className="p-4 space-y-4">
												<div className="flex items-center justify-between">
													<Label className="text-sm text-neutral-300">
														Registered Voter
													</Label>
													<Switch
														checked={formIsVoter}
														onCheckedChange={setFormIsVoter}
													/>
												</div>
												<div className="flex items-center justify-between">
													<Label className="text-sm text-neutral-300">
														Senior Citizen
													</Label>
													<Switch
														checked={formIsSenior}
														onCheckedChange={setFormIsSenior}
													/>
												</div>
												<div className="flex items-center justify-between">
													<Label className="text-sm text-neutral-300">
														Single Parent
													</Label>
													<Switch
														checked={formIsSingleParent}
														onCheckedChange={setFormIsSingleParent}
													/>
												</div>
												<div className="space-y-3 pt-2 border-t border-neutral-800/50">
													<div className="flex items-center justify-between">
														<Label className="text-sm text-neutral-300">
															Person with Disability
														</Label>
														<Switch
															checked={formIsPwd}
															onCheckedChange={setFormIsPwd}
														/>
													</div>
													{formIsPwd && (
														<Input
															value={formPwdType}
															onChange={(e) => setFormPwdType(e.target.value)}
															placeholder="Specify disability type"
															className="bg-neutral-900 border-neutral-800 text-neutral-100 h-8 text-sm"
														/>
													)}
												</div>
											</CardContent>
										</Card>
									</div>
								)}
							</>
						) : (
							/* Transactions Tab */
							<div className="space-y-4">
								<div className="flex items-center justify-between">
									<h3 className="text-[13px] font-medium text-neutral-400">
										Recent Transactions
									</h3>
									<Button
										variant="ghost"
										size="sm"
										className="text-xs text-blue-400 hover:text-blue-300 h-7 px-2"
									>
										View All
									</Button>
								</div>

								<div className="space-y-3">
									{transactions.map((tx) => (
										<Card
											key={tx.id}
											className="bg-neutral-900/50 border-neutral-800/60 shadow-none"
										>
											<CardContent className="p-4 flex gap-4">
												<div className="mt-0.5 h-8 w-8 rounded-full bg-neutral-950 border border-neutral-800 flex items-center justify-center shrink-0">
													{tx.icon}
												</div>
												<div className="space-y-1 flex-1">
													<p className="text-sm font-medium text-neutral-200 leading-tight">
														{tx.title}
													</p>
													<div className="flex items-center justify-between pt-1">
														<span className="text-xs text-neutral-500">
															{tx.date}
														</span>
														<span className="text-[11px] font-medium text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded-md border border-neutral-800">
															{tx.status}
														</span>
													</div>
												</div>
											</CardContent>
										</Card>
									))}
								</div>
							</div>
						)}
					</div>
				</ScrollArea>
			</div>
		</Card>
	);
}
