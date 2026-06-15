import { createEmptyStageState } from "../schema/defaults.js";
import type { StageCharacter, StagePatch, StageState, VNLine } from "../schema/types.js";

export function applyStagePatch(
  current: StageState = createEmptyStageState(),
  patch: StagePatch = {}
): StageState {
  const next: StageState = {
    ...current,
    renderMode: patch.renderMode ?? current.renderMode,
    backgroundId: patch.backgroundId ?? current.backgroundId,
    cgAssetId: patch.cgAssetId ?? current.cgAssetId,
    characters: current.characters.map((character) => ({ ...character })),
    camera: mergeCamera(current.camera, patch.camera),
    effects: patch.effects ? patch.effects.map((effect) => ({ ...effect })) : cloneEffects(current.effects),
    transition: patch.transition ? { ...patch.transition } : cloneTransition(current.transition)
  };

  if (patch.characters) {
    for (const characterPatch of patch.characters) {
      const existingIndex = next.characters.findIndex(
        (character) => character.characterId === characterPatch.characterId
      );
      if (existingIndex >= 0) {
        const existing = next.characters[existingIndex];
        if (!existing) {
          continue;
        }
        next.characters[existingIndex] = {
          characterId: existing.characterId,
          spriteId: characterPatch.spriteId ?? existing.spriteId,
          expression: characterPatch.expression ?? existing.expression,
          position: characterPatch.position ?? existing.position,
          visible: characterPatch.visible ?? existing.visible,
          focus: characterPatch.focus ?? existing.focus,
          facing: characterPatch.facing ?? existing.facing,
          scale: characterPatch.scale ?? existing.scale,
          x: characterPatch.x ?? existing.x,
          y: characterPatch.y ?? existing.y
        };
      } else {
        next.characters.push(createStageCharacterFromPatch(characterPatch));
      }
    }
  }

  return next;
}

export function applySpeakerFocus(stage: StageState, line: VNLine): StageState {
  if (line.kind === "narration" || !line.speakerId) {
    return {
      ...stage,
      characters: stage.characters.map((character) => ({
        ...character,
        focus: character.visible ? "normal" : character.focus
      }))
    };
  }

  return {
    ...stage,
    characters: stage.characters.map((character) => ({
      ...character,
      focus:
        !character.visible
          ? character.focus
          : character.characterId === line.speakerId
            ? "active"
            : "dimmed"
    }))
  };
}

function createStageCharacterFromPatch(patch: { characterId: string } & Partial<StageCharacter>): StageCharacter {
  return {
    characterId: patch.characterId,
    spriteId: patch.spriteId,
    expression: patch.expression,
    position: patch.position ?? "center",
    visible: patch.visible ?? true,
    focus: patch.focus ?? "normal",
    facing: patch.facing,
    scale: patch.scale,
    x: patch.x,
    y: patch.y
  };
}

function mergeCamera(
  current: StageState["camera"],
  patch: StagePatch["camera"]
): StageState["camera"] {
  if (!current && !patch) {
    return undefined;
  }
  return {
    zoom: patch?.zoom ?? current?.zoom ?? 1,
    panX: patch?.panX ?? current?.panX ?? 0,
    panY: patch?.panY ?? current?.panY ?? 0
  };
}

function cloneEffects(effects: StageState["effects"]): StageState["effects"] {
  return effects?.map((effect) => ({ ...effect }));
}

function cloneTransition(transition: StageState["transition"]): StageState["transition"] {
  return transition ? { ...transition } : undefined;
}
