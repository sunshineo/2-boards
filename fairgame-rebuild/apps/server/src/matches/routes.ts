import { Router } from "express";
import type { Response } from "express";
import type { BoardId, SeatId } from "@fairgame/shared";
import type { ClockConfig } from "@fairgame/domain";

import { parseSupportedGameType, type SupportedGameType } from "./gameRegistry.js";
import type { MatchService, SeatClaim } from "./matchService.js";

type CreateBody = {
  readonly gameType?: unknown;
  readonly clockInitialMs?: unknown;
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

export function createMatchRouter(
  matchService: MatchService,
  options: { readonly secureCookies?: boolean } = {}
) {
  const router = Router();

  router.get("/", (_request, response) => {
    response.json({ matches: matchService.listOpenMatches() });
  });

  router.post("/", async (request, response) => {
    const body = request.body as CreateBody;
    const gameType = parseSupportedGameType(body.gameType);
    if (!gameType) {
      response.status(400).json({ error: "unsupported-game" });
      return;
    }

    const clockConfig = parseClockConfig(gameType, body.clockInitialMs);
    if (clockConfig === "invalid") {
      response.status(400).json({ error: "invalid-clock" });
      return;
    }

    const result = await matchService.createMatch(
      gameType,
      typeof body.playerName === "string" ? body.playerName : undefined,
      clockConfig
    );
    setSeatClaimCookie(response, result.claim, options);
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

    setSeatClaimCookie(response, result.claim, options);
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

function parseClockConfig(
  gameType: SupportedGameType,
  clockInitialMs: unknown
): ClockConfig | undefined | "invalid" {
  if (clockInitialMs === undefined) return undefined;
  if (typeof clockInitialMs !== "number" || !Number.isInteger(clockInitialMs)) return "invalid";
  const range = getClockMinuteRange(gameType);
  if (clockInitialMs < range.min * 60_000 || clockInitialMs > range.max * 60_000) return "invalid";
  return { initialMs: clockInitialMs, incrementMs: 0 };
}

function getClockMinuteRange(gameType: SupportedGameType) {
  if (gameType === "tictactoe") return { min: 1, max: 10 };
  if (gameType === "connect4" || gameType === "reversi" || gameType === "mancala") return { min: 2, max: 20 };
  if (gameType === "chess") return { min: 3, max: 60 };
  return { min: 3, max: 30 };
}

export function getSeatCookieName(matchId: string) {
  return `fg_seat_${matchId}`;
}

function setSeatClaimCookie(
  response: Response,
  claim: SeatClaim,
  options: { readonly secureCookies?: boolean } = {}
) {
  response.cookie(getSeatCookieName(claim.matchId), `${claim.seat}.${claim.secret}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: options.secureCookies ?? false,
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
