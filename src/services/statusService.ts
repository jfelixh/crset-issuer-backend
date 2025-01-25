import { AccountId } from "caip";
import * as process from "node:process";
import { constructBFC, toDataHexString } from "padded-bloom-filter-cascade";
import {
  getIdsByStatus,
  getStatusById,
  insertStatusEntry,
  updateStatusById,
} from "src/controllers/controller";
import { connectToDb } from "src/db/database";
import { StatusEntry } from "src/models/statusEntry";
import { sendBlobTransaction } from "src/utils/blob";
import { randomString } from "src/utils/random-string";
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
    const db = connectToDb();
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
export async function getStatusByIDWithDatabase(id: string): Promise<boolean> {
  try {
    const db = connectToDb();
    const currentStatus = await getStatusById(db, id);
    return currentStatus === "valid";
  } catch (error) {
    console.error("Error occurred:", error);
  }
  return false;
}

// Publish BFC
export async function publishBFC(): Promise<{
  success: boolean;
  filter: any[];
}> {
  try {
    emitter?.emit("progress", { step: "queryDB", status: "started" });
    const db = connectToDb();
    const validSet = await getIdsByStatus(db, "valid");
    const invalidSet = await getIdsByStatus(db, "invalid");
    emitter?.emit("progress", {
      step: "queryDB",
      status: "completed",
      additionalMetrics: {
        validSetSize: validSet.size,
        invalidSetSize: invalidSet.size,
      },
    });

    // Calculate optimal rHat: rHat >= validSet.size AND rHat >= invalidSet.size / 2 (see pseudo code)
    const rHat =
      validSet.size > invalidSet.size / 2 ? validSet.size : invalidSet.size / 2;

    emitter?.emit("progress", { step: "constructBFC", status: "started" });
    const startTimeConstruction = performance.now();
    const temp = constructBFC(validSet, invalidSet, rHat);
    emitter?.emit("progress", {
      step: "constructBFC",
      status: "completed",
      additionalMetrics: { levelCount: temp.length },
    });
    emitter?.emit("progress", { step: "serializeBFC", status: "started" });
    const endTimeConstruction = performance.now();
    const serializedData = toDataHexString([temp[0], temp[1]]);
    emitter?.emit("progress", {
      step: "serializeBFC",
      status: "completed",
      additionalMetrics: {
        serializedDataSize: serializedData.length / 2 / 1000,
      },
    });

    const startTimePublishing = performance.now();
    const result = await sendBlobTransaction(
      process.env.INFURA_API_KEY!,
      process.env.PRIVATE_KEY!,
      process.env.ADDRESS!,
      serializedData
    ).catch((error: Error) => {
      console.error("Error publishing BFC:", error);
      return undefined;
    });

    const endTimePublishing = performance.now();

    if (result) {
      insertBfcLog(db, {
        validIdsSize: validSet.size,
        invalidIdsSize: invalidSet.size,
        serializedDataSize: serializedData.length,
        constructionTimeInSec: Number(
          ((endTimeConstruction - startTimeConstruction) / 1000).toFixed(4)
        ),
        publicationTimeInSec: Number(
          ((endTimePublishing - startTimePublishing) / 1000).toFixed(4)
        ),
        numberOfBlobs: result.numberOfBlobs,
        transactionHash: result.txHash,
        blobVersionedHash: result.blobVersionedHashes,
        publicationTimeStemp: new Date().toISOString(),
        transactionCost: result.transactionCost,
        calldataTotalCost: result.callDataTotalCost,
        numberOfBfcLayers: temp[0].length,
        rHat: rHat,
      });
      return { success: true, filter: temp[0] };
    } else {
      console.log("Result from publishing is missing");
      return { success: false, filter: temp[0] };
    }
  } catch (error) {
    console.error("Error querying the database:", error);
    return { success: false, filter: [] };
  }
}
