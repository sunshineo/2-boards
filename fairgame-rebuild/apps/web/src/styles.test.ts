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

  it("keeps floating alerts fixed above the board layout", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".floating-alerts {");
    expect(styles).toContain("position: fixed;");
    expect(styles).toContain("top: max(14px, env(safe-area-inset-top));");
    expect(styles).toContain("pointer-events: none;");
    expect(styles).toContain(".floating-alerts .secondary-button {");
    expect(styles).toContain("pointer-events: auto;");
  });

  it("keeps selected lobby controls unchanged on hover", () => {
    const styles = readFileSync(stylesPath, "utf8");

    expect(styles).toContain(".mode-toggle button.selected:not(:disabled):hover");
    expect(styles).toContain(".difficulty-grid button.selected:not(:disabled):hover");
    expect(styles).toContain(".time-preset-button.selected:not(:disabled):hover");
    expect(styles).toContain("background: #245d63;");
    expect(styles).toContain("color: #ffffff;");
  });
});
