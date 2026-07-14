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
import { formatHouseholdId } from "../lib/utils";
import type { Resident } from "./residents";
import { invalidateResidentsCache } from "./residents";

type HouseholdsSearch = {
	householdId?: string;
	purok?: string;
};

export const Route = createFileRoute("/households")({
	validateSearch: (search: Record<string, unknown>): HouseholdsSearch => {
		return {
			householdId: search.householdId as string | undefined,
			purok: search.purok as string | undefined,
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
	const canvasDragRef = useRef<HTMLDivElement>(null);

	// Edit Modal State
	const [isEditModalOpen, setIsEditModalOpen] = useState(false);
	const [zoom, setZoom] = useState(1);
	const [editBlock, setEditBlock] = useState("");
	const [editLot, setEditLot] = useState("");
	const [editPurok, setEditPurok] = useState("");
	const [editHeadId, setEditHeadId] = useState<string>("");

	// Filters
	const [search, setSearch] = useState("");
	const [selectedPurok, setSelectedPurok] = useState(searchParams.purok || "");
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
					target.closest('[data-slot="dialog-overlay"]') ||
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
		setEditBlock(detail.block || "");
		setEditLot(detail.lot || "");
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
					purok: editPurok,
					block: editBlock || null,
					lot: editLot || null,
					newHeadId: editHeadId ? parseInt(editHeadId) : undefined,
				},
			});

			if (result.success) {
				setIsEditModalOpen(false);

				// Invalidate caches and reload
				invalidateHouseholdsCache();
				invalidateResidentsCache();

				// Invalidate cache for BOTH old and new household IDs
				householdDetailCache[detail.householdId] = null;
				if (result.newHouseholdId && detail.householdId !== result.newHouseholdId) {
					householdDetailCache[result.newHouseholdId] = null;
				}

				toast.success("Household updated successfully.");

				if (result.newHouseholdId && result.newHouseholdId !== detail.householdId) {
					setSelectedId(result.newHouseholdId);
					loadList(); // Refresh list to get new ID
					loadDetail(result.newHouseholdId);
				} else {
					loadList();
					loadDetail(detail.householdId, true);
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
				className={`member-card-node w-56 h-[116px] p-4 rounded-xl border bg-card shadow-sm transition-all hover:bg-card flex flex-col justify-between border-border shrink-0 relative z-10 overflow-hidden group cursor-pointer hover:border-primary/40 hover:shadow-md`}
			>
				<div className="flex items-start justify-between relative z-10 pl-1">
					<span
						className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${roleColor}`}
					>
						{member.isHeadOfHousehold
							? "Head"
							: member.relationshipToHead || "Member"}
					</span>
					<span className="text-xs text-muted-foreground font-medium">
						{calculateAge(member.birthDate)} yrs
					</span>
				</div>

				<div className="space-y-0.5 relative z-10 pl-1">
					<h4
						className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors"
						title={member.fullName}
					>
						{member.fullName}
					</h4>
					<p className="text-[11px] text-muted-foreground">
						{member.gender || "Unknown"}
					</p>
				</div>

				{/* Flag Badges */}
				<div className="flex flex-wrap gap-1.5 pt-1">
					{member.isPwd && (
						<span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
							PWD
						</span>
					)}
					{member.isSeniorCitizen && (
						<span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
							Senior
						</span>
					)}
					{member.isRegisteredVoter && (
						<span className="inline-flex items-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-primary border border-primary/20">
							Voter
						</span>
					)}
					{member.isSingleParent && (
						<span className="inline-flex items-center rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-semibold text-pink-700 border border-pink-200">
							Solo
						</span>
					)}
					{member.isDeceased && (
						<span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground border border-neutral-500/20">
							Deceased
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
					<h2 className="text-2xl font-bold tracking-tight text-foreground">
						Households
					</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						Manage family units and relationships
					</p>
				</div>
			</div>

			<div className="flex flex-col md:flex-row gap-6 h-[calc(100vh-16rem)] overflow-hidden">
				{/* Left Column: Households list */}
				<Card className="w-full md:w-80 bg-card border-border shadow-sm flex flex-col overflow-hidden shrink-0 h-1/2 md:h-full p-0 gap-0">
					{/* List Header */}
					<div className="p-4 border-b border-border space-y-4 bg-card/20">
						<div className="space-y-1">
							<h3 className="font-bold text-foreground flex items-center gap-2">
								<Home className="h-4 w-4 text-primary" />
								<span className="tracking-tight">Households</span>
							</h3>
							<p className="text-[11px] text-muted-foreground">
								Select a family unit to view structure.
							</p>
						</div>

						<div className="space-y-2">
							<div className="relative">
								<span className="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground">
									<Search className="h-3.5 w-3.5" />
								</span>
								<Input
									placeholder="Search head of family..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="pl-8 py-2 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/50 focus-visible:border-primary/20 h-9 rounded-xl"
								/>
							</div>

							<Select
								value={selectedPurok || "ALL"}
								onValueChange={(val) =>
									setSelectedPurok(val === "ALL" ? "" : val)
								}
							>
								<SelectTrigger className="w-full bg-card border-border text-xs text-foreground/80 px-3 py-2 rounded-xl focus:border-primary/20 h-9">
									<SelectValue placeholder="All Puroks" />
								</SelectTrigger>
								<SelectContent className="bg-card border-border text-foreground rounded-xl">
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
					<div className="flex-1 overflow-y-auto divide-y divide-border/60 bg-card">
						{loadingList ? (
							<div className="flex h-40 items-center justify-center">
								<div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
							</div>
						) : filteredHouseholds.length > 0 ? (
							filteredHouseholds.slice(0, 100).map((h) => (
								<button
									type="button"
									key={h.householdId}
									onClick={() => setSelectedId(h.householdId)}
									onMouseEnter={() => prefetchDetail(h.householdId)}
									className={`w-full px-4 py-3 text-left transition-all flex items-center justify-between group ${
										selectedId === h.householdId
											? "bg-muted/80 text-foreground"
											: "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
									}`}
								>
									<div className="space-y-1 truncate pr-2">
										<h4
											className={`font-semibold text-sm truncate transition-colors ${selectedId === h.householdId ? "text-primary" : "text-foreground group-hover:text-foreground"}`}
										>
											{h.headName}
										</h4>
										<div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground mt-1">
											<span className="bg-card border border-border px-2 py-0.5 rounded-full truncate">
												{h.purok}
											</span>
											{(h.block || h.lot) && (
												<span className="bg-card border border-border px-2 py-0.5 rounded-full truncate">
													{h.block ? `Blk ${h.block}` : ""} {h.lot ? `Lot ${h.lot}` : ""}
												</span>
											)}
											<span className="truncate">
												{h.memberCount} members ({h.adultsCount} Adults,{" "}
												{h.childrenCount} Children)
											</span>
										</div>
									</div>
									<ChevronRight
										className={`h-4 w-4 shrink-0 transition-all ${selectedId === h.householdId ? "opacity-100 text-primary translate-x-0.5" : "opacity-0 group-hover:opacity-50 -translate-x-1"}`}
									/>
								</button>
							))
						) : (
							<div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-50">
								<AlertCircle className="h-6 w-6 text-muted-foreground mb-1" />
								<p className="text-xs font-semibold text-muted-foreground">
									No Households Found
								</p>
							</div>
						)}
					</div>
				</Card>

				{/* Right Column: Family Tree Detail panel */}
				<Card className="flex-1 bg-card border-border shadow-sm flex flex-col overflow-hidden h-1/2 md:h-full relative p-0 gap-0">
					{/* Subtle grid background */}
					<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>

					<div className="relative z-10 flex-1 flex flex-col overflow-hidden">
						{loadingDetail ? (
							<div className="flex-1 flex items-center justify-center">
								<div className="flex flex-col items-center gap-4">
									<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-blue-500" />
									<p className="text-sm text-muted-foreground animate-pulse">
										Rendering family tree...
									</p>
								</div>
							</div>
						) : detail ? (
							<div className="flex-1 flex flex-col overflow-hidden">
								{/* Detail Header */}
								<div className="p-6 border-b border-border flex items-center justify-between shrink-0">
									<div>
										<div className="flex items-center gap-3">
											<h3 className="font-semibold text-xl text-foreground">
												Household Family Tree
											</h3>
											<button
												type="button"
												onClick={handleOpenEdit}
												className="h-6 w-6 flex items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-accent dark:hover:bg-primary/10 hover:border-primary/20 dark:hover:border-primary/20 transition-colors cursor-pointer"
												title="Edit Household"
											>
												<Edit2 className="h-3.5 w-3.5" />
											</button>
										</div>
										<div className="flex items-center gap-2 mt-2">
											<span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-accent dark:bg-primary/10 text-primary border border-primary/20 dark:border-primary/20">
												Purok: {detail.purok}
											</span>
											{(detail.block || detail.lot) && (
												<span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border">
													{detail.block ? `Blk ${detail.block}` : ""} {detail.lot ? `Lot ${detail.lot}` : ""}
												</span>
											)}
											<span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-card text-muted-foreground border border-border">
												Code: {formatHouseholdId(detail.householdId)}
											</span>
										</div>
									</div>
									<div className="p-3 bg-background border border-border text-muted-foreground rounded-xl flex items-center gap-2 text-xs font-semibold">
										<Users className="h-4 w-4 text-primary" />
										<span>
											{(detail.head ? 1 : 0) +
												(detail.spouse ? 1 : 0) +
												detail.children.length +
												detail.others.length}{" "}
											Members total
										</span>
									</div>
								</div>

								{/* Interactive Family Tree Canvas */}
								<div className="flex-1 overflow-hidden relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-900/20 via-neutral-950 to-neutral-950">
									{/* Zoom Controls */}
									<div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 bg-surface p-2 rounded-xl border border-border shadow-xl pointer-events-auto">
										<button type="button" onClick={() => setZoom(z => Math.min(z + 0.1, 2))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted text-foreground/80 font-bold">+</button>
										<button type="button" onClick={() => setZoom(1)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted text-foreground/80 text-xs font-bold">1x</button>
										<button type="button" onClick={() => setZoom(z => Math.max(z - 0.1, 0.3))} className="w-8 h-8 flex items-center justify-center rounded-lg bg-muted hover:bg-muted text-foreground/80 font-bold">-</button>
									</div>

									<Draggable nodeRef={canvasDragRef}>
										<div 
											ref={canvasDragRef} 
											className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
											onWheel={(e) => {
												if (e.deltaY > 0) setZoom(z => Math.max(z - 0.1, 0.3));
												else setZoom(z => Math.min(z + 0.1, 2));
											}}
										>
											<div className="transition-transform duration-200 ease-out flex flex-col items-center" style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}>
												{(() => {
													const isAscendant = (rel: string) => ['parent', 'father', 'mother', 'grandparent', 'grandfather', 'grandmother'].includes(rel?.toLowerCase());
													const isSibling = (rel: string) => ['sibling', 'brother', 'sister'].includes(rel?.toLowerCase());
													const isDescendant = (rel: string) => ['nephew', 'niece', 'grandchild', 'grandson', 'granddaughter'].includes(rel?.toLowerCase());

													const ascendants = detail.others.filter(m => isAscendant(m.relationshipToHead || ""));
													const siblings = detail.others.filter(m => isSibling(m.relationshipToHead || ""));
													const descendants = detail.others.filter(m => isDescendant(m.relationshipToHead || ""));
													const otherExtended = detail.others.filter(m => !isAscendant(m.relationshipToHead || "") && !isSibling(m.relationshipToHead || "") && !isDescendant(m.relationshipToHead || ""));

													return (
														<>
															{/* TIER 1: Ascendants */}
															{ascendants.length > 0 && (
																<div className="flex flex-col items-center">
																	<div className="flex justify-center gap-6 relative">
																		{/* Horizontal crossbar at the bottom */}
																		{ascendants.length > 1 && (
																			<div className="absolute bottom-0 left-[7rem] right-[7rem] h-[2px] bg-muted" />
																		)}
																		{ascendants.map(m => (
																			<div key={m.id} className="flex flex-col items-center h-full">
																				<MemberCard member={m} roleColor="bg-amber-100 text-amber-700 border-amber-200" />
																				{/* Drop line stretches to bottom crossbar */}
																				<div className="flex-1 min-h-[1.5rem] w-[2px] bg-muted" />
																			</div>
																		))}
																	</div>
																	{/* Trunk down to Core */}
																	<div className="h-[1.5rem] w-[2px] bg-muted" />
																</div>
															)}

															{/* TIER 2: Core (Head, Spouse, Siblings) */}
															<div className="flex flex-col items-center">
																<div className="flex items-center justify-center gap-[4rem] relative">
																	
																	{/* Siblings */}
																	{siblings.length > 0 && (
																		<div className="absolute right-full top-1/2 -translate-y-1/2 flex items-center gap-6 mr-[4rem]">
																			{/* Connection to head */}
																			<div className="absolute top-1/2 -right-[4rem] h-[2px] w-[4rem] bg-muted -translate-y-1/2" />
																			
																			{siblings.map((m, index) => (
																				<div key={m.id} className="relative flex items-center">
																					{index < siblings.length - 1 && (
																						<div className="absolute top-1/2 -right-[1.5rem] h-[2px] w-[1.5rem] bg-muted -translate-y-1/2" />
																					)}
																					<MemberCard member={m} roleColor="bg-accent text-accent-foreground border border-accent" />
																				</div>
																			))}
																		</div>
																	)}

																	{/* Head */}
																	{detail.head && (
																		<MemberCard member={detail.head} roleColor="bg-accent text-accent-foreground border border-accent" />
																	)}

																	{/* Spouse */}
																	{detail.spouse && (
																		<>
																			<div className="absolute left-[14rem] w-[4rem] h-[2px] bg-muted top-1/2 -translate-y-1/2" />
																			<MemberCard member={detail.spouse} roleColor="bg-accent text-accent-foreground border border-accent" />
																		</>
																	)}

																	{/* Connection from Tier 1 trunk down to marriage line */}
																	{ascendants.length > 0 && detail.spouse && (
																		<div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-1/2 w-[2px] bg-muted z-0" />
																	)}

																	{/* Drop line from center of marriage to bottom of Core container */}
																	{((detail.children.length > 0) || (descendants.length > 0)) && detail.spouse && (
																		<div className="absolute left-1/2 -translate-x-1/2 top-1/2 bottom-0 w-[2px] bg-muted z-0" />
																	)}
																</div>
																
																{/* Trunk down to Children */}
																{((detail.children.length > 0) || (descendants.length > 0)) && (
																	<div className="h-[1.5rem] w-[2px] bg-muted" />
																)}
															</div>

															{/* TIER 3: Children */}
															{detail.children.length > 0 && (
																<div className="flex flex-col items-center">
																	<div className="flex justify-center gap-6 relative">
																		{/* Top crossbar */}
																		{detail.children.length > 1 && (
																			<div className="absolute top-0 left-[7rem] right-[7rem] h-[2px] bg-muted" />
																		)}
																		
																		{/* Bottom crossbar for descendants */}
																		{descendants.length > 0 && detail.children.length > 1 && (
																			<div className="absolute bottom-0 left-[7rem] right-[7rem] h-[2px] bg-muted" />
																		)}

																		{detail.children.map((child) => (
																			<div key={child.id} className="flex flex-col items-center h-full">
																				<div className="h-[1.5rem] shrink-0 w-[2px] bg-muted" />
																				<MemberCard member={child} roleColor="bg-pink-100 text-pink-700 border border-pink-200" />
																				{descendants.length > 0 && (
																					<div className="flex-1 min-h-[1.5rem] w-[2px] bg-muted" />
																				)}
																			</div>
																		))}
																	</div>
																	{/* Trunk to descendants */}
																	{descendants.length > 0 && (
																		<div className="w-[2px] h-[1.5rem] bg-muted" />
																	)}
																</div>
															)}

															{/* TIER 4: Descendants */}
															{descendants.length > 0 && (
																<div className="flex flex-col items-center">
																	<div className="flex justify-center gap-6 relative">
																		{/* Top crossbar */}
																		{descendants.length > 1 && (
																			<div className="absolute top-0 left-[7rem] right-[7rem] h-[2px] bg-muted" />
																		)}
																		{descendants.map((m) => (
																			<div key={m.id} className="flex flex-col items-center">
																				<div className="h-[1.5rem] w-[2px] bg-muted" />
																				<MemberCard member={m} roleColor="bg-purple-100 text-purple-700 border border-purple-200" />
																			</div>
																		))}
																	</div>
																</div>
															)}

															{/* TIER 5: Others */}
															{otherExtended.length > 0 && (
																<div className="flex flex-col items-center w-full max-w-4xl mt-12">
																	<div className="inline-flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1 text-xs text-muted-foreground font-semibold z-10 relative">
																		Distant Relatives & Others
																	</div>
																	
																	{/* Dashed trunk from pill down to crossbar */}
																	<div className="h-[1.5rem] w-[2px] border-l-[2px] border-dashed border-neutral-600/50" />
																	
																	<div className="flex justify-center gap-6 relative z-10 w-full">
																		{/* Top dashed crossbar */}
																		{otherExtended.length > 1 && (
																			<div className="absolute top-0 left-[7rem] right-[7rem] h-[2px] border-t-[2px] border-dashed border-neutral-600/50" />
																		)}
																		
																		{otherExtended.map((other) => (
																			<div key={other.id} className="flex flex-col items-center">
																				<div className="h-[1.5rem] w-[2px] border-l-[2px] border-dashed border-neutral-600/50" />
																				<MemberCard member={other} roleColor="bg-muted/50 text-muted-foreground border border-border" />
																			</div>
																		))}
																	</div>
																</div>
															)}
														</>
													);
												})()}
											</div>
										</div>
									</Draggable>
								</div>
							</div>
						) : (
							<div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
								<Network className="h-14 w-14 text-foreground mb-4" />
								<h3 className="text-lg font-bold text-muted-foreground">
									Select a Household
								</h3>
								<p className="text-xs text-muted-foreground max-w-sm mt-1">
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
							className="fixed top-20 right-4 w-[450px] lg:w-[500px] z-50 pointer-events-none [&>*]:pointer-events-auto"
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
				<DialogContent className="sm:max-w-[425px] bg-background border-border/60 shadow-md">
					<form onSubmit={handleEditSubmit}>
						<DialogHeader>
							<DialogTitle className="text-xl text-foreground">
								Edit Household
							</DialogTitle>
						</DialogHeader>
						<div className="grid gap-4 py-6">
							<div className="space-y-1.5">
								<Label className="text-muted-foreground text-xs">Block</Label>
								<Input
									value={editBlock}
									onChange={(e) => setEditBlock(e.target.value)}
									className="bg-card border-border h-9 text-foreground rounded-xl"
									placeholder="e.g. 5"
								/>
							</div>

							<div className="space-y-1.5">
								<Label className="text-muted-foreground text-xs">Lot</Label>
								<Input
									value={editLot}
									onChange={(e) => setEditLot(e.target.value)}
									className="bg-card border-border h-9 text-foreground rounded-xl"
									placeholder="e.g. 12"
								/>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="purok" className="text-foreground/80">
									Purok
								</Label>
								<Select value={editPurok} onValueChange={setEditPurok} required>
									<SelectTrigger className="bg-card border-border rounded-xl">
										<SelectValue placeholder="Select purok" />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
										{purokOptions.map((p) => (
											<SelectItem key={p} value={p}>
												{p}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="head" className="text-foreground/80">
									Head of Household
								</Label>
								<Select value={editHeadId} onValueChange={setEditHeadId}>
									<SelectTrigger className="bg-card border-border rounded-xl">
										<SelectValue placeholder="Select head" />
									</SelectTrigger>
									<SelectContent className="bg-card border-border">
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
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsEditModalOpen(false)}
								className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5"
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
