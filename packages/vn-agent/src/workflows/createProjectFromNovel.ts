import {
  createDefaultUIConfig,
  createDefaultViewport,
  createEmptyStageState,
  detectLineKind,
  applyStagePatch,
  splitTextToBeats,
  validateProject,
  type CharacterProfile,
  type VNBeat,
  type VNLine,
  type VNProject
} from "@novel-game-maker/vn-core";
import { createPlaceholderAssets } from "../heuristics/assets.js";
import {
  assignSpeakerFocus,
  extractCharacters,
  updateSpeakerContextFromText,
  type SpeakerContext
} from "../heuristics/characters.js";
import {
  cleanNovelText,
  splitChapters,
  splitNovelLines,
  splitScenes
} from "../heuristics/text.js";
import { createBeatStagePatch, createInitialStagePatch, markCGCandidates } from "../heuristics/stagePlanning.js";

export interface CreateProjectFromNovelInput {
  title: string;
  novelText: string;
  style?: {
    name?: string;
    mood?: string;
  };
}

export function createProjectFromNovel(input: CreateProjectFromNovelInput): VNProject {
  const cleanText = cleanNovelText(input.novelText);
  const ui = createDefaultUIConfig();
  const characters = extractCharacters(cleanText);
  const chapters = splitChapters(cleanText);
  const now = new Date().toISOString();

  const project: VNProject = {
    id: createProjectId(input.title),
    title: input.title.trim() || "未命名 Galgame",
    version: "0.1.0",
    viewport: createDefaultViewport(),
    ui,
    assets: createPlaceholderAssets(characters),
    characters,
    chapters: chapters.map((chapter, chapterIndex) => {
      const scenes = splitScenes(chapter.text);
      return {
        id: chapter.id,
        title: chapter.title,
        scenes: scenes.map((scene, sceneIndex) => ({
          id: `${chapter.id}_${scene.id}`,
          title: scene.title,
          shots: [
            {
              id: `${chapter.id}_${scene.id}_shot_1`,
              title: scene.title,
              renderMode: "stage",
              initialStage: applyStagePatch(
                createEmptyStageState(),
                createInitialStagePatch(scene.text, characters)
              ),
              beats: createSceneBeats({
                chapterIndex,
                sceneIndex,
                sceneText: scene.text,
                characters,
                maxCjkCharsPerBeat: ui.maxCjkCharsPerBeat
              })
            }
          ]
        }))
      };
    }),
    metadata: {
      source: "local-heuristic-agent",
      style: input.style
    },
    createdAt: now,
    updatedAt: now
  };

  linkBeatNavigation(project);

  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Generated project is invalid: ${validation.errors.join("; ")}`);
  }

  return project;
}

function linkBeatNavigation(project: VNProject): void {
  const beats = project.chapters.flatMap((chapter) =>
    chapter.scenes.flatMap((scene) => scene.shots.flatMap((shot) => shot.beats))
  );
  project.startBeatId = beats[0]?.id;
  for (let index = 0; index < beats.length; index += 1) {
    const beat = beats[index];
    if (beat) {
      beat.nextBeatId = beats[index + 1]?.id;
    }
  }
}

function createSceneBeats(input: {
  chapterIndex: number;
  sceneIndex: number;
  sceneText: string;
  characters: CharacterProfile[];
  maxCjkCharsPerBeat: number;
}): VNBeat[] {
  const rawLines = splitNovelLines(input.sceneText);
  const beats: VNBeat[] = [];
  let context: SpeakerContext = {};

  for (const rawLine of rawLines) {
    const detectedLine = detectLineKind(rawLine);
    context = updateSpeakerContextFromText(context, rawLine, input.characters);
    const line = assignSpeakerFocus(detectedLine, input.characters, context);
    const beatTexts = splitTextToBeats(line.text, {
      ...createDefaultUIConfig(),
      maxCjkCharsPerBeat: input.maxCjkCharsPerBeat
    });

    for (const beatText of beatTexts) {
      const beatLine: VNLine = {
        ...line,
        text: beatText
      };
      const beatIndex = beats.length;
      beats.push({
        id: `chapter_${input.chapterIndex + 1}_scene_${input.sceneIndex + 1}_beat_${beatIndex + 1}`,
        line: beatLine,
        stagePatch: createBeatStagePatch(
          beatLine,
          beatIndex === 0,
          input.sceneText,
          input.characters
        )
      });
    }
  }

  return markCGCandidates(beats);
}

function createProjectId(title: string): string {
  const normalized = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `vn_${normalized}` : "vn_untitled";
}
