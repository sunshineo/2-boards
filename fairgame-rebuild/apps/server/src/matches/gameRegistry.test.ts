import { describe, expect, it } from "vitest";

import { getGameDefinition } from "./gameRegistry.js";

describe("game registry", () => {
  it("exposes per-game clock range metadata from game plugins", () => {
    expect(getGameDefinition("tictactoe")).toMatchObject({ clockRange: { min: 1, max: 10 } });
    expect(getGameDefinition("connect4")).toMatchObject({ clockRange: { min: 2, max: 20 } });
    expect(getGameDefinition("chess")).toMatchObject({ clockRange: { min: 3, max: 60 } });
  });
});
