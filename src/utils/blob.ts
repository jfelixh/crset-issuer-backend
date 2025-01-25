import dotenv from "dotenv";
import { ethers, isAddress } from "ethers";
import { loadKZG } from "kzg-wasm";
import { emitter } from "src";
import { calculateCallDataGasUsed } from "./hexToByte";
dotenv.config({ path: "../../.env" });

type Blob = {
  data: Uint8Array;
  commitment: string;
  proof: string;
};

/**
 * Partitions the input array into chunks of a specified size and pads the last chunk
 * @param inputArray - The input array to be partitioned
 * @param blobSize - The size of each blob in kilobytes
 * @returns An array of Uint8Arrays with the partitioned and padded input array
 */
function partitionArrayAndPad(
  inputArray: Uint8Array,
  blobSize: number
): Uint8Array[] {
  blobSize = blobSize * 1024; // Maximum hex characters per block including 0x prefix
  const chunks = [];
  for (let i = 0; i < inputArray.length; i += blobSize) {
    const blobData = new Uint8Array(blobSize);
    let block = inputArray.slice(i, i + blobSize);
    blobData.set(block, 0); // Padding for last blob
    chunks.push(blobData);
  }
  return chunks;
}

/**
 * Constructs valid blobs with the original hex string (each blob with corresponding KZG commitment and proof)
 * @param data - The data to be written to the blockchain, in hex string format
 * @param blobSize - The size of each blob in kilobytes (128KB by default)
 * @returns A promise of an array of blobs with the data, KZG commitment, and proof
 */
export async function blobFromData(
  data: string,
  blobSize = 128
): Promise<Blob[]> {
  const encoder = new TextEncoder();
  data = Buffer.from(data).toString();
  const rawData = encoder.encode(data);
  const blobArrays = partitionArrayAndPad(rawData, blobSize);

  const blobs: Blob[] = [];
  const kzg = await loadKZG();
  for (let blobArray of blobArrays) {
    const blobHexString =
      "0x" +
      Array.from(blobArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    let commitment = kzg.blobToKZGCommitment(blobHexString);
    let proof = kzg.computeBlobKZGProof(blobHexString, commitment);
    const blob = { data: blobArray, commitment: commitment, proof: proof };
    blobs.push(blob);
  }
  return blobs;
}

/**
 * Sends the blobs to the blockchain
 * @param APIKey - The API key for a provider supported by ethers.js (e.g. Infura)
 * @param privateKey - The private key of the sender's account
 * @param receiverAddress - The address of the receiver's account (usually the same as the sender's)
 * @param data - The data to be written to the blockchain, in hex string format
 */
export async function sendBlobTransaction(
  APIKey: string,
  privateKey: string,
  receiverAddress: string,
  data: string
): Promise<{
  numberOfBlobs: number;
  txHash: string;
  transactionCost: number;
  blobVersionedHashes: string[];
  callDataTotalCost: number;
}> {
  if (!APIKey || !privateKey || !receiverAddress || !data) {
    throw new Error("Missing required parameters");
  }
  // TODO: adapt for >6 blobs => multiple transactions
  // TODO: allow user to choose provider
  const provider = new ethers.InfuraProvider("sepolia", APIKey);
  const wallet = new ethers.Wallet(privateKey, provider);

  // input validation
  if (!isAddress(receiverAddress)) {
    throw new Error("Invalid Ethereum address");
  }
  if (!data.startsWith("0x")) {
    throw new Error("Data must be in hex format");
  }

  try {
    emitter?.emit("progress", { step: "constructBlobs", status: "started" });
    const blobs = await blobFromData(data, 128);
    emitter?.emit("progress", {
      step: "constructBlobs",
      status: "completed",
      additionalMetrics: { blobCount: blobs.length },
    });

    if (blobs.length > 6) {
      // Maximum number of blobs per transaction is 6 (as of November 2024)
      console.error(
        "Error sending blob transaction: too many blobs (>6), currently not supported"
      );
      throw new Error(
        "Error sending blob transaction: too many blobs (>6), currently not supported"
      );
    }

    emitter?.emit("progress", { step: "constructTx", status: "started" });
    const transaction = {
      type: 3, // blob transaction type
      to: receiverAddress, // send to one's self
      maxFeePerGas: ethers.parseUnits("20", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("1", "gwei"),
      gasLimit: 500000,
      maxFeePerBlobGas: ethers.parseUnits("100", "gwei"),
      blobs: blobs,
    };
    emitter?.emit("progress", { step: "constructTx", status: "completed" });

    /* {
      // There are transactions stuck in mempool if pendingNonce is greater than latestNonce
      const pendingNonce = await provider.getTransactionCount(wallet.address, "pending");
      const latestNonce = await provider.getTransactionCount(wallet.address, "latest");
      console.log(`Pending Nonce: ${pendingNonce}, Latest Nonce: ${latestNonce}`);
    } */

    emitter?.emit("progress", { step: "sendTx", status: "started" });
    const tx = await wallet.sendTransaction(transaction);
    console.log(`Sending TX ${tx.hash}, waiting for confirmation...`);

    let metrics = {
      txHash: tx.hash,
      blockNumber: 0,
      from: tx.from,
      to: tx.to,
      gasPrice: 0,
      gasUsed: 0,
      blobGasPrice: 0,
      blobGasUsed: 0,
    };
    const receipt = await tx.wait();
    console.log(`TX mined in block ${receipt!.blockNumber}`);
    metrics.blockNumber = receipt!.blockNumber;
    metrics.gasPrice = Number(receipt!.gasPrice);
    metrics.gasUsed = Number(receipt!.gasUsed);
    metrics.blobGasPrice = Number(receipt!.blobGasPrice!);
    metrics.blobGasUsed = Number(receipt!.blobGasUsed!);

    emitter?.emit("progress", {
      step: "sendTx",
      status: "completed",
      additionalMetrics: metrics,
    });

    return {
      numberOfBlobs: blobs.length,
      txHash: tx.hash,
      transactionCost: metrics.gasPrice * metrics.gasUsed,
      blobVersionedHashes: blobs.map((blob) => blob.commitment),
      callDataTotalCost: calculateCallDataGasUsed([
        new TextEncoder().encode(data),
      ]),
    };
  } catch (error) {
    console.error("Error sending blob transaction:", error);
    throw error;
  }
}
