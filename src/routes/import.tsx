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
import { Input } from "../components/ui/input";
import { getUniquePuroks } from "../lib/residents-service";
import { invalidateResidentsCache } from "./residents";
import { invalidateHouseholdsCache } from "./households";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../components/ui/select";
import {
	importResidents,
	parseBirthDate,
	normalizeGender,
	normalizeCivilStatus,
	normalizeEducation,
	normalizePurok,
	toTitleCase,
	type ImportRow,
} from "../lib/import-service";

export const Route = createFileRoute("/import")({
	loader: async () => {
		const puroks = await getUniquePuroks();
		return { puroks };
	},
	component: ImportView,
});

// ─── Normalise an Excel header for fuzzy matching ──────────────────────────
// Converts underscores to spaces, trims, lowercases so that
// "last_name", "Last Name", "LAST NAME" all match the same synonym.
function normalizeHeader(h: string): string {
	return h
		.toLowerCase()
		.replace(/_/g, " ")
		.replace(/[^a-z0-9\s]/g, " ") // Replace punctuation with space to avoid squishing words
		.replace(/\s+/g, " ") // Collapse multiple spaces
		.trim();
}

// Database fields that require mapping
const DB_FIELDS = [
	{
		key: "lastName",
		label: "Last Name *",
		desc: "Family name",
		required: true,
		synonyms: ["last name", "lastname", "surname", "last", "family name", "apelyido", "last_name"],
	},
	{
		key: "firstName",
		label: "First Name *",
		desc: "Given name",
		required: true,
		synonyms: ["first name", "firstname", "given name", "first_name"],
	},
	{
		key: "middleName",
		label: "Middle Name",
		desc: "Middle name",
		required: false,
		synonyms: ["middle name", "middlename", "middle_name"],
	},
	{
		key: "suffix",
		label: "Suffix",
		desc: "Jr, Sr, III, etc.",
		required: false,
		synonyms: ["suffix", "ext name", "extension", "suffix"],
	},
	{
		key: "purok",
		label: "Purok",
		desc: "Purok number or name",
		required: false,
		synonyms: ["purok", "zone", "sitio", "address", "purok zone", "purok address"],
	},
	{
		key: "block",
		label: "Block",
		desc: "Block number",
		required: false,
		synonyms: ["block", "blk"],
	},
	{
		key: "lot",
		label: "Lot",
		desc: "Lot number",
		required: false,
		synonyms: ["lot"],
	},
	{
		key: "phase",
		label: "Phase",
		desc: "Phase number",
		required: false,
		synonyms: ["phase"],
	},
	{
		key: "birthDate",
		label: "Birthdate",
		desc: "YYYY-MM-DD format",
		required: false,
		synonyms: ["birthday", "birthdate", "dob", "birth_date", "birth date"],
	},
	{
		key: "gender",
		label: "Sex / Gender",
		desc: "Male, Female",
		required: false,
		synonyms: ["gender", "sex", "kasarian"],
	},
	{
		key: "civilStatus",
		label: "Civil Status",
		desc: "Single, Married, Widow, etc.",
		required: false,
		synonyms: ["civil status", "status", "civil_status"],
	},
	{
		key: "educationalAttainment",
		label: "Educational Attainment",
		desc: "Highest level of education",
		required: false,
		synonyms: ["educational attainment", "education", "educational_attainment"],
	},
	{
		key: "occupation",
		label: "Occupation",
		desc: "Current job",
		required: false,
		synonyms: ["occupation", "job", "profession"],
	},
	{
		key: "employmentStatus",
		label: "Employment Status",
		desc: "Employed, Unemployed, etc.",
		required: false,
		synonyms: ["employment status", "employment_status"],
	},
	{
		key: "contactNumber",
		label: "Contact Number",
		desc: "Mobile number",
		required: false,
		synonyms: ["contact number", "mobile", "phone", "contact_number"],
	},
	{
		key: "email",
		label: "Email",
		desc: "Email address",
		required: false,
		synonyms: ["email", "e-mail", "email address"],
	},
	{
		key: "isResidentVoter",
		label: "Is Resident Voter",
		desc: "True/Yes if resident voter",
		required: false,
		synonyms: ["is resident voter", "resident voter", "is_resident_voter"],
	},
	{
		key: "isRegisteredVoter",
		label: "Is Registered Voter",
		desc: "True/Yes if registered voter",
		required: false,
		synonyms: ["is registered voter", "registered voter", "voter", "is_registered_voter"],
	},
	{
		key: "isOfw",
		label: "Is OFW",
		desc: "True/Yes if Overseas Filipino Worker",
		required: false,
		synonyms: ["is ofw", "ofw", "is_ofw"],
	},
	{
		key: "isPwd",
		label: "Is PWD",
		desc: "True/Yes if Person with Disability",
		required: false,
		synonyms: ["is pwd", "pwd", "is_pwd"],
	},
	{
		key: "isOsy",
		label: "Is OSY",
		desc: "True/Yes if Out of School Youth",
		required: false,
		synonyms: ["is osy", "osy", "out of school youth", "is_osy"],
	},
	{
		key: "isSeniorCitizen",
		label: "Is Senior Citizen",
		desc: "True/Yes if Senior Citizen",
		required: false,
		synonyms: ["is senior citizen", "senior citizen", "senior", "is_senior_citizen"],
	},
	{
		key: "isSingleParent",
		label: "Is Solo Parent",
		desc: "True/Yes if single/solo parent",
		required: false,
		synonyms: ["is solo parent", "solo parent", "single parent", "is_solo_parent"],
	},
	{
		key: "isIp",
		label: "Is IP",
		desc: "True/Yes if Indigenous Person",
		required: false,
		synonyms: ["is ip", "ip", "indigenous", "is_ip"],
	},
	{
		key: "isMigrant",
		label: "Is Migrant",
		desc: "True/Yes if Migrant",
		required: false,
		synonyms: ["is migrant", "migrant", "is_migrant"],
	},
	{
		key: "monthlyIncome",
		label: "Estimated Monthly Income",
		desc: "Monthly income range",
		required: false,
		synonyms: ["estimated monthly income", "monthly income", "income", "monthly_income"],
	},
	{
		key: "sourceOfLivelihood",
		label: "Primary Source of Livelihood",
		desc: "Primary livelihood",
		required: false,
		synonyms: [
			"primary source of livelihood",
			"livelihood",
			"source of income",
			"source_of_livelihood",
		],
	},
	{
		key: "tenureStatus",
		label: "Tenure Status",
		desc: "Owned, Rented, etc.",
		required: false,
		synonyms: ["tenure status", "tenure", "tenure_status"],
	},
	{
		key: "housingType",
		label: "Housing Type",
		desc: "Type of housing",
		required: false,
		synonyms: ["housing type", "housing_type"],
	},
	{
		key: "constructionType",
		label: "Construction Type",
		desc: "Concrete, Wood, etc.",
		required: false,
		synonyms: ["construction type", "construction_type"],
	},
	{
		key: "sanitationMethod",
		label: "Sanitation Method",
		desc: "Toilet type, etc.",
		required: false,
		synonyms: ["sanitation method", "sanitation", "toilet", "sanitation_method"],
	},
	{
		key: "religion",
		label: "Religion",
		desc: "Religious affiliation",
		required: false,
		synonyms: ["religion"],
	},
	{
		key: "debilitatingDiseases",
		label: "Debilitating Diseases",
		desc: "List of diseases",
		required: false,
		synonyms: ["debilitating diseases", "diseases", "illness", "debilitating_diseases"],
	},
	{
		key: "isBedBound",
		label: "Is Bed Bound",
		desc: "True/Yes if bed bound",
		required: false,
		synonyms: ["is bed bound", "bed bound", "is_bed_bound"],
	},
	{
		key: "isWheelchairBound",
		label: "Is Wheelchair Bound",
		desc: "True/Yes if wheelchair bound",
		required: false,
		synonyms: ["is wheelchair bound", "wheelchair bound", "is_wheelchair_bound"],
	},
	{
		key: "isDialysisPatient",
		label: "Is Dialysis Patient",
		desc: "True/Yes if dialysis patient",
		required: false,
		synonyms: ["is dialysis patient", "dialysis patient", "is_dialysis_patient"],
	},
	{
		key: "isCancerPatient",
		label: "Is Cancer Patient",
		desc: "True/Yes if cancer patient",
		required: false,
		synonyms: ["is cancer patient", "cancer patient", "cancer", "is cancer"],
	},
	{
		key: "isNationalPensioner",
		label: "Is National Pensioner",
		desc: "True/Yes if SSS/GSIS pensioner",
		required: false,
		synonyms: ["is national pensioner", "national pensioner", "sss gsis", "sss", "gsis", "pensioner national"],
	},
	{
		key: "isLocalPensioner",
		label: "Is Local Pensioner",
		desc: "True/Yes if local pensioner",
		required: false,
		synonyms: ["is local pensioner", "local pensioner", "pensioner local", "lgu pensioner"],
	},
	{
		key: "relationshipToHead",
		label: "Relationship to Head",
		desc: "Head, Spouse, Child, etc.",
		required: false,
		synonyms: ["relationship", "relation", "relationship to head", "rel", "family relationship"],
	},
];

