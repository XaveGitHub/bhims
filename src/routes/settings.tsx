import { createFileRoute } from "@tanstack/react-router";
import {
	AlertTriangle,
	Download,
	RefreshCw,
	Settings,
	Upload,
	CheckCircle2,
	AlertCircle,
	Loader2,
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

let cachedSettings: { barangayName: string } | null = null;

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

	// Loading & statuses
	const [loading, setLoading] = useState(!cachedSettings);
	const [saving, setSaving] = useState(false);
	const [backingUp, setBackingUp] = useState(false);
	const [restoring, setRestoring] = useState(false);
	const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);


	const loadSettings = useCallback(async (force = false) => {
		if (!force && cachedSettings) {
			setBrgyName(cachedSettings.barangayName);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const data = await getSettings();
			setBrgyName(data.barangayName);
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
		if (!brgyName) {
			toast("Barangay Name is required", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
			return;
		}

		setSaving(true);

		try {
			const result = await updateSettings({
				data: { barangayName: brgyName },
			});
			if (result.success) {
				toast("Settings updated successfully", { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> });
				// Refresh page branding
				setTimeout(() => {
					window.location.reload();
				}, 500);
			}
		} catch (err) {
			toast("Failed to save settings", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
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

				toast("Backup downloaded successfully", { icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" /> });
			} else {
				toast("Failed to create backup: No data received", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
			}
		} catch (err) {
			toast("An error occurred during backup", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
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
					toast("Database restored successfully! Reloading", { icon: <Upload className="h-4 w-4 text-primary" /> });
					setTimeout(() => {
						window.location.href = "/";
					}, 2000);
				} else {
					toast(result.error || "Failed to restore database", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
				}
			} catch (err) {
				toast("Failed to read backup file", { icon: <AlertCircle className="h-4 w-4 text-red-500" /> });
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
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div>
				<h2 className="text-2xl font-bold tracking-tight text-foreground">
					System Settings
				</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Manage system configurations, and database backups.
				</p>
			</div>

			{/* Settings Form */}
			<Card className="rounded-xl border-border bg-card shadow-sm p-6 space-y-6">
				<form onSubmit={handleSaveSettings} className="space-y-6">
					<h3 className="text-lg font-bold text-foreground flex items-center gap-2">
						<Settings className="h-4.5 w-4.5 text-primary" />
						<span>Barangay Customization</span>
					</h3>

					<div className="space-y-4">
						{/* Barangay Name */}
						<div className="space-y-2">
							<Label htmlFor="barangay-name" className="text-foreground">
								Barangay Name
							</Label>
							<Input
								id="barangay-name"
								value={brgyName}
								onChange={(e) => setBrgyName(e.target.value)}
								placeholder="e.g. Barangay Handumanan"
								className="bg-background border-border text-foreground placeholder:text-muted-foreground focus:border-primary/20 rounded-xl"
							/>
						</div>
					</div>

					<Button
						type="submit"
						disabled={saving}
						className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl px-5 text-sm font-semibold active:scale-95 transition-all shadow-md shadow-primary/20"
					>
						{saving ? (
							<div className="flex items-center gap-2">
								<Loader2 className="w-4 h-4 animate-spin" />
								Saving
							</div>
						) : (
							"Save Settings"
						)}
					</Button>
				</form>
			</Card>

			{/* Database Backup & Restore */}
			<Card className="rounded-xl border-border bg-card shadow-sm p-6 space-y-6">
				<div>
					<h3 className="text-lg font-bold text-foreground flex items-center gap-2">
						<Download className="h-4.5 w-4.5 text-primary" />
						<span>Database Backup & Restore</span>
					</h3>
					<p className="text-xs text-muted-foreground mt-1">
						Safeguard your data. Download database snapshots or restore records
						from a backup file.
					</p>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					{/* Backup */}
					<div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-4">
						<div className="space-y-1">
							<h4 className="font-bold text-sm text-foreground">
								Download Backup
							</h4>
							<p className="text-[10px] text-muted-foreground leading-normal">
								Generates a secure snapshot containing all residents,
								households, and setup settings.
							</p>
						</div>
						<Button
							type="button"
							onClick={handleBackup}
							disabled={backingUp}
							className="bg-primary/5 hover:bg-primary/15 text-primary border border-primary/20 rounded-xl px-5 text-xs font-semibold w-full sm:w-auto flex items-center justify-center gap-2 transition-colors"
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
					<div className="p-4 rounded-xl border border-border bg-card flex flex-col justify-between space-y-4">
						<div className="space-y-1">
							<h4 className="font-bold text-sm text-foreground">
								Restore Backup
							</h4>
							<p className="text-[10px] text-muted-foreground leading-normal">
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
							className="bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-500 border border-red-500/20 rounded-xl py-2 px-4 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
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
				<div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3 shadow-sm">
					<AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
					<div className="space-y-1">
						<span className="text-sm font-bold text-amber-700 dark:text-amber-500">Important Notice</span>
						<p className="text-amber-700/90 dark:text-amber-500/90 text-sm leading-relaxed">
							SQLite database files are fully self-contained. For daily backups,
							we recommend downloading the backup `.db` file and saving it to an
							external USB flash drive. Keep backups in a secure place.
						</p>
					</div>
				</div>
			</Card>



			{/* RESTORE CONFIRMATION DIALOG */}
			<Dialog
				open={isRestoreConfirmOpen}
				onOpenChange={setIsRestoreConfirmOpen}
			>
				<DialogContent className="max-w-md bg-background border-border/60 shadow-md text-foreground p-6 sm:rounded-xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
							<AlertTriangle className="h-5 w-5 text-red-600" />
							<span>Confirm Database Overwrite</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-foreground/80">
							WARNING: Restoring a backup will completely overwrite your current
							database records. This action cannot be undone. Do you wish to
							proceed?
						</p>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsRestoreConfirmOpen(false)}
								className="rounded-xl bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900 px-5"
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
