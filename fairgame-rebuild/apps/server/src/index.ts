import { createServer } from "node:http";
import { resolve } from "node:path";

import { Server } from "socket.io";

import { createApp } from "./app";
import type { SupportedGameState } from "./matches/gameRegistry";
import { MatchService } from "./matches/matchService";
import { PgliteMatchRepository } from "./persistence/pgliteMatchRepository";
import { registerRealtime } from "./realtime";

const port = Number(process.env["PORT"] ?? 4000);
const dataDir = process.env["FAIRGAME_DB_DIR"] ?? resolve(process.cwd(), "../../.data/pglite");
const repository = await PgliteMatchRepository.open<SupportedGameState>(dataDir);
const matchService = new MatchService({ repository });
await matchService.loadFromRepository();
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
