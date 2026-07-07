import { eq } from "drizzle-orm";
import { db } from "./src/db";
import { puroks } from "./src/db/schema";

const puroksList = [
	"Zone 1",
	"Zone 2",
	"Zone 3",
	"Zone 4",
	"Zone 5",
	"Zone 6",
	"Zone 7",
	"Zone 8",
	"Zone 9",
	"Zone 10",
	"Zone 11",
	"Zone 12",
	"Lucky Homes",
	"NGO",
	"NEDF",
	"St Ezekiel",
	"Villasor",
	"Paho",
	"Ceres",
	"Lubi",
	"Chico",
	"Mahogany",
	"Golden Risary",
	"Narra",
	"Datiles",
	"Tapulanga",
	"Paghidaet",
	"Maniville",
	"Rosebell",
	"Cadena De Amor",
	"San Antonio",
	"Mabinuligon",
	"GK Village",
	"Saturn",
	"Sto Niño",
	"Sto Domingo",
	"San Rowue 1",
	"San Roque2",
	"Kawayanan 1",
	"Kawayan 2"
];

async function run() {
	console.log("Setting up predefined Puroks order...");
	
	for (let i = 0; i < puroksList.length; i++) {
		const name = puroksList[i];
		const orderIndex = i + 1;
		
		const existing = db.select().from(puroks).where(eq(puroks.name, name)).get();
		
		if (existing) {
			db.update(puroks).set({ orderIndex }).where(eq(puroks.id, existing.id)).run();
			console.log(`Updated existing Purok: ${name} to orderIndex: ${orderIndex}`);
		} else {
			db.insert(puroks).values({ name, orderIndex }).run();
			console.log(`Inserted new Purok: ${name} with orderIndex: ${orderIndex}`);
		}
	}
	
	console.log("Done!");
}

run().catch(console.error);
