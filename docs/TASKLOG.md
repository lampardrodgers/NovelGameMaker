# TASKLOG

## Checkpoint 1: Repository setup

Status: done

What changed:
- 检查仓库后确认当前只有目标文档和 AGENTS.md，接近空仓库。
- 计划创建 pnpm monorepo，包含 Studio app 与 vn-core、vn-agent、vn-runtime、vn-exporter packages。
- 根目录提供 dev、test、typecheck、build、export:sample 命令。

Validation:
- command: pnpm install: passed
- command: pnpm typecheck: passed

Notes:
- MVP 按本地 deterministic heuristic 与 SVG placeholder 实现，不接真实 AI API。

## Checkpoint 2: VN Core

Status: done

What changed:
- 实现 VNProject、资产、角色、章节、场景、shot、beat、line、StageState、StagePatch、CompiledBeat 等核心类型。
- 实现 createDefaultUIConfig、splitTextToBeats、detectLineKind、applyStagePatch、applySpeakerFocus、resolveBeats、validateProject、renderDisplayText。
- 增加 sample novel helper 与手写 sample project。
- 添加 Vitest 单测覆盖文本拆分、line kind、stage patch、speaker focus、resolve、display text 和项目校验。

Validation:
- command: pnpm test: passed
- command: pnpm typecheck: passed

Notes:
- Runtime 显示括号由 renderDisplayText 处理，原始 line.text 不保存 `「」`。
- Stage patch 逐步累积，speaker focus 在 resolve 时应用到 resolvedStage。

## Checkpoint 3: Agent Framework

Status: done

What changed:
- 实现 TextModelProvider、ImageGenerationProvider、VNAgentWorkflow 接口和 mock provider。
- 实现 cleanNovelText、splitChapters、splitScenes、splitNovelLines、extractCharacters、createPlaceholderAssets。
- 实现本地 createProjectFromNovel workflow，包含章节/场景/beat 拆分、说话人推断、初始舞台规划和 CG candidate 标记。
- sample novel 可生成合法 VNProject，包含林雪、实验室背景、林雪 sprite、placeholder assets 和至少一个 CG beat。

Validation:
- command: pnpm test: passed
- command: pnpm typecheck: passed

Notes:
- 无说话人引号会优先使用上一段提到的人物；样例中的“她”作为林雪 alias 处理。
- CG candidate 使用关键词规则映射到 phone/worldline/default CG placeholder。

## Checkpoint 4: Runtime

Status: done

What changed:
- 实现 VNRenderer 接口、VNRuntime、DomVNRenderer、TextboxController、SaveManager、projectLoader。
- Runtime 支持加载并校验 VNProject、resolve compiled beats、next、previous、goToBeat、save、load。
- DOM renderer 支持 stage mode、CG mode、背景/人物分层、底部两行文本框、说话人姓名和 dialogue bracket 显示。
- DOM renderer 支持点击、Space/Enter/ArrowRight 前进，ArrowLeft 后退。

Validation:
- command: pnpm test: passed
- command: pnpm typecheck: passed

Notes:
- DomVNRenderer 使用 VNRenderer 接口，后续可以替换 PixiVNRenderer。
- Studio 预览阶段可使用 inline SVG placeholder，静态导出阶段仍会写出 assets 文件。

## Checkpoint 5: Studio App

Status: done

What changed:
- 实现 React + Vite 单页 Studio，包含顶部栏、beat tree、Runtime Preview、Inspector、Novel Import。
- 支持 Load Sample、Generate VN Project、next/previous、点击 beat、编辑文本、切换 narration/dialogue/monologue、修改 speaker、CG mode、角色 expression/position/visible。
- 支持 localStorage save/load、导出 project JSON、浏览器端导出单文件 static playable HTML。
- Runtime Preview 复用 VNRuntime + DomVNRenderer，支持 16:9 画面、底部两行文字框、speaker focus 和 CG mode。

Validation:
- command: pnpm dev: passed, opened http://127.0.0.1:5173/
- command: Browser smoke check: passed
- command: pnpm build: passed

Notes:
- 浏览器检查发现并修复角色抽取误判“手里紧紧”的问题。
- Smoke screenshot: docs/studio-smoke.png。

## Checkpoint 6: Static Exporter

Status: done

What changed:
- 实现 exportStaticBundle，输出 index.html、project.vn.json 和 assets SVG placeholder。
- 实现独立静态 playable HTML，运行时加载 project.vn.json，并在浏览器内 resolve beats。
- 更新 pnpm export:sample，生成 samples/steins-like-lab/project.vn.json 和 dist/playable-sample。

Validation:
- command: pnpm export:sample: passed
- command: static server smoke check: passed at http://127.0.0.1:5174/

Notes:
- 静态 playable 支持 Previous/Next、点击前进、键盘前进/后退、speaker name、dialogue brackets、stage mode、CG mode。

## Checkpoint 7: Final verification and documentation

Status: done

What changed:
- 补齐 README.md，说明项目定位、安装、启动、测试、构建、sample 导出、静态部署、MVP 限制和未来扩展。
- 补齐 docs/ARCHITECTURE.md，说明 VN Core Protocol、Studio、Runtime、Agent Framework、Exporter、Stage/CG、两行 beat、说话人高亮和未来 provider 接入。
- 更新 docs/TASKLOG.md，记录全部 checkpoint 和验证结果。
- 增加 docs/COMPLETION_AUDIT.md，把 20 条完成标准映射到证据。
- 增加 pnpm audit:mvp 和 pnpm verify:mvp，自动审计 sample、导出文件、CG、高亮、背景复用、括号规则和构建产物卫生。
- 补强测试：Studio jsdom 交互测试、Runtime DOM renderer 测试、Exporter 文件输出测试、Core/Agent 边界测试。

Validation:
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm verify:mvp: passed
- command: Browser Studio sample playback: passed, verified dialogue speaker/brackets and CG mode at http://127.0.0.1:5173/
- command: Browser static playable playback: passed, verified dialogue speaker/brackets and CG image at http://127.0.0.1:5174/

Notes:
- dist/playable-sample 已生成静态可玩 sample。
- docs/studio-smoke.png 保留为 Studio 浏览器 smoke check 截图。

## Checkpoint 8: Image generation provider audit

Status: done

What changed:
- 明确当前默认图片生成方式：SVG placeholder，不调用 Codex/image2 或 OpenAI API。
- 新增 Codex/image2 manifest 工作流：`createCodexImage2Manifest()`、`applyGeneratedAssetManifest()`、`pnpm image2:manifest`。
- 新增 OpenAI-compatible 图片 provider：`OpenAIImageGenerationProvider`、`createOpenAIImageGenerationProviderFromEnv()`。
- 支持 `baseURL`、第三方 `urlbase`、`OPENAI_BASE_URL`、`OPENAI_URLBASE`，endpoint 规范到 `/v1/images/generations`。
- 支持解析 OpenAI-compatible `b64_json` 和 `url` 图片响应。
- 更新 docs/IMAGE_GENERATION.md，说明 placeholder、Codex/image2 manifest、OpenAI-compatible provider 状态。
- 增加 Agent 测试覆盖 Codex/image2 manifest prompt、输出路径和回填 `placeholder: false` 行为。
- 增加 Agent 测试覆盖第三方 URL base、鉴权头、请求 body、`b64_json` 和 `url` 响应解析。

Validation:
- command: pnpm --filter @agentic-galgame/vn-agent test: passed
- command: pnpm --filter @agentic-galgame/vn-agent typecheck: passed
- command: pnpm image2:manifest: passed
- command: Chrome custom novel E2E: passed, generated 9 beats, verified dialogue speaker/brackets, CG mode, inspector edit, local save/load, export status feedback
- command: pnpm verify:mvp: passed

Notes:
- 仓库不保存、不打印 API key。真实 API smoke test 需要在运行环境中临时注入 key；代码测试使用 mock fetch，避免 secret 出现在命令或文件中。
- 用户提供的第三方 base URL 可通过 `urlbase` 或 `OPENAI_BASE_URL` / `OPENAI_URLBASE` 接入。
- Chrome custom novel screenshot: docs/chrome-custom-novel-e2e.png。

## Checkpoint 9: Player fullscreen correction

Status: done

What changed:
- 明确 `5173` 是 Studio 编辑器，`5174` 是玩家 Runtime。
- 修正 `packages/vn-exporter` 生成的静态玩家页，去掉居中 padding 和最大宽度，在全屏容器内保持 16:9 stage，避免拉伸变形。
- 修正 Studio 内 “Export Static Playable” 下载的单文件 playable，同样使用全屏 16:9 玩家布局。
- 重新导出 `dist/playable-sample`。

Validation:
- command: pnpm export:sample: passed
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm audit:mvp: passed
- command: HTTP check for http://127.0.0.1:5174/: passed, exported HTML contains full-viewport page and 16:9 stage CSS.

Notes:
- 当前默认画面资产是场景化 SVG placeholder，不是照片级或 AI 生成图。OpenAI-compatible 和 Codex/image2 provider 已支持，但还没有默认接入 Studio 自动批量生图落盘。

## Checkpoint 10: Requirement re-audit fixes

Status: done

What changed:
- 重新对照 `CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md` 和 `AGENTS.md` 审计当前实现。
- Core 补齐 `DialogueUIConfig.quoteStyle/showNameplate/narrationShowNameplate/typewriter`，`renderDisplayText()` 支持 jp_corner/cn_double/none 和 nameplate 开关。
- Core `detectLineKind()` 增强 `林雪低声说：“...”` 等说话人识别。
- Core/Agent 补齐 `VNBeat.meta.cgCandidateScore/cgCandidateReason`，Agent CG candidate 会写入分数和原因。
- Agent provider 接口补齐 `id`、`generateStructured()`、`generateImage()`、`run()` 形状；Mock provider 不调用外部 API。
- Agent 生成的 shot 补齐 `initialStage`，`resolveBeats()` 支持从 shot initialStage 开始。
- Agent 生成 `startBeatId` 和 beat `nextBeatId`，Runtime 和导出播放器会尊重 `startBeatId`。
- Runtime `goToBeat()` 支持 beatId，`SaveManager` 按 beatId 存档，`VNRuntime.getState()` 暴露当前 beat 状态。
- Studio Runtime Preview 增加 Save Preview / Load Preview；Inspector 显示 beat id、background、CG score/reason、角色 focus，并支持 farLeft/farRight。
- 静态玩家端和 Studio 单文件 playable 增加可见 Save / Load 控件。

Validation:
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm image2:manifest: passed
- command: pnpm audit:mvp: passed
- command: Browser player QA at http://127.0.0.1:5174/?qa=fullscreen: passed, title matches sample, no Studio UI, 1280x720 stage ratio is 1.7777777777777777, Previous/Next/Save/Load visible, no console errors.
- command: Browser player interaction QA: passed, advanced to `cg_phone_screen`, saved, moved previous, loaded back to CG beat, no console errors.
- command: Browser Studio QA at http://127.0.0.1:5173/?qa=studio: passed, toolbar/tree/preview/inspector present, Inspector includes CG/focus fields, Save Preview/Load Preview restored beat 3, no console errors.

Notes:
- MVP 默认仍不调用真实 LLM 或真实 AI 生图 API。图片能力默认是轻量 SVG placeholder；OpenAI-compatible 和 Codex/image2 是保留/可选生成接口。

## Checkpoint 11: Strict requirement re-audit follow-up

Status: done

What changed:
- 再次逐项对照 `CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md` 和 `AGENTS.md`，没有再按“页面能打开”直接判断完成。
- 补齐 `docs/CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md`，让实际文档结构和推荐目录一致。
- Agent 固定生成稳定 `unknown_speaker` 角色；无署名引号对话在无法通过上下文推断时使用 `unknown_speaker`，不再误落到第一个角色。
- `sprite_unknown` placeholder 绑定到 `unknown_speaker`，无署名对话作为第一 beat 时可以把未知说话人放到舞台上。
- 新增 `LocalHeuristicVNAgentWorkflow`，让 Agent Framework 具备可调用的本地 deterministic workflow，而不只是接口和函数。
- 修正静态导出播放器内嵌 resolver，导出 HTML 现在和 Runtime package 一样会读取 `shot.initialStage`。
- 修正 Studio Inspector：不在当前 resolved stage 的角色 `Visible` 默认不再误显示为勾选。
- `pnpm audit:mvp` 新增检查：`unknown_speaker`、本地 workflow、`docs/CODEX_GOAL...`、静态播放器 16:9 全屏、save/load、导出项目合法性。

Validation:
- command: pnpm verify:mvp: passed
- command: Browser player QA at http://127.0.0.1:5174/?qa=player-after-fixes: passed, no Studio UI, stage ratio 1.7777777777777777, dialogue speaker/brackets, active 林雪, CG, Save/Load, no console errors.
- command: Browser Studio QA at http://127.0.0.1:5173/?qa=studio-after-fixes: passed, toolbar/tree/preview/inspector/novel import present, preview ratio 1.7777777777777777, Save Preview/Load Preview restored beat 3, unknown_speaker visible checkbox false, no console errors.

Notes:
- 本次修复不启用真实 LLM 或真实 AI 生图；默认 MVP 仍是本地 heuristic + SVG placeholder。
- 用户提供的第三方 key 没有写入仓库、日志或默认运行路径。

## Implementation Plan

