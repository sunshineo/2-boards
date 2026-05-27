import { Router } from "express";
import type { Response } from "express";
import type { BoardId, SeatId } from "@fairgame/shared";

import type { MatchService, SeatClaim } from "./matchService";

type MoveBody = {
  readonly boardId?: BoardId;
  readonly seat?: SeatId;
  readonly move?: {
    readonly cell?: number;
  };
};

export function createMatchRouter(matchService: MatchService) {
  const router = Router();

  router.post("/", (_request, response) => {
    const result = matchService.createMatch();
    setSeatClaimCookie(response, result.claim);
    response.status(201).json({ seat: result.seat, match: result.match });
  });

  router.post("/:id/join", (request, response) => {
    const result = matchService.joinMatch(request.params["id"] ?? "");

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

  router.get("/:id/session", (request, response) => {
    const id = request.params["id"] ?? "";
    const result = matchService.restoreSession(id, getSeatClaimCookie(request.headers.cookie, id));

    if (!result) {
      response.status(404).json({ error: "match-not-found" });
      return;
    }

    response.json(result);
  });

  router.get("/:id", (request, response) => {
    const match = matchService.getMatch(request.params["id"] ?? "");

    if (!match) {
      response.status(404).json({ error: "match-not-found" });
      return;
    }

    response.json({ match });
  });

  router.post("/:id/moves", (request, response) => {
    const body = request.body as MoveBody;

    if (!body.boardId || !body.seat || typeof body.move?.cell !== "number") {
      response.status(400).json({ error: "invalid-command" });
      return;
    }

    const result = matchService.applyMove({
      id: request.params["id"] ?? "",
      boardId: body.boardId,
      seat: body.seat,
      move: { cell: body.move.cell }
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
