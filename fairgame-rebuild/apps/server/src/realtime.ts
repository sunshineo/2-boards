import type { Server } from "socket.io";

import type { MatchService } from "./matches/matchService.js";

type WatchMatchPayload = {
  readonly matchId?: string;
};

export function registerRealtime(io: Server, matchService: MatchService) {
  matchService.onMatchUpdated((match) => {
    io.to(getMatchRoom(match.id)).emit("match:update", match);
  });

  io.on("connection", (socket) => {
    socket.on("watch-match", async (payload: WatchMatchPayload) => {
      if (!payload.matchId) return;
      const match = await matchService.getMatch(payload.matchId);
      if (!match) return;

      socket.join(getMatchRoom(match.id));
      socket.emit("match:update", match);
    });
  });
}

function getMatchRoom(matchId: string) {
  return `match:${matchId}`;
}
