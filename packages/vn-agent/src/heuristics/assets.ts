import type { AssetManifest, CharacterProfile, VNAsset } from "@novel-game-maker/vn-core";
import { UNKNOWN_SPEAKER_ID } from "./characters.js";

export function createPlaceholderAssets(characters: CharacterProfile[]): AssetManifest {
  const backgroundAssets: VNAsset[] = [
    createAsset("bg_lab_night", "background", "夜晚实验室"),
    createAsset("bg_rooftop_sunset", "background", "黄昏天台"),
    createAsset("bg_classroom_evening", "background", "傍晚教室"),
    createAsset("bg_default", "background", "默认背景")
  ];

  const characterAssets: VNAsset[] = characters.map((character) => ({
    id: character.defaultSpriteId ?? `sprite_${character.id}`,
    type: "characterSprite" as const,
    name: `${character.name}立绘`,
    src: `assets/${character.defaultSpriteId ?? `sprite_${character.id}`}.svg`,
    characterId: character.id,
    placeholder: true
  }));
  if (!characterAssets.some((asset) => asset.id === "sprite_unknown")) {
    characterAssets.push({
      id: "sprite_unknown",
      type: "characterSprite",
      name: "未知角色立绘",
      src: "assets/sprite_unknown.svg",
      characterId: characters.find((character) => character.id === UNKNOWN_SPEAKER_ID)?.id,
      placeholder: true
    });
  }

  const cgAssets: VNAsset[] = [
    createAsset("cg_phone_screen", "cg", "手机屏幕亮起"),
    createAsset("cg_worldline_shift", "cg", "世界线偏移"),
    createAsset("cg_default", "cg", "关键 CG")
  ];

  return {
    items: [...backgroundAssets, ...characterAssets, ...cgAssets]
  };
}

function createAsset(id: string, type: VNAsset["type"], name: string): VNAsset {
  return {
    id,
    type,
    name,
    src: `assets/${id}.svg`,
    placeholder: true
  };
}
