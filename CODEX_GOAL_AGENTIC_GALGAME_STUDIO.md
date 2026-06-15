# Codex Goal: NovelGameMaker MVP

## 0. 项目使命

请实现一个可运行的 **NovelGameMaker MVP**。

这个项目不是普通小说阅读器，也不是聊天式互动小说，而是一个可以把小说文本转成 Web 视觉小说 / Galgame 的框架。

目标风格接近传统 Galgame，例如：

- 16:9 全屏画面。
- 画面底部是文字框。
- 文字框默认最多显示两行。
- 旁白直接显示纯文字。
- 对话由 Runtime 自动渲染为日式括号格式，例如：`「你好」`。
- 大部分普通剧情使用分层画面：背景 + 当前人物 + 特效 + UI。
- 当前说话人物高亮，其他人物变暗。
- 重要剧情节点可以使用整张特殊 CG 插画。
- 架构需要模块化，方便以后加入真实 LLM、AI 生图、Live2D、语音、BGM、分支剧情、好感度系统、部署插件等功能。

最终系统由四个核心部分组成：

```text
1. Game Editor / VN Studio
   游戏编辑器。用于导入小说、编辑 beat、预览游戏、导出项目。

2. Agent Framework
   Agent 框架。用于拆解小说、识别人设、规划画面、生成占位素材计划。

3. Web VN Runtime
   网页游玩引擎。用于加载 VNProject 并播放视觉小说。

4. VN Core Protocol
   共享协议层。定义项目格式、脚本格式、资产格式、舞台状态和编译规则。
```

MVP 不需要接入真实 AI API。  
MVP 必须用本地规则、mock provider 和 placeholder SVG 资产跑通完整流程。

---

## 1. Codex 开始前必须先做的事

开始写代码前，请先执行以下步骤：

1. 检查当前仓库结构。
2. 判断当前项目是否已有框架、包管理器、前端应用。
3. 如果仓库为空或接近空仓库，创建 pnpm monorepo。
4. 如果已有项目结构，尽量复用已有结构，不要强行重建。
5. 创建或更新 `docs/TASKLOG.md`。
6. 在 `docs/TASKLOG.md` 中写入简短实现计划。
7. 按 checkpoint 顺序逐步实现。
8. 每完成一个 checkpoint，运行相关检查。
9. 尽量保持项目始终可构建、可测试、可启动。

除非遇到权限、依赖安装、文件系统不可写等真正阻塞问题，否则不要停下来问问题。  
请自己做合理 MVP 取舍，并把取舍写进 `docs/TASKLOG.md`。

---

## 2. MVP 不做什么

MVP 阶段不要实现以下内容：

```text
真实付费 AI 生图 API
真实 LLM API
用户登录 / 权限系统
多人协作
数据库持久化
支付系统
云存储
Live2D
语音合成
复杂 BGM / SFX 编辑器
复杂分支剧情编辑器
复杂动画时间轴
移动端原生打包
真实 CDN 自动部署
```

但需要保留清晰接口，方便以后加入这些能力。

---

## 3. 推荐工程结构

如果当前仓库为空或很简单，请创建如下结构：

```text
apps/
  studio/
    src/
      main.tsx
      App.tsx
      components/
      studio/
      runtime-preview/
      styles/
    public/

packages/
  vn-core/
    src/
      schema/
      stage/
      compiler/
      validation/
      sample/
      index.ts

  vn-runtime/
    src/
      Runtime.ts
      Renderer.ts
      DomRenderer.ts
      TextboxController.ts
      SaveManager.ts
      projectLoader.ts
      index.ts

  vn-agent/
    src/
      workflows/
      tools/
      providers/
      heuristics/
      index.ts

  vn-exporter/
    src/
      exportStaticBundle.ts
      index.ts

docs/
  ARCHITECTURE.md
  CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md
  TASKLOG.md

samples/
  steins-like-lab/
    novel.txt
    project.vn.json
```

推荐技术栈：

```text
包管理器：pnpm
语言：TypeScript
前端：React + Vite
测试：Vitest
MVP Runtime 渲染：DOM + CSS 分层渲染
未来 Runtime 渲染：可扩展 PixiJS Renderer
静态导出：index.html + project.vn.json + assets
```

如果已有 Next.js 或其他框架，也可以复用，但要保持包边界清楚。

---

## 4. 项目必须提供的命令

请确保根目录 `package.json` 有这些命令：

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

命令含义：

```text
pnpm dev
启动 Studio。

pnpm test
运行单元测试。

pnpm typecheck
运行 TypeScript 类型检查。

pnpm build
构建所有 package 和 app。

pnpm export:sample
导出一个静态可玩的 sample visual novel。
```

---

