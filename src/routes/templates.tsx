import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileImage, Plus, Trash2, Edit } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent } from "../components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../components/ui/dialog";
import { TemplateBuilder, type FieldMapping } from "@/components/TemplateBuilder";
import { getTemplates, createTemplate, updateTemplate, deleteTemplate, toggleTemplateActive } from "../lib/document-templates-service";

export const Route = createFileRoute("/templates")({
	loader: async () => {
		const list = await getTemplates();
		return { templates: list };
	},
	component: TemplatesPage,
});

function TemplatesPage() {
	const { templates: initialTemplates } = Route.useLoaderData();
	const [templates, setTemplates] = useState(initialTemplates);
	
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [editingId, setEditingId] = useState<number | null>(null);
	const [deleteId, setDeleteId] = useState<number | null>(null);
	
	const [name, setName] = useState("");
	const [price, setPrice] = useState("0");
	const [imageBase64, setImageBase64] = useState("");
	const [originalFileName, setOriginalFileName] = useState("");
	const [fieldMappings, setFieldMappings] = useState<FieldMapping[]>([]);
	const [isBuilderMode, setIsBuilderMode] = useState(false);

	const reload = async () => {
		const list = await getTemplates();
		setTemplates(list);
	};

	const openCreate = () => {
		setEditingId(null);
		setName("");
		setPrice("0");
		setImageBase64("");
		setFieldMappings([]);
		setOriginalFileName("");
		setIsModalOpen(true);
	};

	const openEdit = (tpl: typeof templates[0]) => {
		setEditingId(tpl.id);
		setName(tpl.name);
		setPrice(tpl.price?.toString() || "0");
		setImageBase64(tpl.imageBase64 || "");
		setFieldMappings((tpl as any).fieldMappings || []);
		setOriginalFileName("");
		setIsModalOpen(true);
	};

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		setOriginalFileName(file.name);
		const reader = new FileReader();
		reader.onload = (event) => {
			const img = new Image();
			img.onload = () => {
				const canvas = document.createElement("canvas");
				const MAX_DIMENSION = 1500;
				let width = img.width;
				let height = img.height;

				if (width > height) {
					if (width > MAX_DIMENSION) {
						height *= MAX_DIMENSION / width;
						width = MAX_DIMENSION;
					}
				} else {
					if (height > MAX_DIMENSION) {
						width *= MAX_DIMENSION / height;
						height = MAX_DIMENSION;
					}
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					// Draw image with a white background in case it's a transparent PNG
					ctx.fillStyle = "white";
					ctx.fillRect(0, 0, canvas.width, canvas.height);
					ctx.drawImage(img, 0, 0, width, height);
					
					// Compress to 85% JPEG quality
					const compressedBase64 = canvas.toDataURL("image/jpeg", 0.85);
					setImageBase64(compressedBase64);
				} else {
					setImageBase64(event.target?.result as string); // fallback
				}
			};
			img.src = event.target?.result as string;
		};
		reader.readAsDataURL(file);
	};

	const handleToggleActive = async (id: number, currentActive: boolean) => {
		await toggleTemplateActive({ data: { id, isActive: !currentActive } });
		await reload();
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		const p = parseFloat(price);
		if (isNaN(p)) {
			window.alert("Please enter a valid number for the price.");
			return;
		}

		if (editingId) {
			await updateTemplate({ data: { id: editingId, name, price: p, imageBase64, originalFileName, fieldMappings } });
		} else {
			await createTemplate({ data: { name, price: p, imageBase64, originalFileName, fieldMappings } });
		}
		
		setIsModalOpen(false);
		setIsBuilderMode(false);
		reload();
	};

	const handleDelete = (id: number) => {
		setDeleteId(id);
	};

	const confirmDelete = async () => {
		if (deleteId !== null) {
			await deleteTemplate({ data: deleteId });
			setDeleteId(null);
			reload();
		}
	};

	return (
		<div className="space-y-6 max-w-[1400px] mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-2xl font-bold tracking-tight text-neutral-100">
						Document Templates
					</h2>
					<p className="text-sm text-neutral-500 mt-0.5">
						Manage certificates and clearances for the Resident Kiosk.
					</p>
				</div>
				<Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-500 text-white gap-2 rounded-xl px-4">
					<Plus className="h-4 w-4" />
					Add New Template
				</Button>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
				{templates.map((tpl) => (
					<Card key={tpl.id} className="bg-neutral-950 border-white/10 overflow-hidden group transition-all hover:border-white/20 rounded-3xl shadow-xl flex flex-col h-full">
						{/* Image Area */}
						<div className="w-full h-48 relative flex items-center justify-center p-6">
							{/* Hover Overlay with Actions */}
							<div className="absolute inset-0 bg-neutral-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-20 backdrop-blur-sm">
								<Button size="sm" variant="secondary" onClick={() => openEdit(tpl)} className="h-9 px-4 rounded-xl font-bold shadow-xl">
									<Edit className="h-4 w-4 mr-2" /> Edit
								</Button>
								<Button size="sm" variant="ghost" onClick={() => handleDelete(tpl.id)} className="h-9 w-9 p-0 rounded-xl bg-neutral-900 text-neutral-300 hover:text-red-400 hover:bg-red-950/40 shadow-xl">
									<Trash2 className="h-4 w-4" />
								</Button>
							</div>

							{/* The Image */}
							{tpl.imageBase64 ? (
								<img 
									src={tpl.imageBase64.startsWith('data:image') ? tpl.imageBase64 : `/templates/${tpl.imageBase64}`}
									alt={tpl.name}
									className="max-w-full max-h-full object-contain filter drop-shadow-xl"
								/>
							) : (
								<div className="py-12"><FileImage className="h-10 w-10 text-neutral-800" /></div>
							)}
						</div>

						{/* Content Area */}
						<CardContent className="p-5 pt-0 flex-1 flex flex-col justify-end">
							<div className="flex justify-between items-start gap-4 mb-2">
								<h3 className="text-lg font-bold text-white leading-tight">{tpl.name}</h3>
								<div className="flex items-center gap-2 pt-0.5 shrink-0">
									<span className="text-sm font-medium text-neutral-400">
										{tpl.isActive !== false ? "Active" : "Hidden"}
									</span>
									<Switch 
										checked={tpl.isActive ?? true} 
										onCheckedChange={() => handleToggleActive(tpl.id, tpl.isActive ?? true)}
										className="data-[state=checked]:bg-blue-500"
									/>
								</div>
							</div>
							<div className="text-xl text-blue-400 font-black">₱{tpl.price?.toFixed(2) || "0.00"}</div>
						</CardContent>
					</Card>
				))}
				
				{templates.length === 0 && (
					<div className="col-span-full py-20 text-center border-2 border-dashed border-neutral-800 rounded-2xl">
						<FileImage className="h-10 w-10 text-neutral-700 mx-auto mb-3" />
						<h3 className="text-lg font-bold text-neutral-400">No Templates Found</h3>
						<p className="text-sm text-neutral-500 mt-1 max-w-sm mx-auto">
							Create your first Document Template to start using the Kiosk system.
						</p>
					</div>
				)}
			</div>

			<Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
				<DialogContent className="sm:max-w-[425px] bg-neutral-950 border-neutral-800/60 shadow-2xl text-neutral-200">
					<DialogHeader>
						<DialogTitle>{editingId ? "Edit Template" : "New Template"}</DialogTitle>
					</DialogHeader>
					<form onSubmit={handleSubmit} className="space-y-4 pt-4">
						<div className="space-y-2">
							<Label>Document Name</Label>
							<Input
								placeholder="e.g. Barangay Clearance"
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								className="bg-neutral-900 border-neutral-800"
							/>
						</div>
						<div className="space-y-2">
							<Label>Price (₱)</Label>
							<Input
								type="number"
								min="0"
								step="0.01"
								placeholder="0.00"
								value={price}
								onChange={(e) => setPrice(e.target.value)}
								required
								className="bg-neutral-900 border-neutral-800"
							/>
						</div>
						<div className="space-y-2">
							<Label>Template Image</Label>
							<div className="flex items-center gap-4">
								<Label
									htmlFor="file-upload"
									className="cursor-pointer bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 py-2 px-4 rounded-md transition-colors text-sm font-medium flex items-center gap-2"
								>
									<FileImage className="w-4 h-4" />
									Choose File
								</Label>
								<Input
									id="file-upload"
									type="file"
									accept="image/*"
									onChange={handleFileChange}
									className="hidden"
								/>
								<span className="text-sm text-neutral-400 truncate max-w-[200px]">
									{imageBase64 ? (imageBase64.startsWith("data:image") ? originalFileName || "New image selected" : imageBase64) : "No file chosen"}
								</span>
							</div>
							<p className="text-[10px] text-neutral-500">
								Upload a PNG or JPG background template. Current image will be kept if you don't upload a new one.
							</p>
						</div>
						
						
						<div className="pt-4 flex flex-col gap-3">
							{imageBase64 && (
								<Button type="button" variant="outline" onClick={() => setIsBuilderMode(true)} className="rounded-xl w-full border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20">
									Open Drag & Drop Editor
								</Button>
							)}
							<div className="flex gap-3 justify-end mt-2">
								<Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)} className="rounded-xl">
									Cancel
								</Button>
								<Button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl">
									{editingId ? "Save Changes" : "Create Template"}
								</Button>
							</div>
						</div>
					</form>
				</DialogContent>
			</Dialog>

			{/* BUILDER FULLSCREEN MODAL */}
			<Dialog open={isBuilderMode} onOpenChange={setIsBuilderMode}>
				<DialogContent className="max-w-[850px] w-full max-h-[95vh] h-full bg-neutral-950 border-neutral-800/60 shadow-2xl p-0 flex flex-col">
					<DialogHeader className="p-4 border-b border-neutral-800 hidden">
						<DialogTitle>Template Builder</DialogTitle>
					</DialogHeader>
					<div className="flex-1 overflow-hidden">
						<TemplateBuilder 
							imageBase64={imageBase64}
							initialMappings={fieldMappings}
							onSave={(mappings) => {
								setFieldMappings(mappings);
								setIsBuilderMode(false);
							}}
						/>
					</div>
				</DialogContent>
			</Dialog>

			{/* DELETE CONFIRMATION DIALOG */}
			<Dialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
				<DialogContent className="max-w-md bg-neutral-950 border-neutral-800/60 shadow-2xl text-neutral-100 p-6 sm:rounded-2xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold text-neutral-100 flex items-center gap-2">
							<Trash2 className="h-5 w-5 text-red-500" />
							<span>Confirm Deletion</span>
						</DialogTitle>
					</DialogHeader>
					<div className="mt-4 space-y-4">
						<p className="text-sm text-neutral-300">
							Are you sure you want to delete this document template? It will be permanently removed from the Resident Kiosk and cannot be undone.
						</p>
						<div className="flex items-center justify-end gap-2 pt-4">
							<Button
								type="button"
								onClick={() => setDeleteId(null)}
								className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5"
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={confirmDelete}
								className="bg-red-600 hover:bg-red-500 text-white rounded-xl px-5"
							>
								Delete Template
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
