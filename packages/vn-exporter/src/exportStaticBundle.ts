import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { VNProject } from "@novel-game-maker/vn-core";
import { createPlayableHtml } from "./createPlayableHtml.js";
import { createPlaceholderSvg } from "./placeholderSvg.js";

export async function exportStaticBundle(input: {
  project: VNProject;
  outDir: string;
  runtimeBundle?: string;
}): Promise<void> {
  await rm(input.outDir, { recursive: true, force: true });
  await mkdir(join(input.outDir, "assets"), { recursive: true });

  const projectForExport: VNProject = {
    ...input.project,
    assets: {
      items: input.project.assets.items.map((asset) => ({
        ...asset,
        src: asset.src.startsWith("assets/") ? asset.src : `assets/${asset.id}.svg`
      }))
    }
  };

  await writeFile(
    join(input.outDir, "project.vn.json"),
    JSON.stringify(projectForExport, null, 2),
    "utf-8"
  );
  await writeFile(
    join(input.outDir, "index.html"),
    createPlayableHtml(projectForExport, input.runtimeBundle),
    "utf-8"
  );

  for (const asset of projectForExport.assets.items) {
    if (asset.placeholder || asset.src.endsWith(".svg")) {
      await writeFile(
        join(input.outDir, asset.src),
        createPlaceholderSvg(asset, projectForExport),
        "utf-8"
      );
    }
  }
}
