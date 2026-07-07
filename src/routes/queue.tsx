import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getActiveQueue, updateTransactionStatus } from "../lib/queue-service";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { User, FileText, CheckCircle2, Clock, Loader2, RefreshCw, Ban } from "lucide-react";
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
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Staff Queue Dashboard
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Manage incoming document requests from the Kiosk.
					</p>
				</div>
				<div className="flex items-center gap-2 shrink-0">
					<Button
						variant="outline"
						onClick={() => loadQueue()}
						disabled={isRefreshing}
						className="bg-neutral-900 border-neutral-800 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 rounded-xl px-4"
					>
						<RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
						Refresh
					</Button>
				</div>
			</div>

			{loading && queue.length === 0 ? (
				<div className="flex-1 flex items-center justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
				</div>
			) : queue.length === 0 ? (
				<div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-neutral-900/20 border border-neutral-800/50 rounded-3xl border-dashed">
					<CheckCircle2 className="h-16 w-16 text-neutral-700 mb-4" />
					<h3 className="text-xl font-medium text-neutral-300">All Caught Up!</h3>
					<p className="text-neutral-500 mt-2 max-w-sm">
						The queue is currently empty. Waiting for new requests from the Kiosk.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{queue.map((item) => (
						<Card 
							key={item.queueNumber} 
							className={`bg-neutral-950 rounded-3xl border-2 transition-all ${
								item.status === 'Pending' ? 'border-neutral-800 hover:border-neutral-700' :
								item.status === 'Processing' ? 'border-blue-900/50 shadow-[0_0_15px_rgba(59,130,246,0.1)]' :
								'border-emerald-900/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
							}`}
						>
							<CardHeader className="pb-0 pt-6 px-6">
								<div className="flex flex-col items-center justify-center">
									<p className="text-xs font-bold tracking-widest text-neutral-500">Queue Number</p>
									<CardTitle className="text-5xl font-black tabular-nums tracking-tighter mt-1 text-white">
										{item.queueNumber.toString().padStart(4, '0')}
									</CardTitle>
									<Badge variant="outline" className={`mt-3
										${item.status === 'Pending' ? 'text-neutral-400 border-neutral-800' : ''}
										${item.status === 'Processing' ? 'text-blue-400 border-blue-900/50 bg-blue-950/30' : ''}
										${item.status === 'Ready to Claim' ? 'text-emerald-400 border-emerald-900/50 bg-emerald-950/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : ''}
									`}>
										{item.status}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="pt-0 px-6 space-y-4">
								<div className="space-y-3">
									<div className="flex items-start gap-3">
										<User className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-neutral-400">Resident</p>
											<p className="font-semibold text-neutral-200">
												{item.resident?.firstName} {item.resident?.lastName}
											</p>
										</div>
									</div>
									<div className="flex items-start gap-3">
										<FileText className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-neutral-400">Document Requested</p>
											<p className="font-medium text-neutral-200">
												{item.items.length === 1 
													? item.items[0].template?.name 
													: `${item.items.length} Documents`}
											</p>
											{item.items.length > 1 && (
												<p className="text-xs text-neutral-500 mt-0.5">
													{item.items.map((i: any) => i.template?.name).join(", ")}
												</p>
											)}
										</div>
									</div>
									<div className="flex items-start gap-3">
										<Clock className="h-5 w-5 text-neutral-500 shrink-0 mt-0.5" />
										<div>
											<p className="text-sm text-neutral-400">Time Requested</p>
											<p className="text-sm text-neutral-300">
												{new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
											</p>
										</div>
									</div>
								</div>

								<div className="mt-4 flex gap-2 w-full">
									<Button 
										variant="outline" 
										className="border-neutral-800 text-neutral-400 hover:bg-red-950/30 hover:text-red-400 hover:border-red-900/50 shrink-0 px-3 rounded-xl"
										onClick={() => setCancelBatch(item)}
									>
										Cancel
									</Button>

									{item.status === 'Pending' && (
										<Button 
											className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
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
											className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl"
											onClick={() => setSelectedBatch(item)}
										>
											Verify & Print
										</Button>
									)}
									
									{item.status === 'Ready to Claim' && (
										<Button 
											className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-[0_0_15px_rgba(16,185,129,0.2)] rounded-xl"
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
							className="fixed top-[5vh] left-1/2 -translate-x-1/2 w-[1300px] h-[85vh] max-h-[900px] shadow-2xl z-50 pointer-events-none [&>*]:pointer-events-auto"
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
				<DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100 flex items-center gap-2">
							<Ban className="h-5 w-5 text-red-500" />
							<span>Cancel Request</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-neutral-300">
							Are you absolutely sure you want to cancel this queue request? This action cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button 
								type="button" 
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5" 
								onClick={() => setCancelBatch(null)}
							>
								No, keep it
							</Button>
							<Button 
								type="button"
								className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
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
