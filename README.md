# NovelGameMaker

NovelGameMaker 是一个 Web 视觉小说 / Galgame 制作工具。它把小说文本导入后，通过本地 Agent 流水线生成可编辑的 `VNProject`，再用 Web Runtime 播放成传统 Galgame 风格的作品。

核心闭环：

```text
小说文本 -> 本地 Agent -> VNProject JSON -> Studio 编辑预览 -> Runtime 播放 -> 静态 playable 导出
```

MVP 默认不接真实 AI API，不需要数据库、登录、支付或云服务。仓库里也包含生产化地基，例如 API、平台服务、任务队列、发布审批、账号和计费接口；这些是可选扩展，不影响本地创作闭环。

## 快速开始

```bash
corepack enable
pnpm install
pnpm dev
```

如果 Windows 终端提示 `pnpm` 不是可识别命令，可以直接把命令写成：

```powershell
corepack pnpm install
corepack pnpm dev
```

打开 Studio：

```text
http://127.0.0.1:5173/
```

Studio 支持加载 sample、粘贴小说、生成 VNProject、查看 beat tree、编辑文本、切换旁白/对话/内心、调整说话人和角色状态、预览播放、localStorage 存取、导出项目 JSON 和导出可玩的静态页面。

## 常用命令

```bash
pnpm dev            # 启动 Studio
pnpm dev:player     # 启动独立 Player
pnpm dev:api        # 启动生产 API 骨架
pnpm dev:worker     # 启动本地任务 worker
pnpm test           # 运行测试
pnpm typecheck      # TypeScript 类型检查
pnpm build          # 构建 app 和 package
pnpm export:sample  # 导出 sample playable
```

Windows 用户也可以用 `corepack pnpm <script>` 运行同一组命令，例如：

```powershell
corepack pnpm build
corepack pnpm export:sample
```

导出 sample 后，可用静态服务器打开：

```bash
python3 -m http.server 5174 --bind 127.0.0.1 --directory dist/playable-sample
```

然后访问：

```text
http://127.0.0.1:5174/
```

## 项目结构

```text
apps/
  studio/      # 创作者编辑器
  player/      # 独立玩家端
  api/         # 生产 API 骨架

packages/
  vn-core/     # VNProject 协议、beat 解析、舞台状态、校验
  vn-agent/    # 本地 heuristic Agent 和 provider 接口
  vn-runtime/  # Web 视觉小说 Runtime
  vn-exporter/ # 静态 playable 导出
  vn-platform/ # 生产平台服务层

samples/       # 内置示例小说和 VNProject
docs/          # 架构、生产部署、任务记录
scripts/       # 导出、资产同步、审计脚本
```

## 核心能力

- 从小说文本生成章节、场景、shot 和两行以内的 beat。
- 区分旁白、对话和内心独白。
- Runtime 自动为对话添加 `「」`，原始文本不保存括号。
- 普通剧情使用背景、角色立绘和文字框分层渲染。
- 重点剧情支持 CG mode。
- 当前说话人高亮，其他角色变暗；旁白时角色恢复 normal。
- 支持 next、previous、goToBeat、save、load。
- 支持导出 `project.vn.json` 和静态 playable 文件夹。

## Sample

内置示例位于：

```text
samples/steins-like-lab/
```

它包含实验室背景、林雪角色、多个 beat、对话、旁白和至少一个 CG beat，可用于验证完整播放链路。

额外的中式民俗推理样例位于：

```text
samples/fog-name-village/
```

它包含线性化 `project.vn.json`、原始小说文本、可替换占位背景/立绘/证据图，以及 Key、证据、人物、流程节点等结构化源数据，适合验证更长剧情导入和后续分支系统设计。

同步雾名村到独立 Player：

```bash
pnpm assets:player -- fog-name-village
pnpm dev:player
```

或在 Windows 上：

```powershell
corepack pnpm assets:player -- fog-name-village
corepack pnpm dev:player
```

直接导出雾名村 playable：

```bash
pnpm export:fog
```

## 生产化入口

本地 MVP 不依赖生产 API。需要 API、worker、Postgres、对象存储、发布审批、账号、SSO、计费、Webhook、Docker 部署等能力时，优先阅读：

- [docs/PRODUCTION.md](docs/PRODUCTION.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [.env.example](.env.example)

生产镜像命令：

```bash
pnpm docker:build:api
pnpm docker:build:studio
pnpm docker:build:player
```

数据库迁移：

```bash
DATABASE_URL=postgres://user:password@host:5432/agentic_galgame pnpm db:migrate
```

## MVP 限制

- 默认使用本地 deterministic heuristic，不调用真实 LLM。
- 默认使用 SVG placeholder 资产，不调用真实生图服务。
- Runtime MVP 使用 DOM + CSS 分层渲染。
- 分支剧情、BGM、语音、Live2D、复杂动画和多人协作仍是未来扩展。
- 生产 API 中的账号、计费、SSO、审批和运营面板是平台地基，不代表完整 SaaS 已完成。

## 未来扩展

- 接入真实 `TextModelProvider` 生成更稳定的 VNProject。
- 接入真实 `ImageGenerationProvider` 生成背景、立绘和 CG。
- 增加 PixiJS Renderer。
- 增加 BGM、语音、分支剧情和更完整的存档系统。
- 将静态 playable 发布到 CDN 或对象存储。
- 完善生产级账号治理、团队协作、计费财务和审计能力。
