export type DBEntry = {
  id: string;
  status: "Valid" | "Invalid";
};

export interface StatusEntry {
  id: string; // CAIP-10 Account ID
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
}