1. Repository setup -> verify: pnpm install, pnpm typecheck.
2. VN Core -> verify: pnpm test, pnpm typecheck.
3. Agent Framework -> verify: pnpm test, pnpm typecheck.
4. Runtime -> verify: pnpm test, pnpm typecheck.
5. Studio App -> verify: pnpm dev smoke check, pnpm build.
6. Static Exporter -> verify: pnpm export:sample.
7. Final verification and docs -> verify: pnpm test, pnpm typecheck, pnpm build, pnpm export:sample.
8. Image generation provider audit -> verify: pnpm image2:manifest, pnpm verify:mvp.
9. Player fullscreen correction -> verify: pnpm export:sample, pnpm test, pnpm typecheck, pnpm build, pnpm audit:mvp.
10. Requirement re-audit fixes -> verify: pnpm test, pnpm typecheck, pnpm build, pnpm export:sample, Browser player QA, Browser Studio QA.
11. Strict requirement re-audit follow-up -> verify: pnpm test, pnpm typecheck, pnpm build, pnpm export:sample, pnpm image2:manifest, pnpm audit:mvp, Browser player QA, Browser Studio QA.
12. Production foundation -> verify: pnpm verify:production, API smoke, Browser Studio API QA.
13. Production safety and worker -> verify: pnpm verify:production, worker smoke.
14. Backend image generation task pipeline -> verify: pnpm verify:production, dist worker image-generation smoke.
15. Studio asset generation backfill -> verify: Studio/API tests, pnpm verify:production, pnpm audit:mvp.
16. Backend text generation task pipeline -> verify: pnpm verify:production, dist worker text-generation smoke.
17. Owner-scoped API authorization -> verify: pnpm verify:production, dist owner-scope smoke.
18. Production quota, usage, audit and retry -> verify: platform/API tests, pnpm verify:production, runtime smoke.
19. Content safety review and blocking -> verify: platform/API tests, pnpm verify:production, content-safety API smoke.
20. Hashed access token lifecycle -> verify: platform/API tests, pnpm verify:production, access-token API smoke.
21. Independent Player app -> verify: player tests/build, pnpm verify:production, Player dev smoke.
22. Team role authorization -> verify: platform/API tests, pnpm verify:production, dist team-role API smoke.
23. Backend publish to Player -> verify: platform/API tests, pnpm verify:production, dist publish API smoke.
24. Published release history and rollback -> verify: platform/API tests, pnpm verify:production, dist release rollback smoke.
25. Stable public current URL and deployment cache invalidation -> verify: platform/API/Studio tests, pnpm verify:production, dist current URL rollback smoke.
26. Release approval workflow -> verify: platform/API/Studio tests, pnpm verify:production, dist approval-required publish smoke.
27. Studio release approval review UI -> verify: Studio tests, pnpm verify:production, dev server HTTP smoke.
28. Release diff and stale approval guard -> verify: platform/API/Studio tests, pnpm verify:production.
29. Release approval comments -> verify: platform/API/Studio tests, pnpm audit:production, pnpm verify:production.
30. Release approval webhook notifications -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
31. Notification delivery outbox and retry -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
32. Studio notification delivery monitor -> verify: Studio tests, pnpm audit:production, pnpm verify:production.
33. Owner operations summary -> verify: platform/API/Studio tests, pnpm audit:production, pnpm verify:production.
34. Team invitation lifecycle -> verify: platform/API/Studio tests, pnpm audit:production, pnpm verify:production.
35. Team invitation webhook delivery -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
36. User account registration and session auth -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
37. Email verification and password reset -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
38. Studio account session UI -> verify: Studio tests, pnpm audit:production, pnpm verify:production.
39. Public health check and Postgres migration runner -> verify: platform/API tests, pnpm audit:production, pnpm verify:production.
40. Worker-driven Studio asset generation -> verify: Studio tests, pnpm audit:production, pnpm verify:production.
41. Studio and Player production images -> verify: pnpm audit:production, docker compose config, pnpm verify:production.
42. API request tracing and security headers -> verify: API tests/typecheck/build, pnpm audit:production, pnpm verify:production.

## Checkpoint 12: Production foundation

Status: done

What changed:
- 新增 `packages/vn-platform`，拆出生产平台层：项目记录、生成任务、资产记录、仓库接口、服务层和资产存储接口。
- 新增 `FileDatabase`、`ProjectService`、`GenerationJobService`、`LocalAssetStorage`，让本地开发具备持久化、任务和资产落盘能力。
- 新增 `packages/vn-platform/migrations/0001_production_schema.sql`，定义 Postgres 生产表：`studio_projects`、`generation_jobs`、`project_assets`。
- 新增 `apps/api` 后端 API 服务，支持 health、项目创建/读取/列表、任务创建/运行/读取。
- API 增加 CORS、request body size limit 和可选 bearer token 鉴权；生产通过 `API_AUTH_TOKEN` 开启。
- Studio 新增生产 API client，支持通过 `VITE_API_BASE_URL` 连接后端，并在工具栏暴露 Owner、Save API、Load API。
- 新增 `PostgresProjectRepository`、`PostgresJobRepository`、`PostgresAssetRepository` 和 `NodePostgresExecutor`，`DATABASE_URL` 存在时 API 可切换到 Postgres。
- 新增 `S3CompatibleAssetStorage`，`ASSET_STORAGE_PROVIDER=s3` 时 API 可上传到 S3/R2/MinIO compatible object storage。
- API 新增 `POST /v1/assets` 和 `GET /v1/projects/:id/assets`，支持资产上传和项目资产列表。
- package exports 改为 `dist` 产物，并在测试/Vite 中保留源码 alias，避免生产启动依赖 workspace 源码。
- 修正生产 ESM dist 相对 import，确保 `node dist/index.js` 能直接启动 API，而不是只在 tsx/Vite 环境里可用。
- API 输入错误改为返回明确 400/413；无效 base64 资产上传不会再被当作 500 内部错误。
- 新增 `.env.example`、`Dockerfile.api`、`docker-compose.production.yml`，提供生产 API 部署骨架。
- 新增 `pnpm dev:api`、`pnpm audit:production`、`pnpm verify:production`。
- 新增 `docs/PRODUCTION.md`，说明 API、环境变量、Postgres/S3 配置、AI provider 开关和生产限制。
- 更新 README 与 ARCHITECTURE，明确当前状态是 MVP + 生产版地基，不是完整 SaaS 完成态。

Validation:
- command: pnpm verify:production: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: production API start with `pnpm --filter @agentic-galgame/api start`: passed at http://127.0.0.1:8790
- command: API smoke at http://127.0.0.1:8790: passed, health ok, project created from novel, edited VNProject saved through POST /v1/projects, owner project list returned 1 item, asset uploaded/listed, asset_generation job returned waiting_for_credentials.
- command: Browser Studio API QA at http://127.0.0.1:5173/?qa=production-api: passed DOM/interaction checks, API Online visible, Save API and Load API enabled, loaded API project title restored to 浏览器云端保存测试, no console errors. Screenshot capture failed twice with CDP Page.captureScreenshot timeout.

Notes:
- 真实 AI / 图片生成 provider 仍未启用，因为密钥策略还未确认。`asset_generation` 任务默认进入 `waiting_for_credentials`，不会调用外部 API。
- Checkpoint 12 只是生产地基完成，不代表完整商用 SaaS 完成。用户注册/登录、团队权限、支付、监控、真实 TextModelProvider 和真实 ImageGenerationProvider 后端执行仍待实现。

## Checkpoint 13: Production safety and worker

Status: done

What changed:
- `loadConfig()` 增加生产安全约束：`NODE_ENV=production` 时必须配置至少 24 字符的非 placeholder `API_AUTH_TOKEN`，并拒绝 `CORS_ORIGIN=*`。
- API 增加内存限流，支持 `API_RATE_LIMIT_WINDOW_MS` 和 `API_RATE_LIMIT_MAX_REQUESTS`，超过限制返回 429。
- API 错误响应继续保持安全边界：客户端输入错误返回 400/413，未知内部错误返回泛化 500。
- 新增 `apps/api/src/worker.ts`，后台 worker 可以轮询 queued jobs 并调用 `runNext()`。
- 新增 `pnpm dev:worker` 和 `pnpm worker:api`，Docker Compose 新增 `worker` 服务。
- 更新 `.env.example`、README、ARCHITECTURE、PRODUCTION 和生产审计，覆盖限流、worker 和生产安全开关。

Validation:
- command: pnpm --filter @agentic-galgame/api test: passed, 9 tests including production config rejection and rate limit.
- command: pnpm --filter @agentic-galgame/vn-platform test: passed.
- command: pnpm verify:production: passed.
- command: worker smoke with `WORKER_RUN_ONCE=true`: passed, queued `novel_to_project` job processed to `succeeded` and returned a projectId.

Notes:
- 这里实现的是 API token + ownerId 的生产安全基线，不是完整账号体系。真正商用 SaaS 仍需要用户注册/登录、团队权限、计费、配额、审计日志和集中监控。
- 真实 AI provider 仍保持禁用，未写入或调用用户提供的第三方 key。

## Checkpoint 14: Backend image generation task pipeline

Status: done

What changed:
- `vn-platform` 新增 `ImageAssetGenerator` 窄接口，平台层不依赖具体 AI SDK。
- `GenerationJobService` 的 `asset_generation` 从占位状态推进为真实任务路径：调用注入的 image provider，解析 `data:image/...;base64,...` 或下载图片 URL，再通过 `AssetService.store()` 写入本地或 S3-compatible storage。
- `createPlatform()` 支持注入 `imageGenerator` 和生成结果 fetch。
- `apps/api` 接入 `@agentic-galgame/vn-agent` 的 `OpenAIImageGenerationProvider`，通过 `AI_PROVIDER_ENABLED=true`、`AI_IMAGE_PROVIDER=openai-compatible`、`OPENAI_API_KEY` 和 `OPENAI_BASE_URL` 启用。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 IMAGE_GENERATION 文档补充 backend `asset_generation` 任务路径。
- 生产审计新增检查：AI image provider 默认关闭、OpenAI image env、API provider wiring、任务调用 provider 并落盘、API 集成测试覆盖图片任务。

Validation:
- command: pnpm --filter @agentic-galgame/api test: passed, 11 tests including mocked OpenAI-compatible image generation job.
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 9 tests including injected image provider asset generation.
- command: pnpm verify:production: passed.
- command: dist worker image-generation smoke: passed, fake OpenAI-compatible `/v1/images/generations` returned b64 image, `asset_generation` job processed to `succeeded`, output provider `openai-compatible-images`, asset list returned 1 item.

Notes:
- 没有使用或写入用户提供的第三方 key；真实外部 provider smoke 仍需要通过运行环境 secret 临时注入。
- 当前只完成图片生成任务后端路径。真实 TextModelProvider 后端任务、内容安全审核、失败重试、成本配额和 Studio 批量生成 UI 仍待实现。

## Checkpoint 15: Studio asset generation backfill

Status: done

What changed:
- Studio 新增 `AssetGenerationPanel`，显示当前 placeholder image asset 数量，并暴露 `Generate Placeholder Assets` 操作。
- Studio production API client 增加 `createJob()`、`runJob()`、`listAssets()` 和 `resolvePublicUrl()`。
- Studio 生成资产工作流：先保存项目到 API，再为 placeholder background/sprite/CG 创建 `asset_generation` job，任务成功后把 `output.publicUrl` 回填到 `VNAsset.src`，将 `placeholder` 改为 `false`，并再次保存项目。
- API 增加 local asset serving：`GET /assets/<storageKey>`，本地文件存储模式下生成资产可以被 Studio Preview 直接加载。
- 生产审计新增检查 Studio 资产生成 UI、job client、URL 回填、本地资产读取和测试覆盖。
- README、PRODUCTION、IMAGE_GENERATION、ARCHITECTURE 更新了 Studio 回填流程和本地 `/assets` 读取路径。

Validation:
- command: pnpm --filter @agentic-galgame/api test: passed, 12 tests including local stored asset serving.
- command: pnpm --filter @agentic-galgame/studio test: passed, 7 tests including placeholder asset generation through production API and generated URL backfill.
- command: pnpm verify:production: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm audit:production: passed.
- command: content safety API smoke at http://127.0.0.1:8787: passed, unsafe novel import returned 422 and `/v1/content-safety?ownerId=content-safety-smoke` returned blocked review.
- command: local API health smoke at http://127.0.0.1:8787/health: passed.
- command: local Studio smoke at http://127.0.0.1:5173/: passed, HTML 200.
- command: local static player smoke at http://127.0.0.1:5174/project.vn.json: passed, sample title `实验室里的蓝光`.

Notes:
- 当前 Studio MVP 直接调用 `/v1/jobs/:id/run` 运行生成任务，便于本地闭环验证；生产部署可以改为只 enqueue，由独立 worker 消费。
- 仍未完成：选择性资产生成、重试/取消、生成成本预估、内容审核状态和生成质量评估。

## Checkpoint 16: Backend text generation task pipeline

Status: done

What changed:
- `vn-agent` 新增 `OpenAITextModelProvider`，支持 OpenAI-compatible `/v1/chat/completions`、`response_format: json_object`、结构化 JSON 解析、`OPENAI_TEXT_API_KEY` 和 `OPENAI_URLBASE`。
- `vn-platform` 新增 `NovelProjectGenerator` 注入点，`ProjectService.createFromNovel()` 可使用真实 provider 生成 `VNProject`，默认仍走本地 heuristic。
- `apps/api` 增加 `AI_TEXT_PROVIDER=openai-compatible`、`OPENAI_TEXT_MODEL`、`OPENAI_TEXT_TEMPERATURE` 配置，并把文本 provider 接入 `novel_to_project` job。
- 文本 provider 生成路径会把小说文本和本地 heuristic baseline `VNProject` 一起放入 prompt，要求模型返回完整 `VNProject` JSON，保存前使用 `validateProject()` 校验。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和生产审计补充文本 provider 配置与验证。

Validation:
- command: pnpm --filter @agentic-galgame/vn-agent test: passed, 18 tests including OpenAI-compatible text provider.
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 10 tests including injected project generator.
- command: pnpm --filter @agentic-galgame/api test: passed, 14 tests including mocked OpenAI-compatible text generation job.
- command: pnpm verify:production: passed.
- command: dist worker text-generation smoke: passed, fake `/v1/chat/completions` returned full VNProject JSON, `novel_to_project` job processed to `succeeded`, saved project title `AI 文本 Smoke 项目`.

Notes:
- 仍未使用或写入真实第三方 key；真实外部 provider smoke 需要通过运行环境 secret 注入。
- 当前完成的是 provider-backed project generation path。仍需补内容安全审核、失败重试策略、成本配额、模型输出质量评估和人工审核流程。

## Checkpoint 17: Owner-scoped API authorization

Status: done

What changed:
- `ApiConfig` 新增 `API_OWNER_TOKENS`，格式为 `ownerId:token,ownerId2:token2`。
- `API_AUTH_TOKEN` 作为 admin token 保留；owner-scoped token 只能访问绑定 owner 的项目、任务和资产。
- API 路由会校验 query/body/project/job 中的 owner scope，拒绝跨 owner 访问。
- `POST /v1/jobs/run-next` 改为 admin-only，owner token 不能直接消费全局队列。
- 保存已有 project 时会校验原 owner，不允许通过改 body ownerId 抢占其他 owner 的项目。
- 本地开发未配置任何 token 时仍保持 admin-like 开放模式，方便 MVP 调试。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和生产审计补充 owner-scoped token 说明。

Validation:
- command: pnpm --filter @agentic-galgame/api test: passed, 16 tests including owner-scoped bearer tokens.
- command: pnpm verify:production: passed.
- command: dist owner-scope smoke: passed, owner_a token can list owner_a, cannot list owner_b, cannot run admin queue; admin token can run admin queue.

Notes:
- 这不是完整账号/团队系统，但已经从单一 bearer token 推进到可验证的 owner 级租户隔离。
- 后续仍需用户注册/登录、团队成员、角色权限和更完整的账号管理体验。

## Checkpoint 18: Production quota, usage, audit and retry

Status: done

