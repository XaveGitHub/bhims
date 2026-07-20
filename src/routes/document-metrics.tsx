import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, subDays, subWeeks, subMonths, isSameDay, isSameWeek, isSameMonth } from "date-fns";
import {
	Clock,
	FileText,
	TrendingUp,
	DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { getAllTransactions } from "../lib/queue-service";
import { getClientUser } from "../lib/client-auth";
import {
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
	type ChartConfig,
} from "../components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Area, AreaChart, LabelList } from "recharts";

export const Route = createFileRoute("/document-metrics")({
	loader: async () => {
		const user = await getClientUser();
		const transactions = await getAllTransactions();
		return { transactions, user };
	},
	component: DocumentMetricsView,
});

const chartConfig = {
	prints: {
		label: "Prints",
		color: "hsl(var(--chart-1))",
	},
	revenue: {
		label: "Revenue",
		color: "hsl(var(--chart-2))",
	},
	count: {
		label: "Requests",
		color: "hsl(var(--chart-3))",
	}
} satisfies ChartConfig;

function DocumentMetricsView() {
	const { transactions } = Route.useLoaderData();
	const [timeframe, setTimeframe] = useState<"Daily" | "Weekly" | "Monthly" | "Total">("Daily");

	const metrics = useMemo(() => {
		const today = new Date();
		let periods: { date: Date; label: string; prints: number; revenue: number }[] = [];

		if (timeframe === "Daily") {
			periods = Array.from({ length: 7 }, (_, i) => {
				const d = subDays(today, 6 - i);
				return { date: d, label: format(d, "EEE"), prints: 0, revenue: 0 };
			});
		} else if (timeframe === "Weekly") {
			periods = Array.from({ length: 4 }, (_, i) => {
				const d = subWeeks(today, 3 - i);
				return { date: d, label: `Week ${format(d, "w")}`, prints: 0, revenue: 0 };
			});
		} else if (timeframe === "Monthly") {
			periods = Array.from({ length: 6 }, (_, i) => {
				const d = subMonths(today, 5 - i);
				return { date: d, label: format(d, "MMM"), prints: 0, revenue: 0 };
			});
		} else {
			// Total (yearly/all time approximation, let's just do last 6 months for trend)
			periods = Array.from({ length: 6 }, (_, i) => {
				const d = subMonths(today, 5 - i);
				return { date: d, label: format(d, "MMM yyyy"), prints: 0, revenue: 0 };
			});
		}

		let timeframePrints = 0;
		let timeframeRevenue = 0;
		let pendingQueue = 0;
		let totalRevenue = 0;
		const templateCounts: Record<string, number> = {};

		transactions.forEach((tx: any) => {
			const txDate = new Date(tx.createdAt);
			const isCompleted = tx.status === "Completed" || tx.status === "Released";

			if (tx.status === "Pending" || tx.status === "Processing" || tx.status === "Ready to Claim") {
				pendingQueue++;
			}

			if (isCompleted) {
				totalRevenue += tx.totalPrice || 0;
				
				// Template counting for Most Requested
				const tName = tx.template?.name || "Unknown";
				templateCounts[tName] = (templateCounts[tName] || 0) + 1;

				// Match to bucket
				const match = periods.find(p => {
					if (timeframe === "Daily") return isSameDay(p.date, txDate);
					if (timeframe === "Weekly") return isSameWeek(p.date, txDate);
					return isSameMonth(p.date, txDate);
				});

				if (match) {
					match.prints++;
					match.revenue += tx.totalPrice || 0;
				}

				// Global match for the top card depending on timeframe
				if (timeframe === "Daily" && isSameDay(txDate, today)) {
					timeframePrints++;
					timeframeRevenue += tx.totalPrice || 0;
				} else if (timeframe === "Weekly" && isSameWeek(txDate, today)) {
					timeframePrints++;
					timeframeRevenue += tx.totalPrice || 0;
				} else if (timeframe === "Monthly" && isSameMonth(txDate, today)) {
					timeframePrints++;
					timeframeRevenue += tx.totalPrice || 0;
				} else if (timeframe === "Total") {
					timeframePrints++;
					timeframeRevenue += tx.totalPrice || 0;
				}
			}
		});

		const topTemplates = Object.entries(templateCounts)
			.map(([name, count]) => ({ name, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5);

		return {
			timeframePrints,
			timeframeRevenue,
			pendingQueue,
			totalRevenue,
			topTemplates,
			periods,
		};
	}, [transactions, timeframe]);

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300 pb-10">
			{/* Header */}
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-foreground">
						Document Metrics
					</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						Analytics and insights for all document transactions
					</p>
				</div>
				
				{/* Timeframe Toggles */}
				<div className="flex bg-card border border-border rounded-xl p-1 shrink-0">
					{(["Daily", "Weekly", "Monthly", "Total"] as const).map((t) => (
						<button
							key={t}
							type="button"
							onClick={() => setTimeframe(t)}
							className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
								timeframe === t 
									? "bg-primary hover:bg-primary/90 text-primary-foreground shadow-md" 
									: "text-muted-foreground hover:bg-accent hover:text-primary"
							}`}
						>
							{t}
						</button>
					))}
				</div>
			</div>

			{/* Top Cards */}
			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				{/* Prints Card */}
				<Card className="relative h-full overflow-hidden border-border border-border bg-card shadow-sm group hover:border-border transition-all duration-300">
					<div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
					<CardContent className="p-4 relative z-10">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h3 className="text-sm font-medium text-muted-foreground mb-1.5 truncate">
									{timeframe} Prints
								</h3>
								<div className="flex items-baseline gap-2 truncate">
									<span className="text-2xl font-bold tracking-tight text-foreground">
										{metrics.timeframePrints.toLocaleString()}
									</span>
								</div>
							</div>
							<div className="p-2.5 rounded-xl border text-primary bg-primary/10 border-primary/20 shrink-0">
								<FileText className="h-5 w-5" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Revenue Card */}
				<Card className="relative h-full overflow-hidden border-border border-border bg-card shadow-sm group hover:border-border transition-all duration-300">
					<div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
					<CardContent className="p-4 relative z-10">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h3 className="text-sm font-medium text-muted-foreground mb-1.5 truncate">
									{timeframe} Revenue
								</h3>
								<div className="flex items-baseline gap-2 truncate">
									<span className="text-2xl font-bold tracking-tight text-foreground">
										₱{metrics.timeframeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</span>
								</div>
							</div>
							<div className="p-2.5 rounded-xl border text-cyan-700 bg-cyan-100 border-cyan-200 shrink-0">
								<DollarSign className="h-5 w-5" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Pending Card */}
				<Card className="relative h-full overflow-hidden border-border border-border bg-card shadow-sm group hover:border-border transition-all duration-300">
					<div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
					<CardContent className="p-4 relative z-10">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h3 className="text-sm font-medium text-muted-foreground mb-1.5 truncate">
									Pending in Queue
								</h3>
								<div className="flex items-baseline gap-2 truncate">
									<span className="text-2xl font-bold tracking-tight text-foreground">
										{metrics.pendingQueue.toLocaleString()}
									</span>
								</div>
							</div>
							<div className="p-2.5 rounded-xl border text-amber-700 bg-amber-100 border-amber-200 shrink-0">
								<Clock className="h-5 w-5" />
							</div>
						</div>
					</CardContent>
				</Card>

				{/* Total Revenue Card */}
				<Card className="relative h-full overflow-hidden border-border border-border bg-card shadow-sm group hover:border-border transition-all duration-300">
					<div className="absolute inset-0 bg-background opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
					<CardContent className="p-4 relative z-10">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 flex-1">
								<h3 className="text-sm font-medium text-muted-foreground mb-1.5 truncate">
									Total Lifetime Revenue
								</h3>
								<div className="flex items-baseline gap-2 truncate">
									<span className="text-2xl font-bold tracking-tight text-foreground">
										₱{metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
									</span>
								</div>
							</div>
							<div className="p-2.5 rounded-xl border text-primary bg-primary/10 border-primary/20 shrink-0">
								<TrendingUp className="h-5 w-5" />
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Charts Section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Print Volume Trend */}
				<Card className="border-border border-border bg-card shadow-sm py-0 gap-0 flex flex-col">
					<CardHeader className="px-5 pt-5 pb-3">
						<CardTitle className="text-base font-bold text-foreground">
							Print Volume Trend
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-5 flex-1">
						<ChartContainer config={chartConfig} className="h-64 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={metrics.periods}>
									<CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e4e4e7" />
									<XAxis
										dataKey="label"
										tickLine={false}
										tickMargin={10}
										axisLine={false}
										stroke="#71717a"
									/>
									<YAxis hide />
									<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
									<Bar dataKey="prints" fill="#10b981" radius={4} barSize={30}>
										<LabelList position="top" offset={10} className="fill-foreground/70 text-xs font-semibold" />
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Sales Trend */}
				<Card className="border-border border-border bg-card shadow-sm py-0 gap-0 flex flex-col">
					<CardHeader className="px-5 pt-5 pb-3">
						<CardTitle className="text-base font-bold text-foreground">
							Sales / Revenue Trend
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-5 flex-1">
						<ChartContainer config={chartConfig} className="h-64 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<AreaChart data={metrics.periods} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
									<defs>
										<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
											<stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
											<stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
										</linearGradient>
									</defs>
									<CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e4e4e7" />
									<XAxis
										dataKey="label"
										tickLine={false}
										tickMargin={10}
										axisLine={false}
										stroke="#71717a"
									/>
									<YAxis hide />
									<ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
									<Area
										type="monotone"
										dataKey="revenue"
										stroke="#06b6d4"
										strokeWidth={2}
										fillOpacity={1}
										fill="url(#colorRevenue)"
									/>
								</AreaChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>

				{/* Most Requested Templates */}
				<Card className="border-border border-border bg-card shadow-sm py-0 gap-0 lg:col-span-2">
					<CardHeader className="px-5 pt-5 pb-3">
						<CardTitle className="text-base font-bold text-foreground">
							Most Requested Documents
						</CardTitle>
					</CardHeader>
					<CardContent className="px-5 pb-5">
						<ChartContainer config={chartConfig} className="h-[300px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={metrics.topTemplates} layout="vertical" margin={{ top: 10, right: 40, left: 20, bottom: 0 }}>
									<CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e4e4e7" />
									<XAxis type="number" hide />
									<YAxis
										dataKey="name"
										type="category"
										tickLine={false}
										axisLine={false}
										stroke="#71717a"
										width={160}
										fontSize={13}
										tick={{ fill: "#52525b" }}
									/>
									<ChartTooltip cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} content={<ChartTooltipContent indicator="dashed" />} />
									<Bar dataKey="count" fill="#a855f7" radius={4} barSize={25}>
										<LabelList dataKey="count" position="right" offset={10} className="fill-purple-700 font-bold" />
									</Bar>
								</BarChart>
							</ResponsiveContainer>
						</ChartContainer>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
