import type { DialogueUIConfig, StageState, VNViewport } from "./types.js";

export function createDefaultUIConfig(): DialogueUIConfig {
  return {
    maxLines: 2,
    maxCjkCharsPerLine: 30,
    maxCjkCharsPerBeat: 60,
    quoteStyle: "jp_corner",
    showNameplate: true,
    narrationShowNameplate: false,
    typewriter: false,
    dialogueBrackets: ["「", "」"]
  };
}

export function createDefaultViewport(): VNViewport {
  return {
    width: 1280,
    height: 720,
    aspectRatio: "16:9"
  };
}

export function createEmptyStageState(): StageState {
  return {
    renderMode: "stage",
    characters: []
  };
}
