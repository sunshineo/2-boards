import type { SeatId } from "@fairgame/shared";

export type SeatAgentDifficulty = "easy" | "normal" | "hard";

export type AutomatedSeat = {
  readonly seat: SeatId;
  readonly kind: "browser-stockfish";
  readonly gameType: "chess";
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
};

export type SeatAgentControlClaim = {
  readonly matchId: string;
  readonly secret: string;
};

export function parseBrowserChessBotDifficulty(value: unknown): SeatAgentDifficulty | null {
  return value === "easy" || value === "normal" || value === "hard" ? value : null;
}

export function createBrowserStockfishSeatAgent(difficulty: SeatAgentDifficulty): AutomatedSeat {
  return {
    seat: "seat2",
    kind: "browser-stockfish",
    gameType: "chess",
    difficulty,
    displayName: getBrowserChessBotDisplayName(difficulty)
  };
}

export function getBrowserChessBotDisplayName(difficulty: SeatAgentDifficulty): string {
  if (difficulty === "easy") return "Stockfish Easy";
  if (difficulty === "hard") return "Stockfish Hard";
  return "Stockfish Normal";
}

export function getSeatAgentControlCookieName(matchId: string): string {
  return `fg_agent_${matchId}`;
}

export function getLegacyBotControlCookieName(matchId: string): string {
  return `fg_bot_${matchId}`;
}

export function parseSeatAgentControlCookie(cookieHeader: string | undefined, matchId: string): SeatAgentControlClaim | null {
  return parseNamedControlCookie(cookieHeader, getSeatAgentControlCookieName(matchId), matchId)
    ?? parseNamedControlCookie(cookieHeader, getLegacyBotControlCookieName(matchId), matchId);
}

function parseNamedControlCookie(
  cookieHeader: string | undefined,
  cookieName: string,
  matchId: string
): SeatAgentControlClaim | null {
  if (!cookieHeader) return null;
  const cookiePrefix = `${cookieName}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookiePrefix));

  if (!cookie) return null;
  const secret = decodeURIComponent(cookie.slice(cookiePrefix.length));
  return secret ? { matchId, secret } : null;
}
