// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { createSampleProject, type CompiledBeat, type VNProject } from "@agentic-galgame/vn-core";
import { MemorySaveStorage, SaveManager, VNRuntime, type VNRenderer } from "../index";
import { DomVNRenderer } from "../DomRenderer";

class FakeRenderer implements VNRenderer {
  rendered: CompiledBeat[] = [];

  render(beat: CompiledBeat, _project: VNProject): void {
    this.rendered.push(beat);
  }
}

describe("VNRuntime", () => {
  it("renders current beat and supports next, previous, and goToBeat", () => {
    const renderer = new FakeRenderer();
    const runtime = new VNRuntime({
      project: createSampleProject(),
      renderer
    });

    expect(runtime.getCurrentIndex()).toBe(0);
    expect(renderer.rendered[0]?.displayText.text).toBe("实验室里只剩下显示器的蓝光。");

    runtime.next();
    expect(runtime.getCurrentIndex()).toBe(1);
    expect(runtime.current().displayText).toEqual({
      speakerName: "林雪",
      text: "「你听见了吗？」"
    });

    runtime.previous();
    expect(runtime.getCurrentIndex()).toBe(0);

    runtime.goToBeat("beat_3");
    expect(runtime.current().resolvedStage.renderMode).toBe("cg");
    expect(runtime.current().resolvedStage.cgAssetId).toBe("cg_phone_screen");
    expect(runtime.getState()).toEqual({
      projectId: "sample-steins-like-lab",
      projectVersion: "0.1.0",
      beatId: "beat_3",
      beatIndex: 2,
      beatCount: 3
    });
  });

  it("saves and loads beat id by project id", () => {
    const storage = new MemorySaveStorage();
    const saveManager = new SaveManager({ storage });
    const runtime = new VNRuntime({
      project: createSampleProject(),
      renderer: new FakeRenderer(),
      saveManager
    });

    runtime.goToBeat("beat_3");
    runtime.save("slot_1");
    runtime.goToBeat(0);

    const loaded = runtime.load("slot_1");
    expect(loaded?.index).toBe(2);
    expect(saveManager.load("slot_1")?.beatId).toBe("beat_3");
    expect(runtime.getCurrentIndex()).toBe(2);
  });
});

describe("DomVNRenderer", () => {
  it("renders stage/cg modes and wires click/keyboard controls", () => {
    const mount = document.createElement("div");
    document.body.appendChild(mount);

    const runtime = new VNRuntime({
      project: createSampleProject(),
      renderer: new DomVNRenderer({ mount })
    });

    expect(mount.querySelector(".vn-runtime")?.getAttribute("data-render-mode")).toBe("stage");
    expect(mount.querySelector(".vn-line")?.textContent).toBe("实验室里只剩下显示器的蓝光。");
    expect(mount.querySelector(".vn-character.focus-normal")).not.toBeNull();

    mount.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(runtime.getCurrentIndex()).toBe(1);
    expect(mount.querySelector(".vn-speaker")?.textContent).toBe("林雪");
    expect(mount.querySelector(".vn-line")?.textContent).toBe("「你听见了吗？」");
    expect(mount.querySelector(".vn-character.focus-active")).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(runtime.getCurrentIndex()).toBe(2);
    expect(mount.querySelector(".vn-runtime")?.getAttribute("data-render-mode")).toBe("cg");
    expect(mount.querySelector(".vn-cg-image")).not.toBeNull();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    expect(runtime.getCurrentIndex()).toBe(1);

    runtime.destroy();
    mount.remove();
  });
});