## 5. 核心产品行为

### 5.1 小说导入

Studio 需要允许用户：

```text
粘贴小说文本
加载内置 sample novel
点击 Generate VN Project
得到一个可预览、可编辑、可导出的 VNProject
```

本地 Agent pipeline 需要把小说文本转换成结构化 `VNProject`。

导入流程需要完成：

```text
清洗文本
识别章节
识别场景
拆成两行以内 beat
区分旁白和对话
尽量识别说话人
抽取简单人物表
创建默认背景和人物 placeholder 资产
规划每个 scene 的初始舞台状态
默认复用背景
为说话 beat 设置 speaker focus
标记少量 CG 候选
返回合法 VNProject
```

---

## 6. 文本显示规则

### 6.1 对话

内部数据不要包含括号。

内部数据：

```ts
{
  kind: "dialogue",
  speakerId: "lin_xue",
  text: "你真的决定要离开这里了吗？"
}
```

Runtime 显示：

```text
林雪
「你真的决定要离开这里了吗？」
```

### 6.2 旁白

内部数据：

```ts
{
  kind: "narration",
  text: "夕阳从天台边缘落下，整座城市像被压低了声音。"
}
```

Runtime 显示：

```text
夕阳从天台边缘落下，整座城市像被压低了声音。
```

### 6.3 独白

内部数据：

```ts
{
  kind: "monologue",
  speakerId: "protagonist",
  text: "我终于意识到，一切已经无法回头。"
}
```

Runtime 可以显示为：

```text
我
「我终于意识到，一切已经无法回头。」
```

MVP 中独白可以先按 dialogue 类似方式显示，但数据层必须区分 `monologue`。

---

## 7. 两行文本框规则

默认 UI 配置：

```ts
maxLines: 2
maxCjkCharsPerLine: 30
maxCjkCharsPerBeat: 60
```

Agent 拆 beat 时必须尽量保证每个 beat 在两行以内。

拆分优先级：

```text
1. 句号：。
2. 感叹号：！
3. 问号：？
4. 分号：；
5. 省略号：……
6. 逗号：，
7. 顿号：、
8. 冒号：：
9. 空格
10. 如果没有合适标点，则硬切
```

一个 beat 通常应该是：

```text
一句短对话
一句短旁白
一个情绪变化
一个视觉节拍
```

不要把很多句塞进一个 beat。  
不要让文本框滚动。  
不要让 Runtime 显示超过两行的文本。

---

## 8. 分层画面和 CG 画面

### 8.1 Stage Mode

大部分普通剧情使用 `stage` 模式。

玩家看到的是完整画面，但系统内部是分层：

```text
background layer
character layer
effects layer
textbox UI layer
```

Stage mode 支持：

```text
背景
当前人物
人物位置
人物表情
人物朝向
人物缩放
人物 focus 状态
镜头字段
特效字段
```

### 8.2 CG Mode

重要剧情节点使用 `cg` 模式。

CG mode 是整张特殊插图，例如：

```text
手机屏幕忽然亮起
真相揭露
女主崩溃
世界线偏移
告白
死亡
坠落
枪声
爆炸
拥抱
分别
```

MVP 可以使用 placeholder SVG 作为 CG。

### 8.3 重要原则

普通 beat 不要频繁换背景。  
大部分 beat 只应该变化：

```text
文字
说话人高亮
人物表情
人物进出场
```

只有明显地点、时间、气氛变化时才换背景。  
只有重点剧情才切 CG。

---

## 9. 说话人高亮规则

当当前 line 是 `dialogue` 或 `monologue`，并且可见角色中有对应 `speakerId`：

```text
speaker character: focus = active
other visible characters: focus = dimmed
```

当当前 line 是 `narration`：

```text
visible characters: focus = normal
```

MVP Runtime 用 CSS 实现 focus，不要重新生成图片。

建议 CSS 效果：

```css
active:
  brightness(1) saturate(1)

dimmed:
  brightness(0.55) saturate(0.65)

normal:
  brightness(0.85) saturate(0.9)
```

---

## 10. VN Core Protocol

请创建 package：

```text
packages/vn-core
```

这个包只放共享类型、schema、纯函数、校验、编译逻辑。  
它不能依赖 Studio UI。  
它不能依赖 Runtime DOM。  
它不能依赖 Agent provider。

### 10.1 必须导出的核心类型

请实现以下类型，可以按实际工程微调，但语义不能丢。

