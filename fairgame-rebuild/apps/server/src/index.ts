import { createServer } from "node:http";

import { Server } from "socket.io";

import { createApp } from "./app";
import { MatchService } from "./matches/matchService";
import { registerRealtime } from "./realtime";

const port = Number(process.env["PORT"] ?? 4000);
const matchService = new MatchService();
const app = createApp({ matchService });
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true
  }
});

registerRealtime(io, matchService);

httpServer.listen(port, () => {
  console.log(`FairGame server listening on http://127.0.0.1:${port}`);
});
