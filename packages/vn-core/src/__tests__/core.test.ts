import { describe, expect, it } from "vitest";
import {
  applySpeakerFocus,
  applyStagePatch,
  createDefaultUIConfig,
  createSampleProject,
  detectLineKind,
  renderDisplayText,
  resolveBeats,
  splitTextToBeats,
  validateProject,
  type StageState
} from "../index";

describe("splitTextToBeats", () => {
  it("splits long Chinese text into non-empty beats under the configured max", () => {
    const text =
      "夕阳从天台边缘落下，整座城市像被压低了声音。她站在门口，迟迟没有说话。电车的声音从远处传来，我忽然意识到一切都变了。";
    const beats = splitTextToBeats(text, {
      ...createDefaultUIConfig(),
      maxCjkCharsPerBeat: 30
    });

    expect(beats.length).toBeGreaterThan(1);
    expect(beats.every((beat) => beat.length > 0)).toBe(true);
    expect(beats.every((beat) => beat.length <= 30)).toBe(true);
    expect(beats[0]?.endsWith("。")).toBe(true);
  });

  it("handles quoted dialogue without storing empty beats", () => {
    const beats = splitTextToBeats("“你真的决定要离开这里了吗？如果是真的，我们就没有退路了。”", {
      ...createDefaultUIConfig(),
      maxCjkCharsPerBeat: 24
    });

    expect(beats.length).toBeGreaterThan(1);
    expect(beats.every((beat) => beat.trim().length > 0)).toBe(true);
    expect(beats.join("")).toContain("你真的决定要离开这里了吗？");
  });
});

describe("detectLineKind", () => {
  it("detects narration", () => {
    expect(detectLineKind("实验室里只剩下显示器的蓝光。")).toEqual({
      kind: "narration",
      text: "实验室里只剩下显示器的蓝光。"
    });
  });

  it("detects quoted dialogue", () => {
    expect(detectLineKind("“你好吗？”")).toEqual({
      kind: "dialogue",
      text: "你好吗？"
    });
    expect(detectLineKind("「你好吗？」")).toEqual({
      kind: "dialogue",
      text: "你好吗？"
    });
  });

  it("detects speaker-prefixed dialogue", () => {
    expect(detectLineKind("林雪：“你好吗？”")).toEqual({
      kind: "dialogue",
      speakerName: "林雪",
      text: "你好吗？"
    });
    expect(detectLineKind("林雪低声说：“你听见了吗？”")).toEqual({
      kind: "dialogue",
      speakerName: "林雪",
      text: "你听见了吗？"
    });
  });

  it("keeps unknown speaker names as data instead of crashing", () => {
    expect(detectLineKind("神秘人：“门已经打开了。”")).toEqual({
      kind: "dialogue",
      speakerName: "神秘人",
      text: "门已经打开了。"
    });
  });
});

describe("applyStagePatch", () => {
  it("updates stage fields and merges character patches", () => {
    const current: StageState = {
      renderMode: "stage",
      backgroundId: "bg_lab_night",
      characters: [
        {
          characterId: "lin_xue",
          spriteId: "sprite_lin_xue",
          position: "left",
          visible: true,
          focus: "normal"
        }
      ]
    };

    const next = applyStagePatch(current, {
      renderMode: "cg",
      cgAssetId: "cg_phone_screen",
      characters: [
        {
          characterId: "lin_xue",
          expression: "fear"
        },
        {
          characterId: "protagonist",
          position: "right",
          visible: true
        }
      ]
    });

    expect(next.backgroundId).toBe("bg_lab_night");
    expect(next.renderMode).toBe("cg");
    expect(next.cgAssetId).toBe("cg_phone_screen");
    expect(next.characters).toHaveLength(2);
    expect(next.characters.find((character) => character.characterId === "lin_xue")?.expression).toBe("fear");
    expect(next.characters.find((character) => character.characterId === "lin_xue")?.position).toBe("left");
    expect(next.characters.find((character) => character.characterId === "protagonist")?.focus).toBe("normal");
  });
});

describe("applySpeakerFocus", () => {
  const stage: StageState = {
    renderMode: "stage",
    characters: [
      {
        characterId: "lin_xue",
        position: "left",
        visible: true,
        focus: "normal"
      },
      {
        characterId: "protagonist",
        position: "right",
        visible: true,
        focus: "normal"
      }
    ]
  };

  it("marks the speaker active and other visible characters dimmed", () => {
    const next = applySpeakerFocus(stage, {
      kind: "dialogue",
      speakerId: "lin_xue",
      text: "你听见了吗？"
    });

    expect(next.characters[0]?.focus).toBe("active");
    expect(next.characters[1]?.focus).toBe("dimmed");
  });

  it("marks all visible characters normal for narration", () => {
    const next = applySpeakerFocus(stage, {
      kind: "narration",
      text: "窗外传来电车经过的声音。"
    });

    expect(next.characters.every((character) => character.focus === "normal")).toBe(true);
  });
});

describe("resolveBeats", () => {
  it("outputs compiled beats with accumulated stage and CG mode support", () => {
    const project = createSampleProject();
    const compiled = resolveBeats(project);

    expect(compiled).toHaveLength(3);
    expect(compiled[0]?.resolvedStage.backgroundId).toBe("bg_lab_night");
    expect(compiled[1]?.resolvedStage.characters[0]?.focus).toBe("active");
    expect(compiled[2]?.resolvedStage.renderMode).toBe("cg");
    expect(compiled[2]?.resolvedStage.cgAssetId).toBe("cg_phone_screen");
  });
});

describe("renderDisplayText", () => {
  it("renders dialogue brackets at runtime only", () => {
    const project = createSampleProject();
    const text = renderDisplayText(
      {
        kind: "dialogue",
        speakerId: "lin_xue",
        text: "你听见了吗？"
      },
      project.characters,
      project.ui
    );

    expect(text).toEqual({
      speakerName: "林雪",
      text: "「你听见了吗？」"
    });
  });

  it("renders monologue separately in data and dialogue-like in display", () => {
    const project = createSampleProject();
    const text = renderDisplayText(
      {
        kind: "monologue",
        speakerId: "lin_xue",
        text: "这不可能是真的。"
      },
      project.characters,
      project.ui
    );

    expect(text).toEqual({
      speakerName: "林雪",
      text: "「这不可能是真的。」"
    });
  });

  it("respects quote style and nameplate config", () => {
    const project = createSampleProject();
    const text = renderDisplayText(
      {
        kind: "dialogue",
        speakerId: "lin_xue",
        text: "你好吗？"
      },
      project.characters,
      {
        ...project.ui,
        quoteStyle: "cn_double",
        showNameplate: false
      }
    );

    expect(text).toEqual({
      speakerName: undefined,
      text: "“你好吗？”"
    });
  });
});

describe("validateProject", () => {
  it("validates the sample project", () => {
    const result = validateProject(createSampleProject());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
