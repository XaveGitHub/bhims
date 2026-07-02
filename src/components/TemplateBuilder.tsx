import { useState, useRef, useEffect } from "react";
import Draggable from "react-draggable";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Check, Settings2, Plus, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";export type FieldMapping = {
	id: string;
	label: string;
	x: number;
	y: number;
	fontSize: number;
	fontWeight: "normal" | "bold" | "black";
	fontFamily: "sans" | "serif" | "mono";
};

type Props = {
	imageBase64: string;
	initialMappings: FieldMapping[];
	onSave: (mappings: FieldMapping[]) => void;
};

const DEFAULT_FIELDS = [
	{ id: "fullName", label: "Full Name" },
	{ id: "age", label: "Age" },
	{ id: "gender", label: "Gender" },
	{ id: "purok", label: "Purok" },
	{ id: "occupation", label: "Occupation" },
	{ id: "monthlyIncome", label: "Income" },
	{ id: "purpose", label: "Purpose" },
	{ id: "dateIssued", label: "Date Issued" },
];

export function TemplateBuilder({ imageBase64, initialMappings, onSave }: Props) {
	const [fields, setFields] = useState<FieldMapping[]>(initialMappings || []);
	const containerRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	useEffect(() => {
		if (!containerRef.current) return;
		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const availableWidth = entry.contentRect.width - 64; 
				const newScale = Math.min(1, availableWidth / 794);
				setScale(newScale);
			}
		});
		observer.observe(containerRef.current);
		return () => observer.disconnect();
	}, []);

	const addField = (id: string, label: string) => {
		if (fields.find(f => f.id === id)) return;
		setFields([
			...fields,
			{ id, label, x: 50, y: 50, fontSize: 16, fontWeight: 'normal', fontFamily: 'mono' }
		]);
	};

	const removeField = (id: string) => {
		setFields(fields.filter(f => f.id !== id));
	};

	const updateField = (id: string, updates: Partial<FieldMapping>) => {
		setFields(fields.map(f => f.id === id ? { ...f, ...updates } : f));
	};

	return (
		<div className="flex flex-col h-full bg-neutral-950 overflow-hidden rounded-xl">
			<div className="flex items-center justify-between p-4 pr-14 border-b border-neutral-800 bg-neutral-900/50">
				<div>
					<h3 className="font-bold text-white">Drag & Drop Editor</h3>
					<p className="text-xs text-neutral-400">Position the fields exactly where they should print on the certificate.</p>
				</div>
				<div className="flex gap-2">
					<Popover>
						<PopoverTrigger asChild>
							<Button variant="outline" size="sm" className="bg-neutral-900 border-neutral-700">
								<Plus className="w-4 h-4 mr-2" /> Add Field
							</Button>
						</PopoverTrigger>
						<PopoverContent align="end" className="w-48 p-2 bg-neutral-900 border-neutral-800">
							<div className="space-y-1">
								{DEFAULT_FIELDS.map(f => {
									const isAdded = fields.some(field => field.id === f.id);
									return (
										<Button
											key={f.id}
											variant="ghost"
											size="sm"
											className="w-full justify-start font-normal text-sm"
											disabled={isAdded}
											onClick={() => addField(f.id, f.label)}
										>
											{isAdded ? <Check className="w-3 h-3 mr-2 text-emerald-500" /> : <Plus className="w-3 h-3 mr-2" />}
											{f.label}
										</Button>
									);
								})}
							</div>
						</PopoverContent>
					</Popover>
					<Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => onSave(fields)}>
						<Check className="w-4 h-4 mr-2" /> Done
					</Button>
				</div>
			</div>

			<div className="flex-1 flex overflow-hidden">
				<div ref={containerRef} className="flex-1 overflow-auto bg-neutral-900/30 p-8 flex justify-center items-start">
					<div style={{ width: 794 * scale, height: 1123 * scale }} className="shrink-0 relative">
						<div 
							className="w-[794px] h-[1123px] bg-white text-black shadow-2xl relative border border-neutral-800"
							style={{
								transform: `scale(${scale})`,
								transformOrigin: 'top left',
								backgroundImage: `url('${imageBase64.startsWith('data:image') ? imageBase64 : `/templates/${imageBase64}`}')`,
								backgroundSize: '100% 100%',
								backgroundRepeat: 'no-repeat'
							}}
						>
						{fields.map((field) => (
							<DraggableField 
								key={field.id}
								field={field}
								scale={scale}
								updateField={updateField}
								removeField={removeField}
							/>
						))}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

