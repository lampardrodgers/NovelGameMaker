import { resolve } from "node:path";
import { exportStaticBundle } from "@novel-game-maker/vn-exporter";
import { loadSampleProject, readSampleSlug } from "./sample-utils.js";

const rootDir = resolve(import.meta.dirname, "..");
const sample = await loadSampleProject(rootDir, readSampleSlug());
const outDir = resolve(rootDir, "dist/playable-sample");

await exportStaticBundle({
  project: sample.project,
  outDir,
  assetSourceDir: sample.sampleDir
});

console.log(`Exported playable sample "${sample.slug}" to ${outDir}`);
