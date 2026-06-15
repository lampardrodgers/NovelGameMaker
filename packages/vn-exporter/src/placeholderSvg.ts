import type { VNAsset, VNProject } from "@agentic-galgame/vn-core";

export function createPlaceholderSvg(asset: VNAsset, project: VNProject): string {
  if (asset.type === "characterSprite") {
    const characterName =
      project.characters.find((character) => character.id === asset.characterId)?.name ?? asset.name;
    return createCharacterSvg(asset.id, characterName);
  }

  if (asset.type === "cg") {
    return createCgSvg(asset.id, asset.name);
  }

  return createBackgroundSvg(asset.id, asset.name);
}

function createBackgroundSvg(id: string, title: string): string {
  if (id === "bg_lab_night") {
    return wideSvg(title, `
      <defs>
        <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#07111f"/>
          <stop offset="1" stop-color="#172c3f"/>
        </linearGradient>
        <radialGradient id="monitorGlow" cx="44%" cy="44%" r="42%">
          <stop offset="0" stop-color="#7dd8ff" stop-opacity="0.75"/>
          <stop offset="1" stop-color="#7dd8ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#sky)"/>
      <rect x="0" y="430" width="1280" height="290" fill="#11161d"/>
      <rect x="70" y="64" width="1080" height="374" fill="#0b1624" stroke="#38506a" stroke-width="4"/>
      <g opacity="0.88">
        <rect x="104" y="92" width="160" height="278" fill="#101f2d" stroke="#446680" stroke-width="3"/>
        <rect x="292" y="92" width="160" height="278" fill="#101f2d" stroke="#446680" stroke-width="3"/>
        <rect x="480" y="92" width="160" height="278" fill="#101f2d" stroke="#446680" stroke-width="3"/>
        <rect x="668" y="92" width="160" height="278" fill="#101f2d" stroke="#446680" stroke-width="3"/>
        <rect x="856" y="92" width="160" height="278" fill="#101f2d" stroke="#446680" stroke-width="3"/>
      </g>
      <rect width="1280" height="720" fill="url(#monitorGlow)"/>
      <g>
        <rect x="168" y="408" width="936" height="94" rx="8" fill="#232833"/>
        <rect x="214" y="294" width="270" height="158" rx="10" fill="#08131f" stroke="#8fe7ff" stroke-width="3"/>
        <rect x="236" y="318" width="226" height="104" fill="#12334a"/>
        <path d="M250 394 C302 350 340 422 394 354 C416 330 438 336 456 350" fill="none" stroke="#9be9ff" stroke-width="5" opacity="0.78"/>
        <rect x="544" y="316" width="148" height="126" rx="8" fill="#1a2633" stroke="#6a7f94" stroke-width="3"/>
        <rect x="730" y="332" width="212" height="106" rx="8" fill="#101b25" stroke="#4d667d" stroke-width="3"/>
        <circle cx="1014" cy="456" r="28" fill="#7bdcff" opacity="0.75"/>
      </g>
      <g opacity="0.95">
        <rect x="96" y="500" width="1090" height="20" fill="#3b4652"/>
        <rect x="140" y="520" width="28" height="154" fill="#202832"/>
        <rect x="1088" y="520" width="28" height="154" fill="#202832"/>
        <rect x="330" y="540" width="280" height="74" fill="#161d27" stroke="#465461" stroke-width="2"/>
        <rect x="760" y="540" width="220" height="74" fill="#161d27" stroke="#465461" stroke-width="2"/>
      </g>
    `);
  }

  if (id === "bg_rooftop_sunset") {
    return wideSvg(title, `
      <defs>
        <linearGradient id="sunset" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#6f7db8"/>
          <stop offset="0.52" stop-color="#f0a15f"/>
          <stop offset="1" stop-color="#3e415f"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#sunset)"/>
      <circle cx="1010" cy="180" r="92" fill="#ffd38a" opacity="0.82"/>
      <g fill="#2a3048" opacity="0.86">
        <rect x="42" y="388" width="122" height="202"/>
        <rect x="190" y="342" width="172" height="248"/>
        <rect x="400" y="380" width="136" height="210"/>
        <rect x="578" y="320" width="210" height="270"/>
        <rect x="840" y="366" width="150" height="224"/>
        <rect x="1028" y="330" width="194" height="260"/>
      </g>
      <rect x="0" y="516" width="1280" height="204" fill="#272a37"/>
      <rect x="0" y="468" width="1280" height="18" fill="#3d4051"/>
      <g stroke="#232631" stroke-width="8">
        <path d="M0 470 H1280"/>
        <path d="M80 470 V600"/>
        <path d="M230 470 V600"/>
        <path d="M380 470 V600"/>
        <path d="M530 470 V600"/>
        <path d="M680 470 V600"/>
        <path d="M830 470 V600"/>
        <path d="M980 470 V600"/>
        <path d="M1130 470 V600"/>
      </g>
      <path d="M92 620 C270 574 508 578 690 632 C832 674 1008 674 1194 612" fill="none" stroke="#4a4f63" stroke-width="6" opacity="0.55"/>
    `);
  }

  if (id === "bg_classroom_evening") {
    return wideSvg(title, `
      <defs>
        <linearGradient id="room" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#343447"/>
          <stop offset="1" stop-color="#8a5f47"/>
        </linearGradient>
        <linearGradient id="window" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#f8c887"/>
          <stop offset="1" stop-color="#855f79"/>
        </linearGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#room)"/>
      <rect x="92" y="86" width="500" height="270" fill="#202a29" stroke="#806d5f" stroke-width="8"/>
      <rect x="700" y="78" width="364" height="292" fill="url(#window)" stroke="#e2b77f" stroke-width="8"/>
      <path d="M882 82 V370 M704 224 H1062" stroke="#f2d29b" stroke-width="8"/>
      <rect x="0" y="452" width="1280" height="268" fill="#3a302b"/>
      <g fill="#5c4034" stroke="#8c6858" stroke-width="4">
        <rect x="120" y="498" width="220" height="64" rx="6"/>
        <rect x="452" y="498" width="220" height="64" rx="6"/>
        <rect x="784" y="498" width="220" height="64" rx="6"/>
        <rect x="286" y="604" width="220" height="64" rx="6"/>
        <rect x="618" y="604" width="220" height="64" rx="6"/>
        <rect x="950" y="604" width="220" height="64" rx="6"/>
      </g>
      <g stroke="#372821" stroke-width="8">
        <path d="M168 562 V688 M292 562 V688 M500 562 V704 M624 562 V704 M832 562 V704 M956 562 V704"/>
      </g>
    `);
  }

  return wideSvg(title, `
    <defs>
      <linearGradient id="defaultBg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#111827"/>
        <stop offset="1" stop-color="#334155"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#defaultBg)"/>
    <rect x="130" y="110" width="1020" height="460" fill="#1f2937" opacity="0.72"/>
    <path d="M180 570 L424 250 H856 L1100 570 Z" fill="#263244" stroke="#55657a" stroke-width="5"/>
    <path d="M498 250 V570 M640 250 V570 M782 250 V570" stroke="#506075" stroke-width="4" opacity="0.68"/>
  `);
}

