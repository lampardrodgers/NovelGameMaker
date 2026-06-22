import { resolve } from "node:path";
import { loadSampleProject, readSampleSlug, syncProjectToPublic } from "./sample-utils.js";

const rootDir = resolve(import.meta.dirname, "..");
const sample = await loadSampleProject(rootDir, readSampleSlug());
const studioPublicDir = resolve(rootDir, "apps/studio/public");

await syncProjectToPublic(sample, studioPublicDir, { writeProjectJson: false });

console.log(`Synced Studio assets for sample "${sample.slug}" to apps/studio/public/assets`);
