import type { SeatId } from "@fairgame/shared";

export type SeatAgentDifficulty = "easy" | "normal" | "hard";
export type SeatAgentKind = "browser-stockfish" | "random-legal";

export type AutomatedSeat<TGameType extends string = string> = {
  readonly seat: SeatId;
  readonly kind: SeatAgentKind;
  readonly gameType: TGameType;
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
};

export function parseSeatAgentDifficulty(value: unknown): SeatAgentDifficulty | null {
  return value === "easy" || value === "normal" || value === "hard" ? value : null;
}

export function parseBrowserChessBotDifficulty(value: unknown): SeatAgentDifficulty | null {
  return parseSeatAgentDifficulty(value);
}

export function createAutomatedSeat<TGameType extends string>(options: {
  readonly gameType: TGameType;
  readonly kind: SeatAgentKind;
  readonly difficulty: SeatAgentDifficulty;
  readonly displayName: string;
}): AutomatedSeat<TGameType> {
  return {
    seat: "seat2",
    gameType: options.gameType,
    kind: options.kind,
    difficulty: options.difficulty,
    displayName: options.displayName
  };
}

export function createBrowserStockfishSeatAgent(difficulty: SeatAgentDifficulty): AutomatedSeat<"chess"> {
  return createAutomatedSeat({
    gameType: "chess",
    kind: "browser-stockfish",
    difficulty,
    displayName: getBrowserChessBotDisplayName(difficulty)
  });
}

export function getBrowserChessBotDisplayName(difficulty: SeatAgentDifficulty): string {
  if (difficulty === "easy") return "Stockfish Easy";
  if (difficulty === "hard") return "Stockfish Hard";
  return "Stockfish Normal";
}
