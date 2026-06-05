import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(scriptDir, "..");
const stockfishRoot = join(webRoot, "..", "..", "node_modules", "stockfish", "bin");
const outputRoot = join(webRoot, "public", "vendor", "stockfish");
const files = ["stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];

await mkdir(outputRoot, { recursive: true });
await Promise.all(files.map((file) => copyFile(join(stockfishRoot, file), join(outputRoot, file))));
console.log(`Copied ${files.length} Stockfish assets to ${outputRoot}`);
