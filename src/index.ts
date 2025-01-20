import cors from "cors";
import dotenv from "dotenv";
import express, { Express, Request, Response } from "express";
import statusRoutes from "./routes/statusRoutes";
import {WebSocketServer, WebSocket} from "ws";
import { EventEmitter } from "events";

dotenv.config({ path: ".env" });

const app: Express = express();
const port = process.env.PORT;

export const emitter = new EventEmitter();
const wss = new WebSocketServer({ port: 8091 });
wss.on('connection', (ws: WebSocket) => {
  // Client identifier passed through the WebSocket protocol
  console.log('Client connected');

  // Forward events from the EventEmitter to the correct WebSocket client
  const handleEvent = (eventData: any) => {
    ws.send(JSON.stringify(eventData));
  };

  // Attach listener to the EventEmitter
  emitter.on('progress', handleEvent);

  // Handle client disconnection
  ws.on('close', () => {
    console.log('Client disconnected');
    emitter.removeListener('progress', handleEvent);
  });
});


app.use(
  cors({
    // origin: "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json());

app.get("/api", (req: Request, res: Response) => {
  res.send("Hello World!");
});

app.use("/api/status", statusRoutes);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
