import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("health endpoint", () => {
  it("returns project and bootstrap board assignment data", async () => {
    const response = await request(createApp()).get("/health").expect(200);

    expect(response.body).toEqual({
      ok: true,
      project: "FairGame",
      boardAssignments: [
        { boardId: "A", firstSeat: "seat1" },
        { boardId: "B", firstSeat: "seat2" }
      ]
    });
  });
});
