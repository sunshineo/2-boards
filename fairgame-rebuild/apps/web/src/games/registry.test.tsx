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
});
