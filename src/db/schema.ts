import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const residents = sqliteTable("residents", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	fullName: text("full_name").notNull(),
	birthDate: text("birth_date"), // YYYY-MM-DD
	gender: text("gender"), // Male, Female, Other
	contactNumber: text("contact_number"),
	purok: text("purok").notNull(), // Purok 1, Purok 2, etc.
	householdId: text("household_id"), // Shared ID for members of the same household
	isHeadOfHousehold: integer("is_head_of_household", {
		mode: "boolean",
	}).default(false),
	relationshipToHead: text("relationship_to_head"), // Self, Spouse, Child, Sibling, etc.
	isPwd: integer("is_pwd", { mode: "boolean" }).default(false),
	pwdType: text("pwd_type"), // Optional: type of disability
	isSeniorCitizen: integer("is_senior_citizen", { mode: "boolean" }).default(
		false,
	),
	isVoter: integer("is_voter", { mode: "boolean" }).default(false),
	isSingleParent: integer("is_single_parent", { mode: "boolean" }).default(
		false,
	),
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
