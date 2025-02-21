import dotenv from "dotenv";
import { open } from "sqlite";
import { Database } from "sqlite3";
dotenv.config({ path: "../../.env" });

export function connectToDb() {
  const databaseLocation = process.env.DB_LOCATION;
  console.log("Connecting to SQLite database at path: ", databaseLocation);
  if (!databaseLocation) {
    throw new Error("No database location provided");
  }
  const db = new Database(databaseLocation);
  return db;
}

// Connect to the loans table SQLite database
export const connectDB = async () => {
  const db = await open({
    filename: "./src/db/loans.db",
    driver: Database,
  });

  return db;
};
