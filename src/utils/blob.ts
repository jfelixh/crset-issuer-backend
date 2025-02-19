import dotenv from "dotenv";
import { ethers, isAddress } from "ethers";
import { loadKZG } from "kzg-wasm";
import { emitter } from "src";
import { calculateCallDataGasUsed } from "./hexToByte";
dotenv.config({ path: "../../.env" });

type Blob = {
  data: string;
  commitment: string;
  proof: string;
};

/**
 * Ensures all 32-byte scalars in a Uint8Array are canonical by adding padding
 * to shift problematic segments out of the scalar boundaries.
 * @param rawData - The original raw data as a Uint8Array
 * @returns A Uint8Array with raw data and additional padding for canonicalization
 */
function ensureCanonicalBlobs(rawData: Uint8Array): Uint8Array {
  const scalarSize = 31; // Each scalar is 32 bytes, leave one byte for padding, 3.125% overhead
  const canonicalData: Uint8Array[] = [];
  let p = 0;

  for (let i = 0; i < rawData.length; i += scalarSize) {
    let segment = rawData.slice(i, i + scalarSize);

    if (segment.length < scalarSize) {
      // Pad the last segment to 32 bytes if it's shorter
      const paddedSegment = new Uint8Array(scalarSize);
      paddedSegment.set(segment);
      segment = paddedSegment;
    }

    // Handle non-canonical scalar by adding 1-byte padding
    const paddedSegment = new Uint8Array(scalarSize + 1); // Add 1-byte padding
    paddedSegment.set(segment, 1); // Shift data by 1 byte
    canonicalData.push(paddedSegment); // Truncate to 32 bytes
    p = 1;
  }
  // Flatten the array of segments back into a single Uint8Array
  return new Uint8Array(canonicalData.flatMap((val) => Array.from(val)));
}

/**
 * Constructs valid blobs with the original hex string (each blob with corresponding KZG commitment and proof).
 * The output blobs are canonical and preserve the original data.
 * @param data - The data to be written to the blockchain, in hex string format
 * @param blobSize - The size of each blob in kilobytes (128KiB by default)
 * @returns A promise of an array of blobs with the data, KZG commitment, and proof
 */
export async function blobFromData(
  data: string,
  blobSize = 128,
): Promise<Blob[]> {
  if (data.startsWith("0x")) {
    data = data.slice(2);
  }

  // Convert hex string to Uint8Array
  const rawData = new Uint8Array(
    data.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)),
  );

  // Ensure all blobs are canonical
  const canonicalData = ensureCanonicalBlobs(rawData);

  // Partition canonical data into blobs of specified size
  const chunkSize = blobSize * 1024; // Blob size in bytes (e.g., 128 KB)
  const scalarSize = 32; // Each scalar is 32 bytes
  const blobArrays = [];
  for (let i = 0; i < canonicalData.length; i += chunkSize) {
    const chunk = canonicalData.slice(i, i + chunkSize);

    // Check if the last scalar is incomplete
    if (chunk.length !== chunkSize) {
      const paddedChunk = new Uint8Array(chunkSize);
      paddedChunk.set(chunk);
      blobArrays.push(paddedChunk);
    } else {
      blobArrays.push(chunk);
    }
  }

  // Generate blobs with KZG commitments and proofs
  const blobs: Blob[] = [];
  const kzg = await loadKZG();

  for (const blobArray of blobArrays) {
    const blobHexString =
      "0x" +
      Array.from(blobArray)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    const commitment = kzg.blobToKZGCommitment(blobHexString);
    const proof = kzg.computeBlobKZGProof(blobHexString, commitment);

    blobs.push({ data: blobHexString, commitment, proof });
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
  data: string,
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
        "Error sending blob transaction: too many blobs (>6), currently not supported",
      );
      throw new Error(
        "Error sending blob transaction: too many blobs (>6), currently not supported",
      );
    }

    emitter?.emit("progress", { step: "constructTx", status: "started" });
    const transaction = {
      type: 3, // blob transaction type
      to: receiverAddress, // send to one's self
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("10", "gwei"),
      gasLimit: 500000,
      maxFeePerBlobGas: ethers.parseUnits("50", "wei"),
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
    if (receipt) {
      console.log(`TX mined in block ${receipt.blockNumber}`);

      const blobData = blobs.flatMap((blob) => {
        return new TextEncoder().encode(blob.data);
      });
      const callDataGasUsed = calculateCallDataGasUsed(blobData);

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
        transactionCost:
          (metrics.gasPrice * metrics.gasUsed +
            metrics.blobGasPrice * metrics.blobGasUsed) /
          10 ** 18, // in ether
        blobVersionedHashes: tx.blobVersionedHashes || [],
        callDataTotalCost: (metrics.gasPrice * callDataGasUsed) / 10 ** 18, // in ether
      };
    } else {
      throw new Error("Receipt is null or undefined");
    }
  } catch (error) {
    console.error("Error sending blob transaction:", error);
    throw error;
  }
}
