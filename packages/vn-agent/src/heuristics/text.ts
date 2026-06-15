export interface DetectedChapter {
  id: string;
  title: string;
  text: string;
}

export interface DetectedScene {
  id: string;
  title: string;
  text: string;
}

const CHAPTER_HEADING = /^第[一二三四五六七八九十百千万\d]+章.*$/;

export function cleanNovelText(input: string): string {
  return input
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function splitChapters(novelText: string): DetectedChapter[] {
  const clean = cleanNovelText(novelText);
  if (!clean) {
    return [];
  }

  const lines = clean.split("\n");
  const chapters: DetectedChapter[] = [];
  let currentTitle = "第一章";
  let currentLines: string[] = [];
  let foundHeading = false;

  for (const line of lines) {
    if (CHAPTER_HEADING.test(line)) {
      if (foundHeading || currentLines.length > 0) {
        chapters.push(createChapter(chapters.length, currentTitle, currentLines.join("\n")));
      }
      currentTitle = line;
      currentLines = [];
      foundHeading = true;
    } else {
      currentLines.push(line);
    }
  }

  chapters.push(createChapter(chapters.length, currentTitle, currentLines.join("\n")));
  return chapters.filter((chapter) => chapter.text.trim().length > 0);
}

export function splitScenes(chapterText: string): DetectedScene[] {
  const blocks = cleanNovelText(chapterText)
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  const sceneBlocks = blocks.length > 0 ? blocks : [chapterText];
  return sceneBlocks.map((block, index) => ({
    id: `scene_${index + 1}`,
    title: inferSceneTitle(block, index),
    text: block
  }));
}

export function splitNovelLines(sceneText: string): string[] {
  return cleanNovelText(sceneText)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !CHAPTER_HEADING.test(line));
}

function createChapter(index: number, title: string, text: string): DetectedChapter {
  return {
    id: `chapter_${index + 1}`,
    title,
    text: text.trim()
  };
}

function inferSceneTitle(text: string, index: number): string {
  if (text.includes("实验室")) {
    return "实验室";
  }
  if (text.includes("天台")) {
    return "天台";
  }
  if (text.includes("教室")) {
    return "教室";
  }
  if (text.includes("手机")) {
    return "手机亮起";
  }
  return `Scene ${index + 1}`;
}
