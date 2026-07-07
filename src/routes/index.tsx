import { createFileRoute } from "@tanstack/react-router";
import {
	Activity,
	Baby,
	Check,
	ChevronDown,
	Clock,
	Copy,
	HeartPulse,
	Home,
	Laptop,
	UserCheck,
	Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "../components/ui/badge";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "../components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "../components/ui/collapsible";
import { getDashboardData } from "../lib/dashboard-service";
import { getUniquePuroks } from "../lib/residents-service";
import { z } from "zod";
import { useNavigate, Link, redirect } from "@tanstack/react-router";
import { getClientUser } from "../lib/client-auth";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";

const dashboardSearchSchema = z.object({
	purok: z.string().optional(),
});

export const Route = createFileRoute("/")({
	validateSearch: dashboardSearchSchema,
	loaderDeps: ({ search: { purok } }) => ({ purok }),
	loader: async ({ deps: { purok } }) => {
		const user = await getClientUser();
		if (user?.role === "staff") {
			throw redirect({ to: "/queue" });
		}
		const [stats, puroks] = await Promise.all([
			getDashboardData({ data: { purok } }),
			getUniquePuroks(),
		]);
		return { stats, puroks };
	},
	staleTime: 10000,
	component: DashboardView,
});

// ─── Helpers ────────────────────────────────────────────────────
function formatRelativeTime(timestamp: number): string {
	if (!timestamp) return "—";
	const diff = Date.now() - timestamp;
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString();
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.slice(0, 2)
		.map((n) => n[0])
		.join("")
		.toUpperCase();
}

// ─── Main Component ─────────────────────────────────────────────
function DashboardView() {
	const { stats, puroks } = Route.useLoaderData();
	const { purok } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	
	const [copied, setCopied] = useState(false);
	const [hoveredRing, setHoveredRing] = useState<number | null>(null);
	const [lanOpen, setLanOpen] = useState(false);

	const copyLanLink = () => {
		if (!stats) return;
		navigator.clipboard.writeText(`http://${stats.serverIp}:3000`);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// ── Hero stat cards ────────────────────────────────────────────────
	const heroCards = [
		{
			title: "Total Population",
			value: stats?.totalResidents ?? 0,
			sub: "Registered residents",
			icon: Users,
			accent: "emerald",
			glow: "from-emerald-500/10",
			iconCls: "text-emerald-400 bg-emerald-950/40 border-emerald-800/40",
			to: "/residents",
			search: { purok },
		},
		{
			title: "Total Households",
			value: stats?.totalHouseholds ?? 0,
			sub: `~${(stats?.avgHouseholdSize ?? 0).toFixed(1)} people per home`,
			icon: Home,
			accent: "teal",
			glow: "from-teal-500/10",
			iconCls: "text-teal-400 bg-teal-950/40 border-teal-800/40",
			to: "/households",
			search: { purok },
		},
		{
			title: "Registered Voters",
			value: stats?.totalVoters ?? 0,
			sub: "Eligible active voters",
			icon: UserCheck,
			accent: "cyan",
			glow: "from-cyan-500/10",
			iconCls: "text-cyan-400 bg-cyan-950/40 border-cyan-800/40",
			to: "/residents",
			search: { filterVoter: true, purok },
		},
		{
			title: "Senior Citizens",
			value: stats?.totalSeniors ?? 0,
			sub: "Residents aged 60+",
			icon: Activity,
			accent: "amber",
			glow: "from-amber-500/10",
			iconCls: "text-amber-400 bg-amber-950/40 border-amber-800/40",
			to: "/residents",
			search: { filterSenior: true, purok },
		},
		{
			title: "PWD",
			value: stats?.totalPwd ?? 0,
			sub: "Persons w/ disabilities",
			icon: HeartPulse,
			accent: "purple",
			glow: "from-purple-500/10",
			iconCls: "text-purple-400 bg-purple-950/40 border-purple-800/40",
			to: "/residents",
			search: { filterPwd: true, purok },
		},
		{
			title: "Single Parents",
			value: stats?.totalSingleParents ?? 0,
			sub: "Solo parent households",
			icon: Baby,
			accent: "pink",
			glow: "from-pink-500/10",
			iconCls: "text-pink-400 bg-pink-950/40 border-pink-800/40",
			to: "/residents",
			search: { filterSingleParent: true, purok },
		},
	];

	// ── Concentric ring chart data ────────────────────────────────
	// Demographic Ratios ring data — all percentages relative to total residents
	const total = stats?.totalResidents ?? 0;
	const ringData = [
		{
			label: "Registered Voters",
			value: stats?.totalVoters ?? 0,
			pct: total > 0 ? ((stats?.totalVoters ?? 0) / total) * 100 : 0,
			color: "text-cyan-400",
			stroke: "#22d3ee",
			radius: 54,
		},
		{
			// Use age-calculated seniors (60+) — more accurate than the manual boolean flag
			label: "Seniors (60+)",
			value: stats?.totalSeniors ?? 0,
			pct: total > 0 ? ((stats?.totalSeniors ?? 0) / total) * 100 : 0,
			color: "text-amber-400",
			stroke: "#fbbf24",
			radius: 44,
		},
		{
			label: "PWD Residents",
			value: stats?.totalPwd ?? 0,
			pct: total > 0 ? ((stats?.totalPwd ?? 0) / total) * 100 : 0,
			color: "text-purple-400",
			stroke: "#c084fc",
			radius: 34,
		},
		{
			label: "Single Parents",
			value: stats?.totalSingleParents ?? 0,
			pct: total > 0 ? ((stats?.totalSingleParents ?? 0) / total) * 100 : 0,
			color: "text-pink-400",
			stroke: "#f472b6",
			radius: 24,
		},
	];

	const purokMax = Math.max(
		...(stats?.purokStats.map((p) => p.count) ?? [1]),
		1,
	);

	const purokColors = [
		{
			bar: "bg-emerald-500",
			glow: "shadow-emerald-500/30",
			text: "text-emerald-400",
		},
		{ bar: "bg-teal-500", glow: "shadow-teal-500/30", text: "text-teal-400" },
		{ bar: "bg-cyan-500", glow: "shadow-cyan-500/30", text: "text-cyan-400" },
		{
			bar: "bg-indigo-500",
			glow: "shadow-indigo-500/30",
			text: "text-indigo-400",
		},
		{
			bar: "bg-purple-500",
			glow: "shadow-purple-500/30",
			text: "text-purple-400",
		},
		{
			bar: "bg-amber-500",
			glow: "shadow-amber-500/30",
			text: "text-amber-400",
		},
		{ bar: "bg-pink-500", glow: "shadow-pink-500/30", text: "text-pink-400" },
		{ bar: "bg-sky-500", glow: "shadow-sky-500/30", text: "text-sky-400" },
	];

	const totalGenderCount = (stats?.totalMale ?? 0) + (stats?.totalFemale ?? 0) + (stats?.totalOtherGender ?? 0);

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* ── Page Header ─────────────────────────────────────── */}
			<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Dashboard
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Population overview for Barangay Handumanan
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Select
						value={purok || "all"}
						onValueChange={(val) => {
							navigate({
								search: { purok: val === "all" ? undefined : val },
							});
						}}
					>
						<SelectTrigger className="w-[180px] bg-neutral-900 border-white/10 text-neutral-200">
							<SelectValue placeholder="All Puroks" />
						</SelectTrigger>
						<SelectContent className="bg-neutral-900 border-white/10 text-neutral-200">
							<SelectItem value="all">All Puroks</SelectItem>
							{puroks.map((p: string) => (
								<SelectItem key={p} value={p}>
									{p}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			{/* ── Key Metrics (2x3 grid) ──────────────────────────────── */}
			<div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
				{heroCards.map((card) => (
					<Link
						key={card.title}
						to={card.to as any}
						search={card.search as any}
						className="block outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl"
					>
						<Card
							className="relative h-full overflow-hidden border-white/5 border-t-white/10 bg-neutral-950/40 backdrop-blur-xl shadow-lg group hover:border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer"
						>
							<div
								className={`absolute inset-0 bg-gradient-to-br ${card.glow} to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
							/>
							<CardContent className="p-4 relative z-10">
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<h3
											className="text-sm font-bold text-neutral-300 mb-1.5 truncate"
											title={card.title}
										>
											{card.title}
										</h3>
										<div className="flex items-baseline gap-2 truncate">
											<span className="text-3xl font-black tracking-tighter text-neutral-100">
												{card.value.toLocaleString()}
											</span>
										</div>
									</div>
									<div
										className={`p-2.5 rounded-xl border ${card.iconCls} shrink-0`}
									>
										<card.icon className="h-5 w-5" />
									</div>
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>

			{/* ── Main Layout: Purok (Left) & Demographics (Right) ─── */}
			<div className="grid gap-5 lg:grid-cols-5">
				{/* LEFT: Purok Distribution (60% width, lg:col-span-3) */}
				<div className="lg:col-span-3 flex flex-col h-full">
					<Card className="flex-1 border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CardHeader className="px-5 pt-5 pb-4">
							<CardTitle className="text-base font-bold text-neutral-100">
								Purok Distribution
							</CardTitle>
							<p className="text-xs text-neutral-500 mt-0.5">
								Population per zone — sorted by size
							</p>
						</CardHeader>
						<CardContent className="px-2 pb-5">
							{stats && stats.purokStats.length > 0 ? (
								<div className="space-y-4 max-h-[800px] overflow-y-auto px-3 custom-scrollbar">
									{stats.purokStats.map((purok, i) => {
										const pct = (purok.count / purokMax) * 100;
										const col = purokColors[i % purokColors.length];
										return (
											<div key={purok.purok} className="group/bar">
												<div className="flex items-center justify-between text-sm mb-1.5">
													<span
														className={`font-semibold ${col.text} group-hover/bar:brightness-125 transition-all`}
													>
														{purok.purok}
													</span>
													<div className="flex items-center gap-2">
														<span className="text-neutral-100 font-bold">
															{purok.count.toLocaleString()}
														</span>
														<span className="text-xs text-neutral-600">
															(
															{(
																(purok.count / (stats.totalResidents || 1)) *
																100
															).toFixed(1)}
															%)
														</span>
													</div>
												</div>
												<div className="h-3 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
													<div
														className={`h-full rounded-full transition-all duration-700 ${col.bar} shadow-sm ${col.glow}`}
														style={{ width: `${pct}%` }}
													/>
												</div>
											</div>
										);
									})}
								</div>
							) : (
								<div className="flex h-[280px] flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 mx-3 text-center">
									<Users className="h-7 w-7 text-neutral-700 mb-2" />
									<p className="text-sm text-neutral-500">No Purok data yet</p>
								</div>
							)}
						</CardContent>
					</Card>
				</div>

				{/* RIGHT: Demographics Stack (40% width, lg:col-span-2) */}
				<div className="flex flex-col gap-5 lg:col-span-2">
					{/* Gender Breakdown */}
					<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CardHeader className="px-5 pt-5 pb-3">
							<CardTitle className="text-base font-bold text-neutral-100">
								Gender Breakdown
							</CardTitle>
							<p className="text-xs text-neutral-500 mt-0.5">
								Male vs Female ratio across all residents
							</p>
						</CardHeader>
						<CardContent className="px-5 pb-5">
							{totalGenderCount > 0 ? (
								<div className="space-y-4 mt-2">
									{/* Male */}
									<div>
										<div className="flex items-center justify-between text-sm mb-1.5">
											<div className="flex items-center gap-2">
												<span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shrink-0" />
												<span className="font-semibold text-neutral-300">
													Male
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-neutral-100">
													{(stats?.totalMale ?? 0).toLocaleString()}
												</span>
												<Badge className="bg-emerald-950/60 text-emerald-400 border border-emerald-800/40 text-[10px] px-1.5 py-0 font-bold">
													{totalGenderCount > 0
														? (
																((stats?.totalMale ?? 0) / totalGenderCount) *
																100
															).toFixed(0)
														: 0}
													%
												</Badge>
											</div>
										</div>
										<div className="h-2.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
											<div
												className="h-full rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/30 transition-all duration-700"
												style={{
													width: `${totalGenderCount > 0 ? ((stats?.totalMale ?? 0) / totalGenderCount) * 100 : 0}%`,
												}}
											/>
										</div>
									</div>
									{/* Female */}
									<div>
										<div className="flex items-center justify-between text-sm mb-1.5">
											<div className="flex items-center gap-2">
												<span className="h-2.5 w-2.5 rounded-full bg-pink-400 shrink-0" />
												<span className="font-semibold text-neutral-300">
													Female
												</span>
											</div>
											<div className="flex items-center gap-2">
												<span className="font-bold text-neutral-100">
													{(stats?.totalFemale ?? 0).toLocaleString()}
												</span>
												<Badge className="bg-pink-950/60 text-pink-400 border border-pink-800/40 text-[10px] px-1.5 py-0 font-bold">
													{totalGenderCount > 0
														? (
																((stats?.totalFemale ?? 0) / totalGenderCount) *
																100
															).toFixed(0)
														: 0}
													%
												</Badge>
											</div>
										</div>
										<div className="h-2.5 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
											<div
												className="h-full rounded-full bg-pink-500 shadow-sm shadow-pink-500/30 transition-all duration-700"
												style={{
													width: `${totalGenderCount > 0 ? ((stats?.totalFemale ?? 0) / totalGenderCount) * 100 : 0}%`,
												}}
											/>
										</div>
									</div>
								</div>
							) : (
								<p className="text-xs text-neutral-600 text-center py-4">
									No gender data available
								</p>
							)}
						</CardContent>
					</Card>

					{/* Age Demographics */}
					<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CardHeader className="px-5 pt-5 pb-3">
							<CardTitle className="text-base font-bold text-neutral-100">
								Age Demographics
							</CardTitle>
							<p className="text-xs text-neutral-500 mt-0.5">
								Distribution of minors, adults, and seniors
							</p>
						</CardHeader>
						<CardContent className="px-5 pb-5">
							{stats && stats.totalWithBirthdate > 0 && stats.ageBrackets ? (
								<div className="space-y-4 mt-2">
									<div className="grid grid-cols-2 gap-x-4 gap-y-2">
										{[
											{ label: "0-5 yrs", count: stats.ageBrackets["0-5"], color: "bg-sky-400" },
											{ label: "6-12 yrs", count: stats.ageBrackets["6-12"], color: "bg-cyan-400" },
											{ label: "13-17 yrs", count: stats.ageBrackets["13-17"], color: "bg-indigo-400" },
											{ label: "18-35 yrs", count: stats.ageBrackets["18-35"], color: "bg-violet-400" },
											{ label: "36-50 yrs", count: stats.ageBrackets["36-50"], color: "bg-purple-400" },
											{ label: "51-65+ yrs", count: stats.ageBrackets["51-65+"], color: "bg-amber-400" },
										].map((bracket) => (
											<div key={bracket.label} className="flex items-center justify-between text-sm">
												<div className="flex items-center gap-2">
													<span className={`h-2.5 w-2.5 rounded-full ${bracket.color} shrink-0`} />
													<span className="font-semibold text-neutral-300">
														{bracket.label}
													</span>
												</div>
												<span className="font-bold text-neutral-100">
													{bracket.count.toLocaleString()}
												</span>
											</div>
										))}
									</div>
									
									{/* Split bar */}
									<div className="flex rounded-full overflow-hidden h-2.5 mt-4 border border-white/5 bg-neutral-900">
										{[
											{ count: stats.ageBrackets["0-5"], color: "bg-sky-500" },
											{ count: stats.ageBrackets["6-12"], color: "bg-cyan-500" },
											{ count: stats.ageBrackets["13-17"], color: "bg-indigo-500" },
											{ count: stats.ageBrackets["18-35"], color: "bg-violet-500" },
											{ count: stats.ageBrackets["36-50"], color: "bg-purple-500" },
											{ count: stats.ageBrackets["51-65+"], color: "bg-amber-500" },
										].map((bracket, i) => (
											<div
												key={i}
												className={`${bracket.color} transition-all duration-700 hover:brightness-110 cursor-pointer`}
												style={{ width: `${(bracket.count / (stats.totalWithBirthdate || 1)) * 100}%` }}
												title={`${bracket.count} residents`}
											/>
										))}
									</div>
								</div>
							) : (
								<p className="text-xs text-neutral-600 text-center py-4">
									No age data available
								</p>
							)}
						</CardContent>
					</Card>

					{/* Demographic Rings */}
					<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CardHeader className="px-5 pt-5 pb-3">
							<CardTitle className="text-base font-bold text-neutral-100">
								Demographic Ratios
							</CardTitle>
							<p className="text-xs text-neutral-500 mt-0.5">
								Key group shares within total population
							</p>
						</CardHeader>
						<CardContent className="px-5 pb-5">
							{stats && stats.totalResidents > 0 ? (
								<div className="flex items-center gap-5 w-full mt-2">
									{/* SVG Ring Chart */}
									<div className="relative shrink-0 select-none size-[140px]">
										<svg viewBox="0 0 140 140" className="size-[140px]">
											<title>Demographic Ratios</title>
											{ringData.map((item, idx) => {
												const circum = 2 * Math.PI * item.radius;
												const offset = circum - (item.pct / 100) * circum;
												const isHov = hoveredRing === idx;
												const anyHov = hoveredRing !== null;
												return (
													/* biome-ignore lint/a11y/noStaticElementInteractions: ring hover */
													<g
														key={item.label}
														onMouseEnter={() => setHoveredRing(idx)}
														onMouseLeave={() => setHoveredRing(null)}
														className="cursor-pointer"
														transform="rotate(-90 70 70)"
													>
														<circle
															cx="70"
															cy="70"
															r={item.radius}
															fill="none"
															strokeWidth="6"
															style={{
																stroke: "#1a1a1a",
																opacity: anyHov && !isHov ? 0.15 : 0.4,
																transition: "opacity 150ms",
															}}
														/>
														<circle
															cx="70"
															cy="70"
															r={item.radius}
															fill="none"
															stroke={item.stroke}
															strokeWidth="6.5"
															strokeDasharray={circum}
															strokeDashoffset={offset}
															strokeLinecap="round"
															style={{
																opacity: anyHov && !isHov ? 0.15 : 1,
																filter: isHov
																	? `drop-shadow(0 0 4px ${item.stroke})`
																	: "none",
																transition: "opacity 150ms, filter 150ms",
															}}
														/>
													</g>
												);
											})}
											<text
												x="70"
												y="64"
												textAnchor="middle"
												className="fill-neutral-400 text-[8px] font-semibold select-none pointer-events-none"
											>
												{hoveredRing !== null
													? ringData[hoveredRing].label
													: "Population"}
											</text>
											<text
												x="70"
												y="82"
												textAnchor="middle"
												className="fill-neutral-100 text-[16px] font-black tracking-tight select-none pointer-events-none"
											>
												{hoveredRing !== null
													? `${ringData[hoveredRing].pct.toFixed(0)}%`
													: (stats?.totalResidents ?? 0).toLocaleString()}
											</text>
											<text
												x="70"
												y="94"
												textAnchor="middle"
												className="fill-neutral-500 text-[8px] select-none pointer-events-none"
											>
												{hoveredRing !== null
													? `${ringData[hoveredRing].value.toLocaleString()} residents`
													: "total residents"}
											</text>
										</svg>
									</div>
									{/* Legend */}
									<div className="flex flex-col gap-2 flex-1">
										{ringData.map((item, idx) => {
											const isHov = hoveredRing === idx;
											const anyHov = hoveredRing !== null;
											return (
												/* biome-ignore lint/a11y/noStaticElementInteractions: legend hover */
												<div
													key={item.label}
													onMouseEnter={() => setHoveredRing(idx)}
													onMouseLeave={() => setHoveredRing(null)}
													className={`flex items-center justify-between p-1.5 rounded-lg border transition-all duration-150 cursor-pointer ${
														isHov
															? "bg-neutral-800/40 border-white/10"
															: anyHov
																? "opacity-25 border-transparent"
																: "bg-neutral-950/20 border-white/5"
													}`}
												>
													<div className="flex items-center gap-2">
														<span
															className="size-2 rounded-full shrink-0"
															style={{ background: item.stroke }}
														/>
														<span className="text-[11px] font-semibold text-neutral-300 truncate max-w-[100px]">
															{item.label}
														</span>
													</div>
													<span
														className={`text-[11px] font-bold ${item.color}`}
													>
														{item.pct.toFixed(0)}%
													</span>
												</div>
											);
										})}
									</div>
								</div>
							) : (
								<div className="flex h-24 items-center justify-center">
									<p className="text-xs text-neutral-600">
										Add residents to see ratios
									</p>
								</div>
							)}
						</CardContent>
					</Card>

					{/* Data Completeness */}
					<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CardHeader className="px-5 pt-5 pb-3">
							<div className="flex items-center justify-between">
								<div>
									<CardTitle className="text-base font-bold text-neutral-100">
										Data Health
									</CardTitle>
									<p className="text-xs text-neutral-500 mt-0.5">
										Profiles with contact & birth date
									</p>
								</div>
								<Badge
									className={`text-xs px-2 py-0.5 font-bold ${(stats?.dataCompletenessPct ?? 0) >= 90 ? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40" : "bg-amber-950/60 text-amber-400 border-amber-800/40"} border`}
								>
									{(stats?.dataCompletenessPct ?? 0).toFixed(1)}%
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="px-5 pb-5 mt-2">
							<div className="h-3 w-full rounded-full bg-neutral-900 overflow-hidden border border-white/5">
								<div
									className={`h-full rounded-full shadow-sm transition-all duration-700 ${(stats?.dataCompletenessPct ?? 0) >= 90 ? "bg-emerald-500 shadow-emerald-500/30" : "bg-amber-500 shadow-amber-500/30"}`}
									style={{ width: `${stats?.dataCompletenessPct ?? 0}%` }}
								/>
							</div>
						</CardContent>
					</Card>
				</div>
			</div>

			{/* ── Bottom Row: Recent Activity + LAN ───────────────── */}
			<div className="grid gap-5 lg:grid-cols-[1fr_360px]">
				{/* Recent Activity Feed */}
				<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
					<CardHeader className="px-5 pt-5 pb-4">
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-base font-bold text-neutral-100">
									Recent Activity
								</CardTitle>
								<p className="text-xs text-neutral-500 mt-0.5">
									Latest resident records added or updated
								</p>
							</div>
						</div>
					</CardHeader>
					<CardContent className="px-5 pb-5">
						{stats?.recentActivity && stats.recentActivity.length > 0 ? (
							<div className="space-y-2">
								{stats.recentActivity.map((activity) => (
									<div
										key={activity.id}
										className="flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-neutral-950/20 hover:bg-neutral-900/30 hover:border-white/8 transition-all duration-150 group"
									>
										{/* Avatar */}
										<div className="shrink-0 h-8 w-8 rounded-full bg-emerald-950/40 border border-emerald-800/30 flex items-center justify-center text-emerald-400 text-[10px] font-bold">
											{getInitials(activity.fullName)}
										</div>
										{/* Info */}
										<div className="flex-1 min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-semibold text-neutral-200 truncate">
													{activity.fullName}
												</span>
												<Badge
													className={`text-[9px] px-1.5 py-0 shrink-0 font-bold ${
														activity.action === "added"
															? "bg-emerald-950/60 text-emerald-400 border-emerald-800/40"
															: "bg-blue-950/60 text-blue-400 border-blue-800/40"
													} border`}
												>
													{activity.action}
												</Badge>
											</div>
											<p className="text-[10px] text-neutral-500 mt-0.5">
												{activity.purok}
											</p>
										</div>
										{/* Time */}
										<div className="shrink-0 flex items-center gap-1 text-[10px] text-neutral-600">
											<Clock className="h-3 w-3" />
											{formatRelativeTime(activity.timestamp)}
										</div>
									</div>
								))}
							</div>
						) : (
							<div className="flex h-32 flex-col items-center justify-center rounded-xl border border-dashed border-neutral-800 text-center">
								<Clock className="h-7 w-7 text-neutral-700 mb-2" />
								<p className="text-sm text-neutral-500">No recent activity</p>
								<p className="text-xs text-neutral-600 mt-1">
									Add residents to see activity here
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Collapsible LAN Network Card */}
				<Collapsible open={lanOpen} onOpenChange={setLanOpen}>
					<Card className="border-white/5 border-t-white/8 bg-neutral-950/40 backdrop-blur-xl shadow-lg py-0 gap-0">
						<CollapsibleTrigger asChild>
							<button type="button" className="w-full text-left">
								<CardHeader className="px-5 pt-5 pb-5 cursor-pointer hover:bg-white/[0.02] transition-colors rounded-xl">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-3">
											<div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-900/30 text-emerald-400">
												<Laptop className="h-4 w-4" />
											</div>
											<div>
												<CardTitle className="text-sm font-bold text-neutral-100">
													LAN Database Access
												</CardTitle>
												<p className="text-[10px] text-neutral-500 mt-0.5">
													Share with other office PCs
												</p>
											</div>
										</div>
										<ChevronDown
											className={`h-4 w-4 text-neutral-500 transition-transform duration-200 ${lanOpen ? "rotate-180" : ""}`}
										/>
									</div>
								</CardHeader>
							</button>
						</CollapsibleTrigger>
						<CollapsibleContent>
							<CardContent className="px-5 pb-5 space-y-4">
								<p className="text-xs text-neutral-400 leading-relaxed">
									Other desktop computers in the Barangay hall can connect.
									Ensure they are on the same local router, then enter this
									address in their browser:
								</p>
								<div className="flex items-center gap-2 rounded-xl bg-neutral-950/60 border border-white/5 p-3">
									<span className="text-sm font-mono text-emerald-400 font-bold break-all flex-1">
										http://{stats?.serverIp ?? "127.0.0.1"}:3000
									</span>
									<button
										type="button"
										onClick={copyLanLink}
										className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors shrink-0"
										title="Copy link"
									>
										{copied ? (
											<Check className="h-4 w-4 text-emerald-400" />
										) : (
											<Copy className="h-4 w-4" />
										)}
									</button>
								</div>
								<div className="rounded-xl border border-white/5 bg-neutral-950/30 p-3 text-[11px] text-neutral-500 space-y-1.5 leading-relaxed">
									<span className="font-semibold text-neutral-400">
										Instructions:
									</span>
									<ol className="list-decimal list-inside space-y-1 mt-1">
										<li>Open Chrome on the client PC.</li>
										<li>Type the IP address above and press Enter.</li>
										<li>Enter system PIN to authenticate.</li>
									</ol>
								</div>
							</CardContent>
						</CollapsibleContent>
					</Card>
				</Collapsible>
			</div>
		</div>
	);
}
