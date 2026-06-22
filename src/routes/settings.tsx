import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Download,
	Eye,
	EyeOff,
	RefreshCw,
	Settings,
	ShieldAlert,
	Trash2,
	Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
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
	clearAllData,
	downloadBackup,
	getSettings,
	restoreBackup,
	updateSettings,
} from "../lib/settings-service";

export const Route = createFileRoute("/settings")({
	component: SettingsView,
});

let cachedSettings: { barangayName: string; pin: string } | null = null;

// Manual prefetcher for hover-optimizations
export const prefetchSettingsData = async () => {
	try {
		if (!cachedSettings) {
			cachedSettings = await getSettings();
		}
	} catch (err) {
		// Silent fail
	}
};

function SettingsView() {
	const restoreInputRef = useRef<HTMLInputElement>(null);

	// Settings Form state
	const [brgyName, setBrgyName] = useState(cachedSettings?.barangayName || "");
	const [pin, setPin] = useState(cachedSettings?.pin || "");
	const [showPin, setShowPin] = useState(false);

	// Loading & statuses
	const [loading, setLoading] = useState(!cachedSettings);
	const [saving, setSaving] = useState(false);
	const [backingUp, setBackingUp] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
	const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
	const [deleteConfirmText, setDeleteConfirmText] = useState("");
	const [deleting, setDeleting] = useState(false);

	const loadSettings = useCallback(async () => {
		if (cachedSettings) {
			setBrgyName(cachedSettings.barangayName);
			setPin(cachedSettings.pin);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const data = await getSettings();
			setBrgyName(data.barangayName);
			setPin(data.pin);
			cachedSettings = data;
		} catch (err) {
			console.error("Error fetching settings:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadSettings();
	}, [loadSettings]);

	const handleSaveSettings = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!brgyName || !pin) {
			toast.error("Barangay Name and PIN are required.");
			return;
		}
		if (pin.length < 4) {
			toast.error("Access Key must be at least 4 characters.");
			return;
		}

		setSaving(true);

		try {
			const result = await updateSettings({
				data: { barangayName: brgyName, pin },
			});
			if (result.success) {
				toast.success("Settings updated successfully.");
				// Refresh page branding
				setTimeout(() => {
					window.location.reload();
				}, 500);
			}
		} catch (err) {
			toast.error("Failed to save settings.");
		} finally {
			setSaving(false);
		}
	};

	const handleBackup = async () => {
		setBackingUp(true);

		try {
			const { filename, data: base64 } = await downloadBackup();

			if (base64) {
				// Base64 to blob
				const byteCharacters = window.atob(base64);
				const byteNumbers = new Array(byteCharacters.length);
				for (let i = 0; i < byteCharacters.length; i++) {
					byteNumbers[i] = byteCharacters.charCodeAt(i);
				}
				const byteArray = new Uint8Array(byteNumbers);
				const blob = new Blob([byteArray], { type: "application/x-sqlite3" });

				// Download
				const url = window.URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = filename;
				document.body.appendChild(a);
				a.click();
				window.URL.revokeObjectURL(url);
				document.body.removeChild(a);

				toast.success("Backup downloaded successfully.");
			} else {
				toast.error("Failed to create backup: No data received.");
			}
		} catch (err) {
			toast.error("An error occurred during backup.");
		} finally {
			setBackingUp(false);
		}
	};

	const handleRestoreClick = () => {
		setIsRestoreConfirmOpen(true);
	};

	const confirmRestore = () => {
		setIsRestoreConfirmOpen(false);
		restoreInputRef.current?.click();
	};

	const handleDeleteAll = async () => {
		if (deleteConfirmText !== "DELETE ALL") return;
		setDeleting(true);
		try {
			const result = await clearAllData({ data: "DELETE ALL" });
			if (result.success) {
				toast.success("All data has been deleted. Reloading...");
				setIsDeleteAllOpen(false);
				setDeleteConfirmText("");
				setTimeout(() => {
					window.location.href = "/";
				}, 1500);
			} else {
				toast.error(result.error || "Failed to delete data.");
			}
		} catch {
			toast.error("An unexpected error occurred.");
		} finally {
			setDeleting(false);
		}
	};

	const handleRestoreFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setRestoring(true);

		const reader = new FileReader();
		reader.onload = async (event) => {
			try {
				const arrayBuffer = event.target?.result as ArrayBuffer;
				const bytes = new Uint8Array(arrayBuffer);

				// Convert to base64
				let binary = "";
				const len = bytes.byteLength;
				for (let i = 0; i < len; i++) {
					binary += String.fromCharCode(bytes[i]);
				}
				const base64 = window.btoa(binary);

				const result = await restoreBackup({ data: base64 });
				if (result.success) {
					toast.success(
						"Database restored successfully! Reloading application...",
					);
					setTimeout(() => {
						window.location.href = "/";
					}, 2000);
				} else {
					toast.error(result.error || "Failed to restore database.");
				}
			} catch (err) {
				toast.error("Failed to read backup file.");
			} finally {
				setRestoring(false);
				// Reset file input value
				if (restoreInputRef.current) restoreInputRef.current.value = "";
			}
		};

		reader.readAsArrayBuffer(file);
	};

	if (loading) {
		return (
			<div className="flex h-[60vh] items-center justify-center">
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div>
				<h2 className="text-2xl font-extrabold tracking-tight text-neutral-100">
					System Settings
				</h2>
				<p className="text-sm text-neutral-400 mt-1">
					Manage system configurations, user passwords, and database backups.
				</p>
			</div>

			{/* Settings Form */}
			<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg p-6 space-y-6">
				<form onSubmit={handleSaveSettings} className="space-y-6">
					<h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
						<Settings className="h-4.5 w-4.5 text-emerald-500" />
						<span>Barangay Customization</span>
					</h3>

					<div className="space-y-4">
						{/* Barangay Name */}
						<div className="space-y-2">
							<Label htmlFor="barangay-name" className="text-neutral-200">
								Barangay Name
							</Label>
							<Input
								id="barangay-name"
								value={brgyName}
								onChange={(e) => setBrgyName(e.target.value)}
								placeholder="e.g. Barangay Handumanan"
								className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-emerald-500 rounded-xl"
							/>
						</div>

						{/* Access PIN */}
						<div className="space-y-2">
							<Label htmlFor="system-pin" className="text-neutral-200">
								Shared Login PIN
							</Label>
							<div className="relative">
								<Input
									id="system-pin"
									type={showPin ? "text" : "password"}
									value={pin}
									onChange={(e) => setPin(e.target.value.slice(0, 32))}
									placeholder="Access key used for locking"
									className="bg-neutral-950 border-neutral-800 text-white placeholder:text-neutral-500 focus:border-emerald-500 rounded-xl pr-10 tracking-widest font-mono"
								/>
								<button
									type="button"
									onClick={() => setShowPin(!showPin)}
									className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-300"
								>
									{showPin ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
							<p className="text-[10px] text-neutral-500">
								Can be any letters, numbers, or symbols (4 to 32 characters).
							</p>
						</div>
					</div>

					<Button
						type="submit"
						disabled={saving}
						className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 text-sm font-semibold active:scale-95 transition-all shadow-md shadow-emerald-950/20"
					>
						{saving ? "Saving..." : "Save Settings"}
					</Button>
				</form>
			</Card>

			{/* Database Backup & Restore */}
			<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg p-6 space-y-6">
				<div>
					<h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
						<Download className="h-4.5 w-4.5 text-emerald-500" />
						<span>Database Backup & Restore</span>
					</h3>
					<p className="text-xs text-neutral-400 mt-1">
						Safeguard your data. Download database snapshots or restore records
						from a backup file.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					{/* Backup */}
					<div className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-950/20 flex flex-col justify-between space-y-4">
						<div className="space-y-1">
							<h4 className="font-bold text-sm text-neutral-200">
								Download Backup
							</h4>
							<p className="text-[10px] text-neutral-500 leading-normal">
								Generates a secure snapshot containing all residents,
								households, and setup settings.
							</p>
						</div>
						<Button
							type="button"
							onClick={handleBackup}
							disabled={backingUp}
							className="bg-neutral-800 hover:bg-neutral-700 text-emerald-400 border border-emerald-900/30 rounded-xl px-5 text-xs font-semibold w-full sm:w-auto flex items-center justify-center gap-2"
						>
							{backingUp ? (
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Download className="h-3.5 w-3.5" />
							)}
							<span>Backup Database (.db)</span>
						</Button>
					</div>

					{/* Restore */}
					<div className="p-4 rounded-xl border border-neutral-800/80 bg-neutral-950/20 flex flex-col justify-between space-y-4">
						<div className="space-y-1">
							<h4 className="font-bold text-sm text-neutral-200">
								Restore Backup
							</h4>
							<p className="text-[10px] text-neutral-500 leading-normal">
								Upload a previously saved `.db` file to overwrite the current
								records in the database.
							</p>
						</div>

						<input
							type="file"
							ref={restoreInputRef}
							onChange={handleRestoreFileChange}
							accept=".db"
							className="hidden"
						/>

						<Button
							type="button"
							onClick={handleRestoreClick}
							disabled={restoring}
							className="bg-red-950/20 hover:bg-red-900/30 text-red-400 border border-red-900/30 rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2"
						>
							{restoring ? (
								<RefreshCw className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Upload className="h-3.5 w-3.5" />
							)}
							<span>Restore Database (.db)</span>
						</Button>
					</div>
				</div>

				{/* Warnings */}
				<div className="p-4 bg-amber-950/30 border border-amber-900/40 rounded-xl text-xs text-amber-500 flex items-start gap-3 leading-relaxed">
					<AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
					<div className="space-y-1">
						<span className="font-bold">Important Notice:</span>
						<p>
							SQLite database files are fully self-contained. For daily backups,
							we recommend downloading the backup `.db` file and saving it to an
							external USB flash drive. Keep backups in a secure place.
						</p>
					</div>
				</div>
			</Card>

			{/* Danger Zone */}
			<Card className="rounded-2xl border-red-900/40 bg-red-950/10 backdrop-blur-xl shadow-lg p-6 space-y-5">
				<div>
					<h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
						<ShieldAlert className="h-4.5 w-4.5" />
						<span>Danger Zone</span>
					</h3>
					<p className="text-xs text-neutral-400 mt-1">
						Destructive actions that cannot be undone. Proceed with extreme caution.
					</p>
				</div>

				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-red-900/30 bg-neutral-950/30">
					<div className="space-y-1">
						<h4 className="font-bold text-sm text-neutral-200">Delete All Records</h4>
						<p className="text-[10px] text-neutral-500 leading-normal max-w-sm">
							Permanently removes <strong className="text-neutral-400">all residents and household records</strong> from the database.
							System settings (barangay name, PIN) are preserved. This action is irreversible.
						</p>
					</div>
					<Button
						type="button"
						onClick={() => { setDeleteConfirmText(""); setIsDeleteAllOpen(true); }}
						className="shrink-0 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-800/50 hover:border-red-700 rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 transition-all"
					>
						<Trash2 className="h-3.5 w-3.5" />
						Delete All Data
					</Button>
				</div>
			</Card>

			{/* DELETE ALL CONFIRMATION DIALOG */}
			<Dialog
				open={isDeleteAllOpen}
				onOpenChange={(open) => {
					if (!deleting) {
						setIsDeleteAllOpen(open);
						if (!open) setDeleteConfirmText("");
					}
				}}
			>
				<DialogContent className="max-w-md bg-neutral-900 border-red-900/50 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-red-400 flex items-center gap-2">
							<Trash2 className="h-5 w-5" />
							<span>Delete All Records</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<div className="p-3 rounded-xl bg-red-950/40 border border-red-900/50">
							<p className="text-sm text-red-300 leading-relaxed">
								⚠️ This will <strong>permanently delete every resident and household record</strong> in the system.
								This cannot be undone. Make sure you have a backup before proceeding.
							</p>
						</div>

						<div className="space-y-2">
							<Label htmlFor="delete-confirm" className="text-sm text-neutral-300">
								Type <strong className="text-red-400 font-mono">DELETE ALL</strong> to confirm:
							</Label>
							<Input
								id="delete-confirm"
								value={deleteConfirmText}
								onChange={(e) => setDeleteConfirmText(e.target.value)}
								placeholder="DELETE ALL"
								className="bg-neutral-950 border-red-900/50 text-white placeholder:text-neutral-600 focus:border-red-500 rounded-xl font-mono tracking-widest"
								disabled={deleting}
								autoComplete="off"
							/>
						</div>

						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								onClick={() => { setIsDeleteAllOpen(false); setDeleteConfirmText(""); }}
								disabled={deleting}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={handleDeleteAll}
								disabled={deleteConfirmText !== "DELETE ALL" || deleting}
								className="bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl px-5 flex items-center gap-2 transition-all"
							>
								{deleting ? (
									<><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Deleting...</>
								) : (
									<><Trash2 className="h-3.5 w-3.5" /> Delete Everything</>
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* RESTORE CONFIRMATION DIALOG */}
			<Dialog
				open={isRestoreConfirmOpen}
				onOpenChange={setIsRestoreConfirmOpen}
			>
				<DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100 flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-amber-500" />
							<span>Confirm Database Overwrite</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-neutral-300">
							WARNING: Restoring a backup will completely overwrite your current
							database records. This action cannot be undone. Do you wish to
							proceed?
						</p>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								onClick={() => setIsRestoreConfirmOpen(false)}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								onClick={confirmRestore}
								className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
							>
								Overwrite & Restore
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
