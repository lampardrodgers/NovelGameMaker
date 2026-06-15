import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createCodexImage2Manifest } from "@agentic-galgame/vn-agent";

const rootDir = resolve(import.meta.dirname, "..");
const projectPath = resolve(rootDir, process.argv[2] ?? "samples/steins-like-lab/project.vn.json");
const outPath = resolve(rootDir, process.argv[3] ?? "dist/image2-assets-manifest.json");
const project = JSON.parse(await readFile(projectPath, "utf-8")) as Parameters<typeof createCodexImage2Manifest>[0];
const manifest = createCodexImage2Manifest(project, {
  assetDir: "assets/generated",
  extension: "png"
});

await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`Wrote Codex image2 manifest to ${outPath}`);
