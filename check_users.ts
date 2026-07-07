import { db } from "./src/db/index";
import { users } from "./src/db/schema";

async function run() {
  const allUsers = db.select().from(users).all();
  console.log(JSON.stringify(allUsers, null, 2));
}

run();
