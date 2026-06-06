import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const stylesPath = join(dirname(fileURLToPath(import.meta.url)), "styles.css");

describe("styles.css", () => {
  it("slowly pulses the active Chess turn status with green emphasis", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain("animation: chess-turn-status-pulse 2.8s ease-in-out infinite;");
    expect(styles).toContain("@keyframes chess-turn-status-pulse");
    expect(styles).toContain("background-color: #bce88a;");
    expect(styles).toContain("background-color: #ffffff;");
    expect(styles).not.toContain("box-shadow: 0 0 0 4px rgb(106 161 39 / 24%)");
  });
});
