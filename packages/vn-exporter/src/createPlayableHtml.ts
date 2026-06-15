import type { VNProject } from "@agentic-galgame/vn-core";

export function createPlayableHtml(project: VNProject, runtimeBundle?: string): string {
  if (runtimeBundle) {
    return createHtmlShell(project.title, runtimeBundle);
  }

  return createHtmlShell(project.title, DEFAULT_RUNTIME_SCRIPT);
}

function createHtmlShell(title: string, script: string): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    body{margin:0;background:#07080d;color:#f8fbff;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif}
    .page{width:100vw;height:100vh;display:grid;place-items:center;overflow:hidden;background:#07080d}
    .stage{position:relative;width:min(100vw,calc(100vh * 16 / 9));height:min(100vh,calc(100vw * 9 / 16));aspect-ratio:16/9;overflow:hidden;background:#10131d}
    .bg,.cg,.chars,.fx{position:absolute;inset:0}
    .bg{background-size:cover;background-position:center}
    .cg img{width:100%;height:100%;object-fit:cover;display:block}
    .char{position:absolute;bottom:13%;width:26%;max-height:76%;object-fit:contain;transform:translateX(-50%);transition:filter .16s ease,opacity .16s ease}
    .position-farLeft{left:12%}.position-left{left:28%}.position-center{left:50%}.position-right{left:72%}.position-farRight{left:88%}
    .focus-active{filter:brightness(1) saturate(1);opacity:1}
    .focus-dimmed{filter:brightness(.55) saturate(.65);opacity:.78}
    .focus-normal{filter:brightness(.85) saturate(.9);opacity:.92}
    .textbox{position:absolute;z-index:5;left:5%;right:5%;bottom:5%;min-height:24%;padding:22px 28px;border:1px solid rgba(255,255,255,.26);background:rgba(8,12,22,.84);box-shadow:0 18px 48px rgba(0,0,0,.35)}
    .speaker{margin-bottom:10px;color:#9bd3ff;font-size:clamp(14px,1.7vw,20px);font-weight:700;line-height:1.2}
    .line{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:clamp(18px,2.1vw,28px);line-height:1.55;letter-spacing:0}
    .controls{position:absolute;z-index:6;right:5%;top:5%;display:flex;max-width:90%;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.18);background:rgba(2,5,12,.58);box-shadow:0 12px 36px rgba(0,0,0,.28);backdrop-filter:blur(12px);opacity:.78;transition:opacity .14s ease,background-color .14s ease}
    .controls:hover,.controls:focus-within{background:rgba(2,5,12,.78);opacity:1}
    button{min-width:60px;min-height:34px;padding:0 12px;border:1px solid rgba(255,255,255,.24);border-radius:4px;background:rgba(9,13,24,.66);color:#f8fbff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}
    button:hover{border-color:rgba(155,211,255,.72);background:rgba(35,51,84,.9)}
    .toast{position:absolute;z-index:7;right:5%;top:calc(5% + 58px);max-width:50%;padding:8px 12px;border:1px solid rgba(255,255,255,.2);background:rgba(2,5,12,.76);color:#dce7f7;font-size:13px;opacity:0;pointer-events:none;transition:opacity .14s ease}
    .toast.is-visible{opacity:1}
    @media (max-width: 760px){
      .stage{width:100vw;height:calc(100vw * 9 / 16);max-height:100vh}
      .char{width:34%;bottom:15%}
      .textbox{left:3%;right:3%;bottom:3%;min-height:28%;padding:16px 18px}
      .controls{right:3%;top:3%;gap:6px;padding:6px}
      button{min-width:48px;min-height:32px;padding:0 7px;font-size:11px}
      .toast{right:3%;top:calc(3% + 52px);max-width:70%}
    }
  </style>
</head>
<body>
  <main class="page">
    <section id="stage" class="stage"></section>
  </main>
  <script>${script}</script>
</body>
</html>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const DEFAULT_RUNTIME_SCRIPT = `
const state = { project: null, beats: [], index: 0 };
const stageEl = document.getElementById("stage");

fetch("./project.vn.json")
  .then((response) => {
    if (!response.ok) throw new Error("Failed to load project.vn.json");
    return response.json();
  })
  .then((project) => {
    state.project = project;
    state.beats = resolveBeats(project);
    state.index = startIndex(project, state.beats);
    render();
  })
  .catch((error) => {
    stageEl.innerHTML = '<div class="textbox"><div class="line">' + escapeHtml(error.message) + '</div></div>';
  });

function resolveBeats(project) {
  const beats = [];
  let stage = { renderMode: "stage", characters: [] };
  for (const chapter of project.chapters) {
    for (const scene of chapter.scenes) {
      for (const shot of scene.shots) {
        if (shot.initialStage) {
          stage = cloneStage(shot.initialStage);
        }
        for (const beat of shot.beats) {
          stage = applyStagePatch(stage, beat.stagePatch || {});
          stage = applySpeakerFocus(stage, beat.line);
          beats.push({
            index: beats.length,
            beatId: beat.id,
            line: beat.line,
            resolvedStage: cloneStage(stage),
            displayText: renderDisplayText(project, beat.line)
          });
        }
      }
    }
  }
  return beats;
}

function applyStagePatch(current, patch) {
  const next = {
    ...current,
    renderMode: patch.renderMode || current.renderMode,
    backgroundId: patch.backgroundId || current.backgroundId,
    cgAssetId: patch.cgAssetId || current.cgAssetId,
    characters: current.characters.map((character) => ({ ...character }))
  };
  for (const characterPatch of patch.characters || []) {
    const index = next.characters.findIndex((character) => character.characterId === characterPatch.characterId);
    if (index >= 0) {
      next.characters[index] = { ...next.characters[index], ...characterPatch };
    } else {
      next.characters.push({
        characterId: characterPatch.characterId,
        spriteId: characterPatch.spriteId,
        expression: characterPatch.expression,
        position: characterPatch.position || "center",
        visible: characterPatch.visible ?? true,
        focus: characterPatch.focus || "normal",
        scale: characterPatch.scale
      });
    }
  }
  return next;
}

function applySpeakerFocus(stage, line) {
  if (line.kind === "narration" || !line.speakerId) {
    return { ...stage, characters: stage.characters.map((character) => ({ ...character, focus: character.visible ? "normal" : character.focus })) };
  }
  return {
    ...stage,
    characters: stage.characters.map((character) => ({
      ...character,
      focus: !character.visible ? character.focus : character.characterId === line.speakerId ? "active" : "dimmed"
    }))
  };
}

function renderDisplayText(project, line) {
  if (line.kind === "narration") return { text: line.text };
  const character = project.characters.find((item) => item.id === line.speakerId);
  return {
    speakerName: line.speakerName || (character && character.name),
    text: "「" + line.text + "」"
  };
}

function cloneStage(stage) {
  return { ...stage, characters: stage.characters.map((character) => ({ ...character })) };
}

function render() {
  const beat = state.beats[state.index];
  if (!beat || !state.project) return;
  const visual = beat.resolvedStage.renderMode === "cg" ? renderCg(beat) : renderStage(beat);
  const speaker = beat.displayText.speakerName ? '<div class="speaker">' + escapeHtml(beat.displayText.speakerName) + '</div>' : "";
  stageEl.innerHTML = visual + '<div class="fx"></div><div class="controls"><button id="prev">上一段</button><button id="next">下一段</button><button id="save">存档</button><button id="load">读档</button><button id="fullscreen">全屏</button></div><div id="toast" class="toast" aria-live="polite"></div><div class="textbox">' + speaker + '<div class="line">' + escapeHtml(beat.displayText.text) + '</div></div>';
  document.getElementById("prev").addEventListener("click", (event) => { event.stopPropagation(); previous(); });
  document.getElementById("next").addEventListener("click", (event) => { event.stopPropagation(); next(); });
  document.getElementById("save").addEventListener("click", (event) => { event.stopPropagation(); save(); });
  document.getElementById("load").addEventListener("click", (event) => { event.stopPropagation(); load(); });
  document.getElementById("fullscreen").addEventListener("click", (event) => { event.stopPropagation(); toggleFullscreen(); });
  updateFullscreenButton();
}

function renderStage(beat) {
  const background = assetUrl(beat.resolvedStage.backgroundId);
  const characters = beat.resolvedStage.characters
    .filter((character) => character.visible)
    .map((character) => '<img class="char position-' + escapeAttribute(character.position) + ' focus-' + escapeAttribute(character.focus) + '" src="' + escapeAttribute(assetUrl(character.spriteId)) + '" alt="' + escapeAttribute(characterName(character.characterId)) + '"/>')
    .join("");
  return '<div class="bg" style="background-image:url(\\'' + escapeAttribute(background) + '\\')"></div><div class="chars">' + characters + '</div>';
}

function renderCg(beat) {
  return '<div class="cg"><img src="' + escapeAttribute(assetUrl(beat.resolvedStage.cgAssetId)) + '" alt="CG"/></div>';
}

function assetUrl(id) {
  const asset = state.project.assets.items.find((item) => item.id === id);
  return asset ? asset.src : "";
}

function characterName(id) {
  const character = state.project.characters.find((item) => item.id === id);
  return character ? character.name : id;
}

function next() {
  state.index = Math.min(state.index + 1, state.beats.length - 1);
  render();
}

function previous() {
  state.index = Math.max(state.index - 1, 0);
  render();
}

function startIndex(project, beats) {
  if (!project.startBeatId) return 0;
  const index = beats.findIndex((beat) => beat.beatId === project.startBeatId);
  return index >= 0 ? index : 0;
}

function save() {
  const beat = state.beats[state.index];
  localStorage.setItem(saveKey(), JSON.stringify({
    projectId: state.project.id,
    projectVersion: state.project.version,
    beatId: beat.beatId,
    beatIndex: state.index,
    createdAt: new Date().toISOString()
  }));
  showToast("已存档");
}

function load() {
  const raw = localStorage.getItem(saveKey());
  if (!raw) {
    showToast("没有存档");
    return;
  }
  try {
    const data = JSON.parse(raw);
    if (data.projectId !== state.project.id) {
      showToast("存档不属于当前项目");
      return;
    }
    const index = data.beatId
      ? state.beats.findIndex((beat) => beat.beatId === data.beatId)
      : Number(data.beatIndex);
    if (Number.isFinite(index) && index >= 0) {
      state.index = Math.min(index, state.beats.length - 1);
      render();
      showToast("已读档");
    }
  } catch {}
}

function saveKey() {
  return "agentic-galgame:player-save:" + state.project.id;
}

stageEl.addEventListener("click", next);
document.addEventListener("fullscreenchange", updateFullscreenButton);
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") previous();
  if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") next();
});

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
    updateFullscreenButton();
  } catch {
    showToast("当前浏览器不支持全屏");
  }
}

function updateFullscreenButton() {
  const button = document.getElementById("fullscreen");
  if (button) button.textContent = document.fullscreenElement ? "退出全屏" : "全屏";
}

let toastTimer;
function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 1600);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/\\\`/g, "&#96;");
}
`;
