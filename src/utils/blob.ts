import dotenv from "dotenv";
import { ethers, isAddress } from "ethers";
import { loadKZG } from "kzg-wasm";
import { calculateCallDataGasUsed } from "./hexToByte";
dotenv.config({ path: "../../.env" });

type Blob = {
  data: string;
  commitment: string;
  proof: string;
};

// Define the BLS12-381 field modulus (p)
const FIELD_MODULUS = BigInt(
    "52435875175126190479447740508185965837690552500527637822603658699938581184512"
);

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
    p=1;

  }
  // Flatten the array of segments back into a single Uint8Array
  return new Uint8Array(canonicalData.flatMap(val => Array.from(val)));
}

/**
 * Constructs valid blobs with the original hex string (each blob with corresponding KZG commitment and proof).
 * The output blobs are canonical and preserve the original data.
 * @param data - The data to be written to the blockchain, in hex string format
 * @param blobSize - The size of each blob in kilobytes (128KB by default)
 * @returns A promise of an array of blobs with the data, KZG commitment, and proof
 */
export async function blobFromData(
    data: string,
    blobSize = 128
): Promise<Blob[]> {
  if (data.startsWith("0x")) {
    data = data.slice(2);
  }

  // Convert hex string to Uint8Array
  const rawData = new Uint8Array(data.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));

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
  data: string
) : Promise<{ numberOfBlobs: number; txHash: string; transactionCost: number; blobVersionedHashes: string[]; callDataTotalCost: number;}> {
  // TODO: adapt for >6 blobs => multiple transactions
  // TODO: allow user to choose provider
  const provider = new ethers.InfuraProvider("sepolia", APIKey);
  const signer = new ethers.Wallet(privateKey, provider);

  // input validation
  if (!isAddress(receiverAddress)) {
    throw new Error("Invalid Ethereum address");
  }
  if (!data.startsWith("0x")) {
    throw new Error("Data must be in hex format");
  }

  try {
    const blobs = await blobFromData(data, 128);

    if (blobs.length > 6) {
      // Maximum number of blobs per transaction is 6 (as of November 2024)
      console.error("Error sending blob transaction: too many blobs");
      throw new Error("Error sending blob transaction: too many blobs");
    }

    const transaction = {
      type: 3, // blob transaction type
      to: receiverAddress, // send to one's self
      gasLimit: 21000,
      gasPrice: ethers.parseUnits("5", "gwei"),
      // blobGasPrice: ethers.parseUnits("5", "gwei"),
      maxFeePerBlobGas: ethers.parseUnits("5", "gwei"),
      blobs: blobs,
    };

    const tx = await signer.sendTransaction(transaction);
    console.log(`Sending TX ${tx.hash}, waiting for confirmation...`);

    const receipt = await tx.wait(); 

  if (receipt) {
    console.log(`TX mined in block ${receipt.blockNumber}`);

    
    if (receipt) {
        const block = await receipt.getBlock()
        const baseFee = Number(block.baseFeePerGas)
        const priorityFee = Number(tx.maxPriorityFeePerGas)
        const blobData = blobs.flatMap(blob => blob.data);

        const transactionCost = Number(receipt.gasUsed) * (baseFee + priorityFee) + Number(receipt.blobGasUsed) * Number(receipt.blobGasPrice);
      const callDataGasUsed = calculateCallDataGasUsed(
          blobData.map((str) => new TextEncoder().encode(str))
      );
        const callDataTotalCost = (baseFee + priorityFee) * callDataGasUsed

        console.log("Base fee: ", baseFee)
        console.log("Max Priority fee: ", priorityFee)
        console.log("Blob gas used: ", receipt.blobGasUsed)
        console.log("Blob gas price: ", receipt.blobGasPrice)
        
      return {
        numberOfBlobs: blobs.length,
        txHash: tx.hash,
        transactionCost: transactionCost,
        blobVersionedHashes: tx.blobVersionedHashes || [],
        callDataTotalCost: callDataTotalCost
      };
    } else {
      throw new Error("Missing data for calculating transaction cost.");
    }
  } else {
    throw new Error("Receipt is null or undefined.");
  }
} catch (error) {
  console.error("Error sending blob transaction:", error);
  throw error; 
}
}
