export {
  createAutomatedSeat,
  createBrowserStockfishSeatAgent,
  getBrowserChessBotDisplayName,
  parseBrowserChessBotDifficulty,
  parseSeatAgentDifficulty
} from "../seatAgents/types.js";
export type {
  AutomatedSeat,
  SeatAgentDifficulty,
  SeatAgentKind
} from "../seatAgents/types.js";

export type SeatAgentControlClaim = {
  readonly matchId: string;
  readonly secret: string;
};

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