```ts
export type VNProject = {
  id: string;
  title: string;
  version: number;
  viewport: VNViewport;
  ui: DialogueUIConfig;
  assets: AssetManifest;
  characters: Record<string, CharacterProfile>;
  chapters: VNChapter[];
  startBeatId: string;
};

export type VNViewport = {
  width: number;
  height: number;
  aspectRatio: "16:9";
};

export type DialogueUIConfig = {
  maxLines: number;
  maxCjkCharsPerLine: number;
  maxCjkCharsPerBeat: number;
  quoteStyle: "jp_corner" | "cn_double" | "none";
  showNameplate: boolean;
  narrationShowNameplate: boolean;
  typewriter: boolean;
};

export type AssetManifest = {
  backgrounds: Record<string, VNAsset>;
  characterSprites: Record<string, VNAsset>;
  cgs: Record<string, VNAsset>;
  ui?: Record<string, VNAsset>;
  audio?: Record<string, VNAsset>;
};

export type VNAsset = {
  id: string;
  type:
    | "background"
    | "characterSprite"
    | "cg"
    | "ui"
    | "bgm"
    | "sfx"
    | "voice";
  url: string;
  title?: string;
  width?: number;
  height?: number;
  placeholder?: boolean;
  meta?: Record<string, unknown>;
};

export type CharacterProfile = {
  id: string;
  name: string;
  aliases: string[];
  role:
    | "protagonist"
    | "heroine"
    | "supporting"
    | "antagonist"
    | "minor"
    | "unknown";
  personality?: string;
  appearance?: string;
  visualKeywords: string[];
  defaultSpriteId?: string;
};

export type VNChapter = {
  id: string;
  title: string;
  scenes: VNScene[];
};

export type VNScene = {
  id: string;
  title?: string;
  summary?: string;
  locationId?: string;
  timeOfDay?: string;
  defaultBackgroundId?: string;
  shots: VNShot[];
};

export type VNShot = {
  id: string;
  renderMode: "stage" | "cg";
  initialStage: StageState;
  beats: VNBeat[];
};

export type VNBeat = {
  id: string;
  line: VNLine;
  stagePatch?: StagePatch;
  transition?: TransitionConfig;
  nextBeatId?: string;
  sourceText?: string;
  meta?: {
    cgCandidateScore?: number;
    cgCandidateReason?: string;
  };
};

export type VNLine =
  | {
      kind: "dialogue";
      speakerId: string;
      text: string;
      emotion?: string;
    }
  | {
      kind: "narration";
      text: string;
    }
  | {
      kind: "monologue";
      speakerId: string;
      text: string;
      emotion?: string;
    };

export type StageState = {
  renderMode: "stage" | "cg";
  backgroundId?: string;
  cgAssetId?: string;
  characters: StageCharacter[];
  camera?: CameraState;
  effects?: StageEffect[];
};

export type StageCharacter = {
  characterId: string;
  spriteId: string;
  expression: string;
  position: "farLeft" | "left" | "center" | "right" | "farRight";
  scale: number;
  facing: "left" | "right" | "front";
  focus: "active" | "dimmed" | "normal";
};

export type StagePatch = Partial<StageState> & {
  characters?: Array<Partial<StageCharacter> & { characterId: string }>;
};

export type CameraState = {
  zoom: number;
  x: number;
  y: number;
  movement?: "none" | "slowZoomIn" | "slowZoomOut" | "shake";
};

export type StageEffect = {
  type: "rain" | "snow" | "glitch" | "flash" | "vignette" | "blur";
  intensity: number;
};

export type TransitionConfig = {
  visual?: "none" | "cut" | "fade" | "dissolve" | "flash";
  text?: "typewriter" | "instant";
};

export type CompiledBeat = {
  beatId: string;
  chapterId: string;
  sceneId: string;
  shotId: string;
  line: VNLine;
  resolvedStage: StageState;
  transition?: TransitionConfig;
};
```

### 10.2 必须实现的核心函数

```ts
export function createDefaultUIConfig(): DialogueUIConfig;

export function splitTextToBeats(
  input: string,
  config: DialogueUIConfig
): string[];

export function detectLineKind(
  text: string,
  knownCharacters?: CharacterProfile[]
): VNLine;

export function applyStagePatch(
  stage: StageState,
  patch?: StagePatch
): StageState;

export function applySpeakerFocus(
  stage: StageState,
  line: VNLine
): StageState;

export function resolveBeats(project: VNProject): CompiledBeat[];

export function validateProject(project: VNProject): ValidationResult;

export function renderDisplayText(
  line: VNLine,
  config: DialogueUIConfig,
  characters?: Record<string, CharacterProfile>
): {
  nameplate?: string;
  text: string;
};
```

`ValidationResult` 可以这样设计：

```ts
export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
```

### 10.3 核心函数要求

`splitTextToBeats`：

```text
输入长文本。
输出多个短 beat 文本。
尽量保证每个 beat 不超过 maxCjkCharsPerBeat。
优先在标点处切分。
保留标点。
不要输出空字符串。
```

