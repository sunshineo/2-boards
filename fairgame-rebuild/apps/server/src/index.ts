import { createServer } from "node:http";
import { Server } from "socket.io";

import { createApp } from "./app.js";
import { loadServerConfig } from "./config.js";
import type { SupportedGameState } from "./matches/gameRegistry.js";
import { MatchService } from "./matches/matchService.js";
import { PostgresMatchRepository } from "./persistence/postgresMatchRepository.js";
import { registerRealtime } from "./realtime.js";

const config = loadServerConfig();
const repository = await PostgresMatchRepository.open<SupportedGameState>(config.databaseUrl);
const matchService = new MatchService({ repository });
await matchService.loadFromRepository();
const app = createApp({
  matchService,
  config,
  readinessCheck: () => repository.healthCheck()
});
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: config.allowedOrigins.length > 0 ? [...config.allowedOrigins] : true,
    credentials: true
  }
});

registerRealtime(io, matchService);

if (config.cleanupIntervalMs > 0) {
  const cleanupTimer = setInterval(async () => {
    try {
      const pruned = await matchService.pruneStaleMatches(Date.now(), config.staleMatchMaxAgeMs);
      if (pruned.length > 0) {
        console.log(`Pruned ${pruned.length} stale match snapshot(s)`);
      }
    } catch (error) {
      console.error("Failed to prune stale matches", error);
    }
  }, config.cleanupIntervalMs);
  cleanupTimer.unref();
}

httpServer.listen(config.port, () => {
  console.log(`FairGame server listening on http://127.0.0.1:${config.port}`);
});
