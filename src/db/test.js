import Database from 'better-sqlite3';
const db = new Database('./bhims.db');
const rows = db.prepare(`SELECT * FROM residents WHERE full_name LIKE '%Roque%' OR full_name LIKE '%Jonel%' OR full_name LIKE '%Jimenez%'`).all();
console.log("DB Matches for Roque, Jonel, Jimenez:", rows.length);
if (rows.length > 0) {
  console.log(rows.map(r => r.full_name));
}

const allRows = db.prepare(`SELECT full_name FROM residents LIMIT 10`).all();
console.log("First 10 residents:", allRows.map(r => r.full_name));