What changed:
- `vn-platform` 新增 `UsageEventRecord`、`AuditEventRecord`、quota/cost/retry policy 类型，以及 `UsageRepository` / `AuditRepository`。
- `FileDatabase` 和 Postgres repositories 增加 usage/audit 持久化；Postgres migration 增加 `usage_events`、`audit_events`、`generation_jobs.max_attempts` 和 `generation_jobs.next_run_at`。
- `GenerationJobService` 入队前检查每日 job/text/image 配额，超额抛出 `QuotaExceededError`；API 映射为 429。
- `GenerationJobService` 记录 job 入队、成功、失败和估算成本；provider 失败时按 `JOB_RETRY_DELAY_MS` 指数退避，达到 `JOB_MAX_ATTEMPTS` 后才进入 failed。
- `ProjectService`、`AssetService` 和 job service 写入审计事件，覆盖 project create/update、asset store、job started/succeeded/failed/retry/waiting credentials。
- API 新增 `GET /v1/usage?ownerId=` 和 `GET /v1/audit?ownerId=`，并继续遵守 owner-scoped token 权限。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和生产审计脚本补充配额、用量、审计和重试说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 15 tests including quota, usage/cost/audit and retry.
- command: pnpm --filter @agentic-galgame/api test: passed, 19 tests including usage/audit endpoints and quota 429.
- command: pnpm verify:production: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm audit:production: passed.
- command: local API smoke at http://127.0.0.1:8787: passed, health 200 and `/v1/usage?ownerId=local-user` 200.
- command: local Studio smoke at http://127.0.0.1:5173/: passed, HTML 200.
- command: local static player smoke at http://127.0.0.1:5174/project.vn.json: passed, sample title `实验室里的蓝光`.

Notes:
- 这进一步接近商用生产底座，但仍不是完整 SaaS：账号/团队权限、支付结算、集中监控、人工审核后台和真实外部凭据 smoke 仍待补。

## Checkpoint 19: Content safety review and blocking

Status: done

What changed:
- `vn-platform` 新增 `ContentSafetyReviewRecord`、`ContentSafetyPolicy` 和 `ContentSafetyRepository`。
- 新增 `ContentSafetyService`，默认启用本地 deterministic 审核；review 记录保存 `inputHash`、`inputLength`、`matchedRules` 和 metadata，不保存完整原文。
- `FileDatabase` 和 Postgres repositories 增加 content safety review 持久化；Postgres migration 增加 `content_safety_reviews`。
- `ProjectService` 在导入小说和保存 `VNProject` 前审核标题、角色名和 line 文本。
- `GenerationJobService` 在 job 入队和执行前审核 `novel_to_project` 输入与 `asset_generation` prompt；运行期阻断会把 job 标记为 `blocked`，不会重试。
- API 将 `ContentSafetyBlockedError` 映射为 422，并新增 `GET /v1/content-safety?ownerId=` 查询 owner 维度 review。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和生产审计脚本补充内容安全配置、端点和限制。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 18 tests including content safety block and job blocked status.
- command: pnpm --filter @agentic-galgame/api test: passed, 21 tests including 422 content safety response and review listing.
- command: pnpm verify:production: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm audit:production: passed.
- command: access-token API smoke at http://127.0.0.1:8787: passed, admin created owner token, owner token accessed own projects with 200, cross-owner returned 403, list response omitted token/hash, revoked token returned 401.
- command: local API health smoke at http://127.0.0.1:8787/health with bearer token: passed.
- command: local Studio smoke at http://127.0.0.1:5173/: passed, HTML 200.
- command: local static player smoke at http://127.0.0.1:5174/project.vn.json: passed, sample title `实验室里的蓝光`.

Notes:
- 这是上线前的本地阻断和审计底座，不是完整人工审核后台，也不是第三方 moderation provider。后续仍需外部合规模型、人工审核队列、申诉流程和生成质量评估。

## Checkpoint 20: Hashed access token lifecycle

Status: done

What changed:
- `vn-platform` 新增 `AccessTokenRecord`、`AccessTokenRepository` 和 `AccessTokenService`。
- 动态 access token 创建时只返回一次明文 token；持久化层只保存 SHA-256 `tokenHash` 和短 `tokenPrefix`。
- `FileDatabase` 和 Postgres repositories 增加 access token 持久化；Postgres migration 增加 `access_tokens` 表。
- API 鉴权支持静态 env token 和动态 hashed access token；动态 token 支持 `lastUsedAt`、`revokedAt` 和 `expiresAt`。
- API 新增 `POST /v1/access-tokens`、`GET /v1/access-tokens?ownerId=` 和 `POST /v1/access-tokens/:id/revoke`。
- owner token 只能列出/撤销同 owner 的 owner token；admin token 可以创建和撤销 token。
- README、ARCHITECTURE、PRODUCTION 和生产审计脚本补充 token 生命周期说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 20 tests including hashed token creation, authenticate, expiry and revocation.
- command: pnpm --filter @agentic-galgame/api test: passed, 22 tests including create/use/list/revoke dynamic access token.
- command: pnpm verify:production: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm audit:production: passed.

Notes:
- 这补齐的是 token 生命周期，不是完整用户注册/登录/团队成员系统。后续仍需账号体系、团队角色、邀请、SSO/OAuth、支付结算和运营控制台。

## Checkpoint 21: Independent Player app

Status: done

What changed:
- 新增 `apps/player` 独立玩家端，只加载 VNProject 并通过 `VNRuntime + DomVNRenderer` 播放，不包含 Studio 编辑器、Inspector 或 Agent 操作区。
- Player 默认加载 `/project.vn.json`，并支持 `?projectUrl=` 指向远端项目 JSON，方便将玩家端和 Studio/API 分域部署。
- Player 支持 Previous / Next / Save / Load，使用全屏 16:9 Galgame 舞台、底部文本框、对话括号、说话人高亮和 CG 图层。
- 新增 `scripts/sync-player-sample.ts`、根命令 `pnpm dev:player` 和 `pnpm assets:player`，构建流程会同步 Player 示例项目和 SVG 场景资产。
- 更新 README、ARCHITECTURE、PRODUCTION 和生产审计，明确 Studio、API、Player 的部署边界。

Validation:
- command: pnpm --filter @agentic-galgame/player test: passed, 3 tests covering standalone playback, save/load and projectUrl.
- command: pnpm --filter @agentic-galgame/player typecheck: passed
- command: pnpm --filter @agentic-galgame/player build: passed
- command: pnpm audit:production: passed
- command: pnpm verify:production: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: HTTP Player smoke at http://127.0.0.1:5175/: passed, HTML 200 and project.vn.json loaded title `实验室里的蓝光`.
- command: Browser Player smoke at http://127.0.0.1:5175/: passed, no Studio UI, 1280x720 16:9 stage, dialogue `林雪` + `「你听见了吗？」`, `focus-active` speaker highlight, final CG image `cg_worldline_shift.svg`.

Notes:
- 这次补齐的是“玩家端可独立部署”的生产边界，不是完整商业 SaaS 发布平台。
- 商用生产版仍需继续补完整账号注册/登录、团队邀请、支付结算、集中监控告警、外部 moderation provider、人工审核后台、真实外部 key smoke 和生成质量评估。

## Checkpoint 22: Team role authorization

Status: done

What changed:
- `vn-platform` 新增 `TeamRecord`、`TeamMemberRecord`、`TeamMemberRole`、`TeamRepository` 和 `TeamService`。
- `FileDatabase`、Postgres repositories 和 production migration 增加 `teams`、`team_members`，并给 `access_tokens` 增加 `user_id`。
- API 新增 `API_USER_TOKENS` 静态 user token 配置，动态 access token 支持 `role: "user"` 和 `userId`。
- API 新增 `/v1/teams`、`/v1/teams?userId=`、`/v1/teams/:id/members` 团队端点。
- API 权限从单纯 owner/admin 推进到 team role：viewer 可读，editor 可写项目/任务/资产，admin/owner 可管理成员、token、usage/audit/content-safety。
- README、ARCHITECTURE、PRODUCTION、Docker Compose 和 `audit:production` 补充 user token、team role 和部署说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 22 tests including team role hierarchy and Postgres team repository mapping.
- command: pnpm --filter @agentic-galgame/api test: passed, 24 tests including user-scoped team role access.
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm audit:production: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: dist API team-role smoke: passed, admin created team/member, editor user token created project with 201, viewer write returned 403, cross-team read returned 403.

Notes:
- 这补齐的是 team/member/role 授权底座，不是完整账号产品。注册登录、邀请邮件、SSO/OAuth、组织设置 UI 和支付仍是后续商用项。

## Checkpoint 23: Backend publish to Player

Status: done

What changed:
- `vn-platform` 新增 `ProjectPublishService`，把保存后的项目发布为可被独立 Player 加载的 `project.vn.json`。
- 发布服务会把缺失的 placeholder SVG 资产写入当前 `AssetStorage`，把 VNProject 内的资产 `src` 改写为公开 URL，再写入 `published_project_json`。
- `ProjectService` 新增 `markPublished()`，发布成功后更新 `publishedAt` 并写入 `project_published` audit event。
- API 新增 `POST /v1/projects/:id/publish`，需要 editor 级权限，返回 `projectUrl`、`playableUrl`、`publishedProject` 和资产记录。
- API 配置新增 `API_PUBLIC_BASE_URL` 和 `PLAYER_BASE_URL`；Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 已同步。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 23 tests including project publishing and published asset URL rewrite.
- command: pnpm --filter @agentic-galgame/api test: passed, 26 tests including publish endpoint for standalone Player.
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm audit:production: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: dist publish API smoke: passed, created project 201, publish 200, fetched returned projectUrl 200, first published asset URL was absolute and fetched with 200, playableUrl matched Player projectUrl format.

Notes:
- 这补齐的是后端发布到独立 Player 的生产闭环，不是完整部署 provider。后续仍需 CDN cache purge、版本化发布历史、回滚、域名绑定和发布审批流。

## Checkpoint 24: Published release history and rollback

Status: done

What changed:
- `vn-platform` 新增 `PublishedProjectReleaseRecord` 和 release repository，发布不再只是覆盖当前项目状态。
- `FileDatabase`、Postgres repositories 和 production migration 增加 `published_project_releases`，并在 `studio_projects` 记录 `currentReleaseId`、`publishedProjectUrl`、`publishedPlayableUrl`。
- `ProjectPublishService` 每次 publish 创建不可变 release version，支持按项目列出 release history，并支持 rollback 到指定 release。
- `ProjectService` 增加 release rollback 标记，回滚只切换当前发布指针与公开 URL，并写入 `project_release_rolled_back` audit event。
- API 新增 `GET /v1/projects/:id/releases` 和 `POST /v1/projects/:id/rollback`，继续使用 viewer/editor 权限边界。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步发布历史与回滚说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 24 tests including release history and rollback.
- command: pnpm --filter @agentic-galgame/api test: passed, 26 tests including release history and rollback endpoints.
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm audit:production: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm verify:production: passed
- command: dist release rollback smoke: passed, production dist API published v1/v2, listed releases as [2, 1], rolled back to v1, and fetched public project JSON with 200.

Notes:
- 这补齐的是发布版本历史和回滚底座，不是完整部署平台。后续仍需 CDN cache purge、缓存失效策略、域名绑定、发布审批流、版本差异对比和发布监控。

## Checkpoint 25: Stable public current URL and deployment cache invalidation

Status: done

What changed:
- API 新增稳定公开 current project 入口 `GET /v1/public/projects/:id/project.vn.json`，未鉴权玩家端可通过它加载当前发布版本。
- `ProjectPublishService` 在保留 immutable release `projectUrl` 的同时返回 `currentProjectUrl` 和 `currentPlayableUrl`，适合长期分享和回滚后继续使用。
- `DeploymentService` 新增 deployment cache invalidation 记录；默认 provider 为 none 时记录 skipped，配置 provider 后记录 succeeded/failed。
- 新增 `CloudflareCachePurgeProvider`，支持 Cloudflare URL purge，并避免在 metadata 中暴露 API token。
- `FileDatabase`、Postgres repositories 和 production migration 增加 `deployment_invalidations`。
- API 新增 `GET /v1/projects/:id/deployment-invalidations` 和 `GET /v1/deployment-invalidations?ownerId=` 查询 invalidation 结果。
- Studio toolbar 新增 `Publish Player`，会先保存 API 项目，再发布到 Player，并显示 current playable link。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 已同步部署缓存配置和 current URL 文档。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 26 tests including deployment invalidation repository and Cloudflare provider.
- command: pnpm --filter @agentic-galgame/api test: passed, 27 tests including public current project route and deployment invalidation endpoint.
- command: pnpm --filter @agentic-galgame/studio test: passed, 8 tests including Publish Player action.
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm audit:production: passed
- command: pnpm verify:production: passed
- command: dist current URL rollback smoke: passed, production dist API published v1/v2, stable current URL returned titles [版本一, 版本二, 版本一] across publish/rollback, and recorded 3 invalidations.

Notes:
- 这补齐的是固定玩家入口和 CDN purge provider 底座，不是完整部署平台。后续仍需自定义域名绑定、发布审批流、版本 diff、CDN purge 重试后台、监控告警和真实 Cloudflare 凭据 smoke。

## Checkpoint 26: Release approval workflow

Status: done

What changed:
- `vn-platform` 新增 `ReleaseApprovalRecord`、`ReleaseApprovalRepository` 和 `ReleaseApprovalService`。
- 发布审批支持 pending、published、rejected、cancelled 状态；审批通过会复用 `ProjectPublishService`，继续创建 release、更新 current URL、触发 deployment invalidation。
- `FileDatabase`、Postgres repositories 和 production migration 增加 `release_approvals`，并限制同一 project 只允许一个 pending approval。
- API 新增 `GET/POST /v1/projects/:id/release-approvals`、`POST /v1/release-approvals/:id/approve` 和 `POST /v1/release-approvals/:id/reject`。
- API 新增 `RELEASE_APPROVAL_REQUIRED` 配置；设为 `true` 后，editor 直接 publish 会被拒绝，team admin/owner 或 admin token 才能 approve/publish。
- Studio `ProductionApiClient` 新增 `requestReleaseApproval()`，顶部栏新增 `Request Approval` 按钮。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 已同步审批流说明与检查。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 28 tests including release approval service and Postgres adapter.
- command: pnpm --filter @agentic-galgame/api test: passed, 28 tests including approval-required publish mode.
- command: pnpm --filter @agentic-galgame/studio test: passed, 9 tests including Request Approval action.
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm audit:production: passed
- command: pnpm verify:production: passed
- command: dist approval-required publish smoke: passed, production dist API rejected editor direct publish with 403, accepted editor approval request, admin approved and published release v1, and current public JSON loaded.

