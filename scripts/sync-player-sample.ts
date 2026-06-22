import { resolve } from "node:path";
import { loadSampleProject, readSampleSlug, syncProjectToPublic } from "./sample-utils.js";

const rootDir = resolve(import.meta.dirname, "..");
const sample = await loadSampleProject(rootDir, readSampleSlug());
const playerPublicDir = resolve(rootDir, "apps/player/public");

await syncProjectToPublic(sample, playerPublicDir, { writeProjectJson: true });

console.log(`Synced Player sample "${sample.slug}" to apps/player/public`);
