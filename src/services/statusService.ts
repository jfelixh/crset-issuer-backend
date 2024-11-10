import { AccountId } from "caip";
// import cryptoRandomString from "crypto-random-string";
import dotenv from "dotenv";
import { sendBlob } from "src/utils/blob";
dotenv.config({ path: "../../.env" });

interface StatusEntry {
  id: string;
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
  statusPublisher: string; // CAIP-10
}

// Generates a unique ID for a new status entry
function generateRevocationID(): string {
  // Removed for now as importing crypto-random-string is causing issues
  // return cryptoRandomString({ length: 32, type: "url-safe" }); // 32 characters long = 256 bits
  return "Not implemented";
}

// Create a new status entry
export function createStatusEntry(): StatusEntry {
  const id = generateRevocationID();
  // TODO: remove placeholder and implement actual status entry creation
  return {
    id,
    type: "BFCStatusEntry",
    statusPurpose: "revocation",
    statusPublisher: new AccountId({
      chainId: "eip155:1",
      address: "test",
    }).toString(),
  };
}

// Revoke an existing credential by ID
export function revokeCredential(id: string): boolean {
  // TODO
  return false;
}

// Publish BFC
export function publishBFC(filter: any): { success: boolean; filter: any } {
  // TODO
  return { success: false, filter };
}

// Test function to check if data stored in the blob is being fetched correctly
export async function testSend() {
  return sendBlob("Hello World!");
}
