import { describe, expect, it } from "vitest";

import { getApiBaseUrl } from "./api";

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
});
