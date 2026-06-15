import type {
  CharacterProfile,
  StageCharacterPatch,
  StagePatch,
  VNBeat,
  VNLine
} from "@agentic-galgame/vn-core";

export function chooseBackgroundId(sceneText: string): string {
  if (sceneText.includes("实验室")) {
    return "bg_lab_night";
  }
  if (sceneText.includes("天台")) {
    return "bg_rooftop_sunset";
  }
  if (sceneText.includes("教室")) {
    return "bg_classroom_evening";
  }
  return "bg_default";
}

export function createInitialStagePatch(
  sceneText: string,
  characters: CharacterProfile[]
): StagePatch {
  const visibleCharacters = characters
    .filter((character) => character.id !== "protagonist")
    .filter((character) => character.aliases.some((alias) => sceneText.includes(alias)))
    .slice(0, 3);

  return {
    renderMode: "stage",
    backgroundId: chooseBackgroundId(sceneText),
    characters: visibleCharacters.map((character, index) => createCharacterPatch(character, index))
  };
}

export function markCGCandidates(beats: VNBeat[]): VNBeat[] {
  let previousWasCg = false;

  return beats.map((beat) => {
    const candidate = scoreCGCandidate(beat.line.text);
    if (candidate) {
      previousWasCg = true;
      return {
        ...beat,
        tags: uniqueTags([...(beat.tags ?? []), "cg-candidate"]),
        meta: {
          ...beat.meta,
          cgCandidateScore: candidate.score,
          cgCandidateReason: candidate.reason
        },
        stagePatch: {
          ...beat.stagePatch,
          renderMode: "cg",
          cgAssetId: candidate.cgAssetId
        }
      };
    }

    if (previousWasCg) {
      previousWasCg = false;
      return {
        ...beat,
        stagePatch: {
          ...beat.stagePatch,
          renderMode: "stage"
        }
      };
    }

    return beat;
  });
}

export function createBeatStagePatch(
  line: VNLine,
  isFirstBeatInScene: boolean,
  sceneText: string,
  characters: CharacterProfile[]
): StagePatch | undefined {
  if (!isFirstBeatInScene) {
    return undefined;
  }

  const patch = createInitialStagePatch(sceneText, characters);
  if (line.kind !== "narration" && line.speakerId && patch.characters) {
    const speaker = patch.characters.find((character) => character.characterId === line.speakerId);
    if (speaker) {
      speaker.visible = true;
    } else {
      const speakerProfile = characters.find((character) => character.id === line.speakerId);
      if (speakerProfile) {
        patch.characters.push(createCharacterPatch(speakerProfile, patch.characters.length));
      }
    }
  }
  return patch;
}

function scoreCGCandidate(text: string): { cgAssetId: string; score: number; reason: string } | undefined {
  if (text.includes("手机") || text.includes("屏幕")) {
    return {
      cgAssetId: "cg_phone_screen",
      score: 0.92,
      reason: "手机屏幕亮起是关键物品特写"
    };
  }
  if (text.includes("世界线") || text.includes("真相")) {
    return {
      cgAssetId: "cg_worldline_shift",
      score: 0.95,
      reason: "世界线或真相揭露是重点剧情节点"
    };
  }

  const keyword = ["告白", "死亡", "坠落", "枪声", "崩溃", "拥抱", "分别", "爆炸", "血迹"].find((item) =>
    text.includes(item)
  );
  return keyword
    ? {
        cgAssetId: "cg_default",
        score: 0.78,
        reason: `包含重点剧情关键词：${keyword}`
      }
    : undefined;
}

function createCharacterPatch(character: CharacterProfile, index: number): StageCharacterPatch {
  const positions = ["left", "center", "right"] as const;
  return {
    characterId: character.id,
    spriteId: character.defaultSpriteId,
    expression: character.defaultExpression ?? "neutral",
    position: positions[index] ?? "center",
    visible: true,
    focus: "normal",
    facing: "front",
    scale: 1
  };
}

function uniqueTags(tags: string[]): string[] {
  return [...new Set(tags)];
}
