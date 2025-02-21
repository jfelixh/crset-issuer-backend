import {
  getIdsByStatus,
  getStatusById,
  insertStatusEntry,
  updateStatusById,
} from "@/controllers/controller";
import { connectToDb } from "@/db/database";
import { StatusEntry } from "@/models/statusEntry";
import { sendBlobTransaction } from "@/utils/blob";
import { AccountId } from "caip";
import * as process from "node:process";
import { CRSetCascade, random256BitHexString } from "crset-cascade";
import { emitter } from "../index";
import { insertBfcLog } from "./bfcLogsService";

// Creates a new revocation status entry to be added to a VC before it is signed by the issuer.
export async function createStatusEntry(): Promise<StatusEntry | null> {
  try {
    const db = connectToDb();
    // Generates a unique ID for a new status entry
    const statusPublisher = new AccountId({
      chainId: "eip155:1",
      address: process.env.ADDRESS!,
    }).toString();
    const revocationID = random256BitHexString();
    const id = statusPublisher + ":" + revocationID;
    const insertedID = await insertStatusEntry(db, revocationID, 1);

    if (insertedID) {
      return {
        id,
        type: "CRSetEntry",
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
    console.log("Revoking credential with ID:", id);
    const db = connectToDb();
    const currentStatus = await getStatusById(db, id);
    if (currentStatus === 1) {
      await updateStatusById(db, id, 0);
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
    const db = connectToDb();
    const currentStatus = await getStatusById(db, id);
    return currentStatus === 1;
  } catch (error) {
    console.error("Error occurred:", error);
  }
  return false;
}

export async function publishBFC(): Promise<{
  success: boolean;
  logId?: number;
}> {
  try {
    emitter?.emit("progress", { step: "queryDB", status: "started" });
    const db = connectToDb();
    const validSet = await getIdsByStatus(db, 1);
    const invalidSet = await getIdsByStatus(db, 0);
    emitter?.emit("progress", {
      step: "queryDB",
      status: "completed",
      additionalMetrics: {
        validSetSize: validSet.size,
        invalidSetSize: invalidSet.size,
      },
    });

    const rHat = parseInt(process.env.VALID_CAPACITY || "4096", 10);

    emitter?.emit("progress", { step: "constructBFC", status: "started" });
    const startTimeConstruction = performance.now();

    const cascade = CRSetCascade.fromSets(validSet, invalidSet, rHat);

    emitter?.emit("progress", {
      step: "constructBFC",
      status: "completed",
      additionalMetrics: { levelCount: cascade.getDepth() },
    });
    emitter?.emit("progress", { step: "serializeBFC", status: "started" });
    const endTimeConstruction = performance.now();

    const serializedData = cascade.toDataHexString();

    emitter?.emit("progress", {
      step: "serializeBFC",
      status: "completed",
      additionalMetrics: {
        serializedDataSize: serializedData.length / 2,
      },
    });

    const startTimePublishing = performance.now();
    const result = await sendBlobTransaction(
      process.env.INFURA_API_KEY!,
      process.env.PRIVATE_KEY!,
      process.env.ADDRESS!,
      serializedData,
    ).catch((error: Error) => {
      console.error("Error publishing BFC:", error);
      return undefined;
    });
    const endTimePublishing = performance.now();

    if (result) {
      const logId = await insertBfcLog(db, {
        validIdsSize: validSet.size,
        invalidIdsSize: invalidSet.size,
        serializedDataSize: Math.ceil(serializedData.length / 2), // in bytes
        constructionTimeInSec: Number(
          ((endTimeConstruction - startTimeConstruction) / 1000).toFixed(4),
        ),
        publicationTimeInSec: Number(
          ((endTimePublishing - startTimePublishing) / 1000).toFixed(4),
        ),
        numberOfBlobs: result.numberOfBlobs,
        transactionHash: result.txHash,
        blobVersionedHash: result.blobVersionedHashes,
        publicationTimestamp: new Date().toISOString(),
        transactionCost: result.transactionCost,
        calldataTotalCost: result.callDataTotalCost,
        numberOfBfcLayers: cascade.getDepth(),
        rHat: rHat,
      });
      return { success: true, logId: logId };
    } else {
      console.log("Result from publishing is missing");
      return { success: false };
    }
  } catch (error) {
    console.error("Error querying the database:", error);
    return { success: false };
  }
}
