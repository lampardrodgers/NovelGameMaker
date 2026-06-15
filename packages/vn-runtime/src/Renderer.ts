import type { CompiledBeat, VNProject } from "@agentic-galgame/vn-core";

export interface VNRuntimeControls {
  next(): void;
  previous(): void;
}

export interface VNRenderer {
  render(beat: CompiledBeat, project: VNProject): void;
  bindControls?(controls: VNRuntimeControls): void;
  destroy?(): void;
}
