export type DBEntry = {
  id: string;
  status: string;
};

export interface StatusEntry {
  id: string; // CAIP-10 Account ID
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
}
