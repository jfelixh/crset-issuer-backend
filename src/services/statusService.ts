import { AccountId } from "caip";
import dotenv from "dotenv";
import {
  getIdsByStatus,
  getStatusById,
  insertStatusEntry,
  updateStatusById,
} from "src/controllers/controller";
import { connectToDb } from "src/db/database";
import { sendBlobTransaction } from "src/utils/blob";
import { randomString } from "src/utils/random-string";
import * as bfc from "../../../padded-bloom-filter-cascade/src/index";
import * as process from "node:process";
import {EventEmitter} from "events";
import {emitter} from "../index";
import { time } from "console";
import { insertBfcLog } from "./bfcLogsService";
dotenv.config({ path: "../../.env" });

console.log(process.env.DB_LOCATION);

interface StatusEntry {
  id: string; // CAIP-10 Account ID
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
}

// Creates a new revocation status entry to be added to a VC before it is signed by the issuer.
export async function createStatusEntry(): Promise<StatusEntry | null> {
  try {
    if (!process.env.DB_LOCATION) {
      throw new Error("No address provided");
    }
    const db = connectToDb(process.env.DB_LOCATION);

    // Generates a unique ID for a new status entry
    const statusPublisher = new AccountId({
      chainId: "eip155:1",
      address: process.env.ADDRESS!,
    }).toString();
    const id = statusPublisher + ":" + randomString();
    const insertedID = await insertStatusEntry(db, id, "Valid");

    if (insertedID) {
      return {
        id,
        type: "BFCStatusEntry",
        statusPurpose: "revocation",
      };
    }
  } catch (error) {
    console.error("Error creating status entry:", error);
  }
  return null;
}

// Revoke an existing credential by revocation ID
export async function revokeCredential(id: string): Promise<boolean> {
  try {
    const db = connectToDb(process.env.DB_LOCATION!);
    console.log("Revoking credential with ID:", id);
    const currentStatus = await getStatusById(db, id);
    if (currentStatus === "valid") {
      await updateStatusById(db, id, "invalid");
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.error("Error querying the database:", error);
  }
  return false;
}

export async function getStatusByIDForUsers(id: string): Promise<boolean> {
  try {
    const db = connectToDb(process.env.DB_LOCATION!);
    const currentStatus = await getStatusById(db, id);
    return currentStatus.toLowerCase() === "valid";
  } catch (error) {
    console.error("Error occurred:", error);
  }
  return false;
}

// Publish BFC
export async function publishBFC() {
  try {
    console.log("Publishing BFC...");
    if (!process.env.DB_LOCATION) {
      throw new Error("No db location provided or wrong dotenv config");
    }
    
    emitter?.emit('progress', {step: 'queryDB', status: 'started'});
    const db = connectToDb(process.env.DB_LOCATION!);
    const validSet = await getIdsByStatus(db, "Valid");
    const invalidSet = await getIdsByStatus(db, "Invalid");
    emitter?.emit('progress', {step: 'queryDB', status: 'completed', additionalMetrics: {validSetSize: validSet.size, invalidSetSize: invalidSet.size}});

    // Calculate optimal rHat: rHat >= validSet.size AND rHat >= invalidSet.size / 2 (see pseudo code)
    const rHat =
      validSet.size > invalidSet.size / 2 ? validSet.size : invalidSet.size / 2;

    const startTimeConstruction = performance.now()
    emitter?.emit('progress', {step: 'constructBFC', status: 'started'});
    const [serializedBFC, salt] = bfc.constructBFC(validSet, invalidSet, rHat);
    emitter?.emit('progress', {step: 'constructBFC', status: 'completed', additionalMetrics: {levelCount: serializedBFC.length}});
    const endTimeConstruction = performance.now()
    emitter?.emit('progress', {step: 'serializeBFC', status: 'started'});
    const serializedData = bfc.toDataHexString([serializedBFC, salt, serializedBFC.length]);
    emitter?.emit('progress', {step: 'serializeBFC', status: 'completed', additionalMetrics: {serializedDataSize: serializedData.length/2}});
    const startTimePublishing = performance.now()
    sendBlobTransaction(
      process.env.INFURA_API_KEY!,
      process.env.PRIVATE_KEY!,
      process.env.ADDRESS!,
      serializedData
    )
      .then((result) => {
        const endTimePublishing = performance.now()
        
        if (result){
          insertBfcLog(db, {
            validIdsSize: validSet.size,
            invalidIdsSize: invalidSet.size,
            serializedDataSize: serializedData.length,
            constructionTimeInSec: Number(((endTimeConstruction - startTimeConstruction) / 1000).toFixed(4)),
            publicationTimeInSec: Number(((endTimePublishing - startTimePublishing) / 1000).toFixed(4)),
            numberOfBlobs: result.numberOfBlobs,
            transactionHash: result.txHash,
            blobVersionedHash: result.blobVersionedHashes,
            publicationTimeStemp: new Date().toISOString(),
            transactionCost: result.transactionCost,
            calldataTotalCost: result.callDataTotalCost,
            numberOfBfcLayers: temp[0].length as number,
            rHat: rHat
          })
          return { success: true, filter: serializedBFC };
        }
        console.log("Result from publishing is missing")
      })
      .catch((error: Error) => {
        console.error("Error publishing BFC:", error);
        return { success: false, filter: serializedBFC };
      });
  } catch (error) {
    console.error("Error querying the database:", error);
  }
}