`detectLineKind`：

```text
能识别中文引号、日式引号、英文引号。
能把 “你好吗？” 识别为 dialogue。
如果无法判断 speaker，允许使用 unknown_speaker。
能把普通描述识别为 narration。
```

`applyStagePatch`：

```text
能更新 backgroundId。
能切换 renderMode。
能切换 cgAssetId。
能按 characterId 合并角色 patch。
未被 patch 的角色要保留。
如果 patch 中出现新角色，应添加到 characters。
```

`applySpeakerFocus`：

```text
dialogue / monologue 时，说话人 active，其他 visible characters dimmed。
narration 时，所有 visible characters normal。
```

`resolveBeats`：

```text
遍历 chapter / scene / shot / beat。
从 shot.initialStage 开始。
对每个 beat 应用 stagePatch。
再应用 speaker focus。
输出 CompiledBeat[]。
每个 CompiledBeat 必须包含 resolvedStage。
```

`renderDisplayText`：

```text
dialogue + jp_corner => 「text」
dialogue + cn_double => “text”
dialogue + none => text
narration 不加括号
showNameplate 为 true 时显示角色名
narrationShowNameplate 默认为 false
```

---

## 11. Agent Framework

请创建 package：

```text
packages/vn-agent
```

MVP 的 Agent Framework 使用本地 deterministic heuristic，不接真实 AI。

### 11.1 必须提供的 provider 接口

```ts
export interface TextModelProvider {
  id: string;

  generateStructured<T>(input: {
    task: string;
    schemaName: string;
    prompt: string;
  }): Promise<T>;
}

export interface ImageGenerationProvider {
  id: string;

  generateImage(input: {
    prompt: string;
    width: number;
    height: number;
    seed?: number;
    referenceAssetIds?: string[];
  }): Promise<{
    assetUrl: string;
    seed?: number;
  }>;
}

export interface VNAgentWorkflow {
  id: string;
  run(input: unknown): Promise<unknown>;
}
```

### 11.2 MVP mock provider

实现：

```ts
MockTextModelProvider
MockImageGenerationProvider
```

它们不调用外部 API。  
它们只返回 mock 结果或 placeholder asset。

### 11.3 必须实现的主 workflow

```ts
export function createProjectFromNovel(input: {
  title: string;
  novelText: string;
  style?: {
    name?: string;
    mood?: string;
  };
}): VNProject;
```

pipeline 必须包含：

```text
1. cleanNovelText
2. splitChapters
3. splitScenes
4. splitNovelLines
5. splitTextToBeats
6. detectLineKind
7. extractCharacters
8. createPlaceholderAssets
9. planInitialStageForScenes
10. assignSpeakerFocus
11. markCGCandidates
12. validateProject
13. return VNProject
```

### 11.4 启发式规则

#### 对话识别

识别以下形式：

```text
“你听见了吗？”
「你听见了吗？」
"你听见了吗？"
林雪：“你听见了吗？”
林雪说：“你听见了吗？”
林雪低声说：“你听见了吗？”
```

#### 说话人识别

优先规则：

```text
1. 行首 `姓名：`
2. 行首 `姓名说：`
3. 行首 `姓名问：`
4. 前文最近出现的角色名 + 说/问/低声说/喊道
5. 无法判断时使用 unknown_speaker
```

#### 角色抽取

MVP 只需要启发式，不要求完美。

规则：

```text
从 dialogue speaker 中抽取角色
从常见中文姓名模式抽取角色
从 sample 中必须识别 林雪
如果文本出现 “我”，创建 protagonist 角色
```

生成角色 id：

```text
使用稳定 slug，例如：
林雪 => lin_xue
我 => protagonist
未知说话人 => unknown_speaker
```

#### 场景拆分

尽量少拆，不要过度频繁切换场景。

可根据以下关键词拆分：

```text
第一章
第1章
Chapter
序章
尾声
第二天
夜晚
傍晚
清晨
实验室
天台
教室
街道
房间
车站
```

原则：

```text
同一章节内优先复用背景。
只有地点、时间、情绪明显变化才拆 scene。
MVP 可以一个章节一个 scene。
```

#### 背景规划

根据场景关键词选择 placeholder 背景：

```text
实验室 => bg_lab_night
天台 => bg_rooftop_sunset
教室 => bg_classroom_evening
街道 => bg_street_night
房间 => bg_room_night
默认 => bg_default
```

#### CG 候选识别

以下关键词增加 CG 分数：

```text
忽然
真相
死亡
血
手机屏幕
拥抱
吻
坠落
爆炸
崩溃
泪
告白
再见
枪
刀
光芒
世界线
时间机器
改写
偏移
恐惧
```

