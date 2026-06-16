import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowRight,
	CheckCircle,
	Database,
	FileSpreadsheet,
	RefreshCw,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Label } from "../components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import { importResidents } from "../lib/import-service";
import type { ResidentInput } from "../lib/residents-service";

export const Route = createFileRoute("/import")({
	component: ImportView,
});

// Database fields that require mapping
const DB_FIELDS = [
	{
		key: "fullName",
		label: "Full Name *",
		desc: "First name, last name, or combined name",
		required: true,
		synonyms: ["name", "full name", "fullname", "resident name", "nama"],
	},
	{
		key: "purok",
		label: "Purok / Address *",
		desc: "Purok number, zone, or address",
		required: true,
		synonyms: ["purok", "address", "zone", "sitio", "address1", "purok/sitio"],
	},
	{
		key: "birthDate",
		label: "Birthdate",
		desc: "Date of birth (YYYY-MM-DD)",
		required: false,
		synonyms: ["birthday", "birthdate", "birth date", "dob", "birth_date"],
	},
	{
		key: "gender",
		label: "Gender",
		desc: "Male, Female, or Other",
		required: false,
		synonyms: ["gender", "sex", "kasarian"],
	},
	{
		key: "contactNumber",
		label: "Contact Number",
		desc: "Mobile number or landline",
		required: false,
		synonyms: [
			"contact",
			"phone",
			"mobile",
			"number",
			"contact number",
			"phone number",
		],
	},
	{
		key: "householdId",
		label: "Household ID",
		desc: "Shared code/number to group family members",
		required: false,
		synonyms: ["household", "household id", "householdid", "hhid", "hh id"],
	},

	{
		key: "relationshipToHead",
		label: "Relationship to Head",
		desc: "Spouse, Child, Parent, Sibling, etc.",
		required: false,
		synonyms: ["relationship", "relation", "relationship to head", "rel"],
	},
	{
		key: "isPwd",
		label: "Is PWD?",
		desc: "True/1/Yes if Person with Disability",
		required: false,
		synonyms: ["pwd", "is pwd", "ispwd", "is_pwd", "disability"],
	},
	{
		key: "pwdType",
		label: "PWD Disability Type",
		desc: "Type of disability (if PWD)",
		required: false,
		synonyms: ["pwd type", "disability type", "pwd_type"],
	},
	{
		key: "isSeniorCitizen",
		label: "Is Senior Citizen?",
		desc: "Age 60+ (System will also auto-check birthday)",
		required: false,
		synonyms: ["senior", "is senior", "senior citizen", "issenior"],
	},
	{
		key: "isVoter",
		label: "Is Registered Voter?",
		desc: "True/1/Yes if registered voter in barangay",
		required: false,
		synonyms: ["voter", "is voter", "isvoter", "registered voter", "is_voter"],
	},
	{
		key: "isSingleParent",
		label: "Is Single Parent?",
		desc: "True/1/Yes if solo parent",
		required: false,
		synonyms: ["single parent", "solo parent", "single_parent", "solo_parent"],
	},
];

