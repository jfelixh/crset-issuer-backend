export type DBEntry = {
  id: string;
  status: 1 | 0;
};

export interface StatusEntry {
  id: string; // CAIP-10 Account ID
  type: "BFCStatusEntry";
  statusPurpose: "revocation";
}