MVP 不要标太多 CG。  
sample 中至少标记一个 CG，例如：

```text
手机屏幕忽然亮了起来。
那一刻，我终于意识到，世界线已经偏移。
```

CG 规划原则：

```text
如果 cgCandidateScore >= threshold：
  当前 beat stagePatch.renderMode = "cg"
  stagePatch.cgAssetId = suitable CG placeholder
否则：
  保持 stage mode
```

---

## 12. Runtime

请创建 package：

```text
packages/vn-runtime
```

Runtime 必须可以被 Studio preview 使用，也必须可以被静态导出的 playable 使用。

### 12.1 Runtime 职责

Runtime 负责：

```text
加载 VNProject
校验 VNProject
调用 resolveBeats 得到 CompiledBeat[]
渲染当前 beat
next
previous
goToBeat
save
load
渲染旁白
渲染对话
渲染说话人高亮
渲染 stage mode
渲染 cg mode
响应点击和键盘
```

Runtime 不负责：

```text
小说拆分
AI 规划
素材生成
Studio 编辑 UI
```

### 12.2 Runtime API

实现类似：

```ts
export class VNRuntime {
  constructor(options: {
    project: VNProject;
    renderer: VNRenderer;
    saveManager?: SaveManager;
  });

  start(): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  goToBeat(beatId: string): Promise<void>;
  getState(): RuntimeState;
  save(slot?: string): void;
  load(slot?: string): Promise<void>;
}
```

Renderer 接口：

```ts
export interface VNRenderer {
  mount(container: HTMLElement): Promise<void>;
  renderBeat(beat: CompiledBeat, project: VNProject): Promise<void>;
  destroy(): void;
}
```

MVP 实现：

```ts
export class DomVNRenderer implements VNRenderer {}
```

### 12.3 DOM 渲染结构

MVP 使用 DOM + CSS 分层渲染。

HTML 结构类似：

```html
<div class="vn-stage">
  <div class="vn-background"></div>
  <div class="vn-cg"></div>
  <div class="vn-characters"></div>
  <div class="vn-effects"></div>
  <div class="vn-textbox">
    <div class="vn-nameplate"></div>
    <div class="vn-line"></div>
  </div>
</div>
```

### 12.4 CSS 视觉要求

Runtime preview 必须看起来像 Galgame：

```text
16:9 画框
背景铺满
人物在背景前
底部半透明文字框
文字框最多两行
对话有角色名 nameplate
对话加 「」
旁白不加括号
当前说话人更亮
其他人物变暗
CG mode 时显示整张 CG
```

角色位置映射：

```text
farLeft  => left: 10%
left     => left: 25%
center   => left: 50%
right    => left: 75%
farRight => left: 90%
```

CSS 示例语义：

```css
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
```

### 12.5 Textbox 行为

实现：

```text
固定底部文本框
最多两行
dialogue 显示 nameplate
narration 不显示 nameplate
dialogue 自动加括号
可选 typewriter
typewriter 播放中点击：立刻显示完整文本
完整文本状态点击：进入下一 beat
```

MVP 中 typewriter 可以简单实现。  
如果时间不够，至少保证文本正确显示并可前进。

### 12.6 SaveManager

MVP 用 localStorage。

```ts
export type SaveData = {
  projectId: string;
  projectVersion: number;
  beatId: string;
  createdAt: string;
};
```

实现：

```ts
save(slot?: string): void
load(slot?: string): SaveData | null
clear(slot?: string): void
```

---

## 13. Studio App

请创建 app：

```text
apps/studio
```

如果已有 app，则在现有 app 中实现这些功能。

### 13.1 Studio 页面布局

MVP 可以是一个单页应用。

建议布局：

```text
Top Bar
  项目标题
  Load Sample
  Generate VN Project
  Export Project JSON
  Export Static Playable

Left Panel
  Chapter / Scene / Shot / Beat 树

Center Panel
  Runtime Preview

Right Panel
  Inspector

Bottom or Side Panel
  小说导入 textarea
  Agent 操作区
```

### 13.2 必须实现的 Studio 功能

用户可以：

```text
加载 sample novel
粘贴小说文本
点击 Generate VN Project
看到生成后的 beat tree
点击 beat
预览当前 beat
编辑 beat 文本
切换 line kind：narration / dialogue / monologue
选择或修改 speaker
切换当前 beat 是否为 CG
修改角色 expression 字符串
修改角色 position
点击 next / previous 试玩
保存到 localStorage
从 localStorage 加载
导出 project JSON
```

### 13.3 Inspector 要显示的字段

选中 beat 后，右侧 Inspector 显示：

