# Completion Audit

本文件把 `AGENTS.md` 的 20 条完成标准映射到当前可验证证据。只把能由文件、测试、构建、导出或浏览器行为证明的项标记为 done。

## Automated Gate

```bash
pnpm verify:mvp
```

最近一次结果：passed。最新严格复核还把 `unknown_speaker`、本地 workflow、`docs/CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md` 和静态播放器 `shot.initialStage` 纳入 `audit:mvp`。

该命令串行执行：

- `pnpm test`
- `pnpm typecheck`
- `pnpm build`
- `pnpm export:sample`
- `pnpm image2:manifest`
- `pnpm audit:mvp`

## Requirement Evidence

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | 可以本地打开 Studio | done | `pnpm dev` 启动 Vite Studio；Browser smoke check 打开 `http://127.0.0.1:5173/`。 |
| 2 | 可以加载 sample novel | done | Studio 初始状态和 Load Sample 使用 `sampleNovelText`；`apps/studio/src/App.test.tsx` 覆盖 sample 加载。 |
| 3 | 可以粘贴自定义小说并生成 VNProject | done | `apps/studio/src/App.test.tsx` 覆盖自定义小说输入和 Generate VN Project。 |
| 4 | 可以预览生成后的视觉小说 | done | Studio 测试验证生成后 `.vn-line` 更新；Runtime Preview 使用 `VNRuntime + DomVNRenderer`。 |
| 5 | 播放器有 16:9 全屏视觉区域 | done | `dist/playable-sample/index.html` 使用 full-viewport `.page` 和 16:9 `.stage`；Browser QA 在 1280x720 下测得 stage ratio `1.7777777777777777`，且无 Studio UI。 |
| 6 | 播放器底部有两行文本框 | done | Runtime CSS 使用底部 `.vn-textbox` 和 `.vn-line` `-webkit-line-clamp: 2`。 |
| 7 | 对话显示角色名和 `「」` | done | Core、Runtime、Studio 测试覆盖；`audit:mvp` 检查 Runtime display 添加括号。 |
| 8 | 旁白显示纯文字 | done | Core tests 和 Runtime DOM tests 覆盖首个旁白纯文本。 |
| 9 | 说话人高亮有效 | done | Core `applySpeakerFocus` tests、Runtime DOM tests 和 `audit:mvp` 检查 active/normal。 |
| 10 | 背景在多个 beat 中复用 | done | `audit:mvp` 检查 `bg_lab_night` 至少复用到多个 compiled beats。 |
| 11 | sample 至少出现一个 CG beat | done | Agent tests 和 `audit:mvp` 检查 CG beat。 |
| 12 | 可以 next / previous | done | Runtime unit tests、Runtime DOM click/keyboard tests、Studio tests；静态玩家端 QA 验证 `上一段` / `下一段`。 |
| 13 | 可以 local save / load | done | Runtime SaveManager 按 beatId 存取；Studio Preview Save/Load jsdom 测试通过；静态玩家端 QA 验证 `存档` 后前进，再 `读档` 回到保存 beat。 |
| 14 | 可以导出 project JSON | done | Studio tests stub download and verify Export Project JSON triggers Blob download。 |
| 15 | 可以导出静态 playable sample | done | `pnpm export:sample`，Exporter tests，`audit:mvp` 检查 `dist/playable-sample`、16:9 stage CSS、`存档` / `读档` / `全屏` 控件。 |
| 16 | `pnpm test` 通过 | done | `pnpm verify:mvp` 输出 passed。 |
| 17 | `pnpm typecheck` 通过 | done | `pnpm verify:mvp` 输出 passed。 |
| 18 | `pnpm build` 通过 | done | `pnpm verify:mvp` 输出 passed；package dist 不再包含 test output。 |
| 19 | `pnpm export:sample` 通过 | done | `pnpm verify:mvp` 输出 passed。 |
| 20 | README、ARCHITECTURE、TASKLOG 存在且完整 | done | `README.md`、`docs/ARCHITECTURE.md`、`docs/CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md`、`docs/TASKLOG.md` 存在；`audit:mvp` 检查文件存在。 |

## Strict Re-audit Additions

| Requirement | Status | Evidence |
|---|---:|---|
| 无法判断说话人时使用稳定 unknown speaker 语义 | done | Agent 固定生成 `unknown_speaker`；`agent.test.ts` 和 `audit:mvp` 覆盖无署名引号对话。 |
| 无署名对话第一 beat 也能上舞台 | done | `createBeatStagePatch()` 会把 `unknown_speaker` 加入角色 patch；`audit:mvp` 检查 resolved stage。 |
| Agent Framework 有可调用 workflow | done | `LocalHeuristicVNAgentWorkflow` 实现 `VNAgentWorkflow`，返回合法 VNProject；`agent.test.ts` 和 `audit:mvp` 覆盖。 |
| 目标文档在 docs 目录可见 | done | `docs/CODEX_GOAL_AGENTIC_GALGAME_STUDIO.md` 已补齐；`audit:mvp` 检查。 |
| 静态播放器遵守 shot.initialStage | done | 导出 HTML 的内嵌 resolver 会在每个 shot 前读取 `shot.initialStage`；Exporter test 和 `audit:mvp` 覆盖。 |
| Inspector 不把未出场角色误显示为 visible | done | Studio test 覆盖未知说话人 `Focus: not visible` 时 checkbox 未勾选；Browser Studio QA 复测通过。 |

## Latest Browser QA

| Surface | Status | Evidence |
|---|---:|---|
| Static player | done | `http://127.0.0.1:5186/?qa=static-playable-core`：无 Studio UI，stage ratio `1.7777777777777777`，中文 `上一段` / `下一段` / `存档` / `读档` / `全屏` 控制可见，林雪对话显示姓名和 `「」`，林雪 active，读档回到保存 beat，无 console error。 |
| Studio | done | `http://127.0.0.1:5173/?qa=core-commercial` 与移动端 `?qa=mobile-width-fixed`：核心 toolbar actions 在第一行，生产集成在第二行，preview ratio `1.7777777777777777`，小说导入在生产集成面板之前，390px 移动端无页面横向溢出，无 console error。 |

## Remaining Scope Boundaries

这些不是 MVP 要求，当前按文档明确保留为未来扩展：

- 真实 LLM API。
- Studio 内自动批量调用真实 AI 生图并落盘。
- 用户登录、数据库、多人协作、云存储、支付。
- Live2D、语音、BGM、复杂分支剧情和复杂动画时间轴。

## Image Generation Audit

| Requirement | Status | Evidence |
|---|---:|---|
| 确认当前图片生成方式 | done | 默认路径是 SVG placeholder；见 `docs/IMAGE_GENERATION.md`。 |
| 支持 Codex/image2 | done for manifest workflow | `pnpm image2:manifest` 生成 `dist/image2-assets-manifest.json`；`createCodexImage2Manifest()` 和 `applyGeneratedAssetManifest()` 已测试。 |
| 支持 OpenAI Images API | done as optional provider | `OpenAIImageGenerationProvider` 已实现；mock fetch 测试覆盖 `b64_json` / `url` 响应解析和鉴权头。 |
| 支持第三方 URL base | done | provider 支持 `baseURL`、`urlbase`、`OPENAI_BASE_URL`、`OPENAI_URLBASE`，测试覆盖 `https://www.packyapi.com/v1/images/generations` endpoint。 |
