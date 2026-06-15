import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { sampleNovelText } from "@novel-game-maker/vn-core";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { exportStaticBundle } from "@novel-game-maker/vn-exporter";

const rootDir = resolve(import.meta.dirname, "..");
const sampleProject = createProjectFromNovel({
  title: "实验室里的蓝光",
  novelText: sampleNovelText
});
const sampleDir = resolve(rootDir, "samples/steins-like-lab");
const outDir = resolve(rootDir, "dist/playable-sample");

await mkdir(sampleDir, { recursive: true });
await writeFile(
  resolve(sampleDir, "project.vn.json"),
  JSON.stringify(sampleProject, null, 2),
  "utf-8"
);
await exportStaticBundle({
  project: sampleProject,
  outDir
});

console.log(`Exported playable sample to ${outDir}`);
