import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
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
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { Trash2 } from "lucide-react";
import { getUsers, updateUserAccount, createUserAccount, deleteUserAccount } from "../lib/auth-service";

export const Route = createFileRoute("/accounts")({
	component: AccountsView,
});

let cachedUsers: { id: number; username: string; role: string; name: string }[] | null = null;

// Manual prefetcher for hover-optimizations
export const prefetchAccountsData = async () => {
	try {
		if (!cachedUsers) {
			cachedUsers = await getUsers();
		}
	} catch (err) {
		// Silent fail
	}
};

function AccountsView() {
	// Users state
	const [usersList, setUsersList] = useState(cachedUsers || []);
	const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
	const [editUsername, setEditUsername] = useState("");
	const [editName, setEditName] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
	const [updatingAccount, setUpdatingAccount] = useState(false);
	
	// Create Account state
	const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
	const [createUsername, setCreateUsername] = useState("");
	const [createName, setCreateName] = useState("");
	const [createPassword, setCreatePassword] = useState("");
	const [createRole, setCreateRole] = useState<"admin" | "staff">("staff");
	const [creatingAccount, setCreatingAccount] = useState(false);

	// Delete Account state
	const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
	const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
	const [deletingAccount, setDeletingAccount] = useState(false);

	const [loading, setLoading] = useState(!cachedUsers);

	const loadUsers = useCallback(async (force = false) => {
		if (!force && cachedUsers) {
			setUsersList(cachedUsers);
			setLoading(false);
			return;
		}

		setLoading(true);
		try {
			const usersData = await getUsers();
			setUsersList(usersData);
			cachedUsers = usersData;
		} catch (err) {
			console.error("Error fetching users:", err);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadUsers();
	}, [loadUsers]);

	const handleEditAccountClick = (user: { id: number, username: string, name: string }) => {
		setSelectedUserId(user.id);
		setEditUsername(user.username);
		setEditName(user.name);
		setNewPassword("");
		setIsAccountModalOpen(true);
	};

	const handleUpdateAccount = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!selectedUserId || !editUsername || !editName) {
			toast.error("Username and Name are required.");
			return;
		}

		setUpdatingAccount(true);
		try {
			const result = await updateUserAccount({ 
				data: { 
					id: selectedUserId, 
					username: editUsername, 
					name: editName,
					newPassword: newPassword || undefined
				} 
			});
			if (result.success) {
				toast.success("Account updated successfully.");
				setIsAccountModalOpen(false);
				loadUsers(true); // Force reload users to show new names
			} else {
				toast.error(result.error || "Failed to update account.");
			}
		} catch (err) {
			toast.error("An unexpected error occurred.");
		} finally {
			setUpdatingAccount(false);
		}
	};

	const handleCreateAccountClick = () => {
		setCreateUsername("");
		setCreateName("");
		setCreatePassword("");
		setCreateRole("staff");
		setIsCreateModalOpen(true);
	};

	const handleCreateAccount = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!createUsername || !createName || !createPassword) {
			toast.error("All fields are required.");
			return;
		}

		setCreatingAccount(true);
		try {
			const result = await createUserAccount({ 
				data: { 
					username: createUsername, 
					name: createName,
					password: createPassword,
					role: createRole
				} 
			});
			if (result.success) {
				toast.success("Account created successfully.");
				setIsCreateModalOpen(false);
				loadUsers(true);
			} else {
				toast.error(result.error || "Failed to create account.");
			}
		} catch (err) {
			toast.error("An unexpected error occurred.");
		} finally {
			setCreatingAccount(false);
		}
	};

	const handleDeleteClick = (userId: number) => {
		setDeletingUserId(userId);
		setIsDeleteModalOpen(true);
	};

	const handleDeleteAccount = async () => {
		if (!deletingUserId) return;
		setDeletingAccount(true);
		try {
			const result = await deleteUserAccount({ data: { id: deletingUserId } });
			if (result.success) {
				toast.success("Account deleted successfully.");
				setIsDeleteModalOpen(false);
				loadUsers(true);
			} else {
				toast.error(result.error || "Failed to delete account.");
			}
		} catch (err) {
			toast.error("An unexpected error occurred.");
		} finally {
			setDeletingAccount(false);
		}
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
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-extrabold tracking-tight text-neutral-100">
						User Management
					</h2>
					<p className="text-sm text-neutral-400 mt-1">
						Manage passwords and account details for the Admin and Staff accounts.
					</p>
				</div>
				<Button
					onClick={handleCreateAccountClick}
					className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl px-4 py-2"
				>
					Add Account
				</Button>
			</div>

			<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg p-6 space-y-6">
				<div className="space-y-4">
					{usersList.map((user) => (
						<div key={user.id} className="flex items-center justify-between p-4 rounded-xl border border-neutral-800/80 bg-neutral-950/20">
							<div className="space-y-1">
								<h4 className="font-bold text-sm text-neutral-200">
									{user.name} <span className="text-neutral-500 font-normal">(@{user.username})</span>
								</h4>
								<div className="flex items-center gap-2">
									<span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${user.role === 'admin' ? 'bg-amber-950/40 text-amber-400 border border-amber-900/30' : 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30'}`}>
										{user.role}
									</span>
								</div>
							</div>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									onClick={() => handleEditAccountClick(user)}
									className="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800 rounded-xl px-4 text-xs font-semibold"
								>
									Edit Account
								</Button>
								<Button
									type="button"
									variant="outline"
									onClick={() => handleDeleteClick(user.id)}
									className="bg-red-950/20 hover:bg-red-900/40 text-red-400 border-red-900/30 rounded-xl px-3"
									title="Delete Account"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>
						</div>
					))}
				</div>
			</Card>

			{/* EDIT ACCOUNT DIALOG */}
			<Dialog
				open={isAccountModalOpen}
				onOpenChange={setIsAccountModalOpen}
			>
				<DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100">
							Edit Account
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleUpdateAccount} className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="edit-username">Username</Label>
							<Input
								id="edit-username"
								value={editUsername}
								onChange={(e) => setEditUsername(e.target.value)}
								placeholder="Login username"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="edit-name">Display Name</Label>
							<Input
								id="edit-name"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								placeholder="Full name"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="new-password">New Password (Optional)</Label>
							<Input
								id="new-password"
								type="password"
								value={newPassword}
								onChange={(e) => setNewPassword(e.target.value)}
								placeholder="Leave blank to keep current password"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
							/>
						</div>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsAccountModalOpen(false)}
								className="text-neutral-300 hover:text-white"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={updatingAccount}
								className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5"
							>
								{updatingAccount ? "Saving..." : "Save Changes"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* CREATE ACCOUNT DIALOG */}
			<Dialog
				open={isCreateModalOpen}
				onOpenChange={setIsCreateModalOpen}
			>
				<DialogContent className="max-w-md bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100">
							Add New Account
						</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleCreateAccount} className="mt-4 space-y-4">
						<div className="space-y-2">
							<Label htmlFor="create-role">Role</Label>
							<Select 
								value={createRole} 
								onValueChange={(val: "admin" | "staff") => setCreateRole(val)}
							>
								<SelectTrigger className="bg-neutral-950 border-neutral-800 text-white rounded-xl h-10 focus:ring-emerald-500/20">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-200">
									<SelectItem value="admin">Administrator</SelectItem>
									<SelectItem value="staff">Staff</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-username">Username</Label>
							<Input
								id="create-username"
								value={createUsername}
								onChange={(e) => setCreateUsername(e.target.value)}
								placeholder="Login username"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-name">Display Name</Label>
							<Input
								id="create-name"
								value={createName}
								onChange={(e) => setCreateName(e.target.value)}
								placeholder="Full name"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="create-password">Password</Label>
							<Input
								id="create-password"
								type="password"
								value={createPassword}
								onChange={(e) => setCreatePassword(e.target.value)}
								placeholder="Initial password"
								className="bg-neutral-950 border-neutral-800 text-white focus:border-emerald-500 rounded-xl"
								required
							/>
						</div>
						<div className="flex items-center justify-end gap-2 pt-4 border-t border-neutral-800">
							<Button
								type="button"
								variant="ghost"
								onClick={() => setIsCreateModalOpen(false)}
								className="text-neutral-300 hover:text-white"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={creatingAccount}
								className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5"
							>
								{creatingAccount ? "Adding..." : "Add Account"}
							</Button>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* DELETE CONFIRM DIALOG */}
			<Dialog
				open={isDeleteModalOpen}
				onOpenChange={setIsDeleteModalOpen}
			>
				<DialogContent className="max-w-sm bg-neutral-900 border-neutral-800 text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
							<Trash2 className="h-5 w-5" />
							Delete Account
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 text-neutral-300 text-sm">
						Are you sure you want to delete this account? This action cannot be undone.
					</div>
					<div className="flex items-center justify-end gap-2 pt-6">
						<Button
							type="button"
							variant="ghost"
							onClick={() => setIsDeleteModalOpen(false)}
							className="text-neutral-300 hover:text-white"
						>
							Cancel
						</Button>
						<Button
							type="button"
							onClick={handleDeleteAccount}
							disabled={deletingAccount}
							className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
						>
							{deletingAccount ? "Deleting..." : "Delete"}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