Notes:
- 这补齐的是商用发布治理的后端与 Studio 发起入口，不是完整审核运营后台。后续仍需审批列表/详情 UI、版本 diff、审批评论、通知、真实审核策略和发布监控。

## Checkpoint 27: Studio release approval review UI

Status: done

What changed:
- Studio `ProductionApiClient` 新增 `listReleaseApprovals()`、`approveReleaseApproval()` 和 `rejectReleaseApproval()`。
- 新增 `ReleaseApprovalPanel`，在 Studio 中显示 pending/total 审批数量、审批记录列表、审核备注、Approve 和 Reject 操作。
- `App` 在 Save API / Load API 后同步审批列表；提交审批后把新 approval 插入列表；批准/拒绝后更新对应记录并显示 release version 或拒绝状态。
- Studio local load / sample reload / novel regenerate 会清空 remote approval state，避免把本地项目误连到旧的远端审批记录。
- `audit:production` 新增 Studio 审批列表、批准、拒绝 UI 和测试覆盖检查。
- README、ARCHITECTURE、PRODUCTION 同步 Studio 审批审阅入口和剩余商用缺口。

Validation:
- command: pnpm --filter @agentic-galgame/studio typecheck: passed
- command: pnpm --filter @agentic-galgame/studio test: passed, 10 tests including release approval review workflow.
- command: pnpm audit:production: passed
- command: pnpm test: passed
- command: pnpm typecheck: passed after rerun; an earlier parallel run raced with `pnpm test` rebuilding package dist and failed transiently.
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm verify:production: passed
- command: pnpm dev: passed at http://127.0.0.1:5176/
- command: dev server HTTP smoke: passed; Vite served `/`, `ReleaseApprovalPanel.tsx` markers, and release approval CSS markers.

Notes:
- 这补齐的是 Studio 内的审批审阅操作，不是完整审核后台。仍缺完整可视化 diff、审批线程评论、通知、审核策略配置、监控告警、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。
- Browser/Chrome 工具和 Playwright 包在当前环境不可用，因此这轮没有完成真实浏览器截图验证；已有 jsdom 交互测试、dev server HTTP smoke 和生产审计覆盖。

## Checkpoint 28: Release diff and stale approval guard

Status: done

What changed:
- `ProjectPublishService` 在每次发布时把项目 summary 写入 release metadata，用于后续差异比较。
- 新增 `ProjectDiffService`，比较当前草稿和最新发布 release，输出 beat、asset、character 的新增/删除/变更计数和前 20 条摘要。
- API 新增 `GET /v1/projects/:id/release-diff`。
- `ReleaseApprovalService` 在审批申请中记录项目 fingerprint；如果申请后草稿被修改，approve 会抛出 `ReleaseApprovalStaleError`，API 返回 409，必须重新提交审批来刷新 diff/fingerprint。
- `ProjectService.saveProject()` 修复更新草稿时丢失 `currentReleaseId`、`publishedProjectUrl`、`publishedPlayableUrl` 的问题。
- Studio 新增 `ReleaseDiffPanel`，可以刷新 release diff，并显示 base release、变更计数和摘要。
- `audit:production`、README、ARCHITECTURE、PRODUCTION 已同步 release diff 和 stale approval 检查。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 29 tests including release diff and stale approval guard.
- command: pnpm --filter @agentic-galgame/api test: passed, 29 tests including release-diff endpoint and stale approval 409.
- command: pnpm --filter @agentic-galgame/studio test: passed, 11 tests including release diff panel.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/studio typecheck: passed after rebuilding vn-platform dist.
- command: pnpm audit:production: passed
- command: pnpm test: passed
- command: pnpm typecheck: passed
- command: pnpm build: passed
- command: pnpm export:sample: passed
- command: pnpm audit:mvp: passed
- command: pnpm verify:production: passed

Notes:
- 这补齐的是发布审批所需的第一版结构化版本差异和 stale 发布防护，不是完整代码审查式 diff。后续仍需更完整的可视化 diff、审批评论线程、通知、审核策略配置、监控告警、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 29: Release approval comments

Status: done

What changed:
- `vn-platform` 新增 `ReleaseApprovalCommentRecord` / `ReleaseApprovalCommentRepository`，FileDatabase、Postgres repository 和 production migration 均持久化 `release_approval_comments`。
- `ReleaseApprovalService` 增加 `addComment()` / `listComments()`，评论写入时会生成 `release_approval_commented` 审计事件，审计 metadata 不保存评论正文。
- API 新增 `GET /v1/release-approvals/:id/comments` 和 `POST /v1/release-approvals/:id/comments`；viewer 可读，editor 可写，并复用审批所属 owner 权限校验。
- Studio production API client 和 `ReleaseApprovalPanel` 支持加载评论、填写评论和提交评论；提交后刷新对应审批线程。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 已同步审批评论端点、持久化表和 Studio UI 检查。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 30 tests including release approval comments.
- command: pnpm --filter @agentic-galgame/api test: passed, 29 tests including release approval comment endpoint.
- command: pnpm --filter @agentic-galgame/studio test: passed, 11 tests including approval comment UI.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck: passed.
- command: pnpm --filter @agentic-galgame/vn-platform build: passed.
- command: pnpm --filter @agentic-galgame/studio typecheck: passed.
- command: pnpm --filter @agentic-galgame/api typecheck: passed.
- command: pnpm audit:production: passed.
- command: pnpm test: passed.
- command: pnpm typecheck: passed.
- command: pnpm build: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm verify:production: passed.
- command: Browser Studio smoke at http://127.0.0.1:5176/: passed, title correct, toolbar/diff/approval panels visible, Runtime Preview ratio 1.7778, no console errors.
- command: Browser static Player smoke at http://127.0.0.1:5184/: passed, no Studio UI, Previous/Next/Save/Load visible, body overflow hidden, stage ratio 1.7778, no console errors.

Notes:
- 这补齐的是审批线程的站内持久化讨论，不是完整审核后台。后续仍需邮件/IM 原生通知、通知模板、审核策略配置、完整可视化 diff、集中监控、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 30: Release approval webhook notifications

Status: done

What changed:
- `vn-platform` 新增 `ReleaseApprovalNotifier` 和 `ReleaseApprovalNotificationPayload`，`ReleaseApprovalService` 会在 request/update/comment/approve/reject/stale 时发出通知事件。
- 新增 `WebhookReleaseApprovalNotifier`，支持 `RELEASE_APPROVAL_WEBHOOK_URL`、可选 HMAC secret、delivery id、event header 和 timeout。
- 通知失败不会阻断审批主流程，会写入 `release_approval_notification_failed` 审计事件。
- API config 和 `createApiPlatform()` 接入 `RELEASE_APPROVAL_WEBHOOK_URL`、`RELEASE_APPROVAL_WEBHOOK_SECRET`、`RELEASE_APPROVAL_WEBHOOK_TIMEOUT_MS`。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 webhook 配置和生产限制。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 33 tests including release approval webhook notifier and notification failure handling.
- command: pnpm --filter @agentic-galgame/api test: passed, 30 tests including release approval webhook config.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck: passed.
- command: pnpm --filter @agentic-galgame/vn-platform build: passed.
- command: pnpm --filter @agentic-galgame/api typecheck: passed after vn-platform dist rebuild.
- command: pnpm audit:production: passed.
- command: pnpm test: passed.
- command: pnpm typecheck: passed.
- command: pnpm build: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed after sequential rerun; an earlier parallel export/audit attempt raced while files were being rewritten.
- command: pnpm verify:production: passed.

Notes:
- 这补齐的是审批外部通知 webhook 底座，不是完整通知中心。后续仍需邮件/IM 原生 provider、通知模板、审核策略配置、完整可视化 diff、集中监控、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 31: Notification delivery outbox and retry

Status: done

What changed:
- `vn-platform` 新增 `NotificationDeliveryRecord`、`NotificationDeliveryRepository` 和 `NotificationDeliveryService`。
- `ReleaseApprovalService` 不再直接投递外部 webhook；配置 webhook 后会写入 notification outbox，避免审批主流程被外部通知阻塞。
- `NotificationDeliveryService.runNext()` 支持 pending delivery 投递、成功记录、指数退避重试和最终 failed 状态。
- FileDatabase、Postgres repositories 和 production migration 增加 `notification_deliveries`。
- API 新增 `GET /v1/notification-deliveries?ownerId=<id>` 和 `POST /v1/notification-deliveries/run-next`。
- worker 会同时处理 queued generation jobs 和 pending notification deliveries，并输出 `notification_delivery_processed` 结构化日志。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 notification outbox、重试配置和生产限制。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 34 tests including notification delivery outbox and Postgres mapping.
- command: pnpm --filter @agentic-galgame/api test: passed, 30 tests including notification delivery endpoints.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck: passed.
- command: pnpm audit:production: passed.
- command: pnpm test: passed.
- command: pnpm typecheck: passed.
- command: pnpm build: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.
- command: pnpm verify:production: passed.

Notes:
- 这补齐的是 webhook 通知的持久化投递、重试和 API 查询底座，不是完整通知中心。后续仍需邮件/IM 原生 provider、通知模板、审核策略配置、完整可视化 diff、集中监控、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 32: Studio notification delivery monitor

Status: done

What changed:
- Studio `ProductionApiClient` 新增 `listNotificationDeliveries()` 和 `runNextNotificationDelivery()`。
- 新增 `NotificationDeliveryPanel`，显示 owner 维度 notification delivery 的 pending/failed/total 数量、event、provider、attempts、更新时间、nextRunAt 和 error。
- Studio 主界面接入 `Notification Delivery Monitor`，支持刷新 outbox 状态和手动运行下一条 runnable delivery；API 未配置时按钮禁用。
- 移动端 CSS 修正：顶部工具栏小屏自动换行，预览控制按钮改为两列，避免 Studio 页面横向溢出。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 Studio 通知投递状态 UI、API client 方法和测试覆盖检查。

Validation:
- command: pnpm --filter @agentic-galgame/studio test: passed, 12 tests including notification delivery monitor.
- command: pnpm --filter @agentic-galgame/studio typecheck: passed.
- command: pnpm --filter @agentic-galgame/studio build: passed.
- command: pnpm audit:production: passed.
- command: Browser Studio smoke at http://127.0.0.1:5176/: passed, Notification Delivery Monitor visible, desktop stage ratio 1.7778, mobile stage ratio 1.7778, mobile horizontal overflow false, no console errors.
- command: pnpm verify:production: passed.
- command: pnpm export:sample: passed.
- command: pnpm audit:mvp: passed.

Notes:
- 这补齐的是 notification outbox 的 Studio 可观测入口，不是完整通知中心。后续仍需邮件/IM 原生 provider、通知模板、审核策略配置、完整可视化 diff、外部集中监控/错误追踪、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 33: Owner operations summary

Status: done

What changed:
- `vn-platform` 新增 `OperationsService` 和 `OwnerOperationsSummary`，聚合 owner 维度项目、job、release approval、notification delivery、content safety、deployment invalidation、usage 和 audit。
- summary 输出 `healthy` / `degraded` / `critical`，并生成有限 incidents，用于上线巡检和排障。
- API 新增 `GET /v1/ops/summary?ownerId=<id>`，复用 owner/team role 授权，owner token 可看自己的 summary，不能跨 owner。
- Studio `ProductionApiClient` 新增 `getOperationsSummary()`，主界面新增 `Operations Summary` 面板，显示状态、计数、估算成本和最近 incidents。
- Studio 移动端 toolbar 断点修正，避免桌面 `flex-basis` 在竖向布局里变成异常高度，并让标题、Owner/API 和动作按钮在小屏上保持可用。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 owner 运维摘要 API、Studio 面板和生产审计检查。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 35 tests including operations summary aggregation.
- command: pnpm --filter @agentic-galgame/api test: passed, 31 tests including `/v1/ops/summary` owner-scope API.
- command: pnpm --filter @agentic-galgame/studio test: passed, 13 tests including Operations Summary panel.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck: passed.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck: passed.
- command: pnpm --filter @agentic-galgame/studio typecheck: passed.
- command: pnpm audit:production: passed.
- command: Browser Studio smoke at http://127.0.0.1:5176/: passed, Operations Summary visible, desktop stage ratio 1.7778, mobile stage ratio 1.7778, mobile page horizontal overflow false, Next/Previous interaction changed and restored text, no console errors. In-app Browser screenshot capture timed out, so screenshots were captured with `pnpm exec playwright screenshot` for visual evidence.
- command: pnpm verify:production: passed after the mobile toolbar fix.
- command: pnpm export:sample && pnpm audit:mvp: passed after the mobile toolbar fix.

Notes:
- 这补齐的是内置 owner 级可观测和排障入口，不是完整外部监控平台。后续仍需外部日志集中化、错误追踪、告警升级、SLO/SLA 仪表盘、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 34: Team invitation lifecycle

Status: done

What changed:
- `vn-platform` 新增 `TeamInvitationRecord`、`TeamInvitationRepository` 和 `TeamInvitationService`。
- 团队邀请 token 明文只返回一次，服务端只保存 SHA-256 `tokenHash` 和短 `tokenPrefix`。
- `TeamInvitationService` 支持 create/list/accept/revoke/expire，accept 会写入 `team_members`，并记录 `team_invitation_created`、`team_invitation_accepted`、`team_invitation_revoked`、`team_invitation_expired` 审计事件。
- FileDatabase、Postgres repository 和 production migration 增加 `team_invitations`。
- API 新增 `GET /v1/teams/:id/invitations`、`POST /v1/teams/:id/invitations`、`POST /v1/team-invitations/:id/revoke`、`POST /v1/team-invitations/accept`，复用 team admin/owner 授权和 user token 接受邀请。
- API 响应会剔除 invitation `tokenHash`；邮箱校验错误映射为 400，过期/撤销/重复接受映射为 409。
- Studio 新增 `TeamInvitationPanel`，支持刷新邀请、创建邀请、查看一次性 invite token、接受邀请和撤销 pending 邀请。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步团队邀请 API、持久化、Studio 面板和剩余商用限制。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 37 tests including team invitation lifecycle and Postgres invitation mapping.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api test: passed, 32 API tests including team invitation lifecycle.
- command: pnpm --filter @agentic-galgame/studio test: passed, 14 tests including Team Invitations panel.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/studio typecheck: passed.
- command: pnpm audit:production: passed.
- command: pnpm verify:production: passed.
- command: pnpm export:sample && pnpm audit:mvp: passed.
- command: Browser Studio smoke at http://127.0.0.1:5176/: passed, Team Invitations visible, desktop stage ratio 1.7778, mobile stage ratio 1.7778, mobile page horizontal overflow false, Next interaction changed text, no console errors. Screenshots were captured with `pnpm exec playwright screenshot` because in-app Browser screenshot capture has previously timed out on this app.

