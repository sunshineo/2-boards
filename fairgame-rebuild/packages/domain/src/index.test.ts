import { describe, expect, it } from "vitest";

import { createBootstrapBoardAssignments } from "./index";

describe("domain bootstrap", () => {
  it("keeps the core two-board starter invariant visible", () => {
    expect(createBootstrapBoardAssignments()).toEqual([
      { boardId: "A", firstSeat: "seat1" },
      { boardId: "B", firstSeat: "seat2" }
    ]);
  });
});
