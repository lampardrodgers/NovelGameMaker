import type { CompiledBeat, VNProject } from "@agentic-galgame/vn-core";

export function downloadJson(filename: string, data: unknown): void {
  downloadFile(filename, JSON.stringify(data, null, 2), "application/json;charset=utf-8");
}

export function downloadStaticPlayable(project: VNProject, compiledBeats: CompiledBeat[]): void {
  downloadFile(
    `${safeFilename(project.title)}.playable.html`,
    createStaticPlayableHtml(project, compiledBeats),
    "text/html;charset=utf-8"
  );
}

function downloadFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function createStaticPlayableHtml(project: VNProject, compiledBeats: CompiledBeat[]): string {
  const data = JSON.stringify({ project, compiledBeats }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(project.title)}</title>
  <style>
    *{box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden}body{margin:0;background:#080910;color:#f8fbff;font-family:"Noto Sans SC","Microsoft YaHei",Arial,sans-serif}.player{width:100vw;height:100vh;display:grid;place-items:center;overflow:hidden}.stage{position:relative;width:min(100vw,calc(100vh * 16 / 9));height:min(100vh,calc(100vw * 9 / 16));aspect-ratio:16/9;overflow:hidden;background:#10131d}.bg,.cg,.chars{position:absolute;inset:0}.bg{background-size:cover;background-position:center}.cg img{width:100%;height:100%;object-fit:cover;display:block}.char{position:absolute;bottom:13%;width:26%;max-height:76%;object-fit:contain;transform:translateX(-50%);transition:filter .16s ease,opacity .16s ease}.farLeft{left:12%}.left{left:28%}.center{left:50%}.right{left:72%}.farRight{left:88%}.focus-active{filter:brightness(1) saturate(1);opacity:1}.focus-dimmed{filter:brightness(.55) saturate(.65);opacity:.78}.focus-normal{filter:brightness(.85) saturate(.9);opacity:.92}.controls{position:absolute;z-index:6;right:5%;top:5%;display:flex;max-width:90%;justify-content:flex-end;flex-wrap:wrap;gap:8px;padding:8px;border:1px solid rgba(255,255,255,.18);background:rgba(2,5,12,.58);box-shadow:0 12px 36px rgba(0,0,0,.28);backdrop-filter:blur(12px);opacity:.78;transition:opacity .14s ease,background-color .14s ease}.controls:hover,.controls:focus-within{background:rgba(2,5,12,.78);opacity:1}button{min-width:60px;min-height:34px;padding:0 12px;border:1px solid rgba(255,255,255,.24);border-radius:4px;background:rgba(9,13,24,.66);color:#f8fbff;font:inherit;font-size:12px;font-weight:700;cursor:pointer}button:hover{border-color:rgba(155,211,255,.72);background:rgba(35,51,84,.9)}.toast{position:absolute;z-index:7;right:5%;top:calc(5% + 58px);max-width:50%;padding:8px 12px;border:1px solid rgba(255,255,255,.2);background:rgba(2,5,12,.76);color:#dce7f7;font-size:13px;opacity:0;pointer-events:none;transition:opacity .14s ease}.toast.is-visible{opacity:1}.textbox{position:absolute;z-index:5;left:5%;right:5%;bottom:5%;min-height:24%;padding:22px 28px;border:1px solid rgba(255,255,255,.26);background:rgba(8,12,22,.84);box-shadow:0 18px 48px rgba(0,0,0,.35)}.speaker{margin-bottom:10px;color:#9bd3ff;font-weight:700;font-size:clamp(14px,1.7vw,20px)}.line{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:clamp(18px,2.1vw,28px);line-height:1.55;letter-spacing:0}@media (max-width:760px){.stage{width:100vw;height:calc(100vw * 9 / 16);max-height:100vh}.char{width:34%;bottom:15%}.controls{right:3%;top:3%;gap:6px;padding:6px}button{min-width:48px;min-height:32px;padding:0 7px;font-size:11px}.toast{right:3%;top:calc(3% + 52px);max-width:70%}.textbox{left:3%;right:3%;bottom:3%;min-height:28%;padding:16px 18px}}
  </style>
</head>
<body>
  <div class="player"><div id="stage" class="stage"></div></div>
  <script id="vn-data" type="application/json">${data}</script>
  <script>
    const data = JSON.parse(document.getElementById("vn-data").textContent);
    const assetMap = new Map(data.project.assets.items.map((asset) => [asset.id, asset]));
    let index = startIndex();
    const stage = document.getElementById("stage");
    function assetUrl(id) {
      const asset = assetMap.get(id);
      if (!asset) return "";
      if (asset.placeholder) return placeholder(asset.type, asset.name);
      return asset.src;
    }
    function placeholder(type, title) {
      const colors = type === "cg" ? ["#232946", "#b9386d"] : type === "characterSprite" ? ["#334155", "#64748b"] : ["#122033", "#31506f"];
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="' + colors[0] + '"/><stop offset="1" stop-color="' + colors[1] + '"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="640" y="360" text-anchor="middle" dominant-baseline="middle" fill="#f8fbff" font-family="Arial,sans-serif" font-size="48" font-weight="700">' + escapeHtml(title) + '</text></svg>';
      return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    }
    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
    }
    function characterName(id) {
      const character = data.project.characters.find((item) => item.id === id);
      return character ? character.name : id;
    }
    function render() {
      const beat = data.compiledBeats[index];
      const state = beat.resolvedStage;
      const text = beat.displayText;
      const visual = state.renderMode === "cg"
        ? '<div class="cg"><img src="' + assetUrl(state.cgAssetId) + '" alt="CG"/></div>'
        : '<div class="bg" style="background-image:url(' + assetUrl(state.backgroundId) + ')"></div><div class="chars">' + state.characters.filter((character) => character.visible).map((character) => '<img class="char ' + character.position + ' focus-' + character.focus + '" src="' + assetUrl(character.spriteId) + '" alt="' + escapeHtml(characterName(character.characterId)) + '"/>').join("") + '</div>';
      stage.innerHTML = visual + '<div class="controls"><button id="prev">上一段</button><button id="next">下一段</button><button id="save">存档</button><button id="load">读档</button><button id="fullscreen">全屏</button></div><div id="toast" class="toast" aria-live="polite"></div><div class="textbox">' + (text.speakerName ? '<div class="speaker">' + escapeHtml(text.speakerName) + '</div>' : '') + '<div class="line">' + escapeHtml(text.text) + '</div></div>';
      document.getElementById("prev").addEventListener("click", (event) => { event.stopPropagation(); previous(); });
      document.getElementById("next").addEventListener("click", (event) => { event.stopPropagation(); next(); });
      document.getElementById("save").addEventListener("click", (event) => { event.stopPropagation(); save(); });
      document.getElementById("load").addEventListener("click", (event) => { event.stopPropagation(); load(); });
      document.getElementById("fullscreen").addEventListener("click", (event) => { event.stopPropagation(); toggleFullscreen(); });
      updateFullscreenButton();
    }
    function next() { index = Math.min(index + 1, data.compiledBeats.length - 1); render(); }
    function previous() { index = Math.max(index - 1, 0); render(); }
    function save() {
      const beat = data.compiledBeats[index];
      localStorage.setItem(saveKey(), JSON.stringify({
        projectId: data.project.id,
        projectVersion: data.project.version,
        beatId: beat.beatId,
        beatIndex: index,
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
        const saveData = JSON.parse(raw);
        if (saveData.projectId !== data.project.id) {
          showToast("存档不属于当前项目");
          return;
        }
        const nextIndex = saveData.beatId
          ? data.compiledBeats.findIndex((beat) => beat.beatId === saveData.beatId)
          : Number(saveData.beatIndex);
        if (Number.isFinite(nextIndex) && nextIndex >= 0) {
          index = Math.min(nextIndex, data.compiledBeats.length - 1);
          render();
          showToast("已读档");
        }
      } catch {}
    }
    function saveKey() { return "agentic-galgame:player-save:" + data.project.id; }
    function startIndex() {
      if (!data.project.startBeatId) return 0;
      const nextIndex = data.compiledBeats.findIndex((beat) => beat.beatId === data.project.startBeatId);
      return nextIndex >= 0 ? nextIndex : 0;
    }
    stage.addEventListener("click", next);
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
    render();
  </script>
</body>
</html>`;
}

function safeFilename(input: string): string {
  return input.trim().replace(/[\\/:*?"<>|]+/g, "-") || "project";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