Notes:
- 这补齐的是 team/member 体系上的邀请 lifecycle，不是完整账号产品。后续仍需注册登录、邀请邮件/IM 投递、SSO/OAuth、组织设置 UI、支付计费、外部集中监控、错误追踪、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 35: Team invitation webhook delivery

Status: done

What changed:
- `vn-platform` 新增 `TeamInvitationNotifier`、`TeamInvitationNotificationPayload` 和 `WebhookTeamInvitationNotifier`。
- `TeamInvitationService` 在 create/accept/revoke/expire 时发送可选邀请通知；创建事件会把一次性 `invitationToken` 只交给 API 创建响应和已配置的 webhook request，数据库仍只保存 hash。
- 邀请 webhook 使用 `x-agentic-galgame-event`、`x-agentic-galgame-delivery`、`x-agentic-galgame-timestamp` 和可选 `x-agentic-galgame-signature` HMAC 头；配置 `TEAM_INVITATION_ACCEPT_BASE_URL` 后会生成 `invitationAcceptUrl`。
- 邀请通知失败不会阻断邀请创建或生命周期推进，会写入 `team_invitation_notification_failed` 审计。
- API 配置、Docker Compose、`.env.example`、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 `TEAM_INVITATION_WEBHOOK_URL`、`TEAM_INVITATION_WEBHOOK_SECRET`、`TEAM_INVITATION_WEBHOOK_TIMEOUT_MS`、`TEAM_INVITATION_ACCEPT_BASE_URL`。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 41 tests including team invitation webhook signing and notification failure handling.
- command: pnpm --filter @agentic-galgame/api test: passed, 34 tests including API config parsing and local signed team invitation webhook delivery.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: passed.
- command: pnpm audit:production: passed.
- command: pnpm verify:production: passed.
- command: pnpm export:sample && pnpm audit:mvp: passed.

Notes:
- 这补齐的是团队邀请对外投递的 signed webhook 集成，不是完整账号产品或内置邮件/IM 服务。后续仍需注册登录、SSO/OAuth、原生邮件/IM provider、通知模板、bounce 处理、外部集中监控、错误追踪、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。
- API app 消费 `vn-platform` 的 dist 类型；单独运行 API typecheck 前需要先 build 平台包，根命令 `pnpm verify:production` 已按正确顺序执行。

## Checkpoint 36: User account registration and session auth

Status: done

What changed:
- `vn-platform` 新增 `UserAccountRecord`、`UserSessionRecord`、`UserAccountRepository`、`UserSessionRepository` 和 `UserAccountService`。
- 用户注册/登录使用 email/password，密码通过 Node `scrypt` hash 存储；session token 明文只返回一次，服务端只保存 SHA-256 `tokenHash` 和短 `tokenPrefix`。
- FileDatabase、Postgres repositories 和 production migration 增加 `user_accounts`、`user_sessions`。
- API 新增公开 `POST /v1/auth/register`、`POST /v1/auth/login`，以及 bearer 保护的 `GET /v1/auth/me`、`GET /v1/auth/sessions`、`POST /v1/auth/logout`。
- API bearer 鉴权继续兼容静态 admin/owner/user token 和动态 access token，并新增 user session token；登录用户仍通过 `team_members` 的 role 访问 owner/team。
- 团队邀请接受会在登录账号场景校验邀请 email 和账号 email，避免未绑定 `invitedUserId` 的邀请被其他登录账号接受。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步账号注册登录、session、Postgres 表和剩余账号安全限制。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 44 tests including user account lifecycle and Postgres user/session mapping.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api test: passed, 35 API tests including user registration, login, session auth, invitation acceptance, and logout invalidation.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: passed.
- command: pnpm audit:production: passed.
- command: pnpm verify:production: passed.
- command: pnpm export:sample && pnpm audit:mvp: passed.

Notes:
- 这补齐的是 email/password 账号和 session auth 基础闭环。邮箱验证和找回密码在 Checkpoint 37 继续补齐；MFA、SSO/OAuth、设备风险控制、密码策略配置、外部集中监控、错误追踪、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke 仍是后续商用项。

## Checkpoint 37: Email verification and password reset

Status: done

What changed:
- `vn-platform` 新增 `UserAccountActionTokenRecord`、`UserAccountActionTokenRepository`、`UserAccountNotifier` 和 `WebhookUserAccountNotifier`。
- `UserAccountService` 支持邮箱验证请求、邮箱验证确认、密码重置请求和密码重置确认；action token 明文只返回给 notifier，数据库只保存 SHA-256 `tokenHash` 和短 `tokenPrefix`。
- 密码重置成功后撤销该用户旧 session，并写入 `passwordUpdatedAt`；邮箱验证成功写入 `emailVerifiedAt`。
- FileDatabase、Postgres repositories 和 production migration 增加 `user_account_action_tokens`，并为 token hash、用户和状态建立索引。
- API 新增公开 `POST /v1/auth/verify-email`、`POST /v1/auth/password-reset/request`、`POST /v1/auth/password-reset/confirm`，以及 bearer 保护的 `POST /v1/auth/email-verification/request`。
- API 配置、Docker Compose、`.env.example`、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 `USER_ACCOUNT_WEBHOOK_URL`、`USER_ACCOUNT_WEBHOOK_SECRET`、`USER_ACCOUNT_WEBHOOK_TIMEOUT_MS`、`EMAIL_VERIFICATION_BASE_URL`、`PASSWORD_RESET_BASE_URL`。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: passed, 48 tests including email verification, password reset, user account webhook notifier, and Postgres action token repository.
- command: pnpm --filter @agentic-galgame/api test: passed, 37 tests including local signed account webhook delivery, email verification, password reset, old-session revocation, and user account webhook config parsing.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: passed.
- command: pnpm audit:production: passed.
- command: pnpm verify:production: passed.
- command: pnpm export:sample && pnpm audit:mvp: passed.
- command: generic secret scan excluding build output: passed, no API keys found.
- command: Browser Studio account smoke at http://127.0.0.1:5173/?qa=account-panel: passed, Account panel visible, API Online, account buttons and token inputs visible, Runtime stage ratio 1.7778, no console errors.

Notes:
- 这补齐的是账号邮箱验证和密码找回的服务/API/webhook/持久化闭环，不是完整账号安全产品。后续仍需 MFA、SSO/OAuth、设备风险控制、密码策略配置、原生邮件/IM provider、通知模板、bounce 处理、外部集中监控、错误追踪、自定义域名和真实外部 AI/对象存储/CDN 凭据 smoke。

## Checkpoint 38: Studio account session UI

Status: done

What changed:
- Studio 新增 `AccountPanel`，支持 Register、Login、Refresh Account、Logout、Send Verification、Verify Email、Request Reset、Confirm Reset。
- `productionApi` client 新增账号注册登录、当前用户、session 列表/登出、邮箱验证和密码重置方法。
- Studio 登录或注册成功后把 session token 写入 `agentic-galgame-studio:account-session`，后续生产 API client 自动带 bearer session。
- 密码重置确认后清除本地旧 session，避免继续使用服务端已撤销的 token。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 Studio 账号面板能力。

Validation:
- command: pnpm --filter @agentic-galgame/studio test: passed, 15 tests including account registration, email verification, password reset, and local session clearing.
- command: pnpm --filter @agentic-galgame/studio typecheck: passed.
- command: pnpm audit:production: passed.
- command: pnpm verify:production: passed.
- command: pnpm export:sample && pnpm audit:mvp: passed.
- command: generic secret scan excluding build output: passed, no API keys found.

Notes:
- 这补齐的是 Studio 可直接使用账号 session 的生产入口，不是完整账号设置页。后续仍需 MFA、SSO/OAuth、设备风险控制、组织设置 UI、原生邮件/IM provider、通知模板和外部监控。

## Checkpoint 39: Public health check and Postgres migration runner

Status: done

What changed:
- API `GET /health` 移到 bearer 鉴权之前，作为公开容器/负载均衡/uptime probe；业务 API 仍在配置鉴权后要求 bearer/session。
- `vn-platform` 新增 `runPostgresMigrations()`，维护 `schema_migrations`，按文件名顺序执行 SQL，跳过已应用迁移，并在失败时 rollback 当前文件。
- API 新增 `src/migrate.ts` CLI，读取 `DATABASE_URL` 和 `POSTGRES_SSL` 后调用平台 migration runner。
- 根目录新增 `pnpm db:migrate` 和 `pnpm db:migrate:dist`；API package 新增 `migrate` 和 `migrate:dist`。
- `Dockerfile.api` 复制 `packages/vn-platform/migrations` 到 runtime 镜像，保证生产镜像中的 dist migration CLI 能找到 SQL 文件。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步公开 health 和迁移命令说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: pass
- command: pnpm --filter @agentic-galgame/api test: pass
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: pass
- command: pnpm audit:production: pass
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass
- command: current-source API smoke on port 8790 with bearer auth enabled: `/health` without token 200, protected `/v1/projects` without token 401, protected `/v1/projects` with token 200

Notes:
- `pnpm db:migrate` 需要真实 Postgres `DATABASE_URL`，默认验证不会连接外部数据库。当前测试用 fake executor 覆盖排序、跳过和 rollback 行为。

## Checkpoint 40: Worker-driven Studio asset generation

Status: done

What changed:
- Studio `productionApi` 新增 `getJob()`，并读取 `VITE_ASSET_JOB_RUN_MODE`、`VITE_ASSET_JOB_POLL_INTERVAL_MS`、`VITE_ASSET_JOB_POLL_ATTEMPTS`。
- Studio 资产生成支持 `inline` 和 `worker` 两种模式：`inline` 仍适合本地闭环直接调用 `/jobs/:id/run`；`worker` 模式只创建 `asset_generation` job 并轮询 `GET /v1/jobs/:id`，等待独立 worker 完成。
- Studio job 类型补齐 `blocked`、attempts、maxAttempts 和 nextRunAt，匹配后端可能返回的生产状态。
- `.env.example`、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 worker-driven Studio asset generation 配置。

Validation:
- command: pnpm --filter @agentic-galgame/studio test: pass, 16 tests including worker-driven asset generation without browser `/run`.
- command: pnpm --filter @agentic-galgame/studio typecheck: pass
- command: pnpm audit:production: pass
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass
- command: Browser Studio smoke at http://127.0.0.1:5173/: pass, Generate Placeholder Assets visible/enabled, Account and Operations panels visible, Runtime stage ratio 1.7778, no console errors.

Notes:
- 生产推荐 `VITE_ASSET_JOB_RUN_MODE=worker`，同时运行 `pnpm worker:api` 或 Docker Compose worker service。没有 worker 时，Studio 会轮询到超时，而不会在浏览器里执行后端任务。

## Checkpoint 41: Studio and Player production images

Status: done

What changed:
- 新增 `Dockerfile.studio`，把 Studio 构建为静态 nginx 镜像；构建时只注入 `VITE_API_BASE_URL` 和资产 job 轮询配置，不烘入任何 bearer token。
- 新增 `Dockerfile.player`，把独立 Player 构建为静态 nginx 镜像。
- 新增共享 `nginx.static.conf`，提供 `/health`、SPA fallback、`/project.vn.json` no-cache、`/assets/` 长缓存和基础安全响应头。
- 新增 `.dockerignore`，排除 node_modules、dist、本地数据、dotenv 和日志。
- `docker-compose.production.yml` 新增 `studio` 和 `player` 服务，和现有 `api`、`worker` 分离部署。
- 根目录新增 `docker:build:api`、`docker:build:studio`、`docker:build:player` 脚本。
- `.env.example`、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步生产前端镜像说明。

Validation:
- command: pnpm audit:production: pass
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 docker compose -f docker-compose.production.yml config: pass, config contains studio/player services and frontend Dockerfiles
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass
- command: docker --version: pass; docker daemon unavailable, so actual image build was not run in this local environment

Notes:
- 前端 Docker build arg 只用于公开 API 地址和 worker 轮询策略。生产账号/session token 必须由用户登录后保存在浏览器本地，不能写入镜像。

## Checkpoint 42: API request tracing and security headers

Status: done

