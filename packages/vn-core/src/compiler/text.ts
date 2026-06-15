import { createDefaultUIConfig } from "../schema/defaults.js";
import type { CharacterProfile, DialogueUIConfig, DisplayText, VNLine } from "../schema/types.js";

const QUOTE_PAIRS: Array<readonly [string, string]> = [
  ["“", "”"],
  ["「", "」"],
  ["\"", "\""],
  ["'", "'"]
];

const SPLIT_PRIORITY = ["。", "！", "？", "；", "……", "，", "、", "：", " "];

export function splitTextToBeats(
  text: string,
  config: DialogueUIConfig = createDefaultUIConfig()
): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  const paragraphs = normalized
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const result: string[] = [];
  for (const paragraph of paragraphs) {
    let rest = paragraph;
    while (rest.length > config.maxCjkCharsPerBeat) {
      const cut = findBestCut(rest, config.maxCjkCharsPerBeat);
      const head = rest.slice(0, cut).trim();
      if (head) {
        result.push(head);
      }
      rest = rest.slice(cut).trim();
    }
    if (rest) {
      result.push(rest);
    }
  }

  return result;
}

export function detectLineKind(rawLine: string): VNLine {
  const line = rawLine.trim();
  if (!line) {
    return {
      kind: "narration",
      text: ""
    };
  }

  const speakerMatch = line.match(/^([^：:\n]{1,12}?)(?:低声说|轻声说|说道|说|问|喊道|喊)?[：:]\s*(.+)$/);
  if (speakerMatch?.[1] && speakerMatch[2]) {
    const speakerName = speakerMatch[1].trim();
    const text = stripOuterQuotes(speakerMatch[2].trim());
    return {
      kind: "dialogue",
      speakerName,
      text
    };
  }

  if (isQuoted(line)) {
    return {
      kind: "dialogue",
      text: stripOuterQuotes(line)
    };
  }

  return {
    kind: "narration",
    text: line
  };
}

export function renderDisplayText(
  line: VNLine,
  characters: CharacterProfile[] = [],
  config: DialogueUIConfig = createDefaultUIConfig()
): DisplayText {
  if (line.kind === "narration") {
    return {
      speakerName: config.narrationShowNameplate ? line.speakerName : undefined,
      text: line.text
    };
  }

  const characterName =
    line.speakerName ??
    characters.find((character) => character.id === line.speakerId)?.name;
  const [open, close] = getQuotePair(config);

  return {
    speakerName: config.showNameplate ? characterName : undefined,
    text: `${open}${line.text}${close}`
  };
}

function getQuotePair(config: DialogueUIConfig): readonly [string, string] {
  if (config.quoteStyle === "none") {
    return ["", ""];
  }
  if (config.quoteStyle === "cn_double") {
    return ["“", "”"];
  }
  return config.dialogueBrackets;
}

function findBestCut(text: string, maxLength: number): number {
  for (const delimiter of SPLIT_PRIORITY) {
    const index = lastDelimiterIndex(text, delimiter, maxLength);
    if (index > 0) {
      return index + delimiter.length;
    }
  }

  return maxLength;
}

function lastDelimiterIndex(text: string, delimiter: string, maxLength: number): number {
  let lastIndex = -1;
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const index = text.indexOf(delimiter, searchFrom);
    if (index === -1 || index + delimiter.length > maxLength) {
      break;
    }
    lastIndex = index;
    searchFrom = index + delimiter.length;
  }
  return lastIndex;
}

function isQuoted(text: string): boolean {
  return QUOTE_PAIRS.some(([open, close]) => text.startsWith(open) && text.endsWith(close));
}

function stripOuterQuotes(text: string): string {
  for (const [open, close] of QUOTE_PAIRS) {
    if (text.startsWith(open) && text.endsWith(close)) {
      return text.slice(open.length, text.length - close.length).trim();
    }
  }
  return text;
}
