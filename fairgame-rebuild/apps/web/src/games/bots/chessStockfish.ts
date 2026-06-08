import type { BrowserStockfishWebGameBotCapability } from "./types";

export const chessStockfishBotCapability: BrowserStockfishWebGameBotCapability = {
  kind: "browser-stockfish",
  displayName: "Stockfish",
  difficulties: ["easy", "normal", "hard"]
};
