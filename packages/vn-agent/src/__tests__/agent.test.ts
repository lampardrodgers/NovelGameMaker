import { describe, expect, it } from "vitest";
import { resolveBeats, sampleNovelText, validateProject } from "@agentic-galgame/vn-core";
import {
  applyGeneratedAssetManifest,
  cleanNovelText,
  createCodexImage2Manifest,
  createPlaceholderAssets,
  createProjectFromNovel,
  extractCharacters,
  LocalHeuristicVNAgentWorkflow,
  MockImageGenerationProvider,
  MockTextModelProvider,
  splitChapters,
  splitScenes
} from "../index";

describe("agent text heuristics", () => {
  it("cleans text and splits chapters/scenes", () => {
    const clean = cleanNovelText(sampleNovelText);
    const chapters = splitChapters(clean);
    const scenes = splitScenes(chapters[0]?.text ?? "");

    expect(chapters[0]?.title).toBe("第一章 实验室里的蓝光");
    expect(scenes.length).toBeGreaterThanOrEqual(2);
  });

  it("extracts sample characters", () => {
    const characters = extractCharacters(sampleNovelText);
    expect(characters.some((character) => character.name === "林雪")).toBe(true);
    expect(characters.some((character) => character.id === "unknown_speaker")).toBe(true);
    expect(characters.some((character) => character.name === "手里紧紧")).toBe(false);
  });

  it("creates the expected placeholder asset family", () => {
    const characters = extractCharacters(sampleNovelText);
    const assets = createPlaceholderAssets(characters);
    const ids = assets.items.map((asset) => asset.id);

    expect(ids).toContain("bg_lab_night");
    expect(ids).toContain("bg_rooftop_sunset");
    expect(ids).toContain("bg_classroom_evening");
    expect(ids).toContain("bg_default");
    expect(ids).toContain("sprite_lin_xue");
    expect(ids).toContain("sprite_protagonist");
    expect(ids).toContain("sprite_unknown");
    expect(ids).toContain("cg_phone_screen");
    expect(ids).toContain("cg_worldline_shift");
    expect(ids).toContain("cg_default");
  });
});

describe("createProjectFromNovel", () => {
  it("generates a valid playable VNProject from the sample novel", () => {
    const project = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    const validation = validateProject(project);
    const compiled = resolveBeats(project);

    expect(validation.valid).toBe(true);
    expect(project.characters.some((character) => character.name === "林雪")).toBe(true);
    expect(project.assets.items.some((asset) => asset.placeholder)).toBe(true);
    expect(project.assets.items.some((asset) => asset.id === "sprite_lin_xue")).toBe(true);
    expect(project.assets.items.some((asset) => asset.id === "bg_lab_night")).toBe(true);
    expect(project.chapters[0]?.scenes[0]?.shots[0]?.beats.some((beat) => beat.tags?.includes("cg-candidate"))).toBe(true);
    expect(project.chapters[0]?.scenes[0]?.shots[0]?.beats.some((beat) => beat.meta?.cgCandidateScore)).toBe(true);
    expect(project.chapters[0]?.scenes[0]?.shots[0]?.initialStage?.backgroundId).toBe("bg_lab_night");
    expect(project.startBeatId).toBe(project.chapters[0]?.scenes[0]?.shots[0]?.beats[0]?.id);
    expect(project.chapters[0]?.scenes[0]?.shots[0]?.beats[0]?.nextBeatId).toBe(project.chapters[0]?.scenes[0]?.shots[0]?.beats[1]?.id);
    expect(compiled.length).toBeGreaterThan(3);
    expect(compiled.some((beat) => beat.resolvedStage.renderMode === "cg")).toBe(true);
    expect(compiled.some((beat) => beat.displayText.speakerName === "林雪")).toBe(true);
    expect(compiled.every((beat) => beat.line.text.length <= project.ui.maxCjkCharsPerBeat)).toBe(true);
  });

  it("puts an inferred speaker on stage when a scene starts with dialogue", () => {
    const project = createProjectFromNovel({
      title: "天台",
      novelText: "第一章 天台\n\n林雪：“我们走吧。”\n风从门后吹来。"
    });
    const compiled = resolveBeats(project);

    expect(compiled[0]?.line.kind).toBe("dialogue");
    expect(compiled[0]?.resolvedStage.characters.some((character) => character.characterId === "lin_xue")).toBe(true);
    expect(compiled[0]?.resolvedStage.characters.find((character) => character.characterId === "lin_xue")?.focus).toBe("active");
  });

  it("uses unknown_speaker for unattributed quoted dialogue", () => {
    const project = createProjectFromNovel({
      title: "雨夜",
      novelText: "第一章 雨夜\n\n“有人在吗？”"
    });
    const compiled = resolveBeats(project);

    expect(project.characters.some((character) => character.id === "unknown_speaker")).toBe(true);
    expect(compiled[0]?.line.kind).toBe("dialogue");
    expect(compiled[0]?.line.speakerId).toBe("unknown_speaker");
    expect(compiled[0]?.displayText.speakerName).toBe("未知说话人");
    expect(compiled[0]?.resolvedStage.characters.some((character) => character.characterId === "unknown_speaker")).toBe(true);
  });
});

describe("local heuristic workflow", () => {
  it("runs the local workflow without external providers", async () => {
    const workflow = new LocalHeuristicVNAgentWorkflow();
    const project = await workflow.run({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });

    expect(project.title).toBe("实验室里的蓝光");
    expect(validateProject(project).valid).toBe(true);
  });
});

describe("mock providers", () => {
  it("implements the reserved provider interfaces without calling external APIs", async () => {
    const textProvider = new MockTextModelProvider();
    const imageProvider = new MockImageGenerationProvider();

    await expect(
      textProvider.generateStructured({
        task: "test",
        schemaName: "Example",
        prompt: "hello"
      })
    ).resolves.toMatchObject({ task: "test", schemaName: "Example", prompt: "hello" });
    await expect(
      imageProvider.generateImage({
        prompt: "夜晚实验室",
        width: 1280,
        height: 720,
        seed: 42
      })
    ).resolves.toEqual({
      assetUrl: "mock://%E5%A4%9C%E6%99%9A%E5%AE%9E%E9%AA%8C%E5%AE%A4-1280x720.svg",
      seed: 42
    });
  });
});

describe("codex image2 asset manifest", () => {
  it("creates prompts and can apply generated asset paths back to a project", () => {
    const project = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    const manifest = createCodexImage2Manifest(project, {
      assetDir: "assets/generated",
      stylePrompt: "moody galgame test style",
      extension: "webp"
    });
    const generatedProject = applyGeneratedAssetManifest(project, manifest);

    expect(manifest.provider).toBe("codex-image2");
    expect(manifest.assets.some((asset) => asset.assetId === "bg_lab_night")).toBe(true);
    expect(manifest.assets.some((asset) => asset.assetId === "sprite_lin_xue")).toBe(true);
    expect(manifest.assets.some((asset) => asset.assetId === "cg_phone_screen")).toBe(true);
    expect(manifest.assets.every((asset) => asset.prompt.includes("moody galgame test style"))).toBe(true);
    expect(manifest.assets.every((asset) => asset.outputPath.endsWith(".webp"))).toBe(true);
    expect(generatedProject.assets.items.every((asset) => !asset.placeholder)).toBe(true);
    expect(generatedProject.assets.items.find((asset) => asset.id === "bg_lab_night")?.src).toBe("assets/generated/bg_lab_night.webp");
  });
});
