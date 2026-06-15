# AGENTS.md

## 项目定位

这个仓库要实现一个 **NovelGameMaker**。

它是一个 Web 视觉小说 / Galgame 框架，可以把小说文本导入后，通过本地 Agent 流水线拆解成可编辑、可预览、可导出、可在 Web 上游玩的视觉小说。

项目由四个核心部分组成：

```text
1. VN Core Protocol
   共享协议层。
   定义 VNProject、角色、人设、资产、章节、场景、镜头、beat、文本行、舞台状态、补丁、编译结果、校验规则。

2. Web VN Runtime
   网页游玩引擎。
   加载编译后的 VNProject JSON。
   以传统 Galgame 风格播放视觉小说。
   支持背景、人物、说话人高亮、旁白、对话、CG 特写、next、previous、save、load。

3. VN Studio
   游戏编辑器。
   用户可以导入小说、生成 VNProject、查看 beat 树、编辑文本、修改说话人、调整人物表情和位置、切换 CG、预览游戏、导出项目。

4. Agent Framework
   Agent 框架。
   MVP 阶段使用本地 deterministic heuristic。
   负责清洗小说、拆章节、拆场景、拆两行 beat、识别旁白/对话、抽取角色、规划背景和人物、标记 CG 候选、生成 placeholder 资产。
```

本项目的第一阶段目标是：  
**不用真实 AI API，也能跑通从小说文本到 Web 可玩视觉小说的完整闭环。**

---

## 语言要求

面向用户的说明、README、架构文档、TASKLOG、UI 文案优先使用中文。

代码中的类型名、函数名、接口名、目录名、命令名保持英文，例如：

```ts
VNProject
StageState
VNRuntime
createProjectFromNovel
applySpeakerFocus
```

这样更利于 TypeScript 工程和 Codex 修改代码。

---

## 核心产品风格

目标视觉效果是传统 Galgame / 视觉小说：

```text
16:9 全屏画面
底部文字框
文字框最多两行
旁白直接显示纯文字
对话由 Runtime 自动加括号，例如：「你好」
当前说话人高亮
其他人物变暗
大部分普通剧情使用背景 + 人物分层
重点剧情使用整张 CG 特写
```

重要原则：

```text
玩家看到的是完整画面。
系统内部使用分层资产。
普通剧情尽量复用背景和人物立绘。
不要每个 beat 都重新生成一张完整图。
只有重点场景才切换到 CG。
```

---

## 工程原则

请遵守以下原则：

```text
1. 优先使用 TypeScript。

2. 核心逻辑必须放在 packages 中，不要埋在 React 组件里。

3. Runtime 不能依赖 Studio。

4. Agent 不能依赖 Runtime UI。

5. VNProject 必须是可序列化 JSON。

6. MVP 不接入真实 AI API。

7. MVP 不需要数据库、登录、支付、多人协作、云存储。

8. 真实 LLM、真实 AI 生图、PixiJS、Live2D、BGM、语音、分支剧情、部署 Provider 都作为未来扩展点保留接口。

9. 先做小而完整的闭环，再做复杂功能。

10. 每个 checkpoint 完成后尽量运行测试、类型检查或构建。
```

---

## 默认技术栈

如果仓库为空或很简单，默认使用：

```text
包管理器：pnpm
语言：TypeScript
前端：React + Vite
测试：Vitest
MVP Runtime：DOM + CSS 分层渲染
未来 Runtime：可增加 PixiJS Renderer
静态导出：index.html + project.vn.json + assets
```

如果仓库已经有 Next.js 或其他前端框架，可以复用已有结构，但必须保持模块边界清楚。

---

## 推荐目录结构

如果当前仓库为空或接近空仓库，请创建：

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

如果仓库已有结构，请适配已有结构，不要为了完全匹配上面目录而大规模重建。

---

## 必须提供的根目录命令

请确保根目录提供以下命令：

```bash
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

命令语义：

```text
pnpm dev
启动 Studio。

pnpm test
运行测试。

pnpm typecheck
运行 TypeScript 类型检查。

pnpm build
构建所有 app 和 package。

