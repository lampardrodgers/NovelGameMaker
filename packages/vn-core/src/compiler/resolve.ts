import { createEmptyStageState } from "../schema/defaults.js";
import type { CompiledBeat, StageState, VNProject } from "../schema/types.js";
import { applySpeakerFocus, applyStagePatch } from "../stage/stage.js";
import { renderDisplayText } from "./text.js";

export function resolveBeats(project: VNProject): CompiledBeat[] {
  const compiled: CompiledBeat[] = [];
  let stage: StageState = createEmptyStageState();

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        if (shot.initialStage) {
          stage = cloneStage(shot.initialStage);
        }
        for (const beat of shot.beats) {
          stage = applyStagePatch(stage, beat.stagePatch);
          const focusedStage = applySpeakerFocus(stage, beat.line);
          stage = focusedStage;
          compiled.push({
            index: compiled.length,
            chapterId: chapter.id,
            chapterTitle: chapter.title,
            sceneId: scene.id,
            sceneTitle: scene.title,
            shotId: shot.id,
            shotTitle: shot.title,
            beatId: beat.id,
            line: { ...beat.line },
            resolvedStage: cloneStage(focusedStage),
            displayText: renderDisplayText(beat.line, project.characters, project.ui)
          });
        }
      }
    }
  }

  return compiled;
}

function cloneStage(stage: StageState): StageState {
  return {
    ...stage,
    characters: stage.characters.map((character) => ({ ...character })),
    camera: stage.camera ? { ...stage.camera } : undefined,
    effects: stage.effects?.map((effect) => ({ ...effect })),
    transition: stage.transition ? { ...stage.transition } : undefined
  };
}
