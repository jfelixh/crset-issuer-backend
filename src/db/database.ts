import csv from "csv-parser";
import dotenv from "dotenv";
import * as fs from "node:fs";
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

function createTable(db: Database) {
  db.run(
    `CREATE TABLE IF NOT EXISTS credentialStatus(
        id TEXT PRIMARY KEY, 
        status TEXT NOT NULL
        ) STRICT`,
    (err) => {
      if (err) {
        console.error("Error creating table:", err.message);
        return;
      }
      console.log("Credential Status table is ready.");
    }
  );
}

function populateDb(db: Database, filePath: string) {
  const insertStmt = db.prepare(
    "INSERT INTO credentialStatus (id, status) VALUES (?, ?)"
  );

  fs.createReadStream(filePath)
    .pipe(
      csv({
        // separator: ";"
      })
    )
    .on("data", (row) => {
      insertStmt.run([row.id, row.status], (err) => {
        if (err) {
          console.error(
            `Error inserting row ${JSON.stringify(row)}:`,
            err.message
          );
        }
      });
    })
    .on("end", () => {
      console.log("CSV file successfully processed.");
      insertStmt.finalize();
    })
    .on("error", (err) => {
      console.error("Error reading CSV file:", err.message);
    });
}
