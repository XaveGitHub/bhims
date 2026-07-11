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
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "../components/ui/table";
import { Trash2 } from "lucide-react";
import { getUsers, updateUserAccount, createUserAccount, deleteUserAccount } from "../lib/auth-service";

export const Route = createFileRoute("/accounts")({
	component: AccountsView,
});

let cachedUsers: { id: number; username: string; role: string; name: string }[] | null = null;


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
				<div className="h-8 w-8 animate-spin rounded-full border-4 border-primary/20 border-t-transparent" />
			</div>
		);
	}

	return (
		<div className="space-y-8 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h2 className="text-2xl font-extrabold tracking-tight text-foreground">
						User Management
					</h2>
					<p className="text-sm text-muted-foreground mt-1">
						Manage passwords and account details for the Admin and Staff accounts.
					</p>
				</div>
				<Button
					onClick={handleCreateAccountClick}
					className="bg-primary hover: font-bold rounded-xl px-4 py-2"
				>
					Add Account
				</Button>
			</div>

			<Card className="rounded-2xl border-border bg-card backdrop-blur-xl shadow-lg p-0 space-y-0 overflow-hidden">
				<Table>
					<TableHeader className="bg-muted/50">
						<TableRow className="border-border hover:bg-transparent">
							<TableHead className="text-muted-foreground font-bold h-14 px-6">Name</TableHead>
							<TableHead className="text-muted-foreground font-bold h-14 px-6">Username</TableHead>
							<TableHead className="text-muted-foreground font-bold h-14 px-6">Role</TableHead>
							<TableHead className="text-muted-foreground font-bold h-14 px-6 text-right">Actions</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{usersList.map((user) => (
							<TableRow key={user.id} className="border-border/40 hover:bg-background/40 transition-colors">
								<TableCell className="font-bold text-foreground px-6 py-4">
									{user.name}
								</TableCell>
								<TableCell className="text-muted-foreground px-6 py-4">
									@{user.username}
								</TableCell>
								<TableCell className="px-6 py-4">
									<span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize border ${user.role === 'admin' ? 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30' : 'bg-primary/10 text-primary border-primary/20'}`}>
										{user.role}
									</span>
								</TableCell>
								<TableCell className="text-right px-6 py-4">
									<div className="flex items-center justify-end gap-2">
										<Button
											type="button"
											variant="outline"
											onClick={() => handleEditAccountClick(user)}
											className="bg-background hover:bg-muted text-muted-foreground border-border rounded-xl px-4 text-xs font-semibold"
										>
											Edit
										</Button>
										<Button
											type="button"
											variant="ghost"
											size="icon"
											onClick={() => handleDeleteClick(user.id)}
											className="h-8 w-8 text-destructive/80 hover:text-destructive hover:bg-destructive/10 rounded-xl gap-1.5"
											title="Delete Account"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</Card>

			{/* EDIT ACCOUNT DIALOG */}
			<Dialog
				open={isAccountModalOpen}
				onOpenChange={setIsAccountModalOpen}
			>
				<DialogContent className="max-w-md bg-background border-border text-foreground p-6 sm:rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground">
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
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
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
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
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
								placeholder="Leave blank to keep unchanged"
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
							/>
						</div>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => setIsAccountModalOpen(false)}
								className="bg-muted hover:bg-muted text-muted-foreground rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={updatingAccount}
								className="bg-primary hover: rounded-xl px-5"
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
				<DialogContent className="max-w-md bg-background border-border text-foreground p-6 sm:rounded-2xl shadow-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-foreground">
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
								<SelectTrigger className="bg-background border-border text-white rounded-xl h-10 focus:ring-primary/50">
									<SelectValue placeholder="Select a role" />
								</SelectTrigger>
								<SelectContent className="bg-background border-border text-foreground">
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
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
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
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
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
								placeholder="Minimum 6 characters"
								className="bg-background border-border text-white focus:border-primary/20 rounded-xl"
								required
								minLength={6}
							/>
						</div>
						<div className="flex items-center justify-end gap-2 mt-4">
							<Button
								type="button"
								onClick={() => setIsCreateModalOpen(false)}
								className="bg-muted hover:bg-muted text-muted-foreground rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={creatingAccount}
								className="bg-primary hover: rounded-xl px-5"
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
				<DialogContent className="max-w-md bg-background border-border shadow-2xl text-foreground p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-red-500 flex items-center gap-2">
							<Trash2 className="h-5 w-5" />
							Delete Account
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 text-muted-foreground text-sm">
						Are you sure you want to delete this account? This action cannot be undone.
					</div>
					<div className="flex items-center justify-end gap-2 mt-4">
						<Button
							type="button"
							onClick={() => setIsDeleteModalOpen(false)}
							className="bg-muted hover:bg-muted text-muted-foreground rounded-xl px-5"
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
