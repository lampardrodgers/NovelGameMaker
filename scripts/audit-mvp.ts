import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  renderDisplayText,
  resolveBeats,
  sampleNovelText,
  validateProject,
  type VNProject
} from "@agentic-galgame/vn-core";
import { createProjectFromNovel, LocalHeuristicVNAgentWorkflow } from "@agentic-galgame/vn-agent";

const rootDir = resolve(import.meta.dirname, "..");
const checks: string[] = [];

interface Image2Manifest {
  provider?: string;
  assets?: Array<{
    assetId?: string;
    prompt?: string;
    outputPath?: string;
  }>;
}

function pass(label: string): void {
  checks.push(`PASS ${label}`);
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) {
    throw new Error(`MVP audit failed: ${label}`);
  }
  pass(label);
}

async function assertFile(path: string, label: string): Promise<void> {
  await access(resolve(rootDir, path));
  pass(label);
}

const generated = createProjectFromNovel({
  title: "实验室里的蓝光",
  novelText: sampleNovelText
});
const unknownSpeakerProject = createProjectFromNovel({
  title: "雨夜",
  novelText: "第一章 雨夜\n\n“有人在吗？”"
});
const validation = validateProject(generated);
const compiled = resolveBeats(generated);
const unknownCompiled = resolveBeats(unknownSpeakerProject);
const workflowProject = await new LocalHeuristicVNAgentWorkflow().run({
  title: "实验室里的蓝光",
  novelText: sampleNovelText
});

assert(validation.valid, "generated sample project is valid");
assert(generated.chapters.length > 0, "sample has chapters");
assert(generated.chapters.some((chapter) => chapter.scenes.length > 0), "sample has scenes");
assert(compiled.length > 1, "sample has multiple compiled beats");
assert(generated.characters.some((character) => character.name === "林雪"), "sample includes 林雪 character");
assert(generated.characters.some((character) => character.id === "unknown_speaker"), "sample includes stable unknown_speaker character");
assert(generated.assets.items.some((asset) => asset.id === "bg_lab_night"), "sample includes lab background asset");
assert(generated.assets.items.some((asset) => asset.id === "sprite_lin_xue"), "sample includes 林雪 sprite asset");
assert(generated.assets.items.some((asset) => asset.id === "sprite_unknown"), "sample includes unknown sprite placeholder");
assert(generated.assets.items.some((asset) => asset.id === "cg_phone_screen"), "sample includes phone CG asset");
assert(compiled.some((beat) => beat.resolvedStage.renderMode === "cg"), "sample has at least one CG beat");
assert(
  compiled.filter((beat) => beat.resolvedStage.backgroundId === "bg_lab_night").length >= 2,
  "lab background is reused across multiple beats"
);
assert(
  compiled.some((beat) =>
    beat.resolvedStage.characters.some(
      (character) => character.characterId === "lin_xue" && character.focus === "active"
    )
  ),
  "林雪 becomes active while speaking"
);
assert(
  compiled.some((beat) =>
    beat.line.kind === "narration" &&
    beat.resolvedStage.characters.some(
      (character) => character.characterId === "lin_xue" && character.focus === "normal"
    )
  ),
  "林雪 is normal during narration"
);
assert(
  generated.chapters.every((chapter) =>
    chapter.scenes.every((scene) =>
      scene.shots.every((shot) =>
        shot.beats.every((beat) => beat.line.text.length <= generated.ui.maxCjkCharsPerBeat)
      )
    )
  ),
  "all generated beat text fits maxCjkCharsPerBeat"
);

