import { describe, expect, it } from "vitest";

import { getWebGamePlugin, webGamePlugins } from "./registry";

describe("web game plugin registry", () => {
  it("exposes metadata and board rendering hooks for every game", () => {
    expect(webGamePlugins).toHaveLength(10);
    expect(getWebGamePlugin("chess")).toMatchObject({
      gameType: "chess",
      label: "Chess",
      timeRange: { min: 3, max: 60 },
      imageSrc: "/game-thumbnails/chess.png"
    });
    expect(getWebGamePlugin("chess")?.renderBoard).toEqual(expect.any(Function));
    expect(getWebGamePlugin("tictactoe")?.timeRange).toEqual({ min: 1, max: 10 });
  });

  it("exposes ordered bot capabilities for every game", () => {
    expect(
      webGamePlugins.map((plugin) => ({
        gameType: plugin.gameType,
        kind: plugin.bot?.kind
      }))
    ).toEqual([
      { gameType: "chess", kind: "browser-stockfish" },
      { gameType: "tictactoe", kind: "random-legal" },
      { gameType: "connect4", kind: "random-legal" },
      { gameType: "gomoku", kind: "random-legal" },
      { gameType: "hex", kind: "random-legal" },
      { gameType: "reversi", kind: "random-legal" },
      { gameType: "breakthrough", kind: "random-legal" },
      { gameType: "mancala", kind: "random-legal" },
      { gameType: "dots-boxes", kind: "random-legal" },
      { gameType: "order-chaos", kind: "random-legal" }
    ]);

    expect(getWebGamePlugin("connect4")?.bot).toMatchObject({
      displayName: "Connect Four Bot",
      difficulties: ["normal"]
    });
    expect(getWebGamePlugin("chess")?.bot).toMatchObject({
      displayName: "Stockfish",
      difficulties: ["easy", "normal", "hard"]
    });
  });
});
