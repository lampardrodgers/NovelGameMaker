import type { CharacterProfile, VNLine } from "@agentic-galgame/vn-core";

export const UNKNOWN_SPEAKER_ID = "unknown_speaker";

const COMMON_FALSE_NAMES = new Set(["实验室", "显示器", "手机屏幕", "窗外", "那一刻"]);

export function extractCharacters(novelText: string): CharacterProfile[] {
  const orderedNames: string[] = [];
  const addName = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || COMMON_FALSE_NAMES.has(trimmed) || trimmed.length > 4) {
      return;
    }
    if (!orderedNames.includes(trimmed)) {
      orderedNames.push(trimmed);
    }
  };

  for (const match of novelText.matchAll(/^([^：:\n]{1,6})[：:]/gm)) {
    if (match[1]) {
      addName(match[1]);
    }
  }

  for (const match of novelText.matchAll(/(?:^|\n)([一-龥]{2,4})(?:站|坐|抬|看|问|说|笑|哭|走|握|攥|低|转|沉默)/g)) {
    if (match[1] && match[1] !== "她" && match[1] !== "他") {
      addName(match[1]);
    }
  }

  if (novelText.includes("林雪")) {
    addName("林雪");
  }

  const profiles = orderedNames.map((name, index) => createCharacterProfile(name, index));
  if (novelText.includes("我")) {
    profiles.push({
      id: "protagonist",
      name: "我",
      aliases: ["我"],
      role: "protagonist",
      visualKeywords: ["第一人称", "主角"],
      defaultSpriteId: "sprite_protagonist",
      defaultExpression: "neutral"
    });
  }

  ensureUnknownSpeaker(profiles);

  return profiles;
}

export function assignSpeakerFocus(line: VNLine, characters: CharacterProfile[], context: SpeakerContext): VNLine {
  if (line.kind === "narration") {
    const mentioned = findMentionedCharacter(line.text, characters);
    return {
      ...line,
      speakerId: undefined,
      speakerName: undefined,
      text: line.text
    };
  }

  const existingSpeaker = line.speakerId
    ? characters.find((character) => character.id === line.speakerId)
    : undefined;
  const explicitSpeaker = line.speakerName
    ? findCharacterByName(line.speakerName, characters)
    : undefined;
  const inferredSpeaker =
    existingSpeaker ??
    explicitSpeaker ??
    context.lastMentionedCharacter ??
    findUnknownSpeaker(characters) ??
    firstVisibleCharacter(characters);

  return {
    ...line,
    speakerId: inferredSpeaker?.id,
    speakerName: inferredSpeaker?.name ?? line.speakerName
  };
}

export interface SpeakerContext {
  lastMentionedCharacter?: CharacterProfile;
}

export function updateSpeakerContextFromText(
  context: SpeakerContext,
  text: string,
  characters: CharacterProfile[]
): SpeakerContext {
  const mentioned = findMentionedCharacter(text, characters);
  return mentioned
    ? {
        lastMentionedCharacter: mentioned
      }
    : context;
}

export function findCharacterByName(
  name: string,
  characters: CharacterProfile[]
): CharacterProfile | undefined {
  return characters.find((character) => character.name === name || character.aliases.includes(name));
}

function findMentionedCharacter(
  text: string,
  characters: CharacterProfile[]
): CharacterProfile | undefined {
  const nonProtagonists = characters.filter(
    (character) => character.id !== "protagonist" && character.id !== UNKNOWN_SPEAKER_ID
  );
  return nonProtagonists.find((character) =>
    character.aliases.some((alias) => alias.length > 0 && text.includes(alias))
  );
}

function firstVisibleCharacter(characters: CharacterProfile[]): CharacterProfile | undefined {
  return characters.find(
    (character) => character.id !== "protagonist" && character.id !== UNKNOWN_SPEAKER_ID
  ) ?? characters[0];
}

function findUnknownSpeaker(characters: CharacterProfile[]): CharacterProfile | undefined {
  return characters.find((character) => character.id === UNKNOWN_SPEAKER_ID);
}

function ensureUnknownSpeaker(characters: CharacterProfile[]): void {
  if (characters.some((character) => character.id === UNKNOWN_SPEAKER_ID)) {
    return;
  }

  characters.push({
    id: UNKNOWN_SPEAKER_ID,
    name: "未知说话人",
    aliases: ["未知说话人", "未知角色"],
    role: "unknown",
    visualKeywords: ["未知说话人"],
    defaultSpriteId: "sprite_unknown",
    defaultExpression: "neutral"
  });
}

function createCharacterProfile(name: string, index: number): CharacterProfile {
  const id = normalizeCharacterId(name, index);
  const aliases = id === "lin_xue" ? ["林雪", "她"] : [name];
  return {
    id,
    name,
    aliases,
    role: id === "lin_xue" ? "heroine" : "supporting",
    visualKeywords: id === "lin_xue" ? ["实验室", "旧手机", "冷静", "恐惧"] : [name],
    defaultSpriteId: `sprite_${id}`,
    defaultExpression: "neutral"
  };
}

function normalizeCharacterId(name: string, index: number): string {
  if (name === "林雪") {
    return "lin_xue";
  }
  if (name === "我") {
    return "protagonist";
  }
  return `character_${index + 1}`;
}
