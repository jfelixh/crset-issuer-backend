import * as sqlite from "sqlite3";
import * as fs from "node:fs";
import csv from "csv-parser";

export type dbEntry = {
  id: string;
  status: string;
};

let db: sqlite.Database;

export function connectToDb(databaseLocation: string) {
  if (!db) {
    db = new sqlite.Database(databaseLocation, (err) => {
      if (err) {
        console.error('Error connecting to SQLite:', err.message);
        return;
      }
      console.log('Connected to SQLite database.');
    });
  }
  return db;
}

function createTable(db: sqlite.Database) {
  db.run(`CREATE TABLE IF NOT EXISTS credentialStatus(
        id TEXT PRIMARY KEY, 
        status TEXT NOT NULL
        ) STRICT`
    , (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
        return;
      }
      console.log('Credential Status table is ready.');
    }
  );
}

function populateDb(db: sqlite.Database, filePath: string) {
  const insertStmt = db.prepare('INSERT INTO credentialStatus (id, status) VALUES (?, ?)');

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      insertStmt.run([row.id, row.status], (err) => {
        if (err) {
          console.error(`Error inserting row ${JSON.stringify(row)}:`, err.message);
        }
      });
    })
    .on('end', () => {
      console.log('CSV file successfully processed.');
      insertStmt.finalize();
    })
    .on('error', (err) => {
      console.error('Error reading CSV file:', err.message);
    });
}

export async function getIdsByStatus(db:sqlite.Database, status: string): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const ids = new Set<string>();

    db.all('SELECT id FROM credentialStatus WHERE status = ?', [status], (err, rows: dbEntry[]) => {
      if (err) {
        console.error('Error querying the database:', err.message);
        reject(err);
        return;
      }

      // Populate the Set with emails
      rows.forEach(row => ids.add(row.id));
      resolve(ids);
    })
  });
}

// connectToDb();
// createTable(db);
// populateDb(db, "/Users/zexingong/Desktop/idSet.csv")
// getIdsByStatus(db!, "Valid").then((result) => {console.log(result)});
// console.log(getIdsByStatus(db, "Valid"));


