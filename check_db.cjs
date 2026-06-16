const Database = require("better-sqlite3");
const db = new Database("bhims.db");

const rows = db.prepare("SELECT id, fullName, relationshipToHead, isHeadOfHousehold, householdId FROM residents WHERE householdId = '2'").all();
console.log(JSON.stringify(rows, null, 2));
