import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const puroks = sqliteTable("puroks", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	orderIndex: integer("order_index").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const households = sqliteTable("households", {
	id: text("id").primaryKey(), // Using the household string code as PK
	purok: text("purok").notNull(),
	block: text("block"),
	lot: text("lot"),
	phase: text("phase"),
	tenureStatus: text("tenure_status"),
	housingType: text("housing_type"),
	constructionType: text("construction_type"),
	sanitationMethod: text("sanitation_method"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const users = sqliteTable("users", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	username: text("username").notNull().unique(),
	password: text("password").notNull(),
	role: text("role").notNull().default("staff"), // 'admin' or 'staff'
	name: text("name").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const residents = sqliteTable("residents", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	residentId: text("resident_id").unique(), // 8-digit unique code
	photoBase64: text("photo_base64"), // Base64 encoded resident photo
	// Name
	fullName: text("full_name").notNull(), // Kept for computed display/search
	lastName: text("last_name"),
	firstName: text("first_name"),
	middleName: text("middle_name"),
	suffix: text("suffix"),
	// Demographics
	birthDate: text("birth_date"), // YYYY-MM-DD
	gender: text("gender"), // Male, Female, Other
	civilStatus: text("civil_status"),
	religion: text("religion"),
	// Contact
	contactNumber: text("contact_number"),
	email: text("email"),
	// Location & Household
	purok: text("purok").notNull(), // Purok 1, Purok 2, etc.
	householdId: text("household_id"), // Shared ID linking to households table
	isHeadOfHousehold: integer("is_head_of_household", {
		mode: "boolean",
	}).default(false),
	relationshipToHead: text("relationship_to_head"), // Self, Spouse, Child, Sibling, etc.
	// Education & Work
	educationalAttainment: text("educational_attainment"),
	occupation: text("occupation"),
	employmentStatus: text("employment_status"),
	monthlyIncome: text("monthly_income"),
	sourceOfLivelihood: text("source_of_livelihood"),
	// Status Flags
	isPwd: integer("is_pwd", { mode: "boolean" }).default(false),
	pwdType: text("pwd_type"), // Optional: type of disability
	isSeniorCitizen: integer("is_senior_citizen", { mode: "boolean" }).default(false),
	isResidentVoter: integer("is_resident_voter", { mode: "boolean" }).default(false),
	isRegisteredVoter: integer("is_registered_voter", { mode: "boolean" }).default(false),
	isSingleParent: integer("is_single_parent", { mode: "boolean" }).default(false),
	isOfw: integer("is_ofw", { mode: "boolean" }).default(false),
	isOsy: integer("is_osy", { mode: "boolean" }).default(false),
	isIp: integer("is_ip", { mode: "boolean" }).default(false),
	isMigrant: integer("is_migrant", { mode: "boolean" }).default(false),
	isNationalPensioner: integer("is_national_pensioner", { mode: "boolean" }).default(false),
	isLocalPensioner: integer("is_local_pensioner", { mode: "boolean" }).default(false),
	// Health
	debilitatingDiseases: text("debilitating_diseases"),
	isBedBound: integer("is_bed_bound", { mode: "boolean" }).default(false),
	isWheelchairBound: integer("is_wheelchair_bound", { mode: "boolean" }).default(false),
	isDialysisPatient: integer("is_dialysis_patient", { mode: "boolean" }).default(false),
	isCancerPatient: integer("is_cancer_patient", { mode: "boolean" }).default(false),
	// Archiving
	isDeceased: integer("is_deceased", { mode: "boolean" }).default(false),
	// Timestamps
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const settings = sqliteTable("settings", {
	key: text("key").primaryKey().notNull(),
	value: text("value").notNull(),
});

export const documentTemplates = sqliteTable("document_templates", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(), // e.g., "Barangay Clearance"
	price: real("price").default(0),
	isActive: integer("is_active", { mode: "boolean" }).default(true),
	imageBase64: text("image_base64"), // The background template image
	fieldMappings: text("field_mappings", { mode: "json" }), // Drag-and-drop field configurations
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const transactions = sqliteTable("transactions", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	queueNumber: integer("queue_number").notNull(),
	residentId: integer("resident_id").notNull(),
	templateId: integer("template_id").notNull(),
	purpose: text("purpose"),
	totalPrice: real("total_price").notNull(),
	status: text("status").default("Pending").notNull(), // Pending, Released, Cancelled
	processedBy: text("processed_by"), // Name of staff
	remarks: text("remarks"),
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const distributionPrograms = sqliteTable("distribution_programs", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull(),
	description: text("description"),
	date: text("date"), // Date of distribution YYYY-MM-DD
	status: text("status").default("Active").notNull(), // Active, Completed
	targetDemographic: text("target_demographic"), // e.g., "All", "Senior Citizens", "Single Parents", etc.
	createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(
		() => new Date(),
	),
});

export const distributionBeneficiaries = sqliteTable("distribution_beneficiaries", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	programId: integer("program_id").notNull(),
	residentId: integer("resident_id").notNull(),
	status: text("status").default("Pending").notNull(), // Pending, Claimed
	claimedAt: integer("claimed_at", { mode: "timestamp" }),
	notes: text("notes"),
});
