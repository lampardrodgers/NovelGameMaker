import type { StagePatch, ValidationResult, VNAssetType, VNProject } from "../schema/types.js";

const KNOWN_ASSET_TYPES = new Set<VNAssetType>([
  "background",
  "characterSprite",
  "cg",
  "effect",
  "ui",
  "bgm",
  "sfx",
  "voice"
]);

export function validateProject(project: VNProject): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const assetIds = new Set<string>();
  const characterIds = new Set(project.characters.map((character) => character.id));

  if (!project.id) {
    errors.push("Project id is required.");
  }
  if (!project.title) {
    errors.push("Project title is required.");
  }
  if (!project.chapters.length) {
    errors.push("Project must contain at least one chapter.");
  }

  for (const asset of project.assets.items) {
    if (!asset.id) {
      errors.push("Asset id is required.");
    }
    if (assetIds.has(asset.id)) {
      errors.push(`Duplicate asset id: ${asset.id}.`);
    }
    assetIds.add(asset.id);
    if (!KNOWN_ASSET_TYPES.has(asset.type)) {
      errors.push(`Unknown asset type: ${asset.type}.`);
    }
    if (!asset.src) {
      errors.push(`Asset ${asset.id} must include src.`);
    }
    if (asset.characterId && !characterIds.has(asset.characterId)) {
      warnings.push(`Asset ${asset.id} references missing character ${asset.characterId}.`);
    }
  }

  for (const character of project.characters) {
    if (!character.id || !character.name) {
      errors.push("Character id and name are required.");
    }
    if (character.defaultSpriteId && !assetIds.has(character.defaultSpriteId)) {
      warnings.push(`Character ${character.id} references missing default sprite.`);
    }
  }

  for (const chapter of project.chapters) {
    if (!chapter.scenes.length) {
      warnings.push(`Chapter ${chapter.id} has no scenes.`);
    }
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        if (!shot.beats.length) {
          warnings.push(`Shot ${shot.id} has no beats.`);
        }
        for (const beat of shot.beats) {
          if (!beat.id) {
            errors.push("Beat id is required.");
          }
          if (!beat.line.text.trim()) {
            errors.push(`Beat ${beat.id} has empty text.`);
          }
          if (beat.line.speakerId && !characterIds.has(beat.line.speakerId)) {
            errors.push(`Beat ${beat.id} references missing speaker ${beat.line.speakerId}.`);
          }
          validatePatchAssets(beat.id, beat.stagePatch, assetIds, characterIds, errors, warnings);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function validatePatchAssets(
  beatId: string,
  patch: StagePatch | undefined,
  assetIds: Set<string>,
  characterIds: Set<string>,
  errors: string[],
  warnings: string[]
) {
  if (!patch) {
    return;
  }
  if (patch.backgroundId && !assetIds.has(patch.backgroundId)) {
    errors.push(`Beat ${beatId} references missing background ${patch.backgroundId}.`);
  }
  if (patch.cgAssetId && !assetIds.has(patch.cgAssetId)) {
    errors.push(`Beat ${beatId} references missing CG ${patch.cgAssetId}.`);
  }
  for (const character of patch.characters ?? []) {
    if (!characterIds.has(character.characterId)) {
      errors.push(`Beat ${beatId} references missing character ${character.characterId}.`);
    }
    if (character.spriteId && !assetIds.has(character.spriteId)) {
      warnings.push(`Beat ${beatId} references missing sprite ${character.spriteId}.`);
    }
  }
}
