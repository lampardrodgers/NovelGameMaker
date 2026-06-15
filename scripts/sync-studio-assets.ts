import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { sampleNovelText } from "@novel-game-maker/vn-core";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { createPlaceholderSvg } from "@novel-game-maker/vn-exporter";

const rootDir = resolve(import.meta.dirname, "..");
const project = createProjectFromNovel({
  title: "实验室里的蓝光",
  novelText: sampleNovelText
});

for (const asset of project.assets.items) {
  if (!asset.src.startsWith("assets/") || !asset.src.endsWith(".svg")) {
    continue;
  }

  const outPath = resolve(rootDir, "apps/studio/public", asset.src);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, createPlaceholderSvg(asset, project), "utf-8");
}

console.log("Synced Studio scene assets to apps/studio/public/assets");