function ImportView() {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// File state
	const [fileName, setFileName] = useState("");
	const [excelData, setExcelData] = useState<any[]>([]);
	const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
	const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Upload, 2: Map Columns, 3: Success

	// Mapping state: key is DB field key, value is Excel header name
	const [mappings, setMappings] = useState<Record<string, string>>({});

	// Loading & error
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [importedCount, setImportedCount] = useState(0);

	// Handle file reading
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;
		processFile(file);
	};

	const processFile = (file: File) => {
		setFileName(file.name);
		setLoading(true);
		setError("");

		const reader = new FileReader();
		reader.onload = (e) => {
			try {
				const data = new Uint8Array(e.target?.result as ArrayBuffer);
				const workbook = XLSX.read(data, { type: "array" });
				const firstSheetName = workbook.SheetNames[0];
				const worksheet = workbook.Sheets[firstSheetName];

				// Convert worksheet to JSON (include empty values as empty strings)
				const json = XLSX.utils.sheet_to_json(worksheet, {
					defval: "",
				}) as any[];

				if (json.length === 0) {
					setError("The uploaded Excel file is empty.");
					setLoading(false);
					return;
				}

				setExcelData(json);

				// Extract headers from first row keys
				const headers = Object.keys(json[0]);
				setExcelHeaders(headers);

				// Perform auto-mapping based on synonyms
				const initialMappings: Record<string, string> = {};
				for (const field of DB_FIELDS) {
					const matchedHeader = headers.find((h) => {
						const normalizedHeader = h.toLowerCase().trim();
						return field.synonyms.includes(normalizedHeader);
					});
					if (matchedHeader) {
						initialMappings[field.key] = matchedHeader;
					} else {
						initialMappings[field.key] = ""; // leave unmapped
					}
				}

				setMappings(initialMappings);
				setStep(2); // Move to mapping step
			} catch (err) {
				setError(
					"Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file.",
				);
			} finally {
				setLoading(false);
			}
		};

		reader.onerror = () => {
			setError("Error reading file.");
			setLoading(false);
		};

		reader.readAsArrayBuffer(file);
	};

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files?.[0];
		if (file) {
			processFile(file);
		}
	};

	// Handle drop-down mapping changes
	const handleMappingChange = (dbFieldKey: string, excelHeader: string) => {
		setMappings((prev) => ({
			...prev,
			[dbFieldKey]: excelHeader,
		}));
	};

	// Check if true/1/yes in excel cells
	const parseBoolean = (value: any): boolean => {
		if (!value) return false;
		const str = String(value).toLowerCase().trim();
		return str === "true" || str === "1" || str === "yes" || str === "y";
	};

	const handleExecuteImport = async () => {
		// Validate required fields are mapped
		const missingFields = DB_FIELDS.filter(
			(f) => f.required && !mappings[f.key],
		);
		if (missingFields.length > 0) {
			setError(
				`Please map all required fields: ${missingFields.map((f) => f.label).join(", ")}`,
			);
			return;
		}

		setLoading(true);
		setError("");

		// Map excel rows to DB payload format
		const payload: ResidentInput[] = excelData.map((row) => {
			const getMappedValue = (dbFieldKey: string) => {
				const mappedHeader = mappings[dbFieldKey];
				return mappedHeader ? row[mappedHeader] : null;
			};

			return {
				fullName: String(getMappedValue("fullName") || "").trim(),
				birthDate: getMappedValue("birthDate")
					? String(getMappedValue("birthDate")).trim()
					: null,
				gender: getMappedValue("gender")
					? String(getMappedValue("gender")).trim()
					: null,
				contactNumber: getMappedValue("contactNumber")
					? String(getMappedValue("contactNumber")).trim()
					: null,
				purok: String(getMappedValue("purok") || "Purok 1").trim(),
				householdId: getMappedValue("householdId")
					? String(getMappedValue("householdId")).trim()
					: null,
				isHeadOfHousehold: false,
				relationshipToHead: getMappedValue("relationshipToHead")
					? String(getMappedValue("relationshipToHead")).trim()
					: null,
				isPwd: parseBoolean(getMappedValue("isPwd")),
				pwdType: getMappedValue("pwdType")
					? String(getMappedValue("pwdType")).trim()
					: null,
				isSeniorCitizen: parseBoolean(getMappedValue("isSeniorCitizen")),
				isVoter: parseBoolean(getMappedValue("isVoter")),
				isSingleParent: parseBoolean(getMappedValue("isSingleParent")),
			};
		});

		// Filter out rows that have an empty name
		const validPayload = payload.filter((r) => r.fullName !== "");

		if (validPayload.length === 0) {
			setError("No valid resident records (with names) could be parsed.");
			setLoading(false);
			return;
		}

		try {
			const result = await importResidents({ data: validPayload });
			if (result.success) {
				setImportedCount(result.count ?? 0);
				setStep(3);
			} else {
				setError(result.error || "Failed to import data.");
			}
		} catch (err) {
			setError("An error occurred during database insertion.");
		} finally {
			setLoading(false);
		}
	};

	// Preview data based on current mapping
	const getPreviewRows = () => {
		return excelData.slice(0, 3).map((row) => {
			const preview: Record<string, string> = {};
			for (const field of DB_FIELDS) {
				const mappedHeader = mappings[field.key];
				preview[field.key] = mappedHeader
					? String(row[mappedHeader] || "")
					: "-";
			}
			return preview;
		});
	};

	return (
		<div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-2 duration-300">
			{/* Header */}
			<div>
				<h2 className="text-2xl font-extrabold tracking-tight text-neutral-100">
					Data Import
				</h2>
				<p className="text-sm text-neutral-400 mt-1">
					Upload your existing Excel spreadsheets to quickly bulk-import
					residents into the system.
				</p>
			</div>

			{error && (
				<div className="p-4 bg-red-950/40 border border-red-900/50 rounded-2xl text-sm text-red-400 flex items-center gap-3">
					<AlertCircle className="h-5 w-5 shrink-0" />
					<span>{error}</span>
				</div>
			)}

			{/* STEP 1: UPLOAD FILE */}
			{step === 1 && (
				<div
					role="button"
					tabIndex={0}
					onDragOver={handleDragOver}
					onDrop={handleDrop}
					onClick={() => fileInputRef.current?.click()}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							fileInputRef.current?.click();
						}
					}}
					className="flex flex-col items-center justify-center border-2 border-dashed border-neutral-800 hover:border-emerald-600/50 hover:bg-emerald-950/5 bg-neutral-900/20 rounded-2xl p-16 text-center cursor-pointer transition-all duration-200 group h-80 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
				>
					<input
						type="file"
						ref={fileInputRef}
						onChange={handleFileChange}
						accept=".xlsx, .xls"
						className="hidden"
					/>

					<div className="p-4 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 group-hover:text-emerald-400 group-hover:border-emerald-900/30 transition-all duration-300 mb-4 shadow-lg shadow-neutral-950/50">
						{loading ? (
							<RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
						) : (
							<Upload className="h-8 w-8" />
						)}
					</div>

					<h3 className="font-bold text-neutral-200 text-lg">
						{loading ? "Reading Excel File..." : "Drag & Drop Excel File here"}
					</h3>
					<p className="text-xs text-neutral-500 max-w-xs mt-2 leading-relaxed">
						Supports `.xlsx` and `.xls` files. Your file will be processed
						locally and securely.
					</p>

					<Button
						type="button"
						className="mt-6 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 text-sm font-semibold active:scale-95 transition-all"
						disabled={loading}
					>
						Select File From PC
					</Button>
				</div>
			)}

			{/* STEP 2: COLUMN MAPPING */}
			{step === 2 && (
				<div className="space-y-6">
					{/* File summary */}
					<Card className="flex items-center justify-between p-4 bg-neutral-950/40 backdrop-blur-xl border-white/5 shadow-lg rounded-2xl">
						<div className="flex items-center gap-3">
							<div className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-900/20 text-emerald-400">
								<FileSpreadsheet className="h-5 w-5" />
							</div>
							<div>
								<h4 className="font-bold text-sm text-neutral-200">
									{fileName}
								</h4>
								<p className="text-xs text-neutral-500">
									{excelData.length.toLocaleString()} rows found in sheet
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => {
								setStep(1);
								setExcelData([]);
								setExcelHeaders([]);
								setMappings({});
								setFileName("");
							}}
							className="text-xs text-neutral-400 hover:text-neutral-200 bg-neutral-800 hover:bg-neutral-700 px-3 py-1.5 rounded-xl border border-neutral-700 transition-colors"
						>
							Choose Another File
						</button>
					</Card>

					{/* Mapping Table */}
					<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg overflow-hidden p-8 space-y-8">
						<div>
							<h3 className="font-bold text-lg text-neutral-100 flex items-center gap-2">
								<Database className="h-4.5 w-4.5 text-emerald-500" />
								<span>Map Excel Columns to Database Fields</span>
							</h3>
							<p className="text-xs text-neutral-400 mt-1">
								We tried to auto-detect columns. Adjust the mappings below to
								ensure the data aligns correctly.
							</p>
						</div>

						<div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
							{DB_FIELDS.map((field) => (
								<div
									key={field.key}
									className="flex flex-col space-y-2 p-3 rounded-xl border border-neutral-800/80 bg-neutral-950/25"
								>
									<div className="flex items-start justify-between">
										<div>
											<Label className="text-sm font-bold text-neutral-200">
												{field.label}
											</Label>
											<p className="text-[10px] text-neutral-500 leading-normal mt-0.5">
												{field.desc}
											</p>
										</div>
									</div>

									<Select
										value={mappings[field.key] || "SKIP"}
										onValueChange={(val) =>
											handleMappingChange(field.key, val === "SKIP" ? "" : val)
										}
									>
										<SelectTrigger
											className={`w-full bg-neutral-950 border text-xs px-3 py-2 rounded-lg focus:outline-none h-10 ${
												mappings[field.key]
													? "border-emerald-800/60 text-emerald-400 font-semibold"
													: "border-neutral-800 text-neutral-500"
											}`}
										>
											<SelectValue placeholder="-- Do Not Import (Skip) --" />
										</SelectTrigger>
										<SelectContent className="bg-neutral-950 border-neutral-800 text-neutral-200">
											<SelectItem value="SKIP">
												-- Do Not Import (Skip) --
											</SelectItem>
											{excelHeaders.map((header) => (
												<SelectItem key={header} value={header}>
													{header}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							))}
						</div>
					</Card>

					{/* Mapped Data Preview */}
					<Card className="rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg p-8 space-y-5">
						<div>
							<h4 className="font-bold text-sm text-neutral-200">
								Import Preview (First 3 Rows)
							</h4>
							<p className="text-[10px] text-neutral-500 mt-0.5">
								Review how your spreadsheet columns will translate into database
								fields.
							</p>
						</div>

						<div className="overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950">
							<table className="w-full text-left text-xs text-neutral-300">
								<thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-semibold uppercase">
									<tr>
										<th className="px-4 py-3">Full Name</th>
										<th className="px-4 py-3">Purok</th>
										<th className="px-4 py-3">Birthdate</th>
										<th className="px-4 py-3">Gender</th>
										<th className="px-4 py-3">Household Status</th>
										<th className="px-4 py-3">PWD / Senior / Voter / Solo P</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-900">
									{getPreviewRows().map((row, idx) => (
										<tr
											key={`${row.fullName}-${idx}`}
											className="hover:bg-neutral-900/20"
										>
											<td className="px-4 py-3 font-semibold text-neutral-200">
												{row.fullName}
											</td>
											<td className="px-4 py-3 text-neutral-300">
												{row.purok}
											</td>
											<td className="px-4 py-3">{row.birthDate}</td>
											<td className="px-4 py-3">{row.gender}</td>
											<td className="px-4 py-3">
												{row.relationshipToHead?.toLowerCase() === "head" ||
												row.relationshipToHead?.toLowerCase() === "self" ? (
													<span className="text-emerald-400 font-medium">
														Head
													</span>
												) : (
													<span>{row.relationshipToHead}</span>
												)}
											</td>
											<td className="px-4 py-3 space-x-1">
												{parseBoolean(row.isPwd) && (
													<span className="bg-purple-950/40 border border-purple-900/30 text-purple-400 text-[8px] px-1 rounded">
														PWD
													</span>
												)}
												{parseBoolean(row.isSeniorCitizen) && (
													<span className="bg-amber-950/40 border border-amber-900/30 text-amber-400 text-[8px] px-1 rounded">
														SR
													</span>
												)}
												{parseBoolean(row.isVoter) && (
													<span className="bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 text-[8px] px-1 rounded">
														Voter
													</span>
												)}
												{parseBoolean(row.isSingleParent) && (
													<span className="bg-pink-950/40 border border-pink-900/30 text-pink-400 text-[8px] px-1 rounded">
														Solo P
													</span>
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</Card>

					{/* Execution Button */}
					<div className="flex items-center justify-end gap-2">
						<Button
							type="button"
							onClick={() => {
								setStep(1);
								setExcelData([]);
								setExcelHeaders([]);
								setMappings({});
								setFileName("");
							}}
							className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-6 py-2.5 text-sm font-semibold"
						>
							Cancel
						</Button>

						<Button
							onClick={handleExecuteImport}
							disabled={loading}
							className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-6 py-2.5 text-sm font-semibold active:scale-95 transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/20"
						>
							{loading ? (
								<>
									<RefreshCw className="h-4 w-4 animate-spin" />
									<span>Importing Records...</span>
								</>
							) : (
								<>
									<Database className="h-4 w-4" />
									<span>Import Residents</span>
								</>
							)}
						</Button>
					</div>
				</div>
			)}

			{/* STEP 3: SUCCESS */}
			{step === 3 && (
				<Card className="flex flex-col items-center justify-center rounded-2xl border-white/5 bg-neutral-950/40 backdrop-blur-xl shadow-lg p-16 text-center space-y-6 h-80">
					<div className="p-4 rounded-full bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 animate-bounce">
						<CheckCircle className="h-10 w-10" />
					</div>

					<div className="space-y-2">
						<h3 className="font-extrabold text-2xl text-neutral-100">
							Import Completed Successfully!
						</h3>
						<p className="text-sm text-neutral-400 max-w-sm mx-auto leading-relaxed">
							We parsed the columns, calculated senior citizen records, and
							successfully inserted{" "}
							<span className="font-bold text-emerald-400">
								{importedCount.toLocaleString()}
							</span>{" "}
							residents into the database.
						</p>
					</div>

					<div className="flex gap-2">
						<Button
							onClick={() => {
								setStep(1);
								setExcelData([]);
								setExcelHeaders([]);
								setMappings({});
								setFileName("");
							}}
							className="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl px-5 text-xs font-semibold"
						>
							Import Another File
						</Button>

						<Button
							onClick={() => navigate({ to: "/residents" })}
							className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 text-xs font-semibold flex items-center gap-1.5"
						>
							<span>View Residents</span>
							<ArrowRight className="h-3.5 w-3.5" />
						</Button>
					</div>
				</Card>
			)}
		</div>
	);
}
