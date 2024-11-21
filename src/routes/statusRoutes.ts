// src/routes/statusRoutes.ts
import { Request, Response, Router } from "express";
import {
  createStatusEntry,
  publishBFC,
  revokeCredential,
  testSend,
} from "../services/statusService";

const router = Router();

// creates a new revocation ID that does not collide with any existing ID
// returns the entire corresponding statusEntry for the credentialStatus array
router.post("/createStatusEntry", (req: Request, res: Response) => {
  const statusEntry = createStatusEntry();
  res.status(201).json(statusEntry);
});

// revokes the credential
router.post("/revokeCredential", async (req: Request, res: Response) => {
  const { id } = req.query;
  if (!id) {
    res.status(400).json({ error: "Revocation ID is required" });
  }

  const revoked = await revokeCredential(id as string);
  if (revoked) {
    res.status(200).json({ message: "Credential revoked" });
  } else {
    res.status(404).json({ error: "Revocation ID not found / Credential was already revoked" });
  }
});

// constructs and publishes a new blob transaction with the filter
router.post("/publishBFC", (req: Request, res: Response) => {
  // const filter = req.body;
  const result = publishBFC();
  res.status(200).json(result);
});

// test route to check if the blob data is being fetched correctly
router.get("/test", async (req: Request, res: Response) => {
  const receipt = await testSend();
  console.log(receipt);
  res.status(200).json({ receipt });
});

export default router;
