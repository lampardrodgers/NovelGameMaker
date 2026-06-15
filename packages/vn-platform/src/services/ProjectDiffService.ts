import { createHash } from "node:crypto";
import type { VNAsset, VNBeat, VNProject } from "@novel-game-maker/vn-core";
import type {
  ProjectReleaseAssetSummary,
  ProjectReleaseBeatSummary,
  ProjectReleaseCharacterSummary,
  ProjectReleaseDiff,
  ProjectReleaseDiffItem,
  ProjectReleaseSummary,
  PublishedProjectReleaseRecord,
  PublishedProjectReleaseRepository
} from "../types.js";
import { ProjectService } from "./ProjectService.js";

export const PROJECT_RELEASE_SUMMARY_METADATA_KEY = "projectSummary";

const MAX_DIFF_ITEMS = 20;

export class ProjectDiffService {
  constructor(
    private readonly projects: ProjectService,
    private readonly releases: PublishedProjectReleaseRepository
  ) {}

  async diffCurrentDraft(projectId: string): Promise<ProjectReleaseDiff> {
    const project = await this.projects.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const current = createProjectReleaseSummary(project.vnProject);
    const baseRelease = await this.releases.getLatestByProject(projectId);
    const published = baseRelease ? readReleaseSummary(baseRelease) : undefined;
    const baseUnavailable = Boolean(baseRelease && !published);

    if (baseUnavailable || !published) {
      return {
        projectId,
        baseRelease: baseRelease ? serializeBaseRelease(baseRelease) : undefined,
        baseUnavailable,
        changed: true,
        current: compactSummary(current),
        published: published ? compactSummary(published) : undefined,
        totals: {
          addedBeats: current.beatCount,
          removedBeats: 0,
          changedBeats: 0,
          addedAssets: current.assetCount,
          removedAssets: 0,
          changedAssets: 0,
          addedCharacters: current.characterCount,
          removedCharacters: 0,
          changedCharacters: 0
        },
        beatChanges: current.beats.slice(0, MAX_DIFF_ITEMS).map((beat) => ({
          id: beat.id,
          kind: "added",
          label: beatLabel(beat),
          current: beat.textPreview
        })),
        assetChanges: current.assets.slice(0, MAX_DIFF_ITEMS).map((asset) => ({
          id: asset.id,
          kind: "added",
          label: assetLabel(asset),
          current: asset.name
        })),
        characterChanges: current.characters.slice(0, MAX_DIFF_ITEMS).map((character) => ({
          id: character.id,
          kind: "added",
          label: character.name,
          current: character.name
        }))
      };
    }

    const beatDiff = diffById(published.beats, current.beats, beatLabel, beatValue, beatPreview);
    const assetDiff = diffById(published.assets, current.assets, assetLabel, assetValue, assetPreview);
    const characterDiff = diffById(
      published.characters,
      current.characters,
      (character) => character.name,
      characterValue,
      (character) => character.name
    );

    return {
      projectId,
      baseRelease: baseRelease ? serializeBaseRelease(baseRelease) : undefined,
      baseUnavailable: false,
      changed: current.fingerprint !== published.fingerprint,
      current: compactSummary(current),
      published: compactSummary(published),
      totals: {
        addedBeats: beatDiff.added,
        removedBeats: beatDiff.removed,
        changedBeats: beatDiff.changed,
        addedAssets: assetDiff.added,
        removedAssets: assetDiff.removed,
        changedAssets: assetDiff.changed,
        addedCharacters: characterDiff.added,
        removedCharacters: characterDiff.removed,
        changedCharacters: characterDiff.changed
      },
      beatChanges: beatDiff.items,
      assetChanges: assetDiff.items,
      characterChanges: characterDiff.items
    };
  }

  async currentSummary(projectId: string): Promise<ProjectReleaseSummary> {
    const project = await this.projects.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }
    return createProjectReleaseSummary(project.vnProject);
  }
}

export function createProjectReleaseSummary(project: VNProject): ProjectReleaseSummary {
  const beats: ProjectReleaseBeatSummary[] = [];
  let sceneCount = 0;
  let shotCount = 0;

  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      sceneCount += 1;
      for (const shot of scene.shots) {
        shotCount += 1;
        for (const beat of shot.beats) {
          beats.push(createBeatSummary({
            beat,
            chapterTitle: chapter.title,
            sceneTitle: scene.title,
            shotTitle: shot.title,
            shotRenderMode: shot.renderMode
          }));
        }
      }
    }
  }

  const assets = project.assets.items.map(createAssetSummary);
  const characters = project.characters.map((character): ProjectReleaseCharacterSummary => ({
    id: character.id,
    name: character.name,
    role: character.role,
    defaultSpriteId: character.defaultSpriteId,
    defaultExpression: character.defaultExpression
  }));
  const summaryWithoutFingerprint = {
    title: project.title,
    chapterCount: project.chapters.length,
    sceneCount,
    shotCount,
    beatCount: beats.length,
    characterCount: characters.length,
    assetCount: assets.length,
    cgBeatCount: beats.filter((beat) => beat.renderMode === "cg" || Boolean(beat.cgAssetId)).length,
    beats,
    assets,
    characters
  };

  return {
    fingerprint: sha256(stableJson(summaryWithoutFingerprint)),
    ...summaryWithoutFingerprint
  };
}