pnpm export:sample
导出一个静态可玩的 sample visual novel。
```

---

## VN Core 要求

`packages/vn-core` 是最重要的底层协议包。

它应该包含：

```text
VNProject
VNViewport
DialogueUIConfig
AssetManifest
VNAsset
CharacterProfile
VNChapter
VNScene
VNShot
VNBeat
VNLine
StageState
StagePatch
StageCharacter
CameraState
StageEffect
TransitionConfig
CompiledBeat
ValidationResult
```

它还应该包含这些纯函数：

```ts
createDefaultUIConfig()
splitTextToBeats()
detectLineKind()
applyStagePatch()
applySpeakerFocus()
resolveBeats()
validateProject()
renderDisplayText()
```

这些函数必须尽量保持纯函数、可测试、无 UI 依赖。

---

## Runtime 要求

`packages/vn-runtime` 负责播放视觉小说。

Runtime 必须支持：

```text
加载 VNProject
校验项目
解析 compiled beats
渲染当前 beat
next
previous
goToBeat
save
load
旁白显示
对话显示
对话自动加括号
说话人高亮
stage mode
cg mode
点击前进
键盘前进
```

MVP 渲染器：

```ts
DomVNRenderer
```

Renderer 接口：

```ts
VNRenderer
```

以后可以新增：

```ts
PixiVNRenderer implements VNRenderer
```

不要把 Runtime 写死成只能 DOM 渲染。

---

## Studio 要求

`apps/studio` 是用户编辑器。

MVP 至少实现一个单页编辑器，包含：

```text
顶部栏：
  项目标题
  Load Sample
  Generate VN Project
  Export Project JSON
  Export Static Playable

左侧：
  Chapter / Scene / Shot / Beat 树

中间：
  Runtime Preview

右侧：
  Inspector

底部或侧边：
  小说导入 textarea
  Agent 操作区
```

用户必须能够：

```text
加载 sample novel
粘贴小说文本
生成 VNProject
查看 beat 树
点击 beat
预览当前 beat
编辑 beat 文本
切换 narration / dialogue / monologue
修改 speaker
切换 CG mode
修改角色 expression
修改角色 position
next / previous 试玩
保存到 localStorage
从 localStorage 读取
导出 project JSON
```

---

## Agent Framework 要求

`packages/vn-agent` 是本地 Agent 流水线。

MVP 不接真实 LLM，不接真实 AI 生图。

必须实现：

```ts
createProjectFromNovel(input: {
  title: string;
  novelText: string;
  style?: {
    name?: string;
    mood?: string;
  };
}): VNProject
```

本地 pipeline 包含：

```text
cleanNovelText
splitChapters
splitScenes
splitNovelLines
splitTextToBeats
detectLineKind
extractCharacters
createPlaceholderAssets
planInitialStageForScenes
assignSpeakerFocus
markCGCandidates
validateProject
return VNProject
```

必须保留 provider 接口：

```ts
TextModelProvider
ImageGenerationProvider
VNAgentWorkflow
```

并实现 MVP mock provider：

```ts
MockTextModelProvider
MockImageGenerationProvider
```

---

## 文本规则

### 两行约束

默认配置：

```ts
maxLines: 2
maxCjkCharsPerLine: 30
maxCjkCharsPerBeat: 60
```

Agent 需要尽量把文本拆成两行以内的 beat。

拆分优先级：

```text
。
！
？
；
……
，
、
：
空格
硬切
```

不要让 Runtime 通过滚动显示长文本。  
文本太长就拆成多个 beat。

### 对话显示

内部数据：

```ts
{
  kind: "dialogue",
  speakerId: "lin_xue",
  text: "你真的决定要离开这里了吗？"
}
```

显示结果：

```text
林雪
「你真的决定要离开这里了吗？」
```

### 旁白显示

内部数据：

```ts
{
  kind: "narration",
  text: "夕阳从天台边缘落下，整座城市像被压低了声音。"
}
```

显示结果：

```text
夕阳从天台边缘落下，整座城市像被压低了声音。
```

不要把 `「」` 存进原始 text。  
括号只由 Runtime 在渲染时添加。

---

## 画面规则

### Stage Mode

普通剧情使用：

```text
background layer
character layer
effects layer
textbox UI layer
```

大多数 beat 只改变：

```text
文字
说话人高亮
人物表情
人物进出场
人物位置
```

不要频繁切换背景。

### CG Mode

重点剧情使用整张 CG。

适合 CG 的情况：

```text
手机屏幕亮起
真相揭露
世界线偏移
告白
死亡
坠落
枪声
崩溃
拥抱
分别
爆炸
血迹
关键物品特写
```

MVP 可以用 SVG placeholder CG。

---

## 说话人高亮规则

当 line 是 `dialogue` 或 `monologue`：

```text
当前 speaker：focus = active
其他可见角色：focus = dimmed
```

当 line 是 `narration`：

```text
所有可见角色：focus = normal
```

MVP 用 CSS 实现：

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

不要为了高亮重新生成图片。

---

## Placeholder 资产要求

MVP 不接真实 AI 生图。

请使用轻量 SVG placeholder 资产。

建议包含：

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

SVG 可以非常简单：

```text
背景：渐变色 + 场景名
人物：半身卡片 + 角色名
CG：全屏构图 + 事件标题
```

---

## Sample Novel

必须内置这个 sample：

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
章节
scene
多个 beat
旁白
对话
林雪角色
实验室背景
林雪 sprite
林雪说话时高亮
旁白时人物 normal
至少一个 CG beat
next / previous 可播放
```

