import dotenv from "dotenv";
import { ethers } from "ethers";
import { loadKZG } from "kzg-wasm";
dotenv.config({ path: "../../.env" });

type Blob = {
  data: Uint8Array;
  commitment: string;
  proof: string;
};

// Writer
function partitionArrayAndPad(inputArray: Uint8Array, blobSize: number): Uint8Array[] {
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

export async function blobFromData(data: string, blobSize = 128): Promise<Blob[]> {
  const encoder = new TextEncoder();
  data = Buffer.from(data).toString('hex');
  const rawData = encoder.encode(data);
  const blobArrays = partitionArrayAndPad(rawData, blobSize);

  const blobs: Blob[] = [];
  const kzg = await loadKZG();
  for (let blobArray of blobArrays) {
    const blobHexString =
      "0x" +
      Array.from(blobArray)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    let commitment = kzg.blobToKZGCommitment(blobHexString);
    let proof = kzg.computeBlobKZGProof(blobHexString, commitment);
    const blob = { data: blobArray, commitment: commitment, proof: proof };
    blobs.push(blob);
  }
  return blobs;
}

export async function sendBlob(data: string) {
  const infuraProvider = new ethers.InfuraProvider(
    "sepolia",
    process.env.INFURA_API_KEY
  );
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, infuraProvider);

  try {
    const blobs = await blobFromData(data, 128);

    if (blobs.length > 6) {
      console.error("Error sending blob transaction: too many blobs");

      return new Error("Error sending blob transaction: too many blobs");
    }

    const transaction = {
      type: 3, // blob transaction type
      to: process.env.ADDRESS, // send to one's self
      gasLimit: 21000,
      gasPrice: ethers.parseUnits("5", "gwei"),
      blobGasPrice: ethers.parseUnits("5", "gwei"),
      maxFeePerBlobGas: ethers.parseUnits("5", "gwei"),
      blobs: blobs,
    };

    const tx = await signer.sendTransaction(transaction);
    console.log(tx);

    const receipt = await tx.wait();
    return receipt;
  } catch (error) {
    console.error("Error sending blob transaction:", error);
    throw error;
  }
}
