import { Request, Response } from "express";
import { getLogData } from "../services/bfcLogsService";
import sqlite from "sqlite3";
import { connectToDb } from "src/db/database";


export async function getLogs(req: Request, res: Response): Promise<void> {
    try {
        console.log("Fetching BFClogs...");
        const db = connectToDb(process.env.DB_LOCATION!);
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
