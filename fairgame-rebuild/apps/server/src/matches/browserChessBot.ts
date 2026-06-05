export type BrowserChessBotDifficulty = "easy" | "normal" | "hard";

export type BrowserChessBot = {
  readonly seat: "seat2";
  readonly kind: "browser-stockfish";
  readonly difficulty: BrowserChessBotDifficulty;
  readonly displayName: string;
};

export type BotControlClaim = {
  readonly matchId: string;
  readonly secret: string;
};

export function parseBrowserChessBotDifficulty(value: unknown): BrowserChessBotDifficulty | null {
  return value === "easy" || value === "normal" || value === "hard" ? value : null;
}

export function createBrowserChessBot(difficulty: BrowserChessBotDifficulty): BrowserChessBot {
  return {
    seat: "seat2",
    kind: "browser-stockfish",
    difficulty,
    displayName: getBrowserChessBotDisplayName(difficulty)
  };
}

export function getBrowserChessBotDisplayName(difficulty: BrowserChessBotDifficulty): string {
  if (difficulty === "easy") return "Stockfish Easy";
  if (difficulty === "hard") return "Stockfish Hard";
  return "Stockfish Normal";
}

export function getBotControlCookieName(matchId: string): string {
  return `fg_bot_${matchId}`;
}

export function parseBotControlCookie(cookieHeader: string | undefined, matchId: string): BotControlClaim | null {
  if (!cookieHeader) return null;
  const cookieName = `${getBotControlCookieName(matchId)}=`;
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName));

  if (!cookie) return null;
  const secret = decodeURIComponent(cookie.slice(cookieName.length));
  return secret ? { matchId, secret } : null;
}
