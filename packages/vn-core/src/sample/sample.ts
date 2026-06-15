import { createDefaultUIConfig, createDefaultViewport } from "../schema/defaults.js";
import type { VNProject } from "../schema/types.js";

export const sampleNovelText = `第一章 实验室里的蓝光

实验室里只剩下显示器的蓝光。
林雪站在桌边，手里紧紧攥着那部旧手机。
“你听见了吗？”
我没有回答。
手机屏幕忽然亮了起来。

她抬起头，眼神里第一次出现了恐惧。
“如果这条消息是真的，我们昨天做的一切，都已经被改写了。”
窗外传来电车经过的声音。
那一刻，我终于意识到，世界线已经偏移。`;

export function createSampleProject(): VNProject {
  return {
    id: "sample-steins-like-lab",
    title: "实验室里的蓝光",
    version: "0.1.0",
    viewport: createDefaultViewport(),
    ui: createDefaultUIConfig(),
    assets: {
      items: [
        {
          id: "bg_lab_night",
          type: "background",
          name: "夜晚实验室",
          src: "assets/bg_lab_night.svg",
          placeholder: true
        },
        {
          id: "sprite_lin_xue",
          type: "characterSprite",
          name: "林雪立绘",
          src: "assets/sprite_lin_xue.svg",
          characterId: "lin_xue",
          placeholder: true
        },
        {
          id: "cg_phone_screen",
          type: "cg",
          name: "手机屏幕亮起",
          src: "assets/cg_phone_screen.svg",
          placeholder: true
        }
      ]
    },
    characters: [
      {
        id: "lin_xue",
        name: "林雪",
        aliases: ["林雪", "她"],
        role: "heroine",
        visualKeywords: ["实验室", "旧手机", "恐惧"],
        defaultSpriteId: "sprite_lin_xue",
        defaultExpression: "fear"
      }
    ],
    startBeatId: "beat_1",
    chapters: [
      {
        id: "chapter_1",
        title: "第一章 实验室里的蓝光",
        scenes: [
          {
            id: "scene_1",
            title: "实验室里的蓝光",
            shots: [
              {
                id: "shot_1",
                title: "实验室",
                renderMode: "stage",
                initialStage: {
                  renderMode: "stage",
                  backgroundId: "bg_lab_night",
                  characters: [
                    {
                      characterId: "lin_xue",
                      spriteId: "sprite_lin_xue",
                      position: "center",
                      visible: true,
                      focus: "normal",
                      expression: "tense",
                      facing: "front",
                      scale: 1
                    }
                  ]
                },
                beats: [
                  {
                    id: "beat_1",
                    line: {
                      kind: "narration",
                      text: "实验室里只剩下显示器的蓝光。"
                    },
                    nextBeatId: "beat_2",
                    stagePatch: {
                      renderMode: "stage",
                      backgroundId: "bg_lab_night",
                      characters: [
                        {
                          characterId: "lin_xue",
                          spriteId: "sprite_lin_xue",
                          position: "center",
                          visible: true,
                          expression: "tense",
                          facing: "front",
                          scale: 1
                        }
                      ]
                    }
                  },
                  {
                    id: "beat_2",
                    line: {
                      kind: "dialogue",
                      speakerId: "lin_xue",
                      text: "你听见了吗？"
                    },
                    nextBeatId: "beat_3"
                  },
                  {
                    id: "beat_3",
                    line: {
                      kind: "narration",
                      text: "手机屏幕忽然亮了起来。"
                    },
                    stagePatch: {
                      renderMode: "cg",
                      cgAssetId: "cg_phone_screen"
                    },
                    tags: ["cg-candidate"],
                    meta: {
                      cgCandidateScore: 0.92,
                      cgCandidateReason: "手机屏幕亮起是关键物品特写"
                    }
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  };
}
