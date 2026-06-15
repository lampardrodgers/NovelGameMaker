import type { DisplayText } from "@novel-game-maker/vn-core";

export function formatTextboxText(displayText: DisplayText): {
  speakerName?: string;
  text: string;
} {
  return {
    speakerName: displayText.speakerName,
    text: displayText.text
  };
}
