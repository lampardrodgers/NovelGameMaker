import type { VNAsset, VNProject, VNAssetType } from "@novel-game-maker/vn-core";

export interface CodexImage2AssetPrompt {
  assetId: string;
  assetType: VNAssetType;
  title: string;
  prompt: string;
  outputPath: string;
  replaceProjectSrc: string;
}

export interface CodexImage2Manifest {
  provider: "codex-image2";
  generatedAt: string;
  notes: string[];
  assets: CodexImage2AssetPrompt[];
}

export interface CodexImage2ManifestOptions {
  assetDir?: string;
  stylePrompt?: string;
  extension?: "png" | "webp";
}

export function createCodexImage2Manifest(
  project: VNProject,
  options: CodexImage2ManifestOptions = {}
): CodexImage2Manifest {
  const assetDir = trimTrailingSlash(options.assetDir ?? "assets/generated");
  const extension = options.extension ?? "png";
  const stylePrompt =
    options.stylePrompt ??
    "traditional Japanese visual novel / galgame art, clean readable composition, no UI text, production game asset";

  return {
    provider: "codex-image2",
    generatedAt: new Date().toISOString(),
    notes: [
      "Use Codex image generation / image2 with each prompt.",
      "Save each generated file to outputPath.",
      "Then call applyGeneratedAssetManifest or update project asset src to replaceProjectSrc."
    ],
    assets: project.assets.items
      .filter(isImageAsset)
      .map((asset) => createAssetPrompt(project, asset, assetDir, extension, stylePrompt))
  };
}

export function applyGeneratedAssetManifest(
  project: VNProject,
  manifest: CodexImage2Manifest
): VNProject {
  const replacements = new Map(
    manifest.assets.map((asset) => [asset.assetId, asset.replaceProjectSrc])
  );

  return {
    ...project,
    assets: {
      items: project.assets.items.map((asset) => {
        const src = replacements.get(asset.id);
        return src
          ? {
              ...asset,
              src,
              placeholder: false
            }
          : asset;
      })
    },
    updatedAt: new Date().toISOString()
  };
}

function createAssetPrompt(
  project: VNProject,
  asset: VNAsset,
  assetDir: string,
  extension: "png" | "webp",
  stylePrompt: string
): CodexImage2AssetPrompt {
  const outputPath = `${assetDir}/${asset.id}.${extension}`;
  return {
    assetId: asset.id,
    assetType: asset.type,
    title: asset.name,
    prompt: buildPrompt(project, asset, stylePrompt),
    outputPath,
    replaceProjectSrc: outputPath
  };
}

function buildPrompt(project: VNProject, asset: VNAsset, stylePrompt: string): string {
  if (asset.type === "characterSprite") {
    const character = project.characters.find((item) => item.id === asset.characterId);
    return [
      stylePrompt,
      "transparent background character sprite, half-body portrait, front-facing game sprite",
      `character name: ${character?.name ?? asset.name}`,
      `asset title: ${asset.name}`
    ].join(". ");
  }

  if (asset.type === "cg") {
    return [
      stylePrompt,
      "16:9 cinematic CG illustration, full-frame key visual, no textbox, no subtitles",
      `scene title: ${asset.name}`,
      `project title: ${project.title}`
    ].join(". ");
  }

  return [
    stylePrompt,
    "16:9 visual novel background, no characters, no textbox, no subtitles",
    `location title: ${asset.name}`,
    `project title: ${project.title}`
  ].join(". ");
}

function isImageAsset(asset: VNAsset): boolean {
  return asset.type === "background" || asset.type === "characterSprite" || asset.type === "cg";
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}