function createCgSvg(id: string, title: string): string {
  if (id === "cg_phone_screen") {
    return wideSvg(title, `
      <defs>
        <radialGradient id="phoneGlow" cx="50%" cy="46%" r="50%">
          <stop offset="0" stop-color="#9deaff" stop-opacity="0.95"/>
          <stop offset="0.45" stop-color="#2b7ea6" stop-opacity="0.54"/>
          <stop offset="1" stop-color="#050812" stop-opacity="1"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="#050812"/>
      <rect width="1280" height="720" fill="url(#phoneGlow)"/>
      <path d="M0 660 C260 560 410 600 604 520 C764 452 930 486 1280 390 V720 H0 Z" fill="#080b13" opacity="0.78"/>
      <g transform="translate(520 112) rotate(-7)">
        <rect x="0" y="0" width="260" height="470" rx="34" fill="#10141b" stroke="#d5f7ff" stroke-width="8"/>
        <rect x="28" y="54" width="204" height="340" rx="18" fill="#bdf5ff"/>
        <rect x="52" y="94" width="156" height="24" rx="12" fill="#3177a1" opacity="0.72"/>
        <rect x="52" y="150" width="126" height="18" rx="9" fill="#3177a1" opacity="0.46"/>
        <rect x="52" y="194" width="168" height="18" rx="9" fill="#3177a1" opacity="0.46"/>
        <rect x="52" y="238" width="104" height="18" rx="9" fill="#3177a1" opacity="0.46"/>
        <circle cx="130" cy="426" r="16" fill="#e8fcff"/>
      </g>
      <path d="M354 602 C430 484 520 486 604 562 C514 554 438 586 392 650 Z" fill="#d5b8a8" opacity="0.9"/>
      <path d="M786 570 C890 474 982 474 1076 596 C968 570 900 584 826 660 Z" fill="#caa796" opacity="0.78"/>
      <g stroke="#9deaff" stroke-width="4" opacity="0.35">
        <path d="M306 116 L470 260"/>
        <path d="M842 132 L760 300"/>
        <path d="M306 390 L486 352"/>
        <path d="M870 422 L766 366"/>
      </g>
    `);
  }

  if (id === "cg_worldline_shift") {
    return wideSvg(title, `
      <defs>
        <linearGradient id="shift" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#12102c"/>
          <stop offset="0.5" stop-color="#234f6c"/>
          <stop offset="1" stop-color="#781d52"/>
        </linearGradient>
        <radialGradient id="core" cx="50%" cy="48%" r="42%">
          <stop offset="0" stop-color="#eaffff" stop-opacity="0.9"/>
          <stop offset="0.28" stop-color="#7ef2ff" stop-opacity="0.45"/>
          <stop offset="1" stop-color="#000000" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1280" height="720" fill="url(#shift)"/>
      <rect width="1280" height="720" fill="url(#core)"/>
      <g fill="none" stroke="#b7f8ff" opacity="0.58">
        <ellipse cx="640" cy="360" rx="440" ry="120" stroke-width="5"/>
        <ellipse cx="640" cy="360" rx="340" ry="230" stroke-width="4" transform="rotate(28 640 360)"/>
        <ellipse cx="640" cy="360" rx="360" ry="220" stroke-width="4" transform="rotate(-31 640 360)"/>
      </g>
      <g opacity="0.82">
        <path d="M0 566 C154 458 272 496 400 424 C520 356 598 392 706 298 C838 182 976 228 1280 116" fill="none" stroke="#ffe7a7" stroke-width="8"/>
        <path d="M0 608 C194 512 280 534 432 470 C556 418 688 434 820 362 C940 296 1044 294 1280 258" fill="none" stroke="#9cf4ff" stroke-width="5" opacity="0.75"/>
      </g>
      <g fill="#080b18" opacity="0.8">
        <rect x="94" y="436" width="116" height="190"/>
        <rect x="256" y="380" width="166" height="246"/>
        <rect x="824" y="400" width="136" height="226"/>
        <rect x="1000" y="342" width="198" height="284"/>
      </g>
      <circle cx="640" cy="360" r="62" fill="#eaffff" opacity="0.9"/>
      <circle cx="640" cy="360" r="18" fill="#11203a"/>
    `);
  }

  return wideSvg(title, `
    <defs>
      <radialGradient id="spot" cx="50%" cy="44%" r="58%">
        <stop offset="0" stop-color="#fff1c0" stop-opacity="0.9"/>
        <stop offset="1" stop-color="#0b1020" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#spot)"/>
    <rect x="530" y="268" width="220" height="150" rx="18" fill="#1f2937" stroke="#f8d783" stroke-width="6"/>
    <path d="M420 520 C520 446 760 446 860 520" fill="none" stroke="#f8d783" stroke-width="8" opacity="0.7"/>
  `);
}