function getPlaceholder(id: string, label: string) {
	switch (id) {
		case 'fullName': return 'Juan Dela Cruz';
		case 'firstName': return 'Juan';
		case 'lastName': return 'Dela Cruz';
		case 'age': return '25';
		case 'birthDate': return 'January 1, 2000';
		case 'purok': return 'Purok 1';
		case 'civilStatus': return 'Single';
		case 'occupation': return 'Farmer';
		case 'monthlyIncome': return '5,000.00';
		case 'dateIssued': return 'March 15, 2026';
		case 'purpose': return 'Scholarship Application';
		case 'yearsResident': return '5';
		case 'orNumber': return '1234567';
		case 'commTaxNo': return '98765432';
		case 'witness': return 'Maria Clara';
		case 'issuedAt': return 'Bacolod City';
		default: return `[${label}]`;
	}
}

function DraggableField({ field, scale, updateField, removeField }: { 
	field: FieldMapping; 
	scale: number; 
	updateField: (id: string, updates: Partial<FieldMapping>) => void;
	removeField: (id: string) => void;
}) {
	const nodeRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [showSettings, setShowSettings] = useState(false);

	// Close settings when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				menuRef.current && !menuRef.current.contains(target) &&
				toolbarRef.current && !toolbarRef.current.contains(target)
			) {
				setShowSettings(false);
			}
		};
		if (showSettings) {
			document.addEventListener("mousedown", handleClickOutside);
		}
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [showSettings]);

	return (
		<Draggable
			nodeRef={nodeRef}
			defaultPosition={{ x: field.x, y: field.y }}
			scale={scale}
			onStop={(_, data) => updateField(field.id, { x: data.x, y: data.y })}
		>
			<div ref={nodeRef} className="absolute top-0 left-0 cursor-move group select-none outline-none">
				<div 
					style={{ 
						fontSize: `${field.fontSize}px`, 
						fontWeight: field.fontWeight,
						fontFamily: field.fontFamily === 'serif' ? 'serif' : field.fontFamily === 'mono' ? 'monospace' : 'sans-serif',
					}}
					className="outline-2 outline-dashed outline-transparent group-hover:outline-blue-500 whitespace-nowrap leading-none"
				>
					{getPlaceholder(field.id, field.label)}
				</div>

				<div 
					ref={toolbarRef}
					className={`absolute -top-10 left-0 transition-opacity bg-neutral-900 rounded-md p-1 flex gap-1 shadow-xl z-20 border border-neutral-700 ${showSettings ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
					style={{ 
						transform: `scale(${1 / scale})`,
						transformOrigin: 'bottom left' 
					}}
				>
					<button 
						onClick={(e) => {
							e.stopPropagation();
							setShowSettings(!showSettings);
						}} 
						onPointerDown={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
						className={`p-1 rounded text-neutral-300 ${showSettings ? 'bg-blue-600/20 text-blue-400' : 'hover:bg-neutral-800'}`}
					>
						<Settings2 className="w-4 h-4" />
					</button>
					<button onClick={() => removeField(field.id)} className="p-1 hover:bg-red-900/50 rounded text-red-400"><Trash2 className="w-4 h-4" /></button>
				</div>

				{showSettings && (
					<div 
						ref={menuRef}
						className="absolute top-full mt-2 left-0 w-64 p-4 bg-neutral-900 border border-neutral-800 rounded-md shadow-2xl flex flex-col gap-4 text-white z-50 cursor-default"
						style={{ 
							transform: `scale(${1 / scale})`,
							transformOrigin: 'top left' 
						}}
						onPointerDown={(e) => e.stopPropagation()}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<div className="border-b border-neutral-800 pb-2 mb-2">
							<p className="font-bold text-sm text-blue-400">{field.label}</p>
						</div>
						<div className="space-y-2">
							<Label className="text-xs">Font Size ({field.fontSize}px)</Label>
							<input 
								type="range" 
								min="8" max="72" 
								value={field.fontSize} 
								onChange={e => updateField(field.id, { fontSize: parseInt(e.target.value) })}
								className="w-full cursor-pointer"
							/>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<div className="space-y-2">
								<Label className="text-xs">Weight</Label>
								<select 
									className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm"
									value={field.fontWeight}
									onChange={e => updateField(field.id, { fontWeight: e.target.value as any })}
								>
									<option value="normal">Normal</option>
									<option value="bold">Bold</option>
									<option value="black">Black</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label className="text-xs">Family</Label>
								<select 
									className="w-full bg-neutral-950 border border-neutral-800 rounded px-2 py-1 text-sm"
									value={field.fontFamily}
									onChange={e => updateField(field.id, { fontFamily: e.target.value as any })}
								>
									<option value="sans">Sans</option>
									<option value="serif">Serif</option>
									<option value="mono">Mono</option>
								</select>
							</div>
						</div>
					</div>
				)}
			</div>
		</Draggable>
	);
}
