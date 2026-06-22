import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const targets = process.argv.slice(2);

if (targets.length === 0) {
  console.error("Usage: node scripts/clean-path.mjs <path> [path...]");
  process.exitCode = 1;
}

for (const target of targets) {
  const resolved = resolve(process.cwd(), target);
  await rm(resolved, { recursive: true, force: true });
}
