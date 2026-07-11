import { useState, useEffect } from "react";
import { Loader2, Plus, GripVertical, X, Pencil, Check, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { getPuroks, addPurok, updatePurok, deletePurok } from "../lib/residents-service";

interface ManagePuroksModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPuroksChanged: () => void;
}

export function ManagePuroksModal({ open, onOpenChange, onPuroksChanged }: ManagePuroksModalProps) {
	const [puroks, setPuroks] = useState<any[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isAdding, setIsAdding] = useState(false);
	const [newPurokName, setNewPurokName] = useState("");
	const [editingId, setEditingId] = useState<number | null>(null);
	const [editingName, setEditingName] = useState("");

	useEffect(() => {
		if (open) {
			loadPuroks();
		}
	}, [open]);

	const loadPuroks = async () => {
		setIsLoading(true);
		try {
			const data = await getPuroks();
			setPuroks(data);
		} catch (error) {
			toast.error("Failed to load puroks");
		} finally {
			setIsLoading(false);
		}
	};

	const handleAdd = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!newPurokName.trim()) return;
		
		setIsAdding(true);
		try {
			const res = await addPurok({ data: newPurokName.trim() });
			if (res.success) {
				toast.success("Purok added!");
				setNewPurokName("");
				loadPuroks();
				onPuroksChanged();
			} else {
				toast.error(res.error || "Failed to add purok");
			}
		} catch (error) {
			toast.error("An error occurred");
		} finally {
			setIsAdding(false);
		}
	};

	const handleSaveEdit = async (purok: any) => {
		if (!editingName.trim() || editingName === purok.name) {
			setEditingId(null);
			return;
		}

		try {
			const res = await updatePurok({ data: { id: purok.id, oldName: purok.name, newName: editingName.trim() } });
			if (res.success) {
				toast.success("Purok renamed! All linked residents were updated.");
				setEditingId(null);
				loadPuroks();
				onPuroksChanged();
			} else {
				toast.error(res.error || "Failed to rename");
			}
		} catch (error) {
			toast.error("An error occurred");
		}
	};

	const handleDelete = async (id: number) => {
		if (!confirm("Are you sure? This deletes the Purok but leaves residents' current text intact until re-assigned.")) return;
		
		try {
			const res = await deletePurok({ data: id });
			if (res.success) {
				toast.success("Purok deleted");
				loadPuroks();
				onPuroksChanged();
			} else {
				toast.error(res.error || "Failed to delete");
			}
		} catch (error) {
			toast.error("An error occurred");
		}
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-md bg-background border-border">
				<DialogHeader>
					<DialogTitle className="text-xl font-bold tracking-tight text-foreground">
						Manage Puroks
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4 pt-2">
					<form onSubmit={handleAdd} className="flex gap-2">
						<Input 
							value={newPurokName}
							onChange={(e) => setNewPurokName(e.target.value)}
							placeholder="Add new Purok..."
							className="bg-card border-border text-foreground focus-visible:ring-primary/50 rounded-xl"
							disabled={isAdding}
						/>
						<Button type="submit" disabled={isAdding || !newPurokName.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 rounded-xl">
							{isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
							Add
						</Button>
					</form>

					<div className="border border-border rounded-xl overflow-hidden bg-card/50 max-h-[400px] overflow-y-auto">
						{isLoading ? (
							<div className="p-8 flex justify-center">
								<Loader2 className="w-6 h-6 animate-spin text-primary" />
							</div>
						) : puroks.length === 0 ? (
							<div className="p-8 text-center text-muted-foreground text-sm">
								No puroks found. Add one above.
							</div>
						) : (
							<div className="divide-y divide-border">
								{puroks.map((purok) => (
									<div key={purok.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors group">
										<div className="flex items-center gap-3 flex-1 min-w-0">
											<GripVertical className="w-4 h-4 text-muted-foreground cursor-grab opacity-50 hover:opacity-100" />
											{editingId === purok.id ? (
												<Input
													value={editingName}
													onChange={(e) => setEditingName(e.target.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter') handleSaveEdit(purok);
														if (e.key === 'Escape') setEditingId(null);
													}}
													className="h-8 bg-background border-primary/20 text-foreground"
													autoFocus
												/>
											) : (
												<span className="font-medium text-foreground truncate">{purok.name}</span>
											)}
										</div>
										<div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
											{editingId === purok.id ? (
												<>
													<Button variant="ghost" size="icon" className="w-8 h-8 text-primary hover:bg-primary/10" onClick={() => handleSaveEdit(purok)}>
														<Check className="w-4 h-4" />
													</Button>
													<Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:bg-muted" onClick={() => setEditingId(null)}>
														<X className="w-4 h-4" />
													</Button>
												</>
											) : (
												<>
													<Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => { setEditingId(purok.id); setEditingName(purok.name); }}>
														<Pencil className="w-4 h-4" />
													</Button>
													<Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={() => handleDelete(purok.id)}>
														<Trash2 className="w-4 h-4" />
													</Button>
												</>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
					<p className="text-xs text-muted-foreground text-center">
						Renaming a Purok will automatically update all residents currently linked to it.
					</p>
				</div>
			</DialogContent>
		</Dialog>
	);
}
