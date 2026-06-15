import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { sampleNovelText } from "@novel-game-maker/vn-core";
import { createPlaceholderSvg } from "@novel-game-maker/vn-exporter";

const rootDir = resolve(import.meta.dirname, "..");
const project = createProjectFromNovel({
  title: "实验室里的蓝光",
  novelText: sampleNovelText
});
const playerPublicDir = resolve(rootDir, "apps/player/public");

await mkdir(playerPublicDir, { recursive: true });
await writeFile(
  resolve(playerPublicDir, "project.vn.json"),
  JSON.stringify(project, null, 2),
  "utf-8"
);

for (const asset of project.assets.items) {
  if (!asset.src.startsWith("assets/") || !asset.src.endsWith(".svg")) {
    continue;
  }

  const outPath = resolve(playerPublicDir, asset.src);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, createPlaceholderSvg(asset, project), "utf-8");
}

console.log("Synced Player sample project and scene assets to apps/player/public");
