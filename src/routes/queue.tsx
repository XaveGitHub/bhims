import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getActiveQueue, updateTransactionStatus } from "../lib/queue-service";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { User, FileText, CheckCircle2, Clock, Loader2, RefreshCw, Ban, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import Draggable from "react-draggable";
import { useRef } from "react";
import { QueueVerificationPane } from "../components/QueueVerificationPane";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

export const Route = createFileRoute("/queue")({
	component: QueueDashboard,
});

function QueueDashboard() {
	const [queue, setQueue] = useState<any[]>([]);
	const [loading, setLoading] = useState(true);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [selectedBatch, setSelectedBatch] = useState<any>(null);
	const [cancelBatch, setCancelBatch] = useState<any>(null);
	const dragNodeRef = useRef(null);

	const loadQueue = async (silent = false) => {
		if (!silent) setLoading(true);
		setIsRefreshing(true);
		try {
			const data = await getActiveQueue();
			setQueue(data);
		} catch (error) {
			console.error("Failed to load queue:", error);
			if (!silent) toast.error("Failed to load queue.");
		} finally {
			setLoading(false);
			setIsRefreshing(false);
		}
	};

	// Initial load and polling
	useEffect(() => {
		loadQueue();
		const interval = setInterval(() => {
			loadQueue(true);
		}, 3000); // 3-second polling
		return () => clearInterval(interval);
	}, []);

	const handleStatusChange = async (transactionIds: number[], newStatus: string) => {
		try {
			const result = await updateTransactionStatus({ 
				data: { transactionIds, newStatus } 
			});
			if (result.success) {
				toast.success(`Marked as ${newStatus}`);
				loadQueue(true); // Refresh instantly
			}
		} catch (error) {
			toast.error("Failed to update status.");
		}
	};

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-foreground">
						Staff Queue Dashboard
					</h2>
					<p className="text-sm text-muted-foreground mt-0.5">
						Manage incoming document requests from the Kiosk.
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="outline"
						onClick={() => loadQueue()}
						disabled={isRefreshing}
						className="bg-card border-border text-foreground/80 hover:bg-muted hover:text-foreground rounded-xl px-4"
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>
			</div>

			{loading && queue.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : queue.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-card/20 border border-border rounded-xl border-dashed">
					<CheckCircle2 className="h-16 w-16 text-muted-foreground mb-4" />
					<h3 className="text-xl font-medium text-foreground/80">All Caught Up!</h3>
					<p className="text-muted-foreground mt-2 max-w-sm">
						The queue is currently empty. Waiting for new requests from the Kiosk.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{queue.map((item) => (
						<Card 
							key={item.queueNumber} 
							className="flex flex-col h-full transition-all"
						>
							<CardHeader className="pb-0 pt-6 px-6">
								<div className="flex flex-col items-center justify-center">
									<p className="text-sm font-medium text-muted-foreground">Queue Number</p>
									<CardTitle className="text-6xl font-semibold tracking-tighter mt-1 text-foreground">
										{item.queueNumber.toString().padStart(4, '0')}
									</CardTitle>
									{(() => {
										const statusConfig: Record<string, { style: string; icon: any }> = {
											"Ready to Claim": { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle },
											Completed: { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle2 },
											Released: { style: "bg-emerald-50 text-emerald-600 border-emerald-200/60", icon: CheckCircle2 },
											Processing: { style: "bg-accent/50 text-primary border-primary/20", icon: Loader2 },
											Pending: { style: "bg-amber-50 text-amber-600 border-amber-200/60", icon: Clock },
											Cancelled: { style: "bg-red-50 text-red-600 border-red-200/60", icon: XCircle },
										};
										const config = statusConfig[item.status] || { style: "bg-accent/15 text-muted-foreground", icon: AlertCircle };
										
										return (
											<Badge variant="outline" className={`mt-3 font-medium shadow-none ${config.style}`} icon={config.icon}>
												{item.status}
											</Badge>
										);
									})()}
								</div>
							</CardHeader>
							<CardContent className="pt-0 px-6 flex-1 flex flex-col">
								<div className="space-y-4">
									<div className="flex items-start gap-3">
										<User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-muted-foreground">Resident</p>
											<p className="text-sm text-foreground">
												{item.resident?.firstName} {item.resident?.lastName}
											</p>
										</div>
									</div>
									<div className="flex items-start gap-3">
										<FileText className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-muted-foreground">Document Requested</p>
											<p className="text-sm text-foreground">
												{item.items.length === 1 
													? item.items[0].template?.name 
													: `${item.items.length} Documents`}
											</p>
											{item.items.length > 1 && item.items.length <= 3 && (
												<p className="text-xs text-muted-foreground mt-0.5 leading-tight">
													{item.items.map((i: any) => i.template?.name).join(", ")}
												</p>
											)}
										</div>
									</div>
									<div className="flex items-start gap-3">
										<Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-muted-foreground">Time Requested</p>
											<p className="text-sm text-foreground/80">
												{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
											</p>
										</div>
									</div>
								</div>

								<div className="mt-auto pt-6 flex gap-2 w-full">
									<Button 
										variant="ghost" 
										className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-4 shrink-0"
										onClick={() => setCancelBatch(item)}
									>
										Cancel
									</Button>

									{item.status === 'Pending' && (
										<Button 
											className= "flex-1  bg-amber-500 hover:bg-amber-500/90 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(245,158,11,0.2)]"
											onClick={async () => {
												await handleStatusChange(item.items.map((i: any) => i.id), 'Processing');
												setSelectedBatch(item);
											}}
										>
											Process Request
										</Button>
									)}
									
									{item.status === 'Processing' && (
										<Button 
											className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl"
											onClick={() => setSelectedBatch(item)}
										>
											Verify & Print
										</Button>
									)}
									
									{item.status === 'Ready to Claim' && (
										<Button 
											className="flex-1 bg-emerald-600 hover:bg-emerald-600/90 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)] rounded-xl"
											onClick={() => handleStatusChange(item.items.map((i: any) => i.id), 'Completed')}
										>
											<CheckCircle2 className="w-4 h-4 mr-2" />
											Mark as Claimed
										</Button>
									)}
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			{/* Document Verification Pane */}
			{selectedBatch && (
				<>
					{/* Backdrop — click outside to close */}
					<div
						className="fixed inset-0 z-40"
						onClick={() => setSelectedBatch(null)}
					/>
					<Draggable
						nodeRef={dragNodeRef}
						handle=".drag-handle"
						cancel=".no-drag"
					>
						<div
							ref={dragNodeRef}
							className="fixed top-[5vh] left-1/2 -translate-x-1/2 w-[1300px] h-[85vh] max-h-[900px] z-50 pointer-events-none [&>*]:pointer-events-auto"
						>
							<QueueVerificationPane
								batch={selectedBatch}
								onClose={() => setSelectedBatch(null)}
								onStatusChange={handleStatusChange}
							/>
						</div>
					</Draggable>
				</>
			)}

			<Dialog open={!!cancelBatch} onOpenChange={() => setCancelBatch(null)}>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground flex items-center gap-2">
							<Ban className="h-5 w-5 text-red-500" />
							<span>Cancel Request</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							Are you absolutely sure you want to cancel this queue request? This action cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button 
								type="button" 
								variant="ghost"
								className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5" 
								onClick={() => setCancelBatch(null)}
							>
								No, keep it
							</Button>
							<Button 
								type="button"
								className="bg-red-600 hover:bg-red-500 text-foreground rounded-xl px-5"
								onClick={async () => {
									await handleStatusChange(cancelBatch.items.map((i: any) => i.id), 'Cancelled');
									setCancelBatch(null);
								}}
							>
								Yes, Cancel Request
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