const dialogueBeat = compiled.find((beat) => beat.line.kind === "dialogue");
assert(dialogueBeat, "sample has a dialogue beat");
assert(!dialogueBeat.line.text.includes("「") && !dialogueBeat.line.text.includes("」"), "raw dialogue text stores no brackets");
assert(renderDisplayText(dialogueBeat.line, generated.characters, generated.ui).text.startsWith("「"), "runtime display adds opening bracket");
assert(
  unknownCompiled[0]?.line.speakerId === "unknown_speaker" &&
    unknownCompiled[0]?.displayText.speakerName === "未知说话人",
  "unattributed quoted dialogue uses unknown_speaker"
);
assert(
  unknownCompiled[0]?.resolvedStage.characters.some((character) => character.characterId === "unknown_speaker"),
  "unknown_speaker can be placed on stage"
);
assert(validateProject(workflowProject).valid, "LocalHeuristicVNAgentWorkflow returns a valid project");

await assertFile("README.md", "README exists");
await assertFile("docs/ARCHITECTURE.md", "ARCHITECTURE exists");
await assertFile("docs/CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md", "CODEX_GOAL doc exists in docs");
await assertFile("docs/TASKLOG.md", "TASKLOG exists");
await assertFile("docs/IMAGE_GENERATION.md", "IMAGE_GENERATION exists");
await assertFile("dist/playable-sample/index.html", "exported playable index.html exists");
await assertFile("dist/playable-sample/project.vn.json", "exported project.vn.json exists");
await assertFile("dist/playable-sample/assets/bg_lab_night.svg", "exported lab background SVG exists");
await assertFile("dist/playable-sample/assets/sprite_lin_xue.svg", "exported 林雪 sprite SVG exists");
await assertFile("dist/playable-sample/assets/sprite_unknown.svg", "exported unknown sprite SVG exists");
await assertFile("dist/playable-sample/assets/cg_phone_screen.svg", "exported phone CG SVG exists");
await assertFile("dist/image2-assets-manifest.json", "image2 manifest exists");

const exportedProject = JSON.parse(
  await readFile(resolve(rootDir, "dist/playable-sample/project.vn.json"), "utf-8")
) as VNProject;
assert(validateProject(exportedProject).valid, "exported project JSON is valid");

const html = await readFile(resolve(rootDir, "dist/playable-sample/index.html"), "utf-8");
assert(html.includes("fetch(\"./project.vn.json\")"), "exported HTML loads project.vn.json");
assert(html.includes("function resolveBeats"), "exported HTML contains playable runtime logic");
assert(html.includes("if (shot.initialStage)"), "exported HTML honors shot.initialStage");
assert(html.includes("ArrowLeft") && html.includes("ArrowRight"), "exported HTML supports keyboard navigation");
assert(
  html.includes(".stage{position:relative;width:min(100vw,calc(100vh * 16 / 9))"),
  "exported HTML keeps a fullscreen 16:9 stage"
);
assert(
  html.includes('<button id="save">存档</button>') &&
    html.includes('<button id="load">读档</button>') &&
    html.includes('<button id="fullscreen">全屏</button>'),
  "exported HTML exposes player save/load/fullscreen controls"
);

const image2Manifest = JSON.parse(
  await readFile(resolve(rootDir, "dist/image2-assets-manifest.json"), "utf-8")
) as Image2Manifest;
assert(image2Manifest.provider === "codex-image2", "image2 manifest uses codex-image2 provider");
assert(Array.isArray(image2Manifest.assets) && image2Manifest.assets.length > 0, "image2 manifest has asset prompts");
assert(
  image2Manifest.assets.some((asset) => asset.assetId === "cg_phone_screen" && asset.prompt),
  "image2 manifest includes phone CG prompt"
);

const packageFiles = [
  "packages/vn-core/dist/__tests__",
  "packages/vn-agent/dist/__tests__",
  "packages/vn-runtime/dist/__tests__",
  "packages/vn-exporter/dist/__tests__"
];
for (const file of packageFiles) {
  try {
    await access(resolve(rootDir, file));
    throw new Error(`MVP audit failed: ${file} should not be emitted in package dist`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("MVP audit failed")) {
      throw error;
    }
  }
}
pass("package dist folders do not include test output");

console.log(checks.join("\n"));
