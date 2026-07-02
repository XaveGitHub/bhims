import Database from "better-sqlite3";

const db = new Database("bhims.db");

try {
  const insert = db.prepare(`
    INSERT INTO users (username, name, password, role, created_at, updated_at) 
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  insert.run("admin", "Administrator", "123", "admin", Date.now(), Date.now());
  console.log("Admin account created successfully!");
} catch (error: any) {
  if (error.message.includes("UNIQUE constraint failed")) {
    console.log("Admin account already exists.");
  } else {
    console.error("Error creating account:", error);
  }
}