What changed:
- API config 新增 `API_ACCESS_LOG`，生产默认开启，开发默认关闭。
- API 每个响应写入 `x-request-id`，支持透传调用方提供的合法 request id，否则生成 UUID。
- API 每个响应写入基础安全头：`x-content-type-options`、`x-frame-options`、`referrer-policy`、`permissions-policy`。
- CORS allow headers 增加 `x-request-id`，支持前端和网关串联排障。
- Access log 输出结构化 `http_request` JSON 行，只记录 method/path/status/duration/auth role，不记录 query、body 或 token。
- API 测试、`.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步请求追踪和 access log。

Validation:
- command: pnpm --filter @agentic-galgame/api test: pass, 38 tests including request id propagation and structured access logs.
- command: pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: pass
- command: pnpm audit:production: pass
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 docker compose -f docker-compose.production.yml config: pass
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass, no API keys found

Notes:
- Access log 刻意只记录 URL pathname，不记录 query string，避免把一次性 token 或业务参数写进日志。
- `API_ACCESS_LOG` 在生产默认开启；开发默认关闭，避免本地测试输出噪声。

## Checkpoint 43: API Prometheus metrics endpoint

Status: done

What changed:
- API config 新增 `API_METRICS_PUBLIC`，默认 `false`，避免生产环境意外公开 metrics。
- API 新增 `GET /metrics`，默认需要 admin bearer；设置 `API_METRICS_PUBLIC=true` 后才允许匿名抓取。
- Metrics 使用 Prometheus 文本格式，输出 `agentic_galgame_api_uptime_seconds` 和 `agentic_galgame_api_requests_total`。
- HTTP request counter 标签只包含 method、规范化 route、status 和 auth role，不包含动态 id、ownerId query、body、authorization header 或 token。
- Access log 对未鉴权公开探针标记 `authRole=public`，避免把 `/health` 误记为 admin。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 metrics 配置与文档。

Validation:
- command: pnpm --filter @agentic-galgame/api test: pass, 41 tests including private metrics, public metrics opt-in, route normalization, and metrics config default.
- command: pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: pass
- command: pnpm audit:production: pass
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 docker compose -f docker-compose.production.yml config: pass, config includes API_METRICS_PUBLIC=false for api and worker.
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass, no API keys found

Notes:
- 这是最小生产可抓取指标入口，不替代完整外部监控、告警、日志集中化和错误追踪平台。

## Checkpoint 44: API server error webhook

Status: done

What changed:
- API config 新增 `API_ERROR_WEBHOOK_URL`、`API_ERROR_WEBHOOK_SECRET`、`API_ERROR_WEBHOOK_TIMEOUT_MS`。
- API 未捕获 500 不再裸 `console.error(error)`，改为输出结构化 `server_error` 日志。
- 配置 error webhook 后，API 会异步投递 signed `api_server_error` webhook；投递失败不会改变原 500 响应。
- Error webhook payload 只包含 requestId、method、规范化 route、status、auth role、错误类型和脱敏后的错误摘要。
- 错误摘要会 redaction `Bearer ...` 和 `sk-...` 形态的 provider key；payload 不包含 query、真实 project id、ownerId、body 或 token。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步错误追踪配置。

Validation:
- command: pnpm --filter @agentic-galgame/api test: pass, 43 tests including signed API error webhook, server error redaction, and API error webhook config parsing.
- command: pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: pass
- command: pnpm audit:production: pass
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 docker compose -f docker-compose.production.yml config: pass, config includes API_ERROR_WEBHOOK_* for api and worker.
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass, no API keys found

Notes:
- 这是最小外部错误追踪接入点，不替代完整 Sentry/OTel 集成、告警升级、错误分组、采样和 PII 管控平台。

## Checkpoint 45: Account login lockout policy

Status: done

What changed:
- 平台账号服务新增可配置安全策略：`passwordMinLength`、`maxFailedLoginAttempts`、`failedLoginLockoutMs`。
- API config 新增 `AUTH_PASSWORD_MIN_LENGTH`、`AUTH_MAX_FAILED_LOGIN_ATTEMPTS`、`AUTH_LOGIN_LOCKOUT_MS`。
- 登录失败会记录 `failedLoginCount`、`lastFailedLoginAt`，达到阈值后写入 `lockedUntil` 并临时拒绝登录。
- 锁定期间正确密码也返回 HTTP 423；成功登录或密码重置会清空失败计数和锁定状态。
- API user 序列化继续隐藏 `passwordHash`，并新增隐藏失败登录计数、最后失败时间和锁定时间。
- Postgres migration / repository 映射新增 `failed_login_count`、`last_failed_login_at`、`locked_until`。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步账号登录保护配置。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 51 platform tests including user login lockout.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api build: pass, 45 API tests including login lockout and account security config parsing.
- command: pnpm audit:production: pass
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 docker compose -f docker-compose.production.yml config: pass, config includes AUTH_* lockout settings for api and worker.
- command: pnpm verify:production: pass
- command: pnpm export:sample && pnpm audit:mvp: pass
- command: generic secret scan for `sk-...` tokens: pass, no API keys found

Notes:
- 这补齐的是账号级登录保护，不是 MFA、SSO/OAuth、设备风险控制、IP reputation 或完整风控系统。

## Checkpoint 46: Account TOTP MFA baseline

Status: done

What changed:
- 平台账号服务新增 TOTP MFA setup / confirm / disable；MFA secret 使用 AES-256-GCM 加密后保存，明文只在 setup 响应返回一次。
- 登录已启用 MFA 的账号时，缺少验证码返回 `mfaRequired` challenge；验证码正确才会创建 session，并记录最后使用的 TOTP counter 防止同窗口重放。
- API config 新增 `AUTH_MFA_ENABLED`、`AUTH_MFA_ISSUER`、`AUTH_MFA_ENCRYPTION_KEY`、`AUTH_MFA_TOTP_STEP_SECONDS`、`AUTH_MFA_TOTP_WINDOW_STEPS`；生产启用 MFA 时要求至少 32 字符非 placeholder 加密密钥。
- API 新增 `/v1/auth/mfa/totp/setup`、`/v1/auth/mfa/totp/confirm`、`/v1/auth/mfa/totp/disable`，并继续从 user 响应中隐藏 MFA secret 密文和 counter。
- Postgres migration / repository 映射新增 `mfa_totp_secret_encrypted`、`mfa_totp_enabled_at`、`mfa_totp_last_used_counter`。
- Studio `Account` 面板新增 MFA code、Setup MFA、Confirm MFA、Disable MFA 控件；`productionApi` client 增加对应方法并处理 `mfaRequired` 登录结果。
- `.env.example`、Docker Compose、README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 MFA 配置、接口、存储字段和测试覆盖。

Validation:
- command: pnpm test: pass, all workspace tests passed including 52 platform tests, 47 API tests, 16 Studio tests.
- command: pnpm typecheck && pnpm build: pass
- command: pnpm verify:production: pass, includes tests, typecheck, build and production audit.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes AUTH_MFA_* for api and worker.
- command: pnpm export:sample && pnpm audit:mvp: pass

Notes:
- 这补齐的是 TOTP MFA 生产基线，不是完整账号风控。后续仍需恢复码、设备记忆、SSO/OAuth、设备风险控制、IP reputation、外部 IdP、完整审计报表和安全运营后台。

## Checkpoint 47: Account MFA recovery codes baseline

Status: done

What changed:
- 平台账号服务新增一次性 MFA recovery codes：确认 TOTP MFA 时返回明文恢复码一次，服务端只保存 SHA-256 hash。
- 登录 `mfaCode` 现在支持 TOTP 或未使用的 recovery code；恢复码使用后立即消费并记录 `user_mfa_recovery_code_used` 审计。
- 新增 `regenerateMfaRecoveryCodes`，要求当前密码和有效第二因子，返回新明文恢复码并替换旧 hash 集合。
- API 新增 `/v1/auth/mfa/recovery-codes/regenerate`；TOTP confirm 响应新增 `recoveryCodes`，公开 user 响应继续隐藏 MFA secret、counter 和 recovery code hashes。
- Postgres migration / repository 映射新增 `mfa_recovery_code_hashes`、`mfa_recovery_codes_updated_at`。
- Studio `Account` 面板新增一次性恢复码展示和 `Regenerate Codes` 控件；登录、禁用 MFA 和再生成恢复码均可输入 TOTP 或 recovery code。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步恢复码接口、存储字段、安全语义和测试覆盖。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: pass, 52 platform tests including recovery code one-time use and regeneration.
- command: pnpm --filter @agentic-galgame/api test: pass, 47 API tests including recovery code response hiding, regeneration, login and replay rejection.
- command: pnpm --filter @agentic-galgame/studio test: pass, 16 Studio tests including recovery code display and regeneration UI.
- command: pnpm test: pass, all workspace tests passed.
- command: pnpm typecheck: pass.
- command: pnpm build: pass.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: pnpm verify:production: pass, includes test, typecheck, build and production audit.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes AUTH_MFA_* for api and worker.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 MFA 恢复码生产基线，不是完整账号风控。后续仍需设备记忆、SSO/OAuth、设备风险控制、IP reputation、外部 IdP、完整审计报表和安全运营后台。

## Checkpoint 48: Account MFA trusted devices baseline

Status: done

What changed:
- 平台账号服务新增 MFA trusted device token 生命周期：通过有效 TOTP 或 recovery code 登录时可以选择记住当前设备。
- Trusted device 明文 token 只在登录响应返回一次，服务端只保存 SHA-256 hash、短 prefix、创建时间、过期时间和最后使用时间。
- 启用 MFA 的账号再次登录时，如果提供有效未撤销且未过期的 `mfaDeviceToken`，可以跳过第二因子 challenge，并记录 `user_mfa_trusted_device_used` 审计。
- 新增 `revokeMfaTrustedDevices`，要求当前密码和有效第二因子，撤销当前账号保存的 trusted devices，并记录 `user_mfa_trusted_devices_revoked` 审计。
- API config 新增 `AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS` 和 `AUTH_MFA_MAX_TRUSTED_DEVICES`；登录接口支持 `rememberMfaDevice` / `mfaDeviceToken`，并新增 `/v1/auth/mfa/trusted-devices/revoke`。
- Postgres migration / repository 映射新增 `mfa_trusted_devices`，公开 user 响应继续隐藏 trusted device hash。
- Studio `Account` 面板新增 `Remember MFA device` 和 `Forget Devices` 控件；本地只保存后端返回的设备 token，撤销或禁用 MFA 时清理本地 token。
- README、ARCHITECTURE、PRODUCTION、`.env.example`、Docker Compose 和 `audit:production` 同步设备记忆配置、接口、存储字段和测试覆盖。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck: pass, 52 platform tests including trusted device creation, use, revocation and audit events.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 47 API tests including remember device login, device-token login, public response hiding and revocation.
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 16 Studio tests including remember device and forget devices UI.
- command: pnpm test: pass, all workspace tests passed.
- command: pnpm typecheck: pass.
- command: pnpm build: pass.
- command: pnpm audit:production: pass.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: pnpm verify:production: pass, includes test, typecheck, build and production audit.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS and AUTH_MFA_MAX_TRUSTED_DEVICES for api and worker.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 MFA 设备记忆生产基线，不是完整设备风险引擎。后续仍需 SSO/OAuth、设备风险控制、IP reputation、外部 IdP、完整审计报表和安全运营后台。

## Checkpoint 49: Studio audit log panel baseline

Status: done

What changed:
- Studio production API client 新增 `ProductionAuditEventRecord` 和 `listAuditEvents(ownerId, limit)`，复用已有 `GET /v1/audit` 后端接口。
- 新增 `AuditLogPanel`，可按 owner 刷新最近审计事件，并展示 action、outcome、target、createdAt 和紧凑 details。
- 审计面板会把 `user_*`、MFA、access token 和 team invitation 相关动作标记为 `security`，方便运营排查账号、权限和 MFA 事件。
- App 接入审计日志状态、刷新动作和 owner 切换清理，避免切换 owner 后继续显示旧审计事件。
- Studio 样式新增审计日志面板、结果状态和分类标签；生产审计脚本新增 Studio audit log 门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步说明 Studio 已有基础审计查看入口，同时明确它仍不是 SIEM 级安全运营后台。

Validation:
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 17 Studio tests including audit event loading and security classification.
- command: pnpm audit:production: pass, includes Studio audit log panel and production API client checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 Studio 内置审计查看入口，不是完整 SIEM、异常检测、告警升级、报表导出或安全运营后台。后续仍需 SSO/OAuth、设备风险控制、真实外部凭据 smoke、原生邮件/IM provider、支付计费和完整人工审核后台。

## Checkpoint 50: Account session management baseline

Status: done

What changed:
- 平台账号服务新增 `revokeUserSession(userId, sessionId)`，只允许用户撤销归属自己的 session，避免直接按 session id 跨用户撤销。
- API 新增 `POST /v1/auth/sessions/:id/revoke`，要求 user session 鉴权；撤销不存在或非本人 session 返回 404，响应继续隐藏 `tokenHash`。
- Metrics route 新增 `/v1/auth/sessions/:id/revoke` 规范化映射，避免动态 session id 进入指标标签。
- Studio production API client 新增 `revokeUserSession`；`Account` 面板新增 `Refresh Sessions`、session 列表和 `Revoke Session`。
- Studio 撤销当前本机 session 时会清掉 localStorage 中的 session token，避免浏览器继续使用服务端已撤销 token。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 session 列表/撤销接口、归属校验、Studio UI 和测试覆盖。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform build: pass, 52 platform tests including owned session revocation guard.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 47 API tests including second-session revocation and revoked token rejection.
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 17 Studio tests including session refresh and revocation UI.
- command: pnpm audit:production: pass, includes API route, service guard, Studio client/UI, docs and tests checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是账号 session 可见性和撤销基线，不是完整设备风险控制、SSO/OAuth、异常登录检测、IP reputation 或企业 IdP 生命周期管理。

## Checkpoint 51: Account password complexity policy baseline

Status: done

What changed:
- 平台账号安全策略新增可配置密码复杂度：字母、数字、符号要求，以及弱密码片段拦截列表。
- API config、`.env.example` 和 `docker-compose.production.yml` 新增 `AUTH_PASSWORD_REQUIRE_LETTER`、`AUTH_PASSWORD_REQUIRE_NUMBER`、`AUTH_PASSWORD_REQUIRE_SYMBOL`、`AUTH_PASSWORD_BLOCKED_TERMS`。
- 默认配置保持本地开发兼容：要求字母，数字/符号/blocked terms 默认不强制；生产部署文档建议开启数字要求和常见弱词拦截。
- `UserAccountService` 在注册和重置密码时统一执行复杂度校验，避免前端绕过策略。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步密码策略配置、服务端校验和测试覆盖。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 53 platform tests including configurable password complexity policy.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 47 API tests including password complexity env parsing.
- command: pnpm audit:production: pass, includes password complexity env, API config, service and docs checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes AUTH_PASSWORD_REQUIRE_* and AUTH_PASSWORD_BLOCKED_TERMS for api and worker.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是本地账号密码复杂度生产基线，不是密码历史、强制定期轮换、 breached-password 数据库、企业 SSO/OAuth、外部 IdP 或设备风险引擎。

## Checkpoint 52: Studio content safety review baseline

Status: done

What changed:
- API 新增 `POST /v1/content-safety/review`，允许 owner/admin 对 `novel_text`、`project_json` 或 `asset_prompt` 手动运行同一套本地内容安全策略。
- 手动 review 响应和历史记录继续只保存/返回 `inputHash`、`inputLength`、`matchedRules`、decision 和 metadata，不保存原文。
- Studio production API client 新增 `listContentSafetyReviews()` 和 `reviewContentSafety()`。
- Studio 新增 `Content Safety` 面板，可刷新最近 review，展示 decision、source、target、命中规则和 hash 摘要，并可先保存当前项目后对项目 JSON 重新复核。
- `audit:production` 新增 API route、Studio client/UI、测试和生产文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步内容安全面板、手动 review endpoint 和生产边界说明。

Validation:
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 47 API tests including manual content safety review.
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 18 Studio tests including content safety refresh and project review UI.
- command: pnpm audit:production: pass, includes content safety endpoint, Studio panel, docs and tests checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 Studio 内置内容安全复核基线，不是完整人工审核队列、内容申诉、第三方 moderation provider、法务合规模型或分级权限审核后台。

## Checkpoint 53: Studio access token management baseline

Status: done

What changed:
- API 动态 access token 创建权限从仅 bootstrap admin 放宽为更可用的商用模型：admin 可创建任意动态 token；team admin/owner 可创建当前 owner 的 owner token；user token 只能 admin 或本人创建。
- API 测试覆盖 owner-scoped token 自助创建和撤销同 owner 的 child token。
- Studio production API client 新增 `listAccessTokens()`、`createOwnerAccessToken()` 和 `revokeAccessToken()`。
- Studio 新增 `Access Tokens` 面板，可刷新当前 owner token、创建 owner token、显示一次性明文 token、撤销 token，并展示 active/revoked、prefix、last used 和 expiresAt。
- `audit:production` 新增 access token client、面板、App、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步动态 token 权限模型、Studio 面板和一次性明文 token 说明。

Validation:
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 47 API tests including owner-scoped access token self-service.
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 19 Studio tests including owner access token refresh/create/revoke UI.
- command: pnpm audit:production: pass, includes access token API client, Studio panel, docs and tests checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 owner access token 运营管理基线，不是完整企业密钥治理、token 自动轮换、细粒度 scope、IP allowlist、JIT 凭据或外部 secret manager 集成。

## Checkpoint 54: Studio usage and estimated billing baseline

Status: done

What changed:
- Studio production API client 新增 `getUsageSummary(ownerId, limit)`，读取已有 `GET /v1/usage` 的 usage summary 和最近 usage events。
- Studio 新增 `Usage & Billing` 面板，可刷新今日 text/image job、成功/失败/阻断、资产字节、估算成本和最近 usage event。
- 面板把 `estimatedCostCents` 格式化为美元展示，明确这是运营成本估算，不是支付结算。
- 保存/加载 API 项目和资产生成成功后会静默刷新 usage，让运营面板更接近实时。
- `audit:production` 新增 Studio usage client、面板、App、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 Usage & Billing 面板和估算成本边界说明。

Validation:
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 20 Studio tests including usage and estimated billing panel.
- command: pnpm audit:production: pass, includes usage client, Studio panel, docs and tests checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 owner 用量和成本估算查看入口，不是 Stripe/支付结算、套餐订阅、发票、税务、收入确认、信用额度、欠费停机或正式账务系统。

## Checkpoint 55: Billing subscription and quota baseline

Status: done

What changed:
- 平台层新增 billing plans、subscriptions、checkout sessions 的类型、FileDatabase repository、Postgres repository 和生产迁移表。
- 新增 `BillingService`，内置 free/pro/studio 套餐，支持列出套餐、创建 checkout session、mock 完成 checkout、激活/取消 subscription，并写入 audit events。
- API 新增 `GET /v1/billing/plans`、`GET /v1/billing/subscription`、`GET /v1/billing/checkout-sessions`、`POST /v1/billing/checkout`、`POST /v1/billing/checkout-sessions/:id/complete` 和 `POST /v1/billing/subscription/cancel`。
- `GenerationJobService` 现在会按 active/trialing subscription 的 plan quota 执行 text/image/job 配额；无有效 subscription 时回落到 free plan。
- Studio production API client 和 UI 新增 `Billing` 面板，可刷新套餐/订阅/checkout sessions，发起 checkout，显示 checkout URL，并取消当前 subscription。
- README、ARCHITECTURE、PRODUCTION 和 `audit:production` 同步 billing endpoint、数据库表、Studio UI、subscription quota enforcement 和商业边界说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 55 platform tests including billing service and subscription quota enforcement.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes api, worker, Studio and Player production services plus password policy env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.
- local smoke: Studio opened at http://127.0.0.1:5176/ with API Online, Billing plans loaded from http://127.0.0.1:8788, and mock checkout session was created for pro plan.
- local smoke: Player opened at http://127.0.0.1:5177/ as a standalone player page, not Studio; it loaded sample text and rendered a 1280x720 fullscreen 16:9 stage.

Notes:
- 这补齐的是商用计费的产品和工程基线：套餐、订阅状态、checkout session、Studio 管理入口和订阅配额执行。
- 当前 checkout provider 仍是 `MockBillingCheckoutProvider`，`/complete` 仅用于本地和管理员验证。真正商用上线前仍需接 Stripe/Paddle/自有支付 provider、签名 webhook、发票、税务、退款、催缴、欠费冻结、收入确认和财务对账。

## Checkpoint 56: Stripe billing checkout and webhook baseline

Status: done

What changed:
- 新增 `StripeBillingCheckoutProvider`，可通过服务端 `BILLING_CHECKOUT_PROVIDER=stripe` 调用 Stripe-compatible `POST /v1/checkout/sessions` 创建 hosted subscription checkout session。
- API config、`.env.example` 和 `docker-compose.production.yml` 新增 `STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_PRO`、`STRIPE_PRICE_STUDIO`、`STRIPE_API_BASE_URL`、`STRIPE_REQUEST_TIMEOUT_MS` 和 `STRIPE_WEBHOOK_TOLERANCE_SECONDS`。
- API 新增公开但签名保护的 `POST /v1/billing/stripe/webhook`。它读取 raw body，校验 `Stripe-Signature`，处理 `checkout.session.completed`、`customer.subscription.updated` 和 `customer.subscription.deleted`。
- `BillingService` 新增按外部 checkout session id 激活 subscription、按外部 subscription id 更新/取消 subscription 的入口，避免真实支付回调依赖本地管理员手动 complete。
- FileDatabase、Postgres repository 和 migration 新增外部 checkout session/subscription id 查询与唯一索引，支持 webhook 快速、幂等地定位本地记录。
- `audit:production` 新增 Stripe provider、webhook route、配置、Compose、migration、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 Stripe Checkout/Webhook 启用方式、签名校验、事件映射和仍未覆盖的财务系统边界。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 56 platform tests including Stripe checkout provider.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 50 API tests including signed Stripe webhook activation/cancellation and Stripe config parsing.
- command: pnpm audit:production: pass, includes Stripe billing provider, webhook endpoint, signature verification, external id indexes, docs and tests checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player production services plus billing/Stripe env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 Stripe Checkout subscription 和签名 webhook 的工程基线，已经比 mock checkout 更接近真实商用支付。
- 当前仍不是完整财务/支付运营系统：税务、发票、优惠券、退款、争议处理、欠费停机、收入确认、对账、账单邮件和支付失败重试策略仍需继续接入支付 provider 的更多事件和后台流程。

## Checkpoint 57: Billing provider events and invoice payment state

Status: done

What changed:
- 平台层新增 `BillingEventRecord`、`BillingEventRepository` 和 `BillingProviderEventType`，把支付 provider event 从 subscription metadata 提升为可查询、可幂等处理的账务事件流水。
- FileDatabase、Postgres repository 和 production migration 新增 `billing_events`，保存 provider event id、invoice id、金额、币种、invoice URL、subscription 关联和发生时间，并对 `(provider, external_event_id)` 建唯一索引。
- `BillingService` 新增 `recordProviderBillingEvent()` 和 `listBillingEvents()`；重复 provider event id 会返回已有记录，`invoice_payment_failed` / `invoice_payment_action_required` 可把 subscription 标记为 `past_due`，`invoice_paid` 可恢复为 `active`。
- API 新增 `GET /v1/billing/events?ownerId=<id>`，并扩展 `POST /v1/billing/stripe/webhook` 处理 `invoice.payment_failed`、`invoice.payment_action_required` 和 `invoice.paid`。
- Studio production API client 和 `BillingPanel` 新增最近 billing events 展示，运营可看到 invoice event、invoice id、金额、状态和发生时间。
- `audit:production` 新增 billing events API、service、Postgres repository、migration、Studio、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 billing events、Stripe invoice 事件映射和仍未完成的财务边界。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 58 platform tests including provider billing events and Postgres billing event mapping.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 50 API tests including signed Stripe invoice failure/recovery webhooks and billing event query.
- command: pnpm --filter @agentic-galgame/studio test && pnpm --filter @agentic-galgame/studio typecheck: pass, 21 Studio tests including billing event panel rendering.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player production services plus billing/Stripe env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是支付运营的事件流水和发票支付状态同步基线，后续欠费停机、账单邮件、退款/争议处理、收入确认和财务对账可以基于 `billing_events` 继续做。
- 当前仍不是完整财务系统：税务、发票 PDF 归档、优惠券、退款、争议处理、欠费自动停机、收入确认、财务对账和真实外部凭据 smoke 仍未完成。

## Checkpoint 58: Past-due billing entitlement blocking

Status: done

What changed:
- 平台层新增 `BillingEntitlementPolicy` 和 `BillingEntitlementError`，用于把支付状态从“只记录”推进到“影响生产资源使用”。
- `GenerationJobService` 在新任务入队前检查 subscription entitlement；`past_due` 且超过宽限期时抛出 `BillingEntitlementError`，避免继续消耗 AI/图片生成资源。
- worker 执行已排队任务前也会二次检查 entitlement；欠费阻断时任务会变成 `blocked`，写入 `job_blocked` usage 和 `job_blocked_billing_entitlement` audit。
- API config 新增 `BILLING_BLOCK_PAST_DUE` 和 `BILLING_PAST_DUE_GRACE_DAYS`，默认开启欠费阻断，默认 3 天宽限。
- API 对 `BillingEntitlementError` 返回 HTTP 402，并在响应里返回 `billingEntitlement` 详情，便于 Studio/前端显示需要处理支付。
- `.env.example` 和 `docker-compose.production.yml` 同步欠费阻断配置；API 和 worker 都使用同一策略。
- `audit:production` 新增 env、Compose、config、platform wiring、API 402、GenerationJobService、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 past_due 宽限期、free quota 降级、HTTP 402 和 worker 二次阻断行为。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass, 59 platform tests including past-due entitlement blocking and worker blocked job behavior.
- command: pnpm --filter @agentic-galgame/api test && pnpm --filter @agentic-galgame/api typecheck: pass, 50 API tests including Stripe invoice failure -> HTTP 402 and invoice paid recovery.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus billing past-due env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是欠费后阻断生产资源消耗的 entitlement 基线。它依赖前一个 checkpoint 的 Stripe invoice events 把 subscription 更新为 `past_due` / `active`。
- 当前仍不是完整 dunning 系统：账单邮件、支付方式更新页、自动重试策略、优惠券、退款、争议处理、收入确认和财务对账仍需继续实现。

## Checkpoint 59: Billing payment method update portal

Status: done

What changed:
- 平台层新增 `BillingCustomerPortalSession`，并把 `BillingCheckoutProvider` 扩展为同时支持 checkout session 和 customer portal session。
- `MockBillingCheckoutProvider` 新增本地 `https://billing.local/portal/<sessionId>` 支付方式更新链接，用于开发和自动化测试闭环。
- `StripeBillingCheckoutProvider` 新增 `POST /v1/billing_portal/sessions` 调用，使用 subscription 的 `externalCustomerId` 创建 Stripe hosted payment method update URL，且不把 Stripe secret 写入 metadata。
- `BillingService.createCustomerPortalSession()` 会为已有 subscription 创建 portal session，并记录 `billing_payment_method_update_started` 审计事件。
- API 新增 `POST /v1/billing/payment-method-session`，按 owner admin 权限创建支付方式更新 session；没有 subscription 时返回 404。
- Studio production API client 和 `BillingPanel` 新增 `Update Payment Method` 操作，显示 hosted portal URL，方便 `past_due` 用户自助恢复支付。
- `audit:production` 新增 payment method session 的 API、平台类型、BillingService、Stripe provider、Studio UI、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 Stripe customer portal、支付方式更新 endpoint 和当前支付财务边界。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: pass, 60 platform tests including mock and Stripe customer portal sessions.
- command: pnpm --filter @agentic-galgame/api test: pass, 50 API tests including payment method session creation during Stripe billing lifecycle.
- command: pnpm --filter @agentic-galgame/studio test: pass, 21 Studio tests including `Update Payment Method` UI.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/studio typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck: pass.
- command: pnpm audit:production: pass, includes billing customer portal and Studio payment method update checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus billing env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 hosted 支付方式更新入口，和前一 checkpoint 的 `past_due` 阻断形成“支付失败 -> 阻断资源 -> 自助更新支付方式”的最小商用闭环。
- 当前仍不是完整 dunning / 财务系统：账单邮件、支付失败自动重试策略、税务、发票 PDF 归档、优惠券、退款、争议处理、收入确认和财务对账仍需继续实现。

