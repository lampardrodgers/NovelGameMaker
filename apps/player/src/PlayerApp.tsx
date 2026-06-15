import { useEffect, useMemo, useRef, useState } from "react";
import type { CompiledBeat, VNProject } from "@novel-game-maker/vn-core";
import { DomVNRenderer, loadProjectFromUrl, VNRuntime } from "@novel-game-maker/vn-runtime";

const defaultProjectUrl = "/project.vn.json";

interface PlayerState {
  project?: VNProject;
  beat?: CompiledBeat;
  error?: string;
  status: "loading" | "ready" | "error";
}

export function PlayerApp(): JSX.Element {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<VNRuntime | null>(null);
  const projectUrl = useMemo(() => readProjectUrl(), []);
  const [state, setState] = useState<PlayerState>({ status: "loading" });
  const [message, setMessage] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadProjectFromUrl(projectUrl)
      .then((project) => {
        if (cancelled) {
          return;
        }
        setState({ status: "ready", project });
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setState({
          status: "error",
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return () => {
      cancelled = true;
    };
  }, [projectUrl]);

  useEffect(() => {
    if (!state.project || !mountRef.current) {
      return undefined;
    }
    const renderer = new DomVNRenderer({
      mount: mountRef.current,
      assetBasePath: assetBasePathFromProjectUrl(projectUrl),
      preferProjectAssetSrc: true
    });
    const runtime = new VNRuntime({
      project: state.project,
      renderer,
      onBeatChange: (beat) => {
        setState((current) => ({ ...current, beat }));
        setMessage("");
      }
    });
    runtimeRef.current = runtime;
    setState((current) => ({ ...current, beat: runtime.current() }));

    return () => {
      runtime.destroy();
      runtimeRef.current = null;
    };
  }, [state.project, projectUrl]);

  useEffect(() => {
    const updateFullscreenState = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", updateFullscreenState);
    updateFullscreenState();
    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
    };
  }, []);

  const beatIndex = state.beat?.index ?? 0;
  const beatCount = runtimeRef.current?.compiledBeats.length ?? 0;

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      await document.documentElement.requestFullscreen();
    } catch {
      setMessage("当前浏览器不支持全屏");
    }
  };

  return (
    <main className="player-shell">
      {state.status === "loading" ? (
        <div className="player-state" role="status">加载中</div>
      ) : null}
      {state.status === "error" ? (
        <div className="player-state player-state-error" role="alert">{state.error}</div>
      ) : null}
      <section className="player-stage" aria-label="视觉小说播放器">
        <div className="player-runtime" ref={mountRef} />
      </section>
      <nav className="player-controls" aria-label="播放控制">
        <button type="button" onClick={() => runtimeRef.current?.previous()}>上一段</button>
        <span className="player-counter">{beatCount > 0 ? `${beatIndex + 1} / ${beatCount}` : "0 / 0"}</span>
        <button type="button" onClick={() => runtimeRef.current?.next()}>下一段</button>
        <button type="button" onClick={() => {
          runtimeRef.current?.save("player");
          setMessage("已存档");
        }}>存档</button>
        <button type="button" onClick={() => {
          const beat = runtimeRef.current?.load("player");
          setMessage(beat ? "已读档" : "没有存档");
        }}>读档</button>
        <button type="button" onClick={() => void toggleFullscreen()}>
          {isFullscreen ? "退出全屏" : "全屏"}
        </button>
      </nav>
      {message ? <div className="player-toast" role="status">{message}</div> : null}
    </main>
  );
}

function readProjectUrl(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("projectUrl") || defaultProjectUrl;
}

function assetBasePathFromProjectUrl(projectUrl: string): string {
  return new URL("./", new URL(projectUrl, window.location.href)).toString();
}
