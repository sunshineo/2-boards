import { describe, expect, it } from "vitest";

import { projectName, type BoardOutcome } from "./index";

describe("shared package", () => {
  it("exports the project name", () => {
    expect(projectName).toBe("FairGame");
  });

  it("supports generic board outcomes", () => {
    const outcome: BoardOutcome = {
      status: "win",
      winner: "seat1",
      loser: "seat2",
      reason: "bootstrap-test"
    };

    expect(outcome.status).toBe("win");
  });
});
