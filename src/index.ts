import bfcLogsRoutes from "@/routes/bfcLogsRoutes";
import statusRoutes from "@/routes/statusRoutes";
import cors from "cors";
import dotenv from "dotenv";
import { EventEmitter } from "events";
import express, { Express } from "express";
import { WebSocket, WebSocketServer } from "ws";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import fs from "fs";
import path from "path";

dotenv.config({ path: ".env" });

const app: Express = express();
const port = process.env.PORT;

export const emitter = new EventEmitter();
const wss = new WebSocketServer({ port: 8091 });
wss.on("connection", (ws: WebSocket) => {
  // Client identifier passed through the WebSocket protocol
  console.log("Client connected for live progress updates");

  // Forward events from the EventEmitter to the correct WebSocket client
  const handleEvent = (eventData: unknown) => {
    ws.send(JSON.stringify(eventData));
  };

  // Attach listener to the EventEmitter
  emitter.on("progress", handleEvent);

  // Handle client disconnection
  ws.on("close", () => {
    console.log("Client disconnected for live progress updates");
    emitter.removeListener("progress", handleEvent);
  });
});

app.use(
  cors({
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);

app.use(express.json());

app.use("/api/status", statusRoutes);
app.use("/api/bfcLogs", bfcLogsRoutes);

// Read and parse OpenAPI spec
const openApiPath = path.join(__dirname, "../docs/openapi.yaml");
const openApiSpec = YAML.parse(fs.readFileSync(openApiPath, "utf8"));

// Serve Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.listen(port, async () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