```text
beat id
line kind
speaker
text
stage renderMode
backgroundId
cgAssetId
visible characters
character expression
character position
character focus
cgCandidateScore
cgCandidateReason
```

允许编辑 MVP 中最重要的字段：

```text
text
line kind
speakerId
renderMode
cgAssetId
character expression
character position
```

### 13.4 Runtime Preview

中间预览必须直接使用 `packages/vn-runtime`。

Preview 支持：

```text
next
previous
click to advance
Space / Enter advance
save
load
go to selected beat
```

---

## 14. Sample Novel

请内置这个 sample：

```text
第一章 实验室里的蓝光

实验室里只剩下显示器的蓝光。
林雪站在桌边，手里紧紧攥着那部旧手机。
“你听见了吗？”
我没有回答。
手机屏幕忽然亮了起来。

她抬起头，眼神里第一次出现了恐惧。
“如果这条消息是真的，我们昨天做的一切，都已经被改写了。”
窗外传来电车经过的声音。
那一刻，我终于意识到，世界线已经偏移。
```

生成结果必须展示：

```text
有章节
有 scene
有多个 beat
有 narration
有 dialogue
识别 林雪 角色
显示实验室背景
林雪 sprite 出现
林雪说话时高亮
旁白时恢复 normal
至少一个 CG beat
可以 next / previous 播放
```

---

## 15. Placeholder 资产

MVP 不接入真实 AI 生图。

请创建 lightweight SVG placeholder 资产。

建议 assets：

```text
bg_lab_night.svg
bg_rooftop_sunset.svg
bg_classroom_evening.svg
bg_default.svg

sprite_lin_xue.svg
sprite_protagonist.svg
sprite_unknown.svg

cg_phone_screen.svg
cg_worldline_shift.svg
cg_default.svg
```

可以放在：

```text
apps/studio/public/assets/
```

或者导出时生成到：

```text
dist/playable-sample/assets/
```

SVG 可以很简单，例如：

```text
背景：渐变色 + 场景文字
人物：半身立绘卡片 + 角色名
CG：全屏构图卡片 + CG 标题
```

---

## 16. Exporter

请创建 package：

```text
packages/vn-exporter
```

### 16.1 必须实现函数

```ts
export async function exportStaticBundle(input: {
  project: VNProject;
  outDir: string;
  runtimeBundle?: string;
}): Promise<void>;
```

### 16.2 MVP 导出行为

`exportStaticBundle` 需要：

```text
创建 outDir
写入 project.vn.json
写入 index.html
复制或生成 placeholder assets
确保 index.html 能加载 project.vn.json
确保导出的项目可以作为静态文件打开 / 托管
```

输出目录示例：

```text
dist/playable-sample/
  index.html
  project.vn.json
  assets/
    bg_lab_night.svg
    sprite_lin_xue.svg
    cg_phone_screen.svg
```

### 16.3 export:sample 命令

实现：

```bash
pnpm export:sample
```

执行后生成：

```text
dist/playable-sample/
```

README 里必须说明：

```text
这个目录可以部署到任意静态托管服务。
本地可以用简单静态服务器预览。
```

---

## 17. 测试要求

使用 Vitest。

至少实现以下测试：

### 17.1 vn-core tests

测试 `splitTextToBeats`：

```text
长中文文本会被拆成多个 beat
每个 beat 尽量不超过 maxCjkCharsPerBeat
优先在标点处切分
不输出空字符串
能处理带引号对话
```

测试 `detectLineKind`：

```text
普通描述 => narration
“你好吗？” => dialogue
「你好吗？」 => dialogue
林雪：“你好吗？” => dialogue with speaker
未知 speaker 时不崩溃
```

测试 `applyStagePatch`：

```text
能更新 backgroundId
能切换 renderMode
能切换 cgAssetId
能按 characterId 合并角色 patch
未修改角色保留
新角色可添加
```

测试 `applySpeakerFocus`：

```text
说话人 active
其他人 dimmed
旁白时所有人 normal
```

测试 `resolveBeats`：

```text
能生成 CompiledBeat[]
CompiledBeat 包含 resolvedStage
stagePatch 会逐步累积
支持 CG mode
```

### 17.2 vn-agent tests

测试 `createProjectFromNovel`：

```text
sample novel 能生成 valid project
project 有 title
project 有 chapters
project 有 beats
characters 包含 林雪
有 placeholder assets
至少一个 beat 是 CG candidate
resolveBeats 后可播放
```

### 17.3 validation commands

最终必须运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

如果某条命令因为环境限制不能运行，需要在 `docs/TASKLOG.md` 里写清楚原因和最小下一步。

---

## 18. 文档要求

请创建或更新：

```text
README.md
docs/ARCHITECTURE.md
docs/TASKLOG.md
```