## Checkpoint 60: Stripe refund and dispute billing events

Status: done

What changed:
- `BillingProviderEventType` 新增 `refund_created`、`dispute_created` 和 `dispute_closed`，用于记录退款和争议账务事件。
- `BillingEventRecord` 新增 `externalChargeId`、`amountRefundedCents` 和 `amountDisputedCents`，让退款/争议事件不只藏在 metadata 里，后续可以用于财务对账和运营查询。
- `BillingSubscriptionRepository` 新增 `getByExternalCustomerId()`；FileDatabase 和 Postgres repository 都支持按 Stripe customer id 反查 subscription。
- 新增 `packages/vn-platform/migrations/0002_billing_refund_dispute_events.sql`，为 Postgres `billing_events` 增加 charge/refund/dispute 字段，并为 external customer 与 external charge 建索引。
- `BillingService.recordProviderBillingEvent()` 现在可以在缺少 external subscription id 时按 external customer id 关联 owner/subscription，适配 refund/dispute 这类 charge 级事件。
- Stripe webhook 新增处理 `charge.refunded`、`charge.dispute.created` 和 `charge.dispute.closed`，记录 charge id、退款金额、争议金额、状态和 dispute reason。
- Studio production API client 和 `BillingPanel` 支持展示 refund/dispute billing events、charge id、refunded amount 和 disputed amount。
- `audit:production` 新增 refund/dispute webhook、类型字段、migration、repository、API 测试、Studio UI 和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 refund/dispute event 记录能力和仍未完成的财务系统边界。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform test: pass, 61 platform tests including external-customer refund event association and Postgres mapping.
- command: pnpm --filter @agentic-galgame/api test: pass, 50 API tests including Stripe refund and dispute webhook events.
- command: pnpm --filter @agentic-galgame/studio test: pass, 21 Studio tests including refund billing event display.
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/studio typecheck && pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck: pass.
- command: pnpm audit:production: pass, includes refund/dispute billing event migration and webhook checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus billing env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是退款/争议事件入账流水基线，不是完整的退款审批、争议证据提交、收入确认或财务对账系统。
- Stripe dispute 对象在真实 webhook 中可能只带 charge id；当前实现支持 `object.customer` 或 expanded `charge.customer`，生产 Stripe webhook 如果需要无歧义关联，应配置 event expansion 或在支付 provider adapter 中补 charge lookup。

## Checkpoint 61: OAuth/OIDC SSO baseline

Status: done

