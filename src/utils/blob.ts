import { Alchemy, Network } from "alchemy-sdk";
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
export async function blobFromData(
  data: string,
  blobSize = 128
): Promise<Blob> {
  const encoder = new TextEncoder();
  data = "0x" + Buffer.from(data).toString("hex");
  const rawData = encoder.encode(data);

  blobSize = blobSize * 1024; // blob input data must be 128 kB, otherwise infura provider will throw an error
  const blobData = new Uint8Array(blobSize);
  blobData.set(rawData, 0);

  // same data should be used for calculating commitment and proof, but kzg-wasm only supports strings as input
  const blobHex =
    "0x" +
    Array.from(blobData)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

  return loadKZG()
    .then((kzg) => {
      let commitment = kzg.blobToKZGCommitment(blobHex);
      let proof = kzg.computeBlobKZGProof(blobHex, commitment);
      return { data: blobData, commitment: commitment, proof: proof };
    })
    .catch((err) => {
      throw err;
    });
}

export async function sendBlob(data: string) {
  const infuraProvider = new ethers.InfuraProvider(
    "sepolia",
    process.env.INFURA_API_KEY
  );
  const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, infuraProvider);

  try {
    const blob = await blobFromData(data);
    const transaction = {
      type: 3, // blob transaction type
      to: process.env.ADDRESS, // send to one's self
      value: ethers.parseEther("0.0001"), // send a tiny amount so the transaction can be found using Alchemy's Transfer API, only paid plans can use Trace API which includes 0 ETH TXs
      gasLimit: 21000,
      gasPrice: ethers.parseUnits("5", "gwei"),
      blobGasPrice: ethers.parseUnits("5", "gwei"),
      maxFeePerBlobGas: ethers.parseUnits("5", "gwei"),
      blobs: [
        { data: blob.data, commitment: blob.commitment, proof: blob.proof },
      ],
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
