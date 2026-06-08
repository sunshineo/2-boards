import { afterEach, describe, expect, it, vi } from "vitest";

import { createMatch, getApiBaseUrl, makeAgentMove, makeBotMove } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getApiBaseUrl", () => {
  it("uses same-origin API URLs in production builds", () => {
    const env = { DEV: false, VITE_API_URL: undefined } as unknown as ImportMetaEnv;
    const location = new URL("https://play.example.com/matches/match-1") as unknown as Location;

    expect(getApiBaseUrl(env, location)).toBe("https://play.example.com");
  });

  it("uses the local API port during Vite development", () => {
    const env = { DEV: true, VITE_API_URL: undefined } as unknown as ImportMetaEnv;
    const location = new URL("http://localhost:5173/") as unknown as Location;

    expect(getApiBaseUrl(env, location)).toBe("http://localhost:4000");
  });

  it("prefers an explicit API URL", () => {
    const env = { DEV: false, VITE_API_URL: "https://api.example.com" } as unknown as ImportMetaEnv;
    const location = new URL("https://play.example.com/") as unknown as Location;

    expect(getApiBaseUrl(env, location)).toBe("https://api.example.com");
  });

  it("sends bot difficulty when creating a bot match", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ seat: "seat1", match: { id: "match-bot" } }), {
        status: 201,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await createMatch("chess", { clockInitialMs: 300_000, bot: { difficulty: "hard" } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({ gameType: "chess", clockInitialMs: 300_000, bot: { difficulty: "hard" } })
      })
    );
  });

  it("submits bot moves without a user-supplied seat", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ match: { id: "match-bot" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await makeAgentMove({ matchId: "match-bot", boardId: "B", move: { from: "e7", to: "e5" } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-bot/agent-moves"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ boardId: "B", move: { from: "e7", to: "e5" } })
      })
    );
  });

  it("keeps makeBotMove as a compatibility wrapper over agent moves", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ match: { id: "match-bot" } }), {
        status: 200,
        headers: { "content-type": "application/json" }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await makeBotMove({ matchId: "match-bot", boardId: "B", move: { from: "e7", to: "e5" } });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/matches/match-bot/agent-moves"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
