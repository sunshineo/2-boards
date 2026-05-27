import { Router } from "express";
import type { Response } from "express";
import type { BoardId, SeatId } from "@fairgame/shared";

import { parseSupportedGameType } from "./gameRegistry";
import type { MatchService, SeatClaim } from "./matchService";

type CreateBody = {
  readonly gameType?: unknown;
  readonly playerName?: unknown;
};

type JoinBody = {
  readonly playerName?: unknown;
};

type MoveBody = {
  readonly boardId?: BoardId;
  readonly seat?: SeatId;
  readonly move?: unknown;
};

export function createMatchRouter(matchService: MatchService) {
  const router = Router();

  router.post("/", async (request, response) => {
    const body = request.body as CreateBody;
    const gameType = parseSupportedGameType(body.gameType);
    if (!gameType) {
      response.status(400).json({ error: "unsupported-game" });
      return;
    }

    const result = await matchService.createMatch(gameType, typeof body.playerName === "string" ? body.playerName : undefined);
    setSeatClaimCookie(response, result.claim);
    response.status(201).json({ seat: result.seat, match: result.match });
  });

  router.post("/:id/join", async (request, response) => {
    const body = request.body as JoinBody;
    const result = await matchService.joinMatch(
      request.params["id"] ?? "",
      typeof body.playerName === "string" ? body.playerName : undefined
    );

    if (!result) {
      response.status(404).json({ error: "match-not-found" });
      return;
    }

    if ("error" in result) {
      response.status(409).json(result);
      return;
    }

    setSeatClaimCookie(response, result.claim);
    response.json({ seat: result.seat, match: result.match });
  });

  router.get("/:id/session", async (request, response) => {
    const id = request.params["id"] ?? "";
    const result = await matchService.restoreSession(id, getSeatClaimCookie(request.headers.cookie, id));

    if (!result) {
      response.status(404).json({ error: "match-not-found" });
      return;
    }

    response.json(result);
  });

  router.get("/:id", async (request, response) => {
    const match = await matchService.getMatch(request.params["id"] ?? "");

    if (!match) {
      response.status(404).json({ error: "match-not-found" });
      return;
    }

    response.json({ match });
  });

  router.post("/:id/moves", async (request, response) => {
    const body = request.body as MoveBody;

    if (!isBoardId(body.boardId) || !isSeatId(body.seat) || !isRecord(body.move)) {
      response.status(400).json({ error: "invalid-command" });
      return;
    }

    const result = await matchService.applyMove({
      id: request.params["id"] ?? "",
      boardId: body.boardId,
      seat: body.seat,
      move: body.move
    });

    if (!result.ok) {
      response.status(result.status).json({
        error: result.reason,
        match: result.match
      });
      return;
    }

    response.json({ match: result.match });
  });

  return router;
}

function isBoardId(value: unknown): value is BoardId {
  return value === "A" || value === "B";
}

function isSeatId(value: unknown): value is SeatId {
  return value === "seat1" || value === "seat2";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getSeatCookieName(matchId: string) {
  return `fg_seat_${matchId}`;
}

function setSeatClaimCookie(response: Response, claim: SeatClaim) {
  response.cookie(getSeatCookieName(claim.matchId), `${claim.seat}.${claim.secret}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/"
  });
}

function getSeatClaimCookie(cookieHeader: string | undefined, matchId: string): string | null {
  if (!cookieHeader) return null;
  const cookieName = `${getSeatCookieName(matchId)}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName));

  return cookie ? decodeURIComponent(cookie.slice(cookieName.length)) : null;
}
