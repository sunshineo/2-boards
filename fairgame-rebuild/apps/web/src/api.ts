import type { BoardId, MatchView, SeatId, SeatSession } from "./types";

export function getApiBaseUrl() {
  if (import.meta.env["VITE_API_URL"]) return import.meta.env["VITE_API_URL"];
  return `${window.location.protocol}//${window.location.hostname}:4000`;
}

export class ApiError extends Error {
  readonly match: MatchView | undefined;

  constructor(message: string, match?: MatchView) {
    super(message);
    this.name = "ApiError";
    this.match = match;
  }
}

export async function createMatch(): Promise<SeatSession> {
  return request<SeatSession>("/api/matches", {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function joinMatch(matchId: string): Promise<SeatSession> {
  return request<SeatSession>(`/api/matches/${encodeURIComponent(matchId)}/join`, {
    method: "POST",
    body: JSON.stringify({})
  });
}

export async function getMatch(matchId: string): Promise<MatchView> {
  const response = await request<{ match: MatchView }>(`/api/matches/${encodeURIComponent(matchId)}`);
  return response.match;
}

export async function restoreSession(matchId: string): Promise<SeatSession> {
  return request<SeatSession>(`/api/matches/${encodeURIComponent(matchId)}/session`);
}

export async function makeMove(input: {
  matchId: string;
  boardId: BoardId;
  seat: SeatId;
  cell: number;
}): Promise<MatchView> {
  const response = await request<{ match: MatchView }>(
    `/api/matches/${encodeURIComponent(input.matchId)}/moves`,
    {
      method: "POST",
      body: JSON.stringify({
        boardId: input.boardId,
        seat: input.seat,
        move: { cell: input.cell }
      })
    }
  );

  return response.match;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...init.headers
    }
  });
  const body = (await response.json()) as T & { error?: string; match?: MatchView };

  if (!response.ok) {
    throw new ApiError(body.error ?? "request-failed", body.match);
  }

  return body;
}
