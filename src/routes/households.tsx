import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	ChevronRight,
	Edit2,
	Home,
	Network,
	Search,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import Draggable from "react-draggable";
import { toast } from "sonner";
import { ResidentProfilePane } from "../components/ResidentProfilePane";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import {
	getHouseholdDetails,
	getHouseholds,
	type HouseholdDetail,
	type HouseholdMember,
	type HouseholdSummary,
	updateHouseholdDetails,
} from "../lib/households-service";
import { getUniquePuroks } from "../lib/residents-service";
import type { Resident } from "./residents";
import { invalidateResidentsCache } from "./residents";

export const Route = createFileRoute("/households")({
	validateSearch: (search: Record<string, unknown>) => {
		return {
			householdId: search.householdId as string | undefined,
		};
	},
	component: HouseholdsView,
});

let cachedHouseholdsList: HouseholdSummary[] | null = null;
let cachedPurokOptions: string[] | null = null;
const householdDetailCache: Record<string, HouseholdDetail | null> = {};

export const invalidateHouseholdsCache = () => {
	cachedHouseholdsList = null;
	cachedPurokOptions = null;
	for (const key in householdDetailCache) {
		delete householdDetailCache[key];
	}
};

function HouseholdsView() {
	const searchParams = Route.useSearch();
	const [householdsList, setHouseholdsList] = useState<HouseholdSummary[]>(
		cachedHouseholdsList || [],
	);
	const [loadingList, setLoadingList] = useState(!cachedHouseholdsList);
	const [selectedId, setSelectedId] = useState<string | null>(
		searchParams.householdId || null,
	);

	const [detail, setDetail] = useState<HouseholdDetail | null>(null);
	const [loadingDetail, setLoadingDetail] = useState(false);

	// Floating Profile Pane State
	const [drawerResident, setDrawerResident] = useState<Resident | null>(null);
	const dragNodeRef = useRef<HTMLDivElement>(null);

	// Edit Modal State
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [editHouseholdId, setEditHouseholdId] = useState("");
	const [editPurok, setEditPurok] = useState("");
	const [editHeadId, setEditHeadId] = useState<string>("");

	// Filters
	const [search, setSearch] = useState("");
	const [selectedPurok, setSelectedPurok] = useState("");
	const [purokOptions, setPurokOptions] = useState<string[]>([]);

	const loadList = useCallback(async () => {
		if (cachedHouseholdsList) {
			setHouseholdsList(cachedHouseholdsList);
			setLoadingList(false);
		} else {
			setLoadingList(true);
		}

		if (cachedPurokOptions) {
			setPurokOptions(cachedPurokOptions);
		}

		try {
			const list = await getHouseholds();
			setHouseholdsList(list);
			cachedHouseholdsList = list;

			const puroks = await getUniquePuroks();
			setPurokOptions(puroks);
			cachedPurokOptions = puroks;
		} catch (err) {
			console.error("Error fetching households:", err);
		} finally {
			setLoadingList(false);
		}
	}, []);

	const loadDetail = useCallback(async (id: string, force = false) => {
		if (!force && householdDetailCache[id]) {
			setDetail(householdDetailCache[id]);
			setLoadingDetail(false);
			return;
		}

		setLoadingDetail(true);
		try {
			const data = await getHouseholdDetails({ data: id });
			console.log("loadDetail received data from server:", data);
			householdDetailCache[id] = data;
			setDetail(data);
		} catch (err) {
			console.error("Error fetching household details:", err);
		} finally {
			setLoadingDetail(false);
		}
	}, []);

	const prefetchDetail = async (id: string) => {
		if (householdDetailCache[id]) return;
		try {
			const data = await getHouseholdDetails({ data: id });
			householdDetailCache[id] = data;
		} catch (err) {
			// Silent fail on prefetch
		}
	};

	useEffect(() => {
		// Clear local cache when entering the page to ensure cross-page edits (like from Residents table) reflect instantly
		for (const key in householdDetailCache) {
			delete householdDetailCache[key];
		}
		loadList();
	}, [loadList]);

	useEffect(() => {
		if (selectedId) {
			loadDetail(selectedId);
		} else {
			setDetail(null);
		}
	}, [selectedId, loadDetail]);

	// Click outside detection to close the profile pane
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (
				drawerResident &&
				dragNodeRef.current &&
				!dragNodeRef.current.contains(event.target as Node)
			) {
				// Don't close if they clicked a dialog/modal overlay (like sweetalert or shadcn dialog)
				const target = event.target as HTMLElement;
				if (
					target.closest('[role="dialog"]') ||
					target.closest("[data-radix-popper-content-wrapper]") ||
					target.closest("[data-radix-select-content]") ||
					target.closest('[role="listbox"]')
				) {
					return;
				}
				// Also don't close if they clicked a household member card
				if (target.closest(".member-card-node")) {
					return;
				}
				setDrawerResident(null);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [drawerResident]);

	const handleOpenEdit = () => {
		if (!detail) return;
		setEditHouseholdId(detail.householdId);
		setEditPurok(detail.purok);
		setEditHeadId(detail.head?.id.toString() || "");
		setIsEditModalOpen(true);
	};

	const handleEditSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!detail) return;

		try {
			const result = await updateHouseholdDetails({
				data: {
					oldHouseholdId: detail.householdId,
					newHouseholdId: editHouseholdId,
					purok: editPurok,
					newHeadId: editHeadId ? parseInt(editHeadId) : undefined,
				},
			});

			if (result.success) {
				toast.success("Household updated successfully!");
				setIsEditModalOpen(false);

				// Invalidate caches and reload
				invalidateHouseholdsCache();
				invalidateResidentsCache();

				// Explicitly clear local cache to bypass any circular dependency state issues
				householdDetailCache[editHouseholdId] = null;
				if (detail.householdId !== editHouseholdId) {
					householdDetailCache[detail.householdId] = null;
				}

				loadList();
				if (editHouseholdId !== detail.householdId) {
					setSelectedId(editHouseholdId);
				} else {
					loadDetail(editHouseholdId);
				}
			} else {
				toast.error(result.error || "Failed to update household.");
			}
		} catch (err) {
			toast.error("An error occurred while saving.");
		}
	};

	// Filtered households list
	const filteredHouseholds = householdsList.filter((h) => {
		const matchesSearch =
			h.headName.toLowerCase().includes(search.toLowerCase()) ||
			h.householdId.toLowerCase().includes(search.toLowerCase());
		const matchesPurok = selectedPurok ? h.purok === selectedPurok : true;
		return matchesSearch && matchesPurok;
	});

	const calculateAge = (birthdateStr: string | null) => {
		if (!birthdateStr) return "N/A";
		const birth = new Date(birthdateStr);
		const diff = Date.now() - birth.getTime();
		const ageDate = new Date(diff);
		return Math.abs(ageDate.getUTCFullYear() - 1970);
	};

	// Helper card component for family tree node
	const MemberCard = ({
		member,
		roleColor,
	}: {
		member: HouseholdMember;
		roleColor: string;
	}) => {
		return (
			<div
				onClick={() => setDrawerResident(member as Resident)}
				className={`member-card-node w-56 h-[116px] p-4 rounded-xl border bg-neutral-950/50 shadow-sm transition-all hover:bg-neutral-900 flex flex-col justify-between border-neutral-800 shrink-0 relative z-10 overflow-hidden group cursor-pointer hover:border-neutral-600`}
			>
				<div className="flex items-start justify-between relative z-10 pl-1">
					<span
						className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${roleColor}`}
					>
						{member.isHeadOfHousehold
							? "Head"
							: member.relationshipToHead || "Member"}
					</span>
					<span className="text-xs text-neutral-400 font-medium">
						{calculateAge(member.birthDate)} yrs
					</span>
				</div>

				<div className="space-y-0.5 relative z-10 pl-1">
					<h4
						className="font-semibold text-sm text-neutral-200 truncate group-hover:text-emerald-400 transition-colors"
						title={member.fullName}
					>
						{member.fullName}
					</h4>
					<p className="text-[11px] text-neutral-500">
						{member.gender || "Unknown"}
					</p>
				</div>

				{/* Flag Badges */}
				<div className="flex flex-wrap gap-1.5 pt-1">
					{member.isPwd && (
						<span className="inline-flex items-center rounded-full bg-purple-400/10 px-2 py-0.5 text-[10px] font-semibold text-purple-400 border border-purple-400/20">
							PWD
						</span>
					)}
					{member.isSeniorCitizen && (
						<span className="inline-flex items-center rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-400/20">
							Senior
						</span>
					)}
					{member.isRegisteredVoter && (
						<span className="inline-flex items-center rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-400/20">
							Voter
						</span>
					)}
					{member.isSingleParent && (
						<span className="inline-flex items-center rounded-full bg-pink-400/10 px-2 py-0.5 text-[10px] font-semibold text-pink-400 border border-pink-400/20">
							Solo
						</span>
					)}
				</div>
			</div>
		);
	};

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Page header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Households
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Manage family units and relationships
					</p>
				</div>
			</div>

			<div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-16rem)] overflow-hidden">
				{/* Left Column: Households list */}
				<Card className="w-full md:w-80 bg-neutral-950/40 backdrop-blur-xl border-white/5 shadow-lg flex flex-col overflow-hidden shrink-0 h-1/2 md:h-full p-0 gap-0">
					{/* List Header */}
					<div className="p-4 border-b border-neutral-800/80 space-y-4 bg-neutral-900/20">
						<div className="space-y-1">
							<h3 className="font-bold text-neutral-100 flex items-center gap-2">
								<Home className="h-4 w-4 text-emerald-500" />
								<span className="tracking-tight">Households</span>
							</h3>
							<p className="text-[11px] text-neutral-500">
								Select a family unit to view structure.
							</p>
						</div>

						<div className="space-y-2">
							<div className="relative">
								<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
									<Search className="h-3.5 w-3.5" />
								</span>
								<Input
									placeholder="Search head of family..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8 py-2 bg-neutral-950/50 border-neutral-800/80 text-xs text-neutral-200 placeholder:text-neutral-600 focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500/50 h-9 rounded-xl"
								/>
							</div>

							<Select
								value={selectedPurok || "ALL"}
								onValueChange={(val) =>
									setSelectedPurok(val === "ALL" ? "" : val)
								}
							>
								<SelectTrigger className="w-full bg-neutral-950 border-neutral-800 text-xs text-neutral-300 px-3 py-2 rounded-xl focus:border-emerald-500 h-9">
									<SelectValue placeholder="All Puroks" />
								</SelectTrigger>
								<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
									<SelectItem value="ALL">All Puroks</SelectItem>
									{purokOptions.map((p) => (
										<SelectItem key={p} value={p}>
											{p}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					</div>

					{/* List scroll area */}
					<div className="flex-1 overflow-y-auto divide-y divide-neutral-800/60 bg-neutral-950/20">
						{loadingList ? (
							<div className="flex h-40 items-center justify-center">
								<div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
							</div>
						) : filteredHouseholds.length > 0 ? (
							filteredHouseholds.map((h) => (
								<button
									type="button"
									key={h.householdId}
									onClick={() => setSelectedId(h.householdId)}
									onMouseEnter={() => prefetchDetail(h.householdId)}
									className={`w-full px-4 py-3 text-left transition-all flex items-center justify-between group ${
										selectedId === h.householdId
											? "bg-neutral-800/80 text-neutral-100"
											: "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200"
									}`}
								>
									<div className="space-y-1 truncate pr-2">
										<h4
											className={`font-semibold text-sm truncate transition-colors ${selectedId === h.householdId ? "text-emerald-400" : "text-neutral-200 group-hover:text-neutral-100"}`}
										>
											{h.headName}
										</h4>
										<div className="flex items-center gap-2 text-[11px] text-neutral-500">
											<span className="bg-neutral-900 border border-neutral-800/80 px-2 py-0.5 rounded-full truncate">
												{h.purok}
											</span>
											<span className="truncate">
												{h.memberCount} members ({h.adultsCount} Adults,{" "}
												{h.childrenCount} Children)
											</span>
										</div>
									</div>
									<ChevronRight
										className={`h-4 w-4 shrink-0 transition-all ${selectedId === h.householdId ? "opacity-100 text-emerald-500 translate-x-0.5" : "opacity-0 group-hover:opacity-50 -translate-x-1"}`}
									/>
								</button>
							))
						) : (
							<div className="flex flex-col items-center justify-center p-8 text-center h-40">
								<AlertCircle className="h-6 w-6 text-neutral-600 mb-1" />
								<p className="text-xs font-semibold text-neutral-500">
									No Households Found
								</p>
							</div>
						)}
					</div>
				</Card>

				{/* Right Column: Family Tree Detail panel */}
				<Card className="flex-1 bg-neutral-950/40 backdrop-blur-xl border-white/5 shadow-lg flex flex-col overflow-hidden h-1/2 md:h-full relative p-0 gap-0">
					{/* Subtle grid background */}
					<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

					<div className="relative z-10 flex-1 flex flex-col overflow-hidden">
						{loadingDetail ? (
							<div className="flex-1 flex items-center justify-center">
								<div className="flex flex-col items-center gap-4">
									<div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/20 border-t-emerald-500" />
									<p className="text-sm text-neutral-400 animate-pulse">
										Rendering family tree...
									</p>
								</div>
							</div>
						) : detail ? (
							<div className="flex-1 flex flex-col overflow-hidden">
								{/* Detail Header */}
								<div className="p-6 border-b border-neutral-800 flex items-center justify-between shrink-0">
									<div>
										<div className="flex items-center gap-3">
											<h3 className="font-extrabold text-xl text-neutral-100">
												Household Family Tree
											</h3>
											<button
												type="button"
												onClick={handleOpenEdit}
												className="h-6 w-6 flex items-center justify-center rounded-md bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-emerald-400 hover:border-emerald-900/50 hover:bg-emerald-950/30 transition-colors cursor-pointer"
												title="Edit Household"
											>
												<Edit2 className="h-3.5 w-3.5" />
											</button>
										</div>
										<div className="flex items-center gap-2 mt-2">
											<span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-950/40 text-emerald-500 border border-emerald-900/30">
												Purok: {detail.purok}
											</span>
											<span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
												Code: {detail.householdId}
											</span>
										</div>
									</div>
									<div className="p-3 bg-neutral-950 border border-neutral-800 text-neutral-400 rounded-2xl flex items-center gap-2 text-xs font-semibold">
										<Users className="h-4 w-4 text-emerald-500" />
										<span>
											{(detail.head ? 1 : 0) +
												(detail.spouse ? 1 : 0) +
												detail.children.length +
												detail.others.length}{" "}
											Members total
										</span>
									</div>
								</div>

								{/* Tree Area (Scrollable) */}
								<div className="flex-1 overflow-auto p-8 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/20 via-neutral-950 to-neutral-950 flex flex-col items-center min-w-max">
									<div className="flex flex-col items-center min-h-full justify-center py-6">
										{/* 1. Parent Layer (Head + Spouse) */}
										<div className="flex items-center gap-16 relative">
											{detail.head && (
												<MemberCard
													member={detail.head}
													roleColor="bg-emerald-950/50 text-emerald-400 border border-emerald-900/30"
												/>
											)}

											{detail.spouse && (
												<>
													{/* Connection bar between spouses */}
													<div className="absolute left-[13.5rem] right-[13.5rem] h-[2px] bg-neutral-800 z-0 top-1/2 -translate-y-1/2" />

													{/* Vertical drop line from the spouses bar down to the children crossbar */}
													{detail.children.length > 0 && (
														<div className="absolute left-1/2 -translate-x-1/2 top-1/2 w-[2px] h-[calc(50%+32px)] bg-neutral-800 z-0" />
													)}

													<MemberCard
														member={detail.spouse}
														roleColor="bg-emerald-950/50 text-emerald-400 border border-emerald-900/30"
													/>
												</>
											)}

											{/* If there are children but NO spouse, drop the line from the head directly */}
											{!detail.spouse && detail.children.length > 0 && (
												<div className="absolute left-1/2 -translate-x-1/2 top-full w-[2px] h-[32px] bg-neutral-800 z-0" />
											)}
										</div>

										{/* 3. Children Layer */}
										{detail.children.length > 0 && (
											<div className="flex flex-wrap justify-center gap-6 max-w-4xl relative pt-6 mt-8">
												{/* Horizontal crossbar connecting the first row */}
												<div className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] bg-neutral-800 w-[calc(100%-14rem)] min-w-[2px] max-w-full z-0" />

												{detail.children.map((child) => (
													<div
														key={child.id}
														className="flex flex-col items-center relative z-10"
													>
														{/* Drop line from horizontal crossbar to child card */}
														<div className="absolute -top-6 h-6 w-[2px] bg-neutral-800" />
														<MemberCard
															member={child}
															roleColor="bg-pink-950/50 text-pink-400 border border-pink-900/30"
														/>
													</div>
												))}
											</div>
										)}

										{/* 4. Others Layer (Extended Family / Other members in household) */}
										{detail.others.length > 0 && (
											<div className="mt-8 border-t border-neutral-800/80 pt-8 w-full flex flex-col items-center">
												<div className="inline-flex items-center gap-2 rounded-full bg-neutral-900 border border-neutral-800 px-3 py-1 text-xs text-neutral-400 mb-6 font-semibold">
													Extended family / Other residents
												</div>
												<div className="flex items-center gap-6 flex-wrap justify-center max-w-2xl">
													{detail.others.map((other) => (
														<MemberCard
															key={other.id}
															member={other}
															roleColor="bg-neutral-850 text-neutral-400 border border-neutral-800"
														/>
													))}
												</div>
											</div>
										)}
									</div>
								</div>
							</div>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
								<Network className="h-14 w-14 text-neutral-700 mb-4" />
								<h3 className="text-lg font-bold text-neutral-400">
									Select a Household
								</h3>
								<p className="text-xs text-neutral-500 max-w-sm mt-1">
									Select a household from the left list to visualize its family
									members, parent-child relationships, and flags.
								</p>
							</div>
						)}
					</div>
				</Card>

				{/* Floating Resident Profile Pane (Draggable on the right side of the screen) */}
				{drawerResident && (
					<Draggable
						nodeRef={dragNodeRef}
						handle=".drag-handle"
						cancel=".no-drag"
					>
						<div
							ref={dragNodeRef}
							className="fixed top-20 right-4 w-[450px] lg:w-[500px] shadow-2xl z-50 pointer-events-none [&>*]:pointer-events-auto"
						>
							<ResidentProfilePane
								resident={drawerResident}
								onClose={() => setDrawerResident(null)}
								hideFamilyTreeButton={true}
								onUpdateComplete={(updated) => {
									setDrawerResident(updated);
									invalidateHouseholdsCache();
									loadList();
									if (selectedId) loadDetail(selectedId, true);
								}}
							/>
						</div>
					</Draggable>
				)}
			</div>

			{/* Edit Household Modal */}
			<Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
				<DialogContent className="sm:max-w-[425px] bg-neutral-950 border-neutral-800">
					<form onSubmit={handleEditSubmit}>
						<DialogHeader>
							<DialogTitle className="text-xl text-neutral-100">
								Edit Household
							</DialogTitle>
						</DialogHeader>
						<div className="grid gap-4 py-6">
							<div className="grid gap-2">
								<Label htmlFor="householdId" className="text-neutral-300">
									Household Code
								</Label>
								<Input
									id="householdId"
									value={editHouseholdId}
									onChange={(e) => setEditHouseholdId(e.target.value)}
									className="bg-neutral-900 border-neutral-800"
									required
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="purok" className="text-neutral-300">
									Purok
								</Label>
								<Select value={editPurok} onValueChange={setEditPurok} required>
									<SelectTrigger className="bg-neutral-900 border-neutral-800">
										<SelectValue placeholder="Select purok" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-900 border-neutral-800">
										{purokOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="head" className="text-neutral-300">
									Head of Household
								</Label>
								<Select value={editHeadId} onValueChange={setEditHeadId}>
									<SelectTrigger className="bg-neutral-900 border-neutral-800">
										<SelectValue placeholder="Select head" />
									</SelectTrigger>
									<SelectContent className="bg-neutral-900 border-neutral-800">
										{detail &&
											[
												detail.head,
												detail.spouse,
												...detail.children,
												...detail.others,
											]
												.filter(Boolean)
												.map((m) => (
													<SelectItem key={m!.id} value={m!.id.toString()}>
														{m!.fullName}
													</SelectItem>
												))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								onClick={() => setIsEditModalOpen(false)}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5"
							>
								Save Changes
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
}
