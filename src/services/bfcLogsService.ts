
import * as sqlite from "sqlite3";
import { connectToDb } from "src/db/database";

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.db');
import { BfcLogData } from "@/models/bfcLogs";
import { Database } from "sqlite3";

/**
 * Inserts a new BFC log entry into the database
 * @param {Object} logData The data to be inserted
 * @returns {Promise<string>} The last inserted ID or an error
 */
export function insertBfcLog(db: Database, logData: BfcLogData) {
  return new Promise((resolve, reject) => {
    const query = `INSERT INTO bfcLogs (validIdsSize, invalidIdsSize, serializedDataSize, constructionTimeInSec, publicationTimeInSec, numberOfBlobs, transactionHash, blobVersionedHash, publicationTimeStemp, transactionCost, calldataTotalCost, numberOfBfcLayers, rHat)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    db.run(
      query,
      [
        logData.validIdsSize,
        logData.invalidIdsSize,
        logData.serializedDataSize,
        logData.constructionTimeInSec,
        logData.publicationTimeInSec,
        logData.numberOfBlobs,
        logData.transactionHash,
        JSON.stringify(logData.blobVersionedHash), // Store as JSON string
        logData.publicationTimeStemp,
        logData.transactionCost,
        logData.calldataTotalCost,
        logData.numberOfBfcLayers,
        logData.rHat,
      ],
      function (err) {
        if (err) {
          console.error("Error inserting BFC log entry:", err.message);
          reject(err);
          return;
        }
        resolve(this.lastID); // Resolve with the last inserted rowID
      }
    );
  });
}

export function getLogData(db: Database): Promise<BfcLogData[]> {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM bfcLogs";

    db.all(query, (err, rows) => {
      if (err) {
        console.error("Error fetching log data:", err.message);
        reject(err);
        return;
      }

      const logsWithParsedHashes = rows.map((row: any) => {
        return {
          ...row,
          blobVersionedHash: JSON.parse(row.blobVersionedHash), // back to an array
        };
      });

      resolve(logsWithParsedHashes as BfcLogData[]);
    });
  });
}
