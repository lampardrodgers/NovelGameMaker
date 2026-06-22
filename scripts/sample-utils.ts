import { constants } from "node:fs";
import { access, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createSampleProject, type VNProject } from "@novel-game-maker/vn-core";
import { createPlaceholderSvg } from "@novel-game-maker/vn-exporter";

export const DEFAULT_SAMPLE_SLUG = "steins-like-lab";

export interface LoadedSampleProject {
  slug: string;
  sampleDir: string;
  project: VNProject;
  assetSourceDir?: string;
}

export function readSampleSlug(args = process.argv.slice(2)): string {
  return args.find((arg) => arg && !arg.startsWith("-")) ?? DEFAULT_SAMPLE_SLUG;
}

export async function loadSampleProject(rootDir: string, slug = DEFAULT_SAMPLE_SLUG): Promise<LoadedSampleProject> {
  const sampleDir = resolve(rootDir, "samples", slug);
  const projectPath = resolve(sampleDir, "project.vn.json");
  const project = await pathExists(projectPath)
    ? JSON.parse(await readFile(projectPath, "utf-8")) as VNProject
    : await createDefaultSampleProject(sampleDir, slug);
  const assetsDir = resolve(sampleDir, "assets");

  return {
    slug,
    sampleDir,
    project,
    assetSourceDir: await pathExists(assetsDir) ? sampleDir : undefined
  };
}

export async function syncProjectToPublic(
  sample: LoadedSampleProject,
  publicDir: string,
  options: { writeProjectJson: boolean }
): Promise<void> {
  await mkdir(publicDir, { recursive: true });

  if (options.writeProjectJson) {
    await writeTextFileIfChanged(
      resolve(publicDir, "project.vn.json"),
      JSON.stringify(sample.project, null, 2),
      "utf-8"
    );
  }

  await syncProjectAssets(sample.project, publicDir, sample.assetSourceDir);
}

async function syncProjectAssets(project: VNProject, publicDir: string, assetSourceDir?: string): Promise<void> {
  for (const asset of project.assets.items) {
    if (!asset.src.startsWith("assets/")) {
      continue;
    }

    const outPath = resolve(publicDir, asset.src);
    const sourcePath = assetSourceDir ? resolve(assetSourceDir, asset.src) : undefined;
    await mkdir(dirname(outPath), { recursive: true });

    if (sourcePath && await pathExists(sourcePath)) {
      await cp(sourcePath, outPath, { force: true });
      continue;
    }

    if (asset.placeholder || asset.src.endsWith(".svg")) {
      await writeTextFileIfChanged(outPath, createPlaceholderSvg(asset, project), "utf-8");
    }
  }
}

async function createDefaultSampleProject(sampleDir: string, slug: string): Promise<VNProject> {
  if (slug !== DEFAULT_SAMPLE_SLUG) {
    throw new Error(`Unknown sample "${slug}". Expected samples/${slug}/project.vn.json to exist.`);
  }

  const project = createSampleProject();
  await mkdir(sampleDir, { recursive: true });
  await writeTextFileIfChanged(resolve(sampleDir, "project.vn.json"), JSON.stringify(project, null, 2), "utf-8");
  return project;
}

async function writeTextFileIfChanged(path: string, data: string, encoding: BufferEncoding): Promise<void> {
  try {
    const current = await readFile(path, encoding);
    if (current === data || normalizeNewlines(current) === normalizeNewlines(data)) {
      return;
    }
  } catch {
    // Missing files are created below.
  }
  await writeFile(path, data, encoding);
}

function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}
