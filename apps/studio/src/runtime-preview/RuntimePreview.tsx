import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { CompiledBeat, VNProject } from "@novel-game-maker/vn-core";
import { DomVNRenderer, VNRuntime } from "@novel-game-maker/vn-runtime";

interface RuntimePreviewProps {
  project: VNProject;
  activeIndex: number;
  onIndexChange(index: number): void;
}

export interface RuntimePreviewHandle {
  save(slot?: string): void;
  load(slot?: string): CompiledBeat | undefined;
}

export const RuntimePreview = forwardRef<RuntimePreviewHandle, RuntimePreviewProps>(function RuntimePreview(
  { project, activeIndex, onIndexChange },
  ref
) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<VNRuntime | null>(null);

  useImperativeHandle(ref, () => ({
    save(slot = "preview") {
      runtimeRef.current?.save(slot);
    },
    load(slot = "preview") {
      return runtimeRef.current?.load(slot);
    }
  }), []);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const renderer = new DomVNRenderer({
      mount,
      preferProjectAssetSrc: true
    });
    const runtime = new VNRuntime({
      project,
      renderer,
      initialBeatIndex: activeIndex,
      onBeatChange: (beat) => onIndexChange(beat.index)
    });
    runtimeRef.current = runtime;

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, [project]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    if (!runtime || runtime.getCurrentIndex() === activeIndex) {
      return;
    }
    runtime.goToBeat(activeIndex);
  }, [activeIndex]);

  return <div className="runtime-preview" ref={mountRef} />;
});