export function releaseMetadataWithSummary(
  metadata: Record<string, unknown>,
  summary: ProjectReleaseSummary
): Record<string, unknown> {
  return {
    ...metadata,
    [PROJECT_RELEASE_SUMMARY_METADATA_KEY]: summary
  };
}

export function readReleaseSummary(release: PublishedProjectReleaseRecord): ProjectReleaseSummary | undefined {
  const raw = release.metadata?.[PROJECT_RELEASE_SUMMARY_METADATA_KEY];
  return isProjectReleaseSummary(raw) ? raw : undefined;
}

function createBeatSummary(input: {
  beat: VNBeat;
  chapterTitle: string;
  sceneTitle: string;
  shotTitle: string;
  shotRenderMode?: string;
}): ProjectReleaseBeatSummary {
  const textPreview = compactText(input.beat.line.text, 120);
  return {
    id: input.beat.id,
    chapterTitle: input.chapterTitle,
    sceneTitle: input.sceneTitle,
    shotTitle: input.shotTitle,
    lineKind: input.beat.line.kind,
    speakerId: input.beat.line.speakerId,
    speakerName: input.beat.line.speakerName,
    textHash: sha256(input.beat.line.text),
    textPreview,
    renderMode: input.beat.stagePatch?.renderMode ?? input.shotRenderMode,
    cgAssetId: input.beat.stagePatch?.cgAssetId
  };
}

function createAssetSummary(asset: VNAsset): ProjectReleaseAssetSummary {
  return {
    id: asset.id,
    type: asset.type,
    name: asset.name,
    srcHash: sha256(asset.src),
    placeholder: asset.placeholder === true,
    characterId: asset.characterId
  };
}

function diffById<T extends { id: string }>(
  previousItems: T[],
  currentItems: T[],
  labelFor: (item: T) => string,
  valueFor: (item: T) => string,
  previewFor: (item: T) => string
): { added: number; removed: number; changed: number; items: ProjectReleaseDiffItem[] } {
  const previous = new Map(previousItems.map((item) => [item.id, item]));
  const current = new Map(currentItems.map((item) => [item.id, item]));
  const items: ProjectReleaseDiffItem[] = [];
  let added = 0;
  let removed = 0;
  let changed = 0;

  for (const item of currentItems) {
    const old = previous.get(item.id);
    if (!old) {
      added += 1;
      pushLimited(items, {
        id: item.id,
        kind: "added",
        label: labelFor(item),
        current: previewFor(item)
      });
      continue;
    }
    if (valueFor(old) !== valueFor(item)) {
      changed += 1;
      pushLimited(items, {
        id: item.id,
        kind: "changed",
        label: labelFor(item),
        previous: previewFor(old),
        current: previewFor(item)
      });
    }
  }

  for (const item of previousItems) {
    if (!current.has(item.id)) {
      removed += 1;
      pushLimited(items, {
        id: item.id,
        kind: "removed",
        label: labelFor(item),
        previous: previewFor(item)
      });
    }
  }

  return { added, removed, changed, items };
}

function pushLimited(items: ProjectReleaseDiffItem[], item: ProjectReleaseDiffItem): void {
  if (items.length < MAX_DIFF_ITEMS) {
    items.push(item);
  }
}

function compactSummary(summary: ProjectReleaseSummary): Omit<ProjectReleaseSummary, "beats" | "assets" | "characters"> {
  const { beats: _beats, assets: _assets, characters: _characters, ...compact } = summary;
  return compact;
}

function serializeBaseRelease(release: PublishedProjectReleaseRecord): ProjectReleaseDiff["baseRelease"] {
  return {
    id: release.id,
    version: release.version,
    createdAt: release.createdAt
  };
}

function beatLabel(beat: ProjectReleaseBeatSummary): string {
  return `${beat.chapterTitle} / ${beat.sceneTitle} / ${beat.shotTitle}`;
}

function beatValue(beat: ProjectReleaseBeatSummary): string {
  return stableJson({
    lineKind: beat.lineKind,
    speakerId: beat.speakerId,
    speakerName: beat.speakerName,
    textHash: beat.textHash,
    renderMode: beat.renderMode,
    cgAssetId: beat.cgAssetId
  });
}

function beatPreview(beat: ProjectReleaseBeatSummary): string {
  return beat.textPreview;
}

function assetLabel(asset: ProjectReleaseAssetSummary): string {
  return `${asset.type}: ${asset.name}`;
}

function assetValue(asset: ProjectReleaseAssetSummary): string {
  return stableJson(asset);
}

function assetPreview(asset: ProjectReleaseAssetSummary): string {
  return `${asset.name}${asset.placeholder ? " (placeholder)" : ""}`;
}

function characterValue(character: ProjectReleaseCharacterSummary): string {
  return stableJson(character);
}

function compactText(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
}

function isProjectReleaseSummary(value: unknown): value is ProjectReleaseSummary {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Partial<ProjectReleaseSummary>;
  return (
    typeof record.fingerprint === "string" &&
    typeof record.title === "string" &&
    typeof record.beatCount === "number" &&
    Array.isArray(record.beats) &&
    Array.isArray(record.assets) &&
    Array.isArray(record.characters)
  );
}
