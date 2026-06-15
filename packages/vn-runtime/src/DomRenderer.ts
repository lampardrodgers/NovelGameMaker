import type {
  CharacterFocus,
  CompiledBeat,
  StageCharacter,
  VNAsset,
  VNProject
} from "@novel-game-maker/vn-core";
import type { VNRenderer, VNRuntimeControls } from "./Renderer.js";
import { formatTextboxText } from "./TextboxController.js";

export interface DomVNRendererOptions {
  mount: HTMLElement;
  assetBasePath?: string;
  preferProjectAssetSrc?: boolean;
}

export class DomVNRenderer implements VNRenderer {
  private readonly mount: HTMLElement;
  private readonly assetBasePath: string;
  private readonly preferProjectAssetSrc: boolean;
  private controls?: VNRuntimeControls;
  private keydownHandler?: (event: KeyboardEvent) => void;
  private clickHandler?: (event: MouseEvent) => void;

  constructor(options: DomVNRendererOptions) {
    this.mount = options.mount;
    this.assetBasePath = options.assetBasePath ?? "";
    this.preferProjectAssetSrc = options.preferProjectAssetSrc ?? false;
    injectRuntimeStyles();
  }

  bindControls(controls: VNRuntimeControls): void {
    this.controls = controls;
    this.clickHandler = (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button, input, textarea, select, a")) {
        return;
      }
      controls.next();
    };
    this.keydownHandler = (event) => {
      if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
        event.preventDefault();
        controls.next();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        controls.previous();
      }
    };
    this.mount.addEventListener("click", this.clickHandler);
    window.addEventListener("keydown", this.keydownHandler);
  }

  render(beat: CompiledBeat, project: VNProject): void {
    const stage = beat.resolvedStage;
    const textbox = formatTextboxText(beat.displayText);

    this.mount.innerHTML = `
      <div class="vn-runtime" data-render-mode="${escapeAttribute(stage.renderMode)}">
        <div class="vn-stage">
          ${stage.renderMode === "cg" ? this.renderCG(beat, project) : this.renderStage(beat, project)}
          <div class="vn-effects-layer"></div>
          <div class="vn-textbox" role="status" aria-live="polite">
            ${textbox.speakerName ? `<div class="vn-speaker">${escapeHtml(textbox.speakerName)}</div>` : ""}
            <div class="vn-line">${escapeHtml(textbox.text)}</div>
          </div>
        </div>
      </div>
    `;
  }

  destroy(): void {
    if (this.clickHandler) {
      this.mount.removeEventListener("click", this.clickHandler);
    }
    if (this.keydownHandler) {
      window.removeEventListener("keydown", this.keydownHandler);
    }
    this.mount.innerHTML = "";
  }

  private renderStage(beat: CompiledBeat, project: VNProject): string {
    const background = findAsset(project, beat.resolvedStage.backgroundId);
    const backgroundUrl = background ? this.resolveAssetUrl(background) : "";
    const characters = beat.resolvedStage.characters
      .filter((character) => character.visible)
      .map((character) => this.renderCharacter(character, project))
      .join("");

    return `
      <div class="vn-background-layer" style="background-image: url('${escapeAttribute(backgroundUrl)}')"></div>
      <div class="vn-character-layer">${characters}</div>
    `;
  }

  private renderCG(beat: CompiledBeat, project: VNProject): string {
    const cg = findAsset(project, beat.resolvedStage.cgAssetId);
    const cgUrl = cg ? this.resolveAssetUrl(cg) : "";

    return `
      <div class="vn-cg-layer">
        <img class="vn-cg-image" src="${escapeAttribute(cgUrl)}" alt="${escapeAttribute(cg?.name ?? "CG")}" />
      </div>
    `;
  }

  private renderCharacter(character: StageCharacter, project: VNProject): string {
    const asset = findAsset(project, character.spriteId);
    const characterName =
      project.characters.find((item) => item.id === character.characterId)?.name ?? character.characterId;
    const src = asset ? this.resolveAssetUrl(asset) : createPlaceholderDataUrl("characterSprite", characterName);
    const focusClass = focusToClass(character.focus);
    return `
      <img
        class="vn-character ${focusClass} position-${escapeAttribute(character.position)}"
        src="${escapeAttribute(src)}"
        alt="${escapeAttribute(characterName)}"
        style="${character.scale ? `--character-scale: ${character.scale};` : ""}"
      />
    `;
  }

  private resolveAssetUrl(asset: VNAsset): string {
    if (asset.placeholder && !this.preferProjectAssetSrc) {
      return createPlaceholderDataUrl(asset.type, asset.name);
    }
    if (/^(data:|https?:|\/)/.test(asset.src)) {
      return asset.src;
    }
    return `${this.assetBasePath}${asset.src}`;
  }
}

