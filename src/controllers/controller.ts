import { DBEntry } from "@/models/statusEntry";
import { Database } from "sqlite3";

export async function getIdsByStatus(
  db: Database,
  status: 0 | 1,
): Promise<Set<string>> {
  return new Promise((resolve, reject) => {
    const ids = new Set<string>();

    db.all(
      "SELECT id FROM credentialStatus WHERE status = ?",
      [status],
      (err, rows: DBEntry[]) => {
        if (err) {
          console.error("Error getting IDs by status:", err.message);
          reject(err);
          return;
        }
        rows.forEach((row) => ids.add(row.id));
        resolve(ids);
      },
    );
  });
}

export async function getStatusById(db: Database, id: string): Promise<number> {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT status FROM credentialStatus WHERE id = ?",
      [id],
      (err, row: DBEntry) => {
        if (err) {
          console.error("Error getting status of id:", err.message);
          reject(err);
          return;
        }
        if (!row) {
          reject("Id not found: " + id);
        }
        resolve(row.status);
      },
    );
  });
}

export async function updateStatusById(
  db: Database,
  id: string,
  status: 0 | 1,
): Promise<void> {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE credentialStatus SET status = ? WHERE id = ?",
      [status, id],
      (err) => {
        if (err) {
          console.error("Error updating status:", err.message);
          reject(err);
          return;
        }
        resolve();
      },
    );
  });
}

export async function patchStatusById(
  db: Database,
  id: string,
  status: 0 | 1,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    db.run(
      "UPDATE credentialStatus SET status = ? WHERE id = ?",
      [status, id],
      function (err) {
        if (err) {
          console.error("Error updating entry status:", err.message);
          reject(err);
          return;
        }

        if (this.changes > 0) {
          resolve(true);
        } else {
          resolve(false);
        }
      },
    );
  });
}

export async function insertStatusEntry(
  db: Database,
  id: string,
  status: 0 | 1,
): Promise<string> {
  return new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO credentialStatus (id, status) VALUES (?, ?)",
      [id, status],
      (err) => {
        if (err) {
          console.error("Error inserting status entry:", err.message);
          reject(err);
          return "";
        }
        resolve(id);
      },
    );
  });
}