---

## Exporter 要求

`packages/vn-exporter` 负责静态导出。

必须实现：

```ts
export async function exportStaticBundle(input: {
  project: VNProject;
  outDir: string;
  runtimeBundle?: string;
}): Promise<void>;
```

导出结果：

```text
dist/playable-sample/
  index.html
  project.vn.json
  assets/
```

`index.html` 必须能加载 `project.vn.json` 并播放 sample。

根目录必须提供：

```bash
pnpm export:sample
```

这个命令执行后生成静态 playable folder。

---

## 测试要求

使用 Vitest。

至少测试以下内容：

```text
splitTextToBeats
  长中文文本可以被拆成多个 beat
  每个 beat 尽量不超过 maxCjkCharsPerBeat
  优先按标点拆
  不输出空字符串

detectLineKind
  普通描述 => narration
  “你好吗？” => dialogue
  「你好吗？」 => dialogue
  林雪：“你好吗？” => dialogue with speaker

applyStagePatch
  更新 backgroundId
  切换 renderMode
  切换 cgAssetId
  按 characterId 合并角色 patch
  未修改角色保留
  新角色可添加

applySpeakerFocus
  说话人 active
  其他角色 dimmed
  旁白时所有角色 normal

resolveBeats
  输出 CompiledBeat[]
  resolvedStage 正确
  stagePatch 逐步累积
  支持 CG mode

createProjectFromNovel
  sample novel 可以生成 valid project
  characters 包含 林雪
  有 placeholder assets
  至少一个 CG candidate
  resolveBeats 后可播放
```

---

## 文档要求

请创建或更新：

```text
README.md
docs/ARCHITECTURE.md
docs/TASKLOG.md
```

### README.md 必须包含

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

### docs/ARCHITECTURE.md 必须解释

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

### docs/TASKLOG.md 格式

每个 checkpoint 使用：

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

---

## 实现顺序

请严格按以下 checkpoint 实现。

### Checkpoint 1: Repository setup

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

---

### Checkpoint 2: VN Core

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

---

### Checkpoint 6: Static Exporter

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

---

### Checkpoint 7: Final verification and documentation

运行：

```bash
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
```

然后补齐：

```text
README.md
docs/ARCHITECTURE.md
docs/TASKLOG.md
```

---

## 完成标准

只有满足以下条件才算完成：

```text
1. 可以本地打开 Studio。
2. 可以加载 sample novel。
3. 可以粘贴自定义小说并生成 VNProject。
4. 可以预览生成后的视觉小说。
5. 播放器有 16:9 全屏视觉区域。
6. 播放器底部有两行文本框。
7. 对话显示角色名和 「」。
8. 旁白显示纯文字。
9. 说话人高亮有效。
10. 背景在多个 beat 中复用。
11. sample 至少出现一个 CG beat。
12. 可以 next / previous。
13. 可以 local save / load。
14. 可以导出 project JSON。
15. 可以导出静态 playable sample。
16. pnpm test 通过。
17. pnpm typecheck 通过。
18. pnpm build 通过。
19. pnpm export:sample 通过。
20. README、ARCHITECTURE、TASKLOG 都存在且内容完整。
```

---

## 重要提醒

请优先保证 MVP 闭环，不要一开始追求复杂功能。

正确优先级：

```text
1. VNProject schema 稳定
2. split / detect / resolve 纯函数可靠
3. Agent 能从小说生成项目
4. Runtime 能播放
5. Studio 能编辑和预览
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

---

## GitHub 上传附加规则

- 以后提交或上传到 GitHub 时，commit message 必须包含 `Co-authored-by: yutong43 <yutong43@illinois.edu>`。