function findAsset(project: VNProject, id: string | undefined): VNAsset | undefined {
  return id ? project.assets.items.find((asset) => asset.id === id) : undefined;
}

function focusToClass(focus: CharacterFocus): string {
  return `focus-${focus}`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(input: string): string {
  return escapeHtml(input).replace(/`/g, "&#96;");
}

function createPlaceholderDataUrl(type: VNAsset["type"], title: string): string {
  const colors = getPlaceholderColors(type);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${colors[0]}"/>
          <stop offset="1" stop-color="${colors[1]}"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#g)"/>
      <text x="640" y="360" text-anchor="middle" dominant-baseline="middle" fill="#f8fbff" font-family="Arial, sans-serif" font-size="48" font-weight="700">${escapeHtml(title)}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function getPlaceholderColors(type: VNAsset["type"]): readonly [string, string] {
  if (type === "cg") {
    return ["#232946", "#b9386d"];
  }
  if (type === "characterSprite") {
    return ["#334155", "#64748b"];
  }
  return ["#122033", "#31506f"];
}

let stylesInjected = false;

function injectRuntimeStyles(): void {
  if (stylesInjected || typeof document === "undefined") {
    return;
  }
  const style = document.createElement("style");
  style.dataset.vnRuntime = "true";
  style.textContent = `
    .vn-runtime {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: #05070d;
      color: #f8fbff;
      font-family: "Noto Sans SC", "Microsoft YaHei", Arial, sans-serif;
    }

    .vn-stage {
      position: relative;
      width: 100%;
      max-width: min(100%, calc(100vh * 16 / 9));
      aspect-ratio: 16 / 9;
      overflow: hidden;
      background: #0d1320;
      box-shadow: 0 18px 70px rgba(0, 0, 0, 0.35);
    }

    .vn-background-layer,
    .vn-cg-layer,
    .vn-character-layer,
    .vn-effects-layer {
      position: absolute;
      inset: 0;
    }

    .vn-background-layer {
      background-size: cover;
      background-position: center;
    }

    .vn-cg-layer {
      display: grid;
      place-items: center;
      background: #060812;
    }

    .vn-cg-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .vn-character-layer {
      pointer-events: none;
    }

    .vn-character {
      position: absolute;
      bottom: 13%;
      width: 26%;
      max-height: 76%;
      object-fit: contain;
      transform: translateX(-50%) scale(var(--character-scale, 1));
      transform-origin: bottom center;
      transition: filter 160ms ease, opacity 160ms ease;
    }

    .vn-character.position-left {
      left: 28%;
    }

    .vn-character.position-farLeft {
      left: 12%;
    }

    .vn-character.position-center {
      left: 50%;
    }

    .vn-character.position-right {
      left: 72%;
    }

    .vn-character.position-farRight {
      left: 88%;
    }

    .vn-character.focus-active {
      filter: brightness(1) saturate(1);
      opacity: 1;
    }

    .vn-character.focus-dimmed {
      filter: brightness(0.55) saturate(0.65);
      opacity: 0.78;
    }

    .vn-character.focus-normal {
      filter: brightness(0.85) saturate(0.9);
      opacity: 0.92;
    }

    .vn-textbox {
      position: absolute;
      left: 5%;
      right: 5%;
      bottom: 5%;
      min-height: 24%;
      padding: 22px 28px;
      border: 1px solid rgba(255, 255, 255, 0.26);
      background: rgba(8, 12, 22, 0.82);
      color: #f8fbff;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18), 0 18px 48px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(10px);
    }

    .vn-speaker {
      margin-bottom: 10px;
      color: #9bd3ff;
      font-size: clamp(14px, 1.7vw, 20px);
      font-weight: 700;
      line-height: 1.2;
    }

    .vn-line {
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      font-size: clamp(18px, 2.1vw, 28px);
      line-height: 1.55;
      letter-spacing: 0;
    }
  `;
  document.head.appendChild(style);
  stylesInjected = true;
}