### 18.1 README.md 必须包含

```text
项目是什么
如何安装
如何启动 Studio
如何运行测试
如何构建
如何导出 sample playable
如何部署静态 playable
MVP 限制
未来扩展方向
```

### 18.2 docs/ARCHITECTURE.md 必须解释

```text
VN Core Protocol
Studio
Runtime
Agent Framework
Exporter
Stage mode vs CG mode
两行 beat 规则
说话人高亮规则
为什么普通剧情使用分层
为什么重点剧情使用 CG
未来 AI provider 如何接入
未来 PixiJS renderer 如何接入
未来部署 provider 如何接入
```

### 18.3 docs/TASKLOG.md 格式

每个 checkpoint 用这个格式记录：

```md
## Checkpoint N: 名称

Status: done / partial / blocked

What changed:
- ...

Validation:
- command: result

Notes:
- ...
```

不要写模糊进度。  
每个 checkpoint 要明确改了什么、验证了什么、还有什么限制。

---

## 19. 实现 checkpoint 顺序

请严格按这个顺序实现。

### Checkpoint 1: Repository setup

目标：

```text
检查 repo
确定 monorepo / app 结构
创建 package scripts
配置 TypeScript
配置 Vitest
创建 docs/TASKLOG.md
写入实现计划
```

验证：

```bash
pnpm install
pnpm typecheck
```

如果这时还没有代码，typecheck 可以在 Checkpoint 2 后跑，但要记录原因。

---

### Checkpoint 2: VN Core

目标：

```text
实现 packages/vn-core
实现核心类型
实现默认 UI 配置
实现 splitTextToBeats
实现 detectLineKind
实现 applyStagePatch
实现 applySpeakerFocus
实现 resolveBeats
实现 validateProject
实现 renderDisplayText
实现 sample helper
实现单元测试
```

验证：

```bash
pnpm test
pnpm typecheck
```

---

### Checkpoint 3: Agent Framework

目标：

```text
实现 packages/vn-agent
实现 provider interfaces
实现 mock providers
实现 cleanNovelText
实现 splitChapters
实现 splitScenes
实现 extractCharacters
实现 createPlaceholderAssets
实现 stage planning
实现 CG candidate marking
实现 createProjectFromNovel
实现单元测试
```

验证：

```bash
pnpm test
pnpm typecheck
```

---

### Checkpoint 4: Runtime

目标：

```text
实现 packages/vn-runtime
实现 VNRuntime
实现 VNRenderer interface
实现 DomVNRenderer
实现 TextboxController 或等效逻辑
实现 SaveManager
实现 click / keyboard navigation
实现 stage mode
实现 CG mode
实现 speaker highlight
实现 dialogue bracket rendering
```

验证：

```bash
pnpm test
pnpm typecheck
```

---

### Checkpoint 5: Studio App

目标：

```text
实现 apps/studio
实现 React UI
实现 Load Sample
实现 Import Text
实现 Generate VN Project
实现 Chapter / Scene / Shot / Beat tree
实现 Runtime Preview
实现 Inspector
实现 beat 编辑
实现 CG toggle
实现 project JSON export
实现 localStorage save/load
```

验证：

```bash
pnpm dev
pnpm build
```

如果 Codex 无法视觉检查页面，需要在 `docs/TASKLOG.md` 写清手动验证步骤。

---

### Checkpoint 6: Static Exporter

目标：

```text
实现 packages/vn-exporter
实现 exportStaticBundle
实现 sample export command
生成 dist/playable-sample
写入 index.html
写入 project.vn.json
写入 assets
确保静态 playable 可运行
```

验证：

```bash
pnpm export:sample
```

检查输出目录：

```text
dist/playable-sample/
  index.html
  project.vn.json
  assets/
```

---

### Checkpoint 7: Final verification and documentation

目标：

```text
补齐 README.md
补齐 docs/ARCHITECTURE.md
补齐 docs/TASKLOG.md
运行最终验证命令
记录结果
```

最终验证：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

---

## 20. Runtime 最小交互细节

### 20.1 下一句

支持：

```text
点击画面
点击 Next 按钮
按 Space
按 Enter
```

### 20.2 上一句

支持：

```text
点击 Previous 按钮
按 ArrowLeft
```

### 20.3 存档

支持：

```text
Save 按钮
Load 按钮
localStorage
```

MVP 只需要一个默认 slot。

---

## 21. Studio 编辑行为细节

### 21.1 选中 beat

用户点击左侧 beat 后：

```text
Preview 跳转到该 beat
Inspector 显示该 beat 数据
```

### 21.2 修改文本

用户修改 text 后：

```text
更新 VNProject
重新 resolveBeats
Preview 更新
localStorage 可保存
```