// Calculate age helper for preview table
const calculateAge = (dateString: string | null | undefined) => {
	if (!dateString || dateString === "—") return "—";
	const today = new Date();
	const birthDate = new Date(dateString);
	if (isNaN(birthDate.getTime())) return "—";
	let age = today.getFullYear() - birthDate.getFullYear();
	const m = today.getMonth() - birthDate.getMonth();
	if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
		age--;
	}
	return age < 0 ? 0 : age;
};

function ImportView() {
	const { puroks } = Route.useLoaderData();
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
	const [defaultPurok, setDefaultPurok] = useState("");
	const [importedCount, setImportedCount] = useState<number>(0);
	const [skippedCount, setSkippedCount] = useState<number>(0);
	const [skippedNames, setSkippedNames] = useState<string[]>([]);

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
				// Combine data from ALL sheets in the workbook
				let combinedJson: any[] = [];
				for (const sheetName of workbook.SheetNames) {
					const worksheet = workbook.Sheets[sheetName];
					const sheetJson = XLSX.utils.sheet_to_json(worksheet, {
						defval: "",
					}) as any[];
					combinedJson = combinedJson.concat(sheetJson);
				}

				const json = combinedJson;

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
				// Headers are normalised: underscores→spaces, lowercased, trimmed
				const initialMappings: Record<string, string> = {};
				for (const field of DB_FIELDS) {
					const matchedHeader = headers.find((h) => {
						const normalizedHeader = normalizeHeader(h);
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

	// Parse TRUE/FALSE/1/0/YES/NO boolean values from Excel
	const parseBoolean = (value: any): boolean => {
		if (value === true || value === 1) return true;
		if (!value) return false;
		const str = String(value).toLowerCase().trim();
		return str === "true" || str === "1" || str === "yes" || str === "y";
	};

	const handleExecuteImport = async () => {
		const missingFields = DB_FIELDS.filter(
			(f) => f.required && !mappings[f.key],
		);
		if (missingFields.length > 0) {
			setError(
				`Please map all required fields: ${missingFields.map((f) => f.label).join(", ")}`,
			);
			return;
		}

		if (!mappings.purok && !defaultPurok.trim()) {
			setError("Please specify a Default Purok for this import, or map the Purok column.");
			return;
		}

		setLoading(true);
		setError("");

		// Map excel rows to ImportRow — pass raw values; all normalization happens server-side
		const payload: ImportRow[] = excelData.map((row) => {
			const get = (key: string) => {
				const header = mappings[key];
				return header ? row[header] : null;
			};

			// Boolean fields
			const boolField = (key: string) => parseBoolean(get(key));

			// String fields — pass raw so server normalizes
			const strField = (key: string): string | null => {
				const v = get(key);
				if (v === null || v === undefined || v === "") {
					if (key === "purok" && !mappings.purok) return defaultPurok.trim();
					return null;
				}
				return String(v);
			};

			return {
				// Names — pass raw strings; server title-cases
				fullName: "", // computed server-side
				lastName: strField("lastName"),
				firstName: strField("firstName"),
				middleName: strField("middleName"),
				suffix: strField("suffix"),
				// Location
				purok: strField("purok") || "",
				block: strField("block"),
				lot: strField("lot"),
				phase: strField("phase"),
				// Demographics — pass raw; server normalizes
				birthDate: get("birthDate"), // pass raw (number OR string)
				gender: strField("gender"),
				civilStatus: strField("civilStatus"),
				religion: strField("religion"),
				// Education & Work
				educationalAttainment: strField("educationalAttainment"),
				occupation: strField("occupation"),
				employmentStatus: strField("employmentStatus"),
				monthlyIncome: strField("monthlyIncome"),
				sourceOfLivelihood: strField("sourceOfLivelihood"),
				// Contact
				contactNumber: strField("contactNumber"),
				email: strField("email"),
				// Household
				householdId: null,
				isHeadOfHousehold: false,
				relationshipToHead: strField("relationshipToHead"),
				// Boolean flags
				isPwd: boolField("isPwd"),
				isSeniorCitizen: boolField("isSeniorCitizen"),
				isResidentVoter: boolField("isResidentVoter"),
				isRegisteredVoter: boolField("isRegisteredVoter"),
				isSingleParent: boolField("isSingleParent"),
				isOfw: boolField("isOfw"),
				isOsy: boolField("isOsy"),
				isIp: boolField("isIp"),
				isMigrant: boolField("isMigrant"),
				isNationalPensioner: boolField("isNationalPensioner"),
				isLocalPensioner: boolField("isLocalPensioner"),
				// Health
				debilitatingDiseases: strField("debilitatingDiseases"),
				isBedBound: boolField("isBedBound"),
				isWheelchairBound: boolField("isWheelchairBound"),
				isDialysisPatient: boolField("isDialysisPatient"),
				isCancerPatient: boolField("isCancerPatient"),
				// Household data
				tenureStatus: strField("tenureStatus"),
				housingType: strField("housingType"),
				constructionType: strField("constructionType"),
				sanitationMethod: strField("sanitationMethod"),
			} as ImportRow;
		});

		// Filter out rows with no name at all or that are just placeholders like (RENTER)
		const validPayload = payload.filter((r) => {
			const combined = [r.firstName, r.lastName, r.fullName].filter(Boolean).join(" ").trim().toLowerCase();
			const isPlaceholder = /^\s*\(?(renter|vacant|none|n\/a|unknown)\)?\s*$/.test(combined);
			return combined.length > 0 && !isPlaceholder;
		});

		if (validPayload.length === 0) {
			setError("No valid resident records (with names) could be parsed.");
			setLoading(false);
			return;
		}

		try {
			const result = await importResidents({ data: validPayload });
			if (result.success) {
				invalidateResidentsCache();
				invalidateHouseholdsCache();
				setImportedCount(result.count ?? 0);
				// @ts-ignore
				setSkippedCount(result.skippedCount ?? 0);
				// @ts-ignore
				setSkippedNames(result.skippedNames ?? []);
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

	// Preview shows NORMALIZED values (what the data looks like after import)
	const getPreviewRows = () => {
		return excelData.slice(0, 3).map((row) => {
			const get = (key: string) => {
				const header = mappings[key];
				return header ? row[header] : null;
			};
			const str = (key: string) => {
				const v = get(key);
				return v !== null && v !== undefined && v !== "" ? String(v) : null;
			};

			const firstName = toTitleCase(str("firstName"));
			const middleName = toTitleCase(str("middleName"));
			const lastName = toTitleCase(str("lastName"));
			const suffix = toTitleCase(str("suffix"));
			const fullName =
				[firstName, middleName, lastName, suffix].filter(Boolean).join(" ") || "—";

			const purokRaw = str("purok") || str("phase");
			const purok = normalizePurok(purokRaw) || "—";
			const block = str("block") || "";
			const lot = str("lot") || "";
			let hhKey = "—";
			if (block && lot && purok !== "—") {
				hhKey = `Blk ${block} Lot ${lot}, ${purok}`;
			} else if (lastName && purok !== "—") {
				hhKey = `Fam ${lastName}, ${purok}`;
			} else {
				hhKey = `Individual Row`;
			}

			return {
				firstName,
				middleName,
				lastName,
				suffix,
				contactNumber: str("contactNumber") || "",
				fullName,
				purok,
				block,
				lot,
				hhKey,
				birthDate: parseBirthDate(get("birthDate")) || "—",
				gender: normalizeGender(str("gender")) || "Unknown",
				civilStatus: normalizeCivilStatus(str("civilStatus")) || "—",
				education: normalizeEducation(str("educationalAttainment")) || "—",
				isPwd: parseBoolean(get("isPwd")),
				isSeniorCitizen: parseBoolean(get("isSeniorCitizen")),
				isRegisteredVoter: parseBoolean(get("isRegisteredVoter")),
				isSingleParent: parseBoolean(get("isSingleParent")),
				isBedBound: parseBoolean(get("isBedBound")),
				isWheelchairBound: parseBoolean(get("isWheelchairBound")),
				isDialysisPatient: parseBoolean(get("isDialysisPatient")),
				isCancerPatient: parseBoolean(get("isCancerPatient")),
				isNationalPensioner: parseBoolean(get("isNationalPensioner")),
				isLocalPensioner: parseBoolean(get("isLocalPensioner")),
				isOfw: parseBoolean(get("isOfw")),
				isOsy: parseBoolean(get("isOsy")),
				isIp: parseBoolean(get("isIp")),
				isMigrant: parseBoolean(get("isMigrant")),
			};
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

						{!mappings.purok && (
							<div className="mt-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 flex flex-col gap-2 max-w-xl">
								<Label className="text-amber-500 font-bold">Default Purok / Phase for this Import *</Label>
								<p className="text-xs text-amber-500/80">Since you didn't map a Purok column, please type the Purok or Phase that all these residents belong to.</p>
								<Input 
									list="purok-suggestions"
									value={defaultPurok} 
									onChange={(e: any) => setDefaultPurok(e.target.value)} 
									placeholder="e.g. Purok 1, Phase 4..." 
									className="border-amber-500/30 focus-visible:ring-amber-500 mt-1 bg-amber-500/5 text-amber-100" 
								/>
								<datalist id="purok-suggestions">
									{puroks.map(p => <option key={p} value={p} />)}
								</datalist>
							</div>
						)}
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
								<thead className="bg-neutral-900 border-b border-neutral-800 text-neutral-400 font-semibold">
									<tr>
										<th className="px-4 py-3">Last Name</th>
										<th className="px-4 py-3">First Name</th>
										<th className="px-4 py-3">Middle Name</th>
										<th className="px-4 py-3">Age / Gender</th>
										<th className="px-4 py-3">Purok</th>
										<th className="px-4 py-3">Blk / Lot</th>
										<th className="px-4 py-3">Tags</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-neutral-900">
									{getPreviewRows().map((row, idx) => (
										<tr
											key={`preview-${idx}`}
											className="hover:bg-neutral-900/20"
										>
											<td className="px-4 py-3">
												<div className="flex flex-col min-w-0">
													<span className="font-semibold text-neutral-100 text-sm leading-snug truncate">
														{row.lastName || "—"} {row.suffix ? ` ${row.suffix}` : ""}
													</span>
													{row.contactNumber && (
														<span className="text-[11px] text-neutral-500 leading-none mt-0.5 sm:hidden">
															{row.contactNumber}
														</span>
													)}
												</div>
											</td>
											<td className="px-4 py-3">
												<span className="text-neutral-100 text-sm">{row.firstName || "—"}</span>
											</td>
											<td className="px-4 py-3">
												<span className="text-neutral-300 text-sm">{row.middleName || "—"}</span>
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-col">
													<span className="text-sm text-neutral-200 leading-snug">
														{calculateAge(row.birthDate)} yrs
													</span>
													<span className="text-[11px] text-neutral-500 leading-none mt-0.5">
														{row.gender}
													</span>
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-col">
													<span className="text-sm font-medium text-neutral-200 leading-snug">
														{row.purok}
													</span>
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-col">
													{row.block || row.lot ? (
														<span className="text-sm font-medium text-neutral-200 leading-snug">
															Blk {row.block || "-"} Lot {row.lot || "-"}
														</span>
													) : (
														<span className="text-sm font-medium text-neutral-500 italic">
															{row.lastName && row.purok !== "—" ? `Fam. ${row.lastName}` : "—"}
														</span>
													)}
												</div>
											</td>
											<td className="px-4 py-3">
												<div className="flex flex-wrap gap-1">
													{row.isPwd && (
														<span
															className="rounded-full bg-purple-950/40 border border-purple-800/30 px-2 py-0.5 text-[10px] font-semibold text-purple-400"
															title="PWD"
														>
															PWD
														</span>
													)}
													{row.isSeniorCitizen && (
														<span className="rounded-full bg-amber-950/40 border border-amber-800/30 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
															Senior
														</span>
													)}
													{row.isRegisteredVoter && (
														<span className="rounded-full bg-emerald-950/40 border border-emerald-800/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
															Voter
														</span>
													)}
													{row.isSingleParent && (
														<span className="rounded-full bg-pink-950/40 border border-pink-800/30 px-2 py-0.5 text-[10px] font-semibold text-pink-400">
															Solo Parent
														</span>
													)}
													{row.isBedBound && (
														<span className="rounded-full bg-red-950/40 border border-red-800/30 px-2 py-0.5 text-[10px] font-semibold text-red-400">
															Bed Bound
														</span>
													)}
													{row.isWheelchairBound && (
														<span className="rounded-full bg-blue-950/40 border border-blue-800/30 px-2 py-0.5 text-[10px] font-semibold text-blue-400">
															Wheelchair
														</span>
													)}
													{row.isDialysisPatient && (
														<span className="rounded-full bg-orange-950/40 border border-orange-800/30 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
															Dialysis
														</span>
													)}
													{row.isCancerPatient && (
														<span className="rounded-full bg-rose-950/40 border border-rose-800/30 px-2 py-0.5 text-[10px] font-semibold text-rose-400">
															Cancer
														</span>
													)}
													{(row.isNationalPensioner || row.isLocalPensioner) && (
														<span className="rounded-full bg-teal-950/40 border border-teal-800/30 px-2 py-0.5 text-[10px] font-semibold text-teal-400">
															Pensioner
														</span>
													)}
													{row.isOfw && (
														<span className="rounded-full bg-indigo-950/40 border border-indigo-800/30 px-2 py-0.5 text-[10px] font-semibold text-indigo-400">
															OFW
														</span>
													)}
													{row.isOsy && (
														<span className="rounded-full bg-yellow-950/40 border border-yellow-800/30 px-2 py-0.5 text-[10px] font-semibold text-yellow-400">
															OSY
														</span>
													)}
													{row.isIp && (
														<span className="rounded-full bg-lime-950/40 border border-lime-800/30 px-2 py-0.5 text-[10px] font-semibold text-lime-400">
															IP
														</span>
													)}
													{row.isMigrant && (
														<span className="rounded-full bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
															Migrant
														</span>
													)}
												</div>
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
								setSkippedCount(0);
								setSkippedNames([]);
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

					<div className="space-y-4">
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

						{skippedCount > 0 && (
							<div className="bg-amber-950/30 border border-amber-900/40 p-4 rounded-xl text-left inline-block max-w-full overflow-hidden">
								<p className="text-sm text-amber-400/90 m-0 font-medium mb-2">
									Skipped {skippedCount.toLocaleString()} duplicate residents:
								</p>
								<div className="max-h-24 overflow-y-auto pr-2 custom-scrollbar">
									<ul className="list-disc list-inside text-xs text-amber-500/80 space-y-1">
										{skippedNames.map((name, i) => (
											<li key={i} className="truncate" title={name}>{name}</li>
										))}
									</ul>
								</div>
							</div>
						)}
					</div>

					<div className="flex gap-2">
						<Button
							onClick={() => {
								setStep(1);
								setExcelData([]);
								setExcelHeaders([]);
								setMappings({});
								setFileName("");
								setSkippedCount(0);
								setSkippedNames([]);
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
