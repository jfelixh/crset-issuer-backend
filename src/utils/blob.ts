import { Alchemy, Network } from "alchemy-sdk";
import dotenv from "dotenv";
import { ethers } from "ethers";
dotenv.config({ path: "../../.env" });

let infuraProvider = new ethers.InfuraProvider(
  "sepolia",
  process.env.INFURA_API_KEY
);

export function blobHexToString(blobHex: string) {
  // Step 1: Remove the '0x' prefix if it exists
  if (blobHex.startsWith("0x")) {
    blobHex = blobHex.slice(2);
  }

  // Step 2: Convert hex string to a Uint8Array
  const byteArray = new Uint8Array(
    blobHex.match(/.{1,2}/g)!.map((byte: string) => parseInt(byte, 16))
  );

  // Step 3: Decode the Uint8Array back to a string
  const decoder = new TextDecoder();
  return decoder.decode(byteArray);
}

export async function getBlobDataFromSenderAddress(
  senderAddress: string
): Promise<string> {
  const config = {
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_SEPOLIA,
  };
  const alchemy = new Alchemy(config);

  const transfers = await alchemy.core
    // @ts-ignore
    .getAssetTransfers({
      fromAddress: senderAddress,
      toAddress: senderAddress,
      category: ["external"],
      order: "desc",
    });

  const latestTxHash = transfers.transfers[0]!.hash;
  const tx = await infuraProvider.getTransaction(latestTxHash);
  const blobVersionedHash = tx?.blobVersionedHashes![0];

  const blobData = await fetch(
    `${process.env.BLOBSCAN_API_URL}${blobVersionedHash}/data`
  ).then((response) => {
    return response.text();
  });

  const preProcessedBlobData = blobHexToString(blobData.replace(/['"]+/g, ""));
  const blobString = blobHexToString(preProcessedBlobData);

  return blobString;
}
