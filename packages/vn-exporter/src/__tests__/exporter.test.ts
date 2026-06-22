import { mkdir, mkdtemp, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { sampleNovelText, validateProject } from "@novel-game-maker/vn-core";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { exportStaticBundle } from "../exportStaticBundle";

describe("exportStaticBundle", () => {
  it("exports a playable sample folder with project JSON, HTML, and SVG assets", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "vn-export-"));
    const project = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });

    await exportStaticBundle({ project, outDir });

    const html = await readFile(join(outDir, "index.html"), "utf-8");
    const json = await readFile(join(outDir, "project.vn.json"), "utf-8");
    const exportedProject = JSON.parse(json);

    expect(html).toContain("project.vn.json");
    expect(html).toContain("resolveBeats");
    expect(html).toContain("if (shot.initialStage)");
    expect(html).toContain(".stage{position:relative;width:min(100vw,calc(100vh * 16 / 9))");
    expect(html).toContain('<button id="save">存档</button>');
    expect(html).toContain('<button id="load">读档</button>');
    expect(html).toContain('<button id="fullscreen">全屏</button>');
    expect(validateProject(exportedProject).valid).toBe(true);
    expect(exportedProject.assets.items.some((asset: { id: string }) => asset.id === "bg_lab_night")).toBe(true);
    expect(exportedProject.assets.items.some((asset: { id: string }) => asset.id === "sprite_lin_xue")).toBe(true);
    expect(exportedProject.assets.items.some((asset: { id: string }) => asset.id === "sprite_unknown")).toBe(true);
    expect(exportedProject.assets.items.some((asset: { id: string }) => asset.id === "cg_phone_screen")).toBe(true);
    await expect(stat(join(outDir, "assets/bg_lab_night.svg"))).resolves.toBeTruthy();
    await expect(stat(join(outDir, "assets/sprite_lin_xue.svg"))).resolves.toBeTruthy();
    await expect(stat(join(outDir, "assets/sprite_unknown.svg"))).resolves.toBeTruthy();
    await expect(stat(join(outDir, "assets/cg_phone_screen.svg"))).resolves.toBeTruthy();
  });

  it("copies existing local assets before falling back to placeholders", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "vn-export-"));
    const assetSourceDir = await mkdtemp(join(tmpdir(), "vn-assets-"));
    const imagePath = join(assetSourceDir, "assets/backgrounds/bg_lab_night.jpg");
    const project = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    const projectWithLocalAsset = {
      ...project,
      assets: {
        items: project.assets.items.map((asset) =>
          asset.id === "bg_lab_night"
            ? { ...asset, src: "assets/backgrounds/bg_lab_night.jpg", placeholder: true }
            : asset
        )
      }
    };

    await mkdir(join(assetSourceDir, "assets/backgrounds"), { recursive: true });
    await writeFile(imagePath, "local image bytes", "utf-8");

    await exportStaticBundle({
      project: projectWithLocalAsset,
      outDir,
      assetSourceDir
    });

    await expect(readFile(join(outDir, "assets/backgrounds/bg_lab_night.jpg"), "utf-8"))
      .resolves
      .toBe("local image bytes");
  });
});
