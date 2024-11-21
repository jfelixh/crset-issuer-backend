import { AccountId } from "caip";
import * as crypto from "crypto";
import * as bfc from "../../../padded-bloom-filter-cascade/src"
// import cryptoRandomString from "crypto-random-string";
import dotenv from "dotenv";
import { sendBlobTransaction } from "src/utils/blob";
import {connectToDb, dbEntry, getIdsByStatus} from "../db/database";

dotenv.config({ path: "../../.env" });

interface StatusEntry {
  id: string;
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
  statusPublisher: string; // CAIP-10
}

// Generates a unique ID for a new status entry
function generateRevocationID(): string {
  return crypto.randomBytes(32).toString("hex");
}

// Create a new status entry
export function createStatusEntry(): StatusEntry {
  const id = generateRevocationID();
  return {
    id,
    type: "BFCStatusEntry",
    statusPurpose: "revocation",
    statusPublisher: new AccountId({
      chainId: "eip155:1",
      address: process.env.ADDRESS!,
    }).toString(),
  };
}

// Revoke an existing credential by ID
export function revokeCredential(id: string): boolean {
  // TODO
  return false;
}

// Publish BFC
export async function publishBFC() {
  const db = connectToDb("../db/bfc.sqlite");

  try {
    const validSet = await getIdsByStatus(db, "Valid");
    const invalidSet = await getIdsByStatus(db, "Invalid");
    console.log(validSet.size)
    const temp = bfc.constructBFC(validSet, invalidSet, validSet.size);
    const serializedData = bfc.toDataHexString(temp);
    sendBlobTransaction(process.env.INFURA_API_KEY!, process.env.PRIVATE_KEY!, process.env.ADDRESS!, serializedData)
      .then(() => {
        return { success: true, filter: temp[0] };
      }).catch((error: Error) => {
      console.error("Error publishing BFC:", error);
      return { success: false, filter: temp[0] };
    });
  } catch (error) {
    console.error("Error querying the database:", error);
  }

}

// Test function to check if data stored in the blob is being fetched correctly
export async function testSend() {
  return sendBlobTransaction(process.env.INFURA_API_KEY!, process.env.PRIVATE_KEY!, process.env.ADDRESS!, "Hello World!");
}

publishBFC()
