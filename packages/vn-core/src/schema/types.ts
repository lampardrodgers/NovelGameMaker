export type VNLineKind = "narration" | "dialogue" | "monologue";
export type VNAssetType = "background" | "characterSprite" | "cg" | "effect" | "ui" | "bgm" | "sfx" | "voice";
export type StageRenderMode = "stage" | "cg";
export type CharacterFocus = "active" | "dimmed" | "normal";
export type StagePosition = "left" | "center" | "right" | string;

export interface VNViewport {
  width: number;
  height: number;
  aspectRatio: "16:9" | string;
}

export interface DialogueUIConfig {
  maxLines: number;
  maxCjkCharsPerLine: number;
  maxCjkCharsPerBeat: number;
  quoteStyle: "jp_corner" | "cn_double" | "none";
  showNameplate: boolean;
  narrationShowNameplate: boolean;
  typewriter: boolean;
  dialogueBrackets: readonly [string, string];
}

export interface VNAsset {
  id: string;
  type: VNAssetType;
  name: string;
  src: string;
  characterId?: string;
  placeholder?: boolean;
  tags?: string[];
}

export interface AssetManifest {
  items: VNAsset[];
}

export interface CharacterProfile {
  id: string;
  name: string;
  aliases: string[];
  role?: "protagonist" | "heroine" | "supporting" | "antagonist" | "minor" | "unknown";
  description?: string;
  personality?: string;
  appearance?: string;
  visualKeywords?: string[];
  defaultSpriteId?: string;
  defaultExpression?: string;
}

export interface VNLine {
  kind: VNLineKind;
  text: string;
  speakerId?: string;
  speakerName?: string;
}

export interface VNBeat {
  id: string;
  line: VNLine;
  stagePatch?: StagePatch;
  transition?: TransitionConfig;
  nextBeatId?: string;
  sourceText?: string;
  meta?: {
    cgCandidateScore?: number;
    cgCandidateReason?: string;
  };
  tags?: string[];
}

export interface VNShot {
  id: string;
  title: string;
  renderMode?: StageRenderMode;
  initialStage?: StageState;
  beats: VNBeat[];
}

export interface VNScene {
  id: string;
  title: string;
  shots: VNShot[];
}

export interface VNChapter {
  id: string;
  title: string;
  scenes: VNScene[];
}

export interface CameraState {
  zoom: number;
  panX: number;
  panY: number;
}

export interface StageEffect {
  id: string;
  type: string;
  intensity?: number;
}

export interface TransitionConfig {
  type: "none" | "fade" | "cut";
  durationMs: number;
}

export interface StageCharacter {
  characterId: string;
  spriteId?: string;
  expression?: string;
  position: StagePosition;
  visible: boolean;
  focus: CharacterFocus;
  facing?: "left" | "right" | "front";
  scale?: number;
  x?: number;
  y?: number;
}

export interface StageCharacterPatch {
  characterId: string;
  spriteId?: string;
  expression?: string;
  position?: StagePosition;
  visible?: boolean;
  focus?: CharacterFocus;
  facing?: "left" | "right" | "front";
  scale?: number;
  x?: number;
  y?: number;
}

export interface StageState {
  renderMode: StageRenderMode;
  backgroundId?: string;
  cgAssetId?: string;
  characters: StageCharacter[];
  camera?: CameraState;
  effects?: StageEffect[];
  transition?: TransitionConfig;
}

export interface StagePatch {
  renderMode?: StageRenderMode;
  backgroundId?: string;
  cgAssetId?: string;
  characters?: StageCharacterPatch[];
  camera?: Partial<CameraState>;
  effects?: StageEffect[];
  transition?: TransitionConfig;
}

export interface DisplayText {
  speakerName?: string;
  text: string;
}

export interface CompiledBeat {
  index: number;
  chapterId: string;
  chapterTitle: string;
  sceneId: string;
  sceneTitle: string;
  shotId: string;
  shotTitle: string;
  beatId: string;
  line: VNLine;
  resolvedStage: StageState;
  displayText: DisplayText;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface VNProject {
  id: string;
  title: string;
  version: string;
  viewport: VNViewport;
  ui: DialogueUIConfig;
  assets: AssetManifest;
  characters: CharacterProfile[];
  chapters: VNChapter[];
  startBeatId?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}
