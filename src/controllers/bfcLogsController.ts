import { connectToDb } from "@/db/database";
import { getLogData } from "@/services/bfcLogsService";
import { Request, Response } from "express";

export async function getLogs(req: Request, res: Response): Promise<void> {
  try {
    console.log("Fetching BFClogs...");
    const db = connectToDb();
    const logs = await getLogData(db);
    res.status(200).json(logs);
  } catch (err) {
    console.error("Error fetching BFClogs:", err);
    res.status(500).json({ message: "Error fetching logs" });
  }
}

export async function getAddress(req: Request, res: Response): Promise<void> {
  try {
    const address = process.env.ADDRESS;
    res.status(200).json(address);
  } catch (err) {
    console.error("Error fetching address:", err);
    res.status(500).json({ message: "Error fetching address" });
  }
}
