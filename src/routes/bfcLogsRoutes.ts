import { Router } from "express";
import { getLogs, getAddress } from "@/controllers/bfcLogsController";

const router = Router();

router.get("/logs", getLogs);

router.get("/address", getAddress);

export default router;
