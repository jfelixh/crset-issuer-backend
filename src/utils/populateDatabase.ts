import type { DBEntry } from "@/models/statusEntry";
import csv from "csv-parser";
import fs from "node:fs";
import * as path from "path";
import { Database } from "sqlite3";

let db: Database;

export function connectToDb(databaseLocation: string): Promise<Database> {
  return new Promise((resolve, reject) => {
    if (!db) {
      const dbPath = path.resolve(process.cwd(), databaseLocation);
      console.log("Connecting to SQLite database with path:", dbPath);
      db = new Database(dbPath, (err) => {
        if (err) {
          console.error("Error connecting to SQLite:", err.message);
          reject(err);
        } else {
          console.log("Connected to SQLite database.");
          resolve(db);
        }
      });
    } else {
      resolve(db);
    }
  });
}

async function populateDbFromCsv(
  db: Database,
  filePath: string
): Promise<void> {
  console.log(`Populating database with data from CSV file at: ${filePath}`);

  const insertStmt = db.prepare(
    "INSERT OR REPLACE INTO credentialStatus (id, status) VALUES (?, ?)"
  );
  const stream = fs
    .createReadStream(filePath, { encoding: "utf8" }) // Ensure correct encoding
    .pipe(
      csv({
        headers: ["id", "status"],
        skipLines: 1,
      })
    );

  stream.on("data", (row) => {
    const credentialStatusId =
      "urn:eip155:1:0x32328bfaea51ce120db44f7755a1170e9cc43653:" + row.id;
    const status = row.status;

    insertStmt.run([credentialStatusId, status], (err) => {
      if (err) {
        console.error(
          `Error inserting row ${JSON.stringify(row)}:`,
          err.message
        );
      }
    });
  });

  stream.on("end", () => {
    console.log("CSV file successfully processed.");
    insertStmt.finalize();
  });
  stream.on("error", (err) => {
    console.error("Error reading CSV file:", err.message);
  });
}

async function checkTable(db: Database): Promise<void> {
  console.log("Checking if the table exists...");

  return new Promise((resolve, reject) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='credentialStatus'",
      (err, row) => {
        if (err) {
          reject(`Error checking if table exists: ${err.message}`);
        } else if (!row) {
          console.warn("❌ Table 'credentialStatus' does not exist.");
          resolve();
        } else {
          console.log("✅ Table 'credentialStatus' exists.");

          console.log("Checking database entries...");
          db.all("SELECT status, id FROM credentialStatus", (err, rows) => {
            if (err) {
              reject(`Error querying database: ${err.message}`);
            } else {
              if (rows.length === 0) {
                console.warn("❌ No entries found in credentialStatus table.");
              } else {
                rows.forEach((row) => {
                  console.log(
                    `✅ Found entry for ID ${(row as DBEntry).id}: ${
                      (row as DBEntry).status
                    }`
                  );
                });
              }
              console.log("Database entries checked.");
              resolve();
            }
          });
        }
      }
    );
  });
}

export async function initDB() {
  try {
    const db = await connectToDb(process.env.DB_LOCATION!);
    populateDbFromCsv(db, "/bfc-status-issuer-backend/app/src/data/idSet.csv");
    // await checkTable(db);  // Run if you want to check if the table exists with the correct content
  } catch (error) {
    console.error("Error during DB initialization:", error);
  }
}