What changed:
- 平台层新增 `OAuthStateRecord`、`OAuthIdentityRecord`、`OAuthLoginProvider`、`OAuthService`、`MockOAuthLoginProvider` 和 `OidcOAuthLoginProvider`，实现带 PKCE code challenge 的 OAuth start/callback 基线。
- `UserAccountService` 新增 `loginWithExternalIdentity()`，SSO 用户会创建或复用本地 user account，并签发和密码登录相同的 bearer user session；外部 subject 只用于服务端绑定，不在 API 响应中暴露。
- FileDatabase 和 Postgres repository 新增 `oauth_states` 与 `oauth_identities` 持久化实现；新增 `packages/vn-platform/migrations/0003_oauth_sso_identity.sql`。
- API config、`.env.example` 和 `docker-compose.production.yml` 新增 `AUTH_OAUTH_*` 配置。生产环境启用 OAuth 时要求 HTTPS redirect；`AUTH_OAUTH_PROVIDER=oidc` 时要求 OIDC client、authorization/token/userinfo endpoint 和强 client secret。
- API 新增 `POST /v1/auth/oauth/start`、`POST /v1/auth/oauth/callback` 和 `GET /v1/auth/oauth/callback`，callback 成功后返回 user session。
- Studio production API client 和 `AccountPanel` 新增 `Start SSO` / `Complete SSO`，可在本地 mock provider 下完成 SSO 登录闭环。
- `audit:production` 新增 OAuth env、Compose、API config、API route、platform service、Postgres repository、migration、Studio UI、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 OAuth/OIDC 启用方式、数据库表、API endpoint、Studio 操作和仍未完成的企业身份治理边界。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform build: pass.
- command: pnpm --filter @agentic-galgame/api typecheck: pass.
- command: pnpm --filter @agentic-galgame/studio typecheck: pass.
- command: pnpm --filter @agentic-galgame/vn-platform test: pass, 63 platform tests including mock OAuth state/callback/session flow and Postgres OAuth mapping.
- command: pnpm --filter @agentic-galgame/api test: pass, 52 API tests including OAuth start/callback session flow and OIDC config safety.
- command: pnpm --filter @agentic-galgame/studio test: pass, 22 Studio tests including SSO account panel flow.
- command: pnpm audit:production: pass, includes OAuth/OIDC service, config, migration, API, Studio and docs checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 AUTH_OAUTH_ENABLED=true AUTH_OAUTH_PROVIDER=oidc AUTH_OAUTH_REDIRECT_URI=https://api.example.com/v1/auth/oauth/callback AUTH_OAUTH_CLIENT_ID=agentic-galgame AUTH_OAUTH_CLIENT_SECRET=oauth-client-secret-000000 AUTH_OAUTH_AUTHORIZATION_URL=https://idp.example.com/oauth2/v1/authorize AUTH_OAUTH_TOKEN_URL=https://idp.example.com/oauth2/v1/token AUTH_OAUTH_USERINFO_URL=https://idp.example.com/oauth2/v1/userinfo docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus OAuth env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是商用 SSO/OIDC 的工程基线：state 防重放、PKCE、外部身份绑定、本地账号/session 复用、mock 和 OIDC provider 抽象。
- 当前还不是完整企业身份治理：SCIM、企业域名强制 SSO、IdP group/team role 自动映射、IdP 单点登出同步、设备风险评分和更完整的安全运营后台仍需继续实现。

## Checkpoint 62: OAuth enterprise email policy

Status: done

What changed:
- `OAuthService` 新增 verified email 和 email domain allowlist 策略；默认要求 IdP 返回 verified email，配置 allowlist 后只允许指定企业邮箱域名登录。
- API config 新增 `AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL` 和 `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS`，并把策略传入平台 OAuth service。
- `.env.example` 与 `docker-compose.production.yml` 同步 OAuth 邮箱校验策略；API 和 worker 使用同一组生产配置。
- API、platform 测试覆盖 OAuth 域名 allowlist、verified email 配置解析和 callback 登录路径。
- `audit:production` 新增 env、Compose、API config、OAuth service、测试和文档门禁，避免后续回退成任意邮箱均可 SSO 登录。
- README、ARCHITECTURE 和 PRODUCTION 同步企业邮箱策略、OIDC 启用方式和生产部署说明。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform test: pass, 63 platform tests including OAuth allowlist rejection.
- command: pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api test: pass, 52 API tests including OAuth config parsing and callback flow.
- command: pnpm --filter @agentic-galgame/studio typecheck && pnpm --filter @agentic-galgame/studio test: pass, 22 Studio tests.
- command: pnpm audit:production: pass, includes OAuth verified email and domain policy checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 AUTH_OAUTH_ENABLED=true AUTH_OAUTH_PROVIDER=oidc AUTH_OAUTH_REDIRECT_URI=https://api.example.com/v1/auth/oauth/callback AUTH_OAUTH_CLIENT_ID=agentic-galgame AUTH_OAUTH_CLIENT_SECRET=oauth-client-secret-000000 AUTH_OAUTH_AUTHORIZATION_URL=https://idp.example.com/oauth2/v1/authorize AUTH_OAUTH_TOKEN_URL=https://idp.example.com/oauth2/v1/token AUTH_OAUTH_USERINFO_URL=https://idp.example.com/oauth2/v1/userinfo AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL=true AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS=example.com docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus OAuth policy env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 SSO 登录入口的企业邮箱准入策略，避免 OIDC 接入后任意 verified consumer email 都能进入租户。
- 当前仍不是完整企业身份治理：SCIM、强制 SSO、IdP group/team role 自动映射、IdP 单点登出同步、session 风险策略和安全运营后台仍需继续实现。

## Checkpoint 63: Managed-domain SSO enforcement

Status: done

What changed:
- 平台层新增 `UserAccountAccessPolicy` 和 `UserAccountSsoRequiredError`，支持按邮箱域名强制 SSO。
- `UserAccountService` 在密码注册、密码登录、密码重置请求和密码重置确认前检查 `ssoRequiredEmailDomains`；命中受管企业域名时返回 `SSO is required for this email domain.`，但 OAuth/OIDC callback 仍可创建或复用账号并签发 session。
- API config 新增 `AUTH_SSO_REQUIRED_EMAIL_DOMAINS`，并传入 platform；生产环境设置该项时如果没有启用 `AUTH_OAUTH_ENABLED=true` 会 fail-fast，避免把受管域名用户锁死。
- API server 把 `UserAccountSsoRequiredError` 映射为 HTTP 403，并返回 `ssoRequired: true` 和命中的 `domain`，方便 Studio/前端提示用户走 SSO。
- `.env.example` 和 `docker-compose.production.yml` 同步受管域名强制 SSO 配置；API 和 worker 使用同一策略。
- `audit:production` 新增 env、Compose、API config、API mapping、platform type/service、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS` 与 `AUTH_SSO_REQUIRED_EMAIL_DOMAINS` 的区别和部署方式。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform test: pass, 64 platform tests including managed-domain SSO enforcement.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api test: pass, 54 API tests including 403 `ssoRequired` responses and config parsing.
- command: pnpm audit:production: pass, includes managed-domain SSO env, Compose, API, platform, tests and docs checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 AUTH_OAUTH_ENABLED=true AUTH_OAUTH_PROVIDER=oidc AUTH_OAUTH_REDIRECT_URI=https://api.example.com/v1/auth/oauth/callback AUTH_OAUTH_CLIENT_ID=agentic-galgame AUTH_OAUTH_CLIENT_SECRET=oauth-client-secret-000000 AUTH_OAUTH_AUTHORIZATION_URL=https://idp.example.com/oauth2/v1/authorize AUTH_OAUTH_TOKEN_URL=https://idp.example.com/oauth2/v1/token AUTH_OAUTH_USERINFO_URL=https://idp.example.com/oauth2/v1/userinfo AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL=true AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS=example.com AUTH_SSO_REQUIRED_EMAIL_DOMAINS=example.com docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus managed-domain SSO env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是企业域名强制 SSO 的最小商用控制面，防止受管域名用户绕过 IdP 用密码注册或登录。
- 当前仍不是完整企业身份治理：SCIM、IdP group 到 team role 自动映射、IdP 单点登出同步、Just-In-Time team provisioning、session 风险策略和安全运营后台仍需继续实现。

## Checkpoint 64: OAuth group to team role mapping

Status: done

What changed:
- `OAuthProviderProfile` 新增 `groups`，`OAuthLoginCompleteResult` 新增 `mappedTeamMemberships`，用于把 SSO profile 中的 IdP group 映射为 Studio team role。
- `MockOAuthLoginProvider` 支持 `email|name|group1,group2` 测试格式；`OidcOAuthLoginProvider` 新增 `groupsClaim`，默认读取 OIDC userinfo 的 `groups` claim，也支持逗号分隔字符串。
- `OAuthService` 新增 `groupRoleMappings` 策略，callback 成功后按 `group:teamId:role` 自动 upsert team member，并写入 `oauth_group_role_mapping_applied` audit。若用户已有更高角色，不会被自动降级。
- API config 新增 `AUTH_OAUTH_GROUP_CLAIM` 和 `AUTH_OAUTH_GROUP_ROLE_MAPPINGS`，并传入 OIDC provider 与平台 OAuth policy。
- API OAuth callback 响应新增 `mappedTeamMemberships`，同时继续隐藏 OAuth subject。
- Studio production API client 补充 `mappedTeamMemberships` 类型，避免前端类型落后于 API。
- `.env.example` 和 `docker-compose.production.yml` 同步 group claim 与 group-role mapping 配置；API 和 worker 使用同一策略。
- `audit:production` 新增 env、Compose、API config、API response、platform type/service、Studio type、测试和文档门禁。
- README、ARCHITECTURE 和 PRODUCTION 同步 IdP group 到 team role 的部署方式，并把已完成的企业域名强制 SSO / group mapping 从未完成列表中移出。

Validation:
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/vn-platform typecheck && pnpm --filter @agentic-galgame/vn-platform test: pass, 65 platform tests including OAuth group role mapping and no automatic role downgrade.
- command: pnpm --filter @agentic-galgame/vn-platform build && pnpm --filter @agentic-galgame/api typecheck && pnpm --filter @agentic-galgame/api test: pass, 55 API tests including OAuth callback group mapping and team access.
- command: pnpm --filter @agentic-galgame/studio typecheck: pass.
- command: pnpm audit:production: pass, includes OAuth group claim, group-role mapping, API response, Studio type and docs checks.
- command: pnpm verify:production: pass, includes all workspace tests, typecheck, build and production audit.
- command: pnpm export:sample && pnpm audit:mvp: pass, static playable sample generated and MVP audit passed.
- command: CORS_ORIGIN=https://studio.example.com API_PUBLIC_BASE_URL=https://api.example.com VITE_API_BASE_URL=https://api.example.com PLAYER_BASE_URL=https://play.example.com API_OWNER_TOKENS=owner_a:strong-random-token-000000 AUTH_MFA_ENABLED=true AUTH_MFA_ENCRYPTION_KEY=strong-mfa-encryption-key-0000000000 AUTH_OAUTH_ENABLED=true AUTH_OAUTH_PROVIDER=oidc AUTH_OAUTH_REDIRECT_URI=https://api.example.com/v1/auth/oauth/callback AUTH_OAUTH_CLIENT_ID=agentic-galgame AUTH_OAUTH_CLIENT_SECRET=oauth-client-secret-000000 AUTH_OAUTH_AUTHORIZATION_URL=https://idp.example.com/oauth2/v1/authorize AUTH_OAUTH_TOKEN_URL=https://idp.example.com/oauth2/v1/token AUTH_OAUTH_USERINFO_URL=https://idp.example.com/oauth2/v1/userinfo AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL=true AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS=example.com AUTH_SSO_REQUIRED_EMAIL_DOMAINS=example.com AUTH_OAUTH_GROUP_CLAIM=groups AUTH_OAUTH_GROUP_ROLE_MAPPINGS=vn-editors:team_alpha:editor docker compose -f docker-compose.production.yml config: pass, config includes API, worker, Studio and Player services plus OAuth group mapping env.
- command: generic secret scan for `sk-...` tokens: pass, no API keys found.

Notes:
- 这补齐的是 IdP group 到 Studio team role 的 JIT 映射基线，可以支撑 Okta/Auth0/Keycloak/Google Workspace 这类 OIDC provider 的团队角色自动授权。
- 当前仍不是完整 SCIM 或企业身份生命周期：不会根据 IdP group 消失自动撤销角色，不会禁用离职账号，也没有 IdP 单点登出同步、设备风险评分或安全运营后台。

## Checkpoint 65: Core commercial playable focus

Status: done

What changed:
- 根据最新优先级，账号、收费、SSO、团队和运营能力保留为可选生产集成，不再继续扩展为当前主线。
- Studio 顶部工具栏重新分层：Load Sample、Generate VN Project、Save/Load Local、Export JSON、Export Static Playable 作为第一行核心操作；Owner、Save/Load API、审批和发布作为第二行可选生产集成快捷入口。
- Studio 中间列把 Runtime Preview、Asset Generation、Preview Controls、Novel Import 放在生产集成面板之前，打开编辑器后先服务小说导入、生成、预览、编辑和导出。
- 修正 Studio 移动端 preview column 宽度约束，避免可选生产面板的最小内容宽度把核心 16:9 预览撑出屏幕。
- Player App 的玩家控制改为中文 `上一段`、`下一段`、`存档`、`读档`、`全屏`，控制条移到右上角低遮挡区域，存读档显示中文反馈。
- `packages/vn-exporter` 静态导出和 Studio 单文件 playable 导出同步中文控制、全屏按钮和存读档反馈，避免导出版退回旧调试体验。
- README、ARCHITECTURE 和 COMPLETION_AUDIT 更新，说明账号/收费是可选生产集成，核心商业化链路优先。

Validation:
- command: pnpm --filter @agentic-galgame/player typecheck && pnpm --filter @agentic-galgame/player test: pass, 3 player tests.
- command: pnpm --filter @agentic-galgame/studio typecheck && pnpm --filter @agentic-galgame/studio test: pass, 22 Studio tests.
- command: pnpm --filter @agentic-galgame/vn-exporter test && pnpm --filter @agentic-galgame/vn-exporter typecheck: pass, exporter test verifies Chinese save/load/fullscreen controls.
- command: pnpm --filter @agentic-galgame/vn-exporter build && pnpm export:sample: pass, `dist/playable-sample/index.html` includes `上一段` / `下一段` / `存档` / `读档` / `全屏`.
- command: pnpm audit:mvp: pass, exported HTML exposes player save/load/fullscreen controls.
- command: Playwright Studio QA at http://127.0.0.1:5173/?qa=core-commercial: pass, desktop preview ratio 1.7777777777777777, core toolbar actions first, production integrations below novel import, no console errors.
- command: Playwright Studio mobile QA at http://127.0.0.1:5173/?qa=mobile-width-fixed: pass, 390px viewport stage ratio 1.7777777777777777, stage width 356px, document scrollWidth 390px, no console errors.
- command: Playwright Player QA at http://127.0.0.1:5175/?qa=player-core-commercial: pass, no Studio UI, stage ratio 1.7777777777777777, Chinese controls visible, speaker highlight active, save/load returns to saved beat, no console errors.
- command: Playwright static playable QA at http://127.0.0.1:5186/?qa=static-playable-core: pass, stage is 1280x720, Chinese controls visible, speaker highlight active, save/load returns to saved beat, no console errors.

Notes:
- 本 checkpoint 只收敛核心 Galgame 商用体验，不继续扩展账号、收费、SSO 或企业身份治理。
- 移动端保持 16:9 完整画面，不拉伸；竖屏会有黑边以保护画面比例。