function createCharacterSvg(id: string, name: string): string {
  const isLinXue = id === "sprite_lin_xue";
  const hair = isLinXue ? "#232232" : "#303844";
  const coat = isLinXue ? "#e7eef4" : "#2f3a48";
  const accent = isLinXue ? "#6db7d8" : "#7b8794";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="720" viewBox="0 0 512 720">
  <title>${escapeXml(name)}</title>
  <defs>
    <linearGradient id="coat" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${coat}"/>
      <stop offset="1" stop-color="#64748b"/>
    </linearGradient>
  </defs>
  <rect width="512" height="720" fill="none"/>
  <ellipse cx="256" cy="684" rx="154" ry="28" fill="#000000" opacity="0.28"/>
  <path d="M142 334 C154 252 198 214 256 214 C314 214 358 252 370 334 L408 650 L104 650 Z" fill="url(#coat)" stroke="#f8fbff" stroke-width="5"/>
  <path d="M174 372 L256 650 L338 372" fill="#1f2937" opacity="0.32"/>
  <path d="M210 394 H302" stroke="${accent}" stroke-width="12" stroke-linecap="round"/>
  <circle cx="256" cy="170" r="84" fill="#e0c1ae" stroke="#fff2e8" stroke-width="5"/>
  <path d="M146 178 C148 92 210 48 282 56 C348 64 394 116 378 204 C336 160 260 142 146 178 Z" fill="${hair}"/>
  <path d="M172 132 C178 238 146 302 118 388" fill="none" stroke="${hair}" stroke-width="34" stroke-linecap="round"/>
  <path d="M334 132 C338 244 370 304 398 390" fill="none" stroke="${hair}" stroke-width="34" stroke-linecap="round"/>
  <ellipse cx="224" cy="174" rx="9" ry="12" fill="#1b2532"/>
  <ellipse cx="290" cy="174" rx="9" ry="12" fill="#1b2532"/>
  <path d="M230 216 C246 228 272 228 288 216" fill="none" stroke="#8b5e53" stroke-width="5" stroke-linecap="round"/>
  <path d="M154 348 C124 442 122 552 148 644" fill="none" stroke="#f8fbff" stroke-width="8" opacity="0.56"/>
  <path d="M358 348 C388 442 390 552 364 644" fill="none" stroke="#f8fbff" stroke-width="8" opacity="0.56"/>
</svg>`;
}

function wideSvg(title: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <title>${escapeXml(title)}</title>
  ${body}
</svg>`;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
