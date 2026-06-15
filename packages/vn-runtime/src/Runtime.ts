import {
  resolveBeats,
  validateProject,
  type CompiledBeat,
  type VNProject
} from "@novel-game-maker/vn-core";
import type { VNRenderer } from "./Renderer.js";
import { SaveManager } from "./SaveManager.js";

export interface VNRuntimeOptions {
  project: VNProject;
  renderer: VNRenderer;
  saveManager?: SaveManager;
  initialBeatIndex?: number;
  onBeatChange?: (beat: CompiledBeat) => void;
}

export interface RuntimeState {
  projectId: string;
  projectVersion: string;
  beatId: string;
  beatIndex: number;
  beatCount: number;
}

export class VNRuntime {
  readonly project: VNProject;
  readonly compiledBeats: CompiledBeat[];

  private readonly renderer: VNRenderer;
  private readonly saveManager: SaveManager;
  private readonly onBeatChange?: (beat: CompiledBeat) => void;
  private beatIndex: number;

  constructor(options: VNRuntimeOptions) {
    const validation = validateProject(options.project);
    if (!validation.valid) {
      throw new Error(`Invalid VNProject: ${validation.errors.join("; ")}`);
    }

    this.project = options.project;
    this.compiledBeats = resolveBeats(options.project);
    this.renderer = options.renderer;
    this.saveManager = options.saveManager ?? new SaveManager();
    this.onBeatChange = options.onBeatChange;
    this.beatIndex = clampIndex(
      options.initialBeatIndex ?? getStartIndex(this.compiledBeats, options.project.startBeatId),
      this.compiledBeats.length
    );

    this.renderer.bindControls?.({
      next: () => this.next(),
      previous: () => this.previous()
    });
    this.render();
  }

  start(): CompiledBeat {
    return this.render();
  }

  current(): CompiledBeat {
    const beat = this.compiledBeats[this.beatIndex];
    if (!beat) {
      throw new Error("VNRuntime has no compiled beats.");
    }
    return beat;
  }

  getCurrentIndex(): number {
    return this.beatIndex;
  }

  next(): CompiledBeat {
    this.beatIndex = Math.min(this.beatIndex + 1, this.compiledBeats.length - 1);
    return this.render();
  }

  previous(): CompiledBeat {
    this.beatIndex = Math.max(this.beatIndex - 1, 0);
    return this.render();
  }

  goToBeat(beat: number | string): CompiledBeat {
    const index = typeof beat === "number" ? beat : this.findBeatIndex(beat);
    this.beatIndex = clampIndex(index, this.compiledBeats.length);
    return this.render();
  }

  getState(): RuntimeState {
    const current = this.current();
    return {
      projectId: this.project.id,
      projectVersion: this.project.version,
      beatId: current.beatId,
      beatIndex: current.index,
      beatCount: this.compiledBeats.length
    };
  }

  save(slot = "default"): void {
    const current = this.current();
    this.saveManager.save(slot, {
      projectId: this.project.id,
      projectVersion: this.project.version,
      beatId: current.beatId,
      beatIndex: this.beatIndex,
      createdAt: new Date().toISOString()
    });
  }

  load(slot = "default"): CompiledBeat | undefined {
    const data = this.saveManager.load(slot);
    if (!data || data.projectId !== this.project.id) {
      return undefined;
    }
    if (data.beatId) {
      return this.goToBeat(data.beatId);
    }
    return typeof data.beatIndex === "number" ? this.goToBeat(data.beatIndex) : undefined;
  }

  render(): CompiledBeat {
    const beat = this.current();
    this.renderer.render(beat, this.project);
    this.onBeatChange?.(beat);
    return beat;
  }

  destroy(): void {
    this.renderer.destroy?.();
  }

  private findBeatIndex(beatId: string): number {
    const index = this.compiledBeats.findIndex((beat) => beat.beatId === beatId);
    if (index === -1) {
      throw new Error(`Beat not found: ${beatId}`);
    }
    return index;
  }
}

function clampIndex(index: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  if (!Number.isFinite(index)) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(index), length - 1));
}

function getStartIndex(beats: CompiledBeat[], startBeatId: string | undefined): number {
  if (!startBeatId) {
    return 0;
  }
  const index = beats.findIndex((beat) => beat.beatId === startBeatId);
  return index >= 0 ? index : 0;
}
