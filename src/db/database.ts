import sqlite3 from "sqlite3";
import dotenv from "dotenv";
dotenv.config({ path: "../../.env" });

export function connectToDb(): sqlite3.Database {
  const databaseLocation = process.env.DB_LOCATION || "./src/db/bfc.db";

  return new sqlite3.Database(databaseLocation, (err) => {
    if (err) {
      console.error("Error connecting to database:", err.message);
      throw err;
    }
  });
}
