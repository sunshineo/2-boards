import { describe, expect, it } from "vitest";

import { getGameDefinition, supportedGameDefinitions } from "./gameRegistry.js";

describe("game registry", () => {
  it("exposes per-game clock range metadata from game plugins", () => {
    expect(getGameDefinition("tictactoe")).toMatchObject({ clockRange: { min: 1, max: 10 } });
    expect(getGameDefinition("connect4")).toMatchObject({ clockRange: { min: 2, max: 20 } });
    expect(getGameDefinition("chess")).toMatchObject({ clockRange: { min: 3, max: 60 } });
  });

  it("exposes bot capability kinds for each current game", () => {
    expect(supportedGameDefinitions.map((game) => [game.gameType, game.bot?.kind])).toEqual([
      ["tictactoe", "random-legal"],
      ["connect4", "random-legal"],
      ["chess", "browser-stockfish"],
      ["gomoku", "random-legal"],
      ["hex", "random-legal"],
      ["reversi", "random-legal"],
      ["breakthrough", "random-legal"],
      ["mancala", "random-legal"],
      ["dots-boxes", "random-legal"],
      ["order-chaos", "random-legal"]
    ]);
  });

  it("creates game-specific automated seat metadata from bot capabilities", () => {
    expect(getGameDefinition("connect4")?.bot?.createAutomatedSeat("normal")).toEqual({
      seat: "seat2",
      gameType: "connect4",
      kind: "random-legal",
      difficulty: "normal",
      displayName: "Connect Four Bot"
    });
    expect(getGameDefinition("chess")?.bot?.createAutomatedSeat("hard")).toEqual({
      seat: "seat2",
      gameType: "chess",
      kind: "browser-stockfish",
      difficulty: "hard",
      displayName: "Stockfish Hard"
    });
  });
});