### 21.3 修改 line kind

如果从 narration 改成 dialogue：

```text
需要 speakerId
默认使用第一个角色
如果没有角色，使用 unknown_speaker
```

如果从 dialogue 改成 narration：

```text
移除 speakerId
显示不加括号
```

### 21.4 Toggle CG

如果打开 CG：

```text
stagePatch.renderMode = "cg"
stagePatch.cgAssetId = cg_default 或合适 CG
```

如果关闭 CG：

```text
stagePatch.renderMode = "stage"
stagePatch.cgAssetId = undefined
```

---

## 22. 项目数据流

最终 MVP 应该体现这个数据流：

```text
Novel Text
  ↓
createProjectFromNovel()
  ↓
VNProject
  ↓
validateProject()
  ↓
resolveBeats()
  ↓
CompiledBeat[]
  ↓
VNRuntime + DomVNRenderer
  ↓
Playable Web VN
  ↓
exportStaticBundle()
  ↓
Static playable folder
```

---

## 23. 未来扩展点

MVP 不做这些完整功能，但代码结构必须方便以后扩展。

### 23.1 真实 LLM Agent

未来可以替换：

```text
heuristic createProjectFromNovel
```

为：

```text
LLM Script Agent
LLM Casting Agent
LLM Stage Director Agent
LLM Asset Planner Agent
```

但输出仍然应该是：

```text
VNProject
或 ProjectPatch
```

不要让 LLM 直接控制 Runtime。

### 23.2 AI 图像生成

未来可以实现真实：

```ts
ImageGenerationProvider
```

接入外部图像模型。

MVP 只用 placeholder SVG。

### 23.3 PixiJS Renderer

未来可以新增：

```ts
PixiVNRenderer implements VNRenderer
```

不要把 Runtime 写死成 DOM-only 逻辑。  
DOM Renderer 是 MVP 实现，不是最终唯一实现。

### 23.4 分支剧情

未来可以扩展：

```ts
VNChoice
flags
jump
conditions
```

MVP 可以只保留 schema 余地，不需要完整分支编辑器。

### 23.5 音频

未来可以加入：

```text
BGM
SFX
voice
```

MVP 资产 schema 可以保留 audio 字段，但不需要完整实现。

### 23.6 部署 Provider

未来可以加入：

```text
DeployToVercel
DeployToCloudflarePages
DeployToS3
DeployToItch
```

MVP 只需要静态导出 folder。

---

## 24. 接受标准

只有满足以下条件，任务才算完成。

### 24.1 功能接受标准

```text
可以本地打开 Studio
可以加载 sample novel
可以粘贴自定义小说并生成 VNProject
可以预览生成后的视觉小说
播放器有 16:9 全屏视觉区域
播放器底部有文本框
文本框默认最多两行
对话显示角色名和 「」
旁白显示纯文字
说话人高亮有效
背景在多个 beat 中复用
sample 至少出现一个 CG beat
可以 next / previous
可以 local save / load
可以导出 project JSON
可以导出静态 playable sample
```

### 24.2 技术接受标准

```text
代码使用 TypeScript
核心逻辑在 packages 中
React 组件不承载核心业务逻辑
Runtime 不依赖 Studio
Agent 不依赖 Runtime UI
VNProject 是可序列化 JSON
有核心单元测试
有 Agent 单元测试
build 通过
README 存在
ARCHITECTURE 文档存在
TASKLOG 存在
```

### 24.3 最终验证命令

必须运行并记录结果：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

---

## 25. 最终停止条件

只有在以下条件都完成后停止：

```text
1. 接受标准基本满足。
2. 最终验证命令已经运行。
3. README 写清楚如何使用。
4. docs/ARCHITECTURE.md 写清楚架构。
5. docs/TASKLOG.md 写清楚 checkpoint 结果。
6. sample game 可以在 Studio preview 里玩。
7. sample game 可以导出为静态 folder。
```

如果被阻塞，只能在记录清楚以下内容后停止：

```text
blocker 是什么
影响哪些文件
运行了什么命令
命令输出是什么
最小下一步是什么
```

---

## 26. 重要实现提醒

请优先保证 MVP 闭环，而不是追求复杂度。

正确优先级：

```text
1. VNProject schema 稳定
2. split / detect / resolve 纯函数可靠
3. Runtime 能播放
4. Studio 能编辑和预览
5. Agent 能从小说生成项目
6. Exporter 能导出静态 playable
7. 文档和测试补齐
```

错误优先级：

```text
一开始接真实 AI
一开始做数据库
一开始做账号系统
一开始做复杂动画
一开始做漂亮 UI
一开始做多平台发布
```

MVP 要小，但必须完整可玩。
