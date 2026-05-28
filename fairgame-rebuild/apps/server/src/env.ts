import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config as loadDotenvFile } from "dotenv";

export function loadLocalEnv(cwd = process.cwd()) {
  for (const path of [resolve(cwd, ".env"), resolve(cwd, "../../.env")]) {
    if (existsSync(path)) {
      loadDotenvFile({ path });
    }
  }
}
