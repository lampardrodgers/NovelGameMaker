import type {
  CharacterProfile,
  CompiledBeat,
  StageCharacterPatch,
  StagePatch,
  VNBeat,
  VNLine,
  VNProject
} from "@novel-game-maker/vn-core";

export interface BeatTreeItem {
  index: number;
  beatId: string;
  chapterTitle: string;
  sceneTitle: string;
  shotTitle: string;
  label: string;
}

export function createBeatTree(compiledBeats: CompiledBeat[]): BeatTreeItem[] {
  return compiledBeats.map((beat) => ({
    index: beat.index,
    beatId: beat.beatId,
    chapterTitle: beat.chapterTitle,
    sceneTitle: beat.sceneTitle,
    shotTitle: beat.shotTitle,
    label: beat.displayText.text
  }));
}

export function findBeat(project: VNProject, beatId: string): VNBeat | undefined {
  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        const beat = shot.beats.find((item) => item.id === beatId);
        if (beat) {
          return beat;
        }
      }
    }
  }
  return undefined;
}

export function updateProjectTitle(project: VNProject, title: string): VNProject {
  return {
    ...project,
    title,
    updatedAt: new Date().toISOString()
  };
}

export function updateBeatLine(project: VNProject, beatId: string, linePatch: Partial<VNLine>): VNProject {
  return updateBeat(project, beatId, (beat) => ({
    ...beat,
    line: normalizeLine({
      ...beat.line,
      ...linePatch
    })
  }));
}

export function updateBeatStagePatch(
  project: VNProject,
  beatId: string,
  patch: StagePatch
): VNProject {
  return updateBeat(project, beatId, (beat) => ({
    ...beat,
    stagePatch: {
      ...(beat.stagePatch ?? {}),
      ...patch
    }
  }));
}

export function updateCharacterPatch(
  project: VNProject,
  beatId: string,
  characterId: string,
  patch: Partial<StageCharacterPatch>
): VNProject {
  return updateBeat(project, beatId, (beat) => {
    const currentPatch = beat.stagePatch ?? {};
    const currentCharacters = currentPatch.characters ?? [];
    const existingIndex = currentCharacters.findIndex((character) => character.characterId === characterId);
    const nextCharacters = currentCharacters.map((character) => ({ ...character }));

    if (existingIndex >= 0) {
      const existing = nextCharacters[existingIndex];
      if (existing) {
        nextCharacters[existingIndex] = {
          ...existing,
          ...patch,
          characterId
        };
      }
    } else {
      nextCharacters.push({
        characterId,
        ...patch
      });
    }

    return {
      ...beat,
      stagePatch: {
        ...currentPatch,
        characters: nextCharacters
      }
    };
  });
}

export function getFirstSpeaker(characters: CharacterProfile[]): CharacterProfile | undefined {
  return characters.find((character) => character.id !== "protagonist") ?? characters[0];
}

function updateBeat(project: VNProject, beatId: string, updater: (beat: VNBeat) => VNBeat): VNProject {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    chapters: project.chapters.map((chapter) => ({
      ...chapter,
      scenes: chapter.scenes.map((scene) => ({
        ...scene,
        shots: scene.shots.map((shot) => ({
          ...shot,
          beats: shot.beats.map((beat) => (beat.id === beatId ? updater(beat) : beat))
        }))
      }))
    }))
  };
}

function normalizeLine(line: VNLine): VNLine {
  if (line.kind === "narration") {
    return {
      kind: "narration",
      text: line.text
    };
  }
  return line;
}
