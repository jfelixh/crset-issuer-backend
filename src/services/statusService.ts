import { AccountId } from "caip";
import * as bfc from "../../../padded-bloom-filter-cascade/src";
import dotenv from "dotenv";
import { sendBlobTransaction } from "src/utils/blob";
import { randomString } from "src/utils/random-string";
import {connectToDb, getIdsByStatus, getStatusById, updateStatusById} from "../db/database";

dotenv.config({ path: "../../.env" });

interface StatusEntry {
  id: string;
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
  statusPublisher: string; // CAIP-10 Account ID
}


// Creates a new revocation status entry to be added to a VC before it is signed by the issuer.
export function createStatusEntry(): StatusEntry {
  // Generates a unique ID for a new status entry
  const id = randomString();

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

// Revoke an existing credential by revocation ID
export async function revokeCredential(id: string): Promise<boolean> {
  const db = connectToDb("../db/bfc.sqlite");
  console.log("here")
  try {
    const currentStatus = await getStatusById(db, id);
    if (currentStatus === "Valid") {
      await updateStatusById(db, id, "Invalid");
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error querying the database:", error);
  }
  return false;
}

// Publish BFC
export async function publishBFC() {
  const db = connectToDb("../db/bfc.sqlite");

  try {
    const validSet = await getIdsByStatus(db, "Valid");
    const invalidSet = await getIdsByStatus(db, "Invalid");
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
  return sendBlobTransaction(
    process.env.INFURA_API_KEY!,
    process.env.PRIVATE_KEY!,
    process.env.ADDRESS!,
    "Hello World!"
  );
}

// publishBFC()
