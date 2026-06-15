# Agentic Galgame Studio 架构

## VN Core Protocol

`packages/vn-core` 是共享协议层，不依赖 React、Studio 或 Runtime UI。

它定义：

- `VNProject`、`VNViewport`、`DialogueUIConfig`
- `AssetManifest`、`VNAsset`
- `CharacterProfile`
- `VNChapter`、`VNScene`、`VNShot`、`VNBeat`、`VNLine`
- `StageState`、`StagePatch`、`StageCharacter`
- `CameraState`、`StageEffect`、`TransitionConfig`
- `CompiledBeat`、`ValidationResult`

核心纯函数：

- `createDefaultUIConfig()`
- `splitTextToBeats()`
- `detectLineKind()`
- `applyStagePatch()`
- `applySpeakerFocus()`
- `resolveBeats()`
- `validateProject()`
- `renderDisplayText()`

`VNProject` 是可序列化 JSON，方便 Studio 编辑、Runtime 加载和 Exporter 静态导出。

## Studio

`apps/studio` 是 React + Vite 单页编辑器。

Studio 负责用户工作流：

- 加载 sample novel。
- 粘贴小说文本。
- 调用本地 Agent 生成 `VNProject`。
- 展示 Chapter / Scene / Shot / Beat 树。
- 用 Runtime Preview 试玩当前 beat。
- 在 Inspector 修改 line kind、speaker、text、render mode、CG asset、角色 expression/position/visible。
- 保存和读取 localStorage。
- 连接生产 API 后，为 placeholder 图片资产创建 `asset_generation` job，并把生成后的 URL 回填进 `VNProject`。
- 资产生成支持两种 Studio 模式：本地 `inline` 可直接触发 `/jobs/:id/run`；生产 `worker` 模式只入队并轮询 job 状态，由独立 worker 执行。
- 连接生产 API 后，注册/登录创作者账号，启动/完成 OAuth/OIDC SSO，保存 bearer session，设置/确认/关闭 TOTP MFA，展示/再生成一次性恢复码，记住/撤销 MFA 设备，并触发邮箱验证和密码重置流程。
- 连接生产 API 后，提交 release approval，刷新审批列表，加载/提交审批评论，并为 pending approval 执行 approve / reject。
- 连接生产 API 后，通过 `Operations Summary` 和 `Audit Log` 查看 owner 级运营汇总、incidents 和最近审计事件。
- 导出 project JSON。
- 浏览器端导出单文件 playable HTML。

Studio 不包含核心拆分、校验或播放规则，这些逻辑都放在 packages 中。

## Runtime

`packages/vn-runtime` 负责播放视觉小说。

主要模块：

- `VNRuntime`：加载并校验 `VNProject`，调用 `resolveBeats()`，维护当前 beat index，支持 `next()`、`previous()`、`goToBeat(index | beatId)`、`save()`、`load()` 和 `getState()`。
- `VNRenderer`：渲染器接口。
- `DomVNRenderer`：MVP DOM + CSS 分层渲染器。
- `SaveManager`：localStorage 或 memory storage 存档。
- `projectLoader`：从 JSON 或 URL 加载项目。

Runtime 只依赖 `vn-core`，不依赖 Studio。

## Player App

`apps/player` 是独立玩家端 Runtime shell，和 `apps/studio` 分离部署。

它负责：

- 加载默认 `/project.vn.json`。
- 支持 `?projectUrl=https://cdn.example.com/project.vn.json` 加载远程项目。
- 使用 `VNRuntime` + `DomVNRenderer` 播放全屏 16:9 Galgame 画面。
- 提供 `上一段`、`下一段`、`存档`、`读档`、`全屏` 玩家控制。
- 不依赖 `vn-agent`，不包含 Studio 编辑器、Inspector 或 Agent 操作区。

生产上可以把 `apps/player/dist` 部署到 CDN / 静态托管，Studio 和 API 只负责生成、保存和发布 `VNProject` JSON 与资产。仓库也提供 `Dockerfile.player`，用 nginx 作为静态 Player 容器。

## Production Frontend Images

`Dockerfile.studio` 和 `Dockerfile.player` 把 Studio / Player 构建成独立 nginx 静态镜像，并共用 `nginx.static.conf`：

- `studio` 镜像只包含 `apps/studio/dist`，构建时注入 `VITE_API_BASE_URL` 和资产 job 轮询配置。
- `player` 镜像只包含 `apps/player/dist`，默认可加载内置 sample，也可通过 `projectUrl` 加载 API 发布的项目 JSON。
- nginx 暴露 `/health`，对 `/assets/` 做长期缓存，对 `/project.vn.json` 使用 no-cache，并对 SPA 路由 fallback 到 `index.html`。
- 前端镜像不接收 `API_AUTH_TOKEN`、owner token、user token 或 session token；创作者登录后的 bearer session 只保存在浏览器本地。

## Agent Framework

`packages/vn-agent` 是本地 Agent 流水线，MVP 默认不接真实 AI API。

当前 workflow：

```text
cleanNovelText
splitChapters
splitScenes
splitNovelLines
detectLineKind
splitTextToBeats
extractCharacters
createPlaceholderAssets
plan initial stage
assign speaker
mark CG candidates
validateProject
return VNProject
```

`createProjectFromNovel()` 是主要入口。

保留 provider 接口：

- `TextModelProvider`
- `ImageGenerationProvider`
- `VNAgentWorkflow`

MVP 实现：

- `MockTextModelProvider`
- `MockImageGenerationProvider`
- `OpenAIImageGenerationProvider`，作为可选 OpenAI-compatible 图片 provider。

未来可以替换 provider，而不需要改 Studio 或 Runtime。

## Exporter

`packages/vn-exporter` 负责静态导出。

入口：

```ts
exportStaticBundle({
  project,
  outDir,
  runtimeBundle
})
```

当前输出：

```text
index.html
project.vn.json
assets/*.svg
```

`index.html` 会加载 `project.vn.json`，在浏览器中 resolve beats 并播放。玩家页在全屏容器中保持 16:9 stage，提供 `上一段`、`下一段`、`存档`、`读档`、`全屏`，并可部署到任何静态托管服务。

## Stage Mode vs CG Mode

`StageState.renderMode` 有两种模式：

- `stage`：背景层 + 人物层 + effects 层 + textbox UI 层。
- `cg`：整张 CG 特写 + textbox UI 层。

普通剧情使用 `stage`，只调整文字、说话人高亮、人物表情、人物位置和少量进出场。

重点剧情使用 `cg`，例如手机屏幕亮起、世界线偏移、真相揭露、告白、死亡、坠落、枪声、崩溃、拥抱、分别、爆炸、血迹和关键物品特写。

## 两行 Beat 规则

默认 UI 配置：

```ts
maxLines: 2
maxCjkCharsPerLine: 30
maxCjkCharsPerBeat: 60
```

Agent 使用 `splitTextToBeats()` 在导入阶段尽量把长文本拆成两行以内的 beat。拆分优先级是中文句读和停顿标点，最后才硬切。

Runtime 不通过滚动显示长对白。文本太长应该在 Agent 阶段拆成多个 beat。

## 说话人高亮规则

`applySpeakerFocus()` 在 resolve 阶段应用：

- `dialogue` / `monologue` 且存在 `speakerId`：当前说话人 `active`，其他可见角色 `dimmed`。
- `narration`：所有可见角色 `normal`。

MVP 用 CSS filter 和 opacity 实现高亮，不重新生成图片。

## 为什么普通剧情使用分层

普通剧情的视觉变化通常是背景复用、人物表情、站位和说话人焦点变化。如果每个 beat 都生成完整图片，会造成资产数量爆炸，也会让编辑器很难修改单个角色或文本。

分层结构让背景、立绘和 UI 可以复用，后续也方便接 Live2D、表情差分、转场和演出效果。

## 为什么重点剧情使用 CG

CG 适合承载剧情转折和视觉冲击，例如手机屏幕亮起或世界线偏移。它是少量关键节点的整张画面，不替代普通剧情的分层舞台。

这种分工可以保持 MVP 简洁，同时保留 Galgame 的关键演出感。

## 未来 AI Provider 如何接入

`vn-agent` 已经保留 `TextModelProvider` 和 `ImageGenerationProvider`。

当前图片 provider 状态：

- 默认：SVG placeholder，不调用真实 AI。
- Codex/image2：`createCodexImage2Manifest()` 生成 prompt manifest，Codex 产图后可用 `applyGeneratedAssetManifest()` 回填真实图片路径。
- OpenAI-compatible Images API：`OpenAIImageGenerationProvider` 调用 `/v1/images/generations`，支持 `baseURL`、第三方 `urlbase`、`OPENAI_BASE_URL` 和 `OPENAI_URLBASE`。

未来接入方式：

- 用真实 `TextModelProvider` 替换章节/场景/人物/CG 候选规划。
- 在 Studio / Exporter 流程中调用真实 `ImageGenerationProvider`，根据资产计划生成背景、立绘和 CG 并落盘。
- 保持输出仍然是 `VNProject`，让 Studio、Runtime、Exporter 不需要知道 provider 细节。

凭据规则：

- API key 只通过参数或环境变量注入，不写入仓库。
- OpenAI-compatible provider 的单元测试使用 mock fetch 覆盖请求 URL、鉴权头、`b64_json` 和 `url` 响应解析。
- 第三方网关 base 可以传 `https://www.packyapi.com`，provider 会规范到 `https://www.packyapi.com/v1/images/generations`。

## 未来 PixiJS Renderer 如何接入

`vn-runtime` 的渲染入口是 `VNRenderer`：

```ts
interface VNRenderer {
  render(beat: CompiledBeat, project: VNProject): void;
}
```

未来可以新增：

```ts
class PixiVNRenderer implements VNRenderer
```

`VNRuntime` 只调用 renderer 接口，不关心 DOM 或 PixiJS。

## 未来部署 Provider 如何接入

`vn-exporter` 当前只写本地静态目录。未来可以在 exporter 外层增加部署 provider：

- `StaticHostProvider`
- `GitHubPagesProvider`
- `CloudflarePagesProvider`
- `S3Provider`

部署 provider 接收 `dist/playable-sample` 这样的静态目录，不需要修改 VN Core 或 Runtime。

## Production API

`apps/api` 是生产版后端入口。它不依赖 React，也不承担 Runtime 渲染。

当前 API 支持：

- `GET /health`
- `GET /v1/projects?ownerId=<id>`
- `GET /v1/projects/:id`
- `POST /v1/projects`
- `POST /v1/projects/from-novel`
- `GET /v1/projects/:id/assets`
- `POST /v1/projects/:id/publish`
- `GET /v1/projects/:id/releases`
- `POST /v1/projects/:id/rollback`
- `GET /v1/projects/:id/release-diff`
- `GET /v1/projects/:id/release-approvals`
- `POST /v1/projects/:id/release-approvals`
- `GET /v1/release-approvals/:id/comments`
- `POST /v1/release-approvals/:id/comments`
- `POST /v1/release-approvals/:id/approve`
- `POST /v1/release-approvals/:id/reject`
- `GET /v1/public/projects/:id/project.vn.json`
- `GET /v1/projects/:id/deployment-invalidations`
- `GET /v1/deployment-invalidations?ownerId=<id>`
- `POST /v1/assets`
- `POST /v1/jobs`
- `GET /v1/jobs/:id`
- `POST /v1/jobs/:id/run`
- `POST /v1/jobs/run-next`
- `GET /v1/notification-deliveries?ownerId=<id>`
- `POST /v1/notification-deliveries/run-next`
- `GET /v1/ops/summary?ownerId=<id>`
- `GET /v1/usage?ownerId=<id>`
- `GET /v1/billing/plans`
- `GET /v1/billing/subscription?ownerId=<id>`
- `GET /v1/billing/checkout-sessions?ownerId=<id>`
- `GET /v1/billing/events?ownerId=<id>`
- `POST /v1/billing/checkout`
- `POST /v1/billing/checkout-sessions/:id/complete`
- `POST /v1/billing/subscription/cancel`
- `POST /v1/billing/stripe/webhook`
- `GET /v1/audit?ownerId=<id>`
- `GET /v1/content-safety?ownerId=<id>`
- `POST /v1/content-safety/review`
- `POST /v1/access-tokens`
- `GET /v1/access-tokens?ownerId=<id>`
- `POST /v1/access-tokens/:id/revoke`
- `POST /v1/auth/register`
- `POST /v1/auth/login`
- `POST /v1/auth/oauth/start`
- `POST /v1/auth/oauth/callback`
- `GET /v1/auth/oauth/callback`
- `POST /v1/auth/verify-email`
- `POST /v1/auth/email-verification/request`
- `POST /v1/auth/password-reset/request`
- `POST /v1/auth/password-reset/confirm`
- `GET /v1/auth/me`
- `GET /v1/auth/sessions`
- `POST /v1/auth/sessions/:id/revoke`
- `POST /v1/auth/logout`
- `POST /v1/teams`
- `GET /v1/teams?userId=<id>`
- `GET /v1/teams/:id/members`
- `POST /v1/teams/:id/members`
- `GET /v1/teams/:id/invitations`
- `POST /v1/teams/:id/invitations`
- `POST /v1/team-invitations/:id/revoke`
- `POST /v1/team-invitations/accept`

API 层负责：

- JSON request body 大小限制。
- CORS。
- 公开 `GET /health` 健康检查，供容器、负载均衡和 uptime probe 使用；业务接口仍走 bearer/session 鉴权。
- `GET /metrics` 输出 Prometheus 文本格式的进程级 HTTP 指标，默认 admin-only，可用 `API_METRICS_PUBLIC=true` 显式公开给受控监控网关。
- 每个响应写入 `x-request-id`；调用方可传入合法 `x-request-id` 串联网关、Studio 和后端日志。
- 基础安全响应头：`x-content-type-options`、`x-frame-options`、`referrer-policy`、`permissions-policy`。
- 可配置结构化 access log：`API_ACCESS_LOG=true` 时输出 `http_request` JSON 行，只记录 method/path/status/duration/auth role，不记录 query、body 或 token。
- 可选 signed error webhook：`API_ERROR_WEBHOOK_URL` 启用后，未捕获 500 会发送脱敏后的 `api_server_error` 事件，route 使用规范化路径，避免泄露动态 id、query、body 或 provider key。
- 可选 bearer token 鉴权，生产通过 `API_AUTH_TOKEN` 启用。
- owner-scoped bearer token 鉴权，生产可通过 `API_OWNER_TOKENS=ownerId:token` 把 Studio 用户限制在自己的 ownerId。
- user-scoped bearer token 鉴权，生产可通过 `API_USER_TOKENS=userId:token` 配合 team membership 访问授权 team。
- 用户账号注册登录，`/v1/auth/register` 和 `/v1/auth/login` 生成 bearer session；密码和 session token 都只保存 hash，登录账号仍通过 team membership 授权。用户可以列出自己的 session，并只能撤销归属自己的 session。
- OAuth/OIDC SSO：`OAuthService` 创建带 PKCE code challenge 的 `oauth_states`，只保存 state hash；callback 用授权 code 通过 mock 或 OIDC provider 换取 profile，把 `provider + subject` 持久化到 `oauth_identities` 并绑定本地 user account，再签发同一种 bearer user session。Studio `Account` 面板提供 `Start SSO` 和 `Complete SSO`，本地可以用 mock code 验证闭环，生产可配置通用 OIDC authorization/token/userinfo endpoint。默认要求 provider 返回 verified email，并可用 `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS` 限制允许创建/登录的 SSO profile 域名。`UserAccountService` 还支持 `AUTH_SSO_REQUIRED_EMAIL_DOMAINS`，对受管企业邮箱域名禁止密码注册、密码登录和密码重置，只允许通过 SSO 进入。`AUTH_OAUTH_GROUP_CLAIM` 和 `AUTH_OAUTH_GROUP_ROLE_MAPPINGS` 会在 callback 后把 IdP groups 映射为 Studio team role，并避免自动降级已有更高角色。SCIM 基线由 API 层 `/v1/scim/v2` 提供，使用独立 `SCIM_BEARER_TOKEN`，调用 `UserAccountService.provisionScimUser()` / `disableScimUser()` 创建、更新、启用、禁用用户；禁用时会设置 `disabledAt` 并撤销该用户 session。当前身份治理还不包含 IdP 单点登出同步、group 消失后的自动角色回收或设备风险评分。
- 邮箱验证和密码重置，使用一次性 action token；明文 token 只进入账号 webhook payload，数据库只保存 hash。
- 账号安全策略：注册/重置密码使用可配置最小长度、字母/数字/符号要求和弱密码片段阻断；登录失败按账号累计，达到阈值后写入 `lockedUntil` 并临时拒绝登录，成功登录或密码重置会清空失败计数。
- TOTP MFA：`/v1/auth/mfa/totp/setup` 返回一次性 secret/otpauth URL，数据库只保存 AES-GCM 加密 secret；`confirm` 启用后返回一次性恢复码，数据库只保存恢复码 hash；`login` 缺少验证码返回 `mfaRequired`，`mfaCode` 可以是 TOTP 或未使用恢复码。TOTP 会记录最后使用 counter 防止重放，恢复码使用后立即消费。`rememberMfaDevice` 会返回一次性 `mfaDeviceToken`，后续登录可用 device token 跳过 MFA；服务端只保存 token hash、prefix、过期时间和最后使用时间，并支持撤销。
- 内存限流，生产可通过 `API_RATE_LIMIT_WINDOW_MS` 和 `API_RATE_LIMIT_MAX_REQUESTS` 调整。
- 每日任务配额，生产可通过 `API_DAILY_JOB_LIMIT`、`API_DAILY_TEXT_JOB_LIMIT` 和 `API_DAILY_IMAGE_JOB_LIMIT` 调整。
- 用量和成本估算查询，按 owner 汇总当天 job、资产字节和 AI 任务估算成本。
- 审计日志查询，按 owner 追踪 project、job、asset、账号安全、MFA、access token、团队邀请和发布治理动作；Studio `Audit Log` 面板会把安全相关动作标记出来，便于运营排查。
- 内容安全 review 查询与手动复核，按 owner 追踪导入文本、项目 JSON 和图片 prompt 的本地审核结果；Studio `Content Safety` 面板可以刷新记录并对当前项目 JSON 重新运行策略。
- 项目发布，把 `VNProject` 资产改写为公开 URL，写入 `published_project_json`，创建 versioned release，并返回 Player 可加载的 immutable `projectUrl` / `playableUrl`。
- 稳定公开 current project URL，`/v1/public/projects/:id/project.vn.json` 会指向当前 release，适合长期分享的 `currentPlayableUrl`。
- 发布版本历史和回滚，保留不可变 release 记录，回滚时只更新项目当前发布指针，并触发 current URL cache invalidation。
- Release diff，发布时把项目 summary 写入 release metadata，`GET /v1/projects/:id/release-diff` 比较当前草稿和最新发布版本，供审阅者查看 beat/asset/character 的差异摘要。
- 发布审批流，`RELEASE_APPROVAL_REQUIRED=true` 时 editor 只能提交审批申请，team admin/owner 或 admin token 审批后才会发布；Studio 的 `ReleaseDiffPanel`、`ReleaseApprovalPanel` 和 `NotificationDeliveryPanel` 调用 diff、列表、评论、通知 delivery、approve 和 reject API，避免审阅者只能靠 curl 操作。审批申请记录项目指纹，项目变更后旧 approval 会变成 stale 并拒绝发布。
- 发布审批通知，配置 `RELEASE_APPROVAL_WEBHOOK_URL` 后把 request/update/comment/approve/reject/stale 写入 notification outbox；worker 投递 signed webhook，失败会重试并保留 delivery 状态。Studio 可以查看 owner 维度 delivery 状态、重试次数、错误和手动触发下一条投递。
- 团队邀请通知，配置 `TEAM_INVITATION_WEBHOOK_URL` 后在 create/accept/revoke/expire 时发送 signed webhook。创建事件可以携带一次性 `invitationToken` 和 `TEAM_INVITATION_ACCEPT_BASE_URL` 生成的接受链接；明文 token 不写入数据库，也不写入 notification outbox。
- Owner 用量和估算成本，`UsageService` 聚合当天 job、资产字节和 estimated cents；Studio `UsageBillingPanel` 展示 usage events 和估算金额，作为运营成本视图，不作为支付结算。
- Billing 订阅基线，`BillingService` 维护 `free` / `pro` / `studio` 套餐、owner 当前 subscription、checkout session、customer portal session 和 provider billing event；`GenerationJobService` 入队前会按 active/trialing subscription 的套餐 quota 限制 job，没有订阅时按 free plan 限制，`past_due` 在 `BILLING_PAST_DUE_GRACE_DAYS` 后通过 `BillingEntitlementError` 阻断新任务和 worker 执行中的已排队任务。Studio `BillingPanel` 可以刷新套餐、发起 checkout、展示 checkout URL、创建支付方式更新 URL、查看 invoice/refund/dispute billing events 和取消订阅。默认 provider 是 `MockBillingCheckoutProvider`；生产可配置 `BILLING_CHECKOUT_PROVIDER=stripe` 使用 Stripe Checkout 创建 subscription session，并用 Stripe customer portal 创建 payment method update session，再通过 `POST /v1/billing/stripe/webhook` 的 `Stripe-Signature` raw-body 校验处理 `checkout.session.completed`、`customer.subscription.updated`、`customer.subscription.deleted`、`invoice.payment_failed`、`invoice.payment_action_required`、`invoice.paid`、`charge.refunded`、`charge.dispute.created` 和 `charge.dispute.closed`，把外部支付状态回写到本地 subscription，并把 invoice/charge 金额、退款金额、争议金额、状态、URL、provider event id 写入 `billing_events`。
- Owner 运维摘要，`OperationsService` 聚合项目、job、审批、通知、内容安全、部署、usage 和 audit，输出 `healthy` / `degraded` / `critical` 以及 incidents；Studio `OperationsSummaryPanel` 用它做上线巡检和排障入口。
- Deployment cache invalidation，记录 publish / rollback 后的 purge 状态；可接 Cloudflare URL purge provider。
- 动态访问令牌生命周期，admin 可创建 owner/admin/user token，team admin/owner 可创建当前 owner 的 owner token，owner 可列出和撤销自己的 owner token；Studio `AccessTokenPanel` 提供刷新、创建和撤销入口；服务端只保存 token hash。
- 团队成员角色权限，team id 复用现有 ownerId，成员角色为 owner/admin/editor/viewer。
- 团队邀请 lifecycle，team admin/owner 可创建、列出和撤销邀请；邀请 token 明文只返回一次，服务端保存 hash，user token 接受后写入 team member。
- 把 HTTP 请求转换为 platform service 调用。
- 在 local asset storage 模式下公开 `GET /assets/<storageKey>`，让 Studio/Runtime 能读取生成资产。

API 不直接读写文件，也不直接运行 Agent。它通过 `packages/vn-platform` 间接调用。

`NODE_ENV=production` 下，API config 会拒绝缺失/过短/placeholder admin、owner 或 user token，并拒绝 `CORS_ORIGIN=*`。

权限模型：

- admin token：可访问所有 owner，并可运行 admin-only 队列接口。
- owner token：只能访问同 owner 的项目、任务和资产。
- user token：只代表用户身份；必须通过 `team_members` 中的角色授权访问对应 owner/team。
- user session：由 email/password 登录生成，语义等同 user 身份；必须通过 `team_members` 授权访问 owner/team。
- team role：viewer 可读项目，editor 可创建/更新项目和任务，admin/owner 可管理团队成员、access token、usage/audit/content-safety。
- dynamic access token：通过 `access_tokens` 表保存 hash，支持撤销、过期和最近使用时间；静态 `API_AUTH_TOKEN` 主要用于 bootstrap 和运维。
- 本地开发未配置 token 时默认为 admin 访问，方便 MVP 调试。

## VN Platform

`packages/vn-platform` 是生产版服务层。

它定义：

- `StudioProjectRecord`
- `GenerationJobRecord`
- `AssetRecord`
- `UsageEventRecord`
- `BillingPlanRecord`
- `BillingSubscriptionRecord`
- `BillingCheckoutSessionRecord`
- `AuditEventRecord`
- `ContentSafetyReviewRecord`
- `AccessTokenRecord`
- `UserAccountRecord`
- `UserAccountActionTokenRecord`
- `UserSessionRecord`
- `ReleaseApprovalRecord`
- `ReleaseApprovalCommentRecord`
- `ReleaseApprovalNotificationPayload`
- `NotificationDeliveryRecord`
- `ProjectRepository`
- `JobRepository`
- `AssetRepository`
- `UsageRepository`
- `BillingPlanRepository`
- `BillingSubscriptionRepository`
- `BillingCheckoutSessionRepository`
- `AuditRepository`
- `ContentSafetyRepository`
- `AccessTokenRepository`
- `UserAccountRepository`
- `UserAccountActionTokenRepository`
- `UserSessionRepository`
- `ReleaseApprovalRepository`
- `ReleaseApprovalCommentRepository`
- `ReleaseApprovalNotifier`
- `UserAccountNotifier`
- `TeamInvitationNotifier`
- `NotificationDeliveryRepository`
- `AssetStorage`

当前实现：

- `FileDatabase`：开发/本地测试用文件持久化。
- `ProjectService`：创建、保存、读取和列出项目。
- `ProjectPublishService`：发布项目到当前 AssetStorage，生成公开 `project.vn.json`，记录 release version 和项目 diff summary，支持 release history 和 rollback，并返回独立 Player URL。
- `ProjectDiffService`：基于 release metadata 中的项目 summary 比较当前草稿和最新发布版本，输出变更计数和有限数量的可审阅摘要。
- `ReleaseApprovalService`：记录发布申请、审批评论、拒绝申请、审批并发布，并把可选审批通知写入 outbox；审批发布复用 `ProjectPublishService`，避免绕过 release/current URL/cache invalidation 逻辑。
- `NotificationDeliveryService`：持久化审批通知 delivery，按重试策略投递 webhook，记录 succeeded / retry / failed 审计事件。
- `OperationsService`：聚合 owner 级生产状态、计数、近期失败和 incidents，为 API/Studio 提供内置可观测入口。
- `DeploymentService`：记录部署缓存失效，默认 skipped；配置 Cloudflare provider 后对 current project / current playable URL 发起 URL purge。
- `GenerationJobService`：生成任务入队、运行、状态更新、每日配额检查、失败重试退避和终态记录。
- `UsageService`：记录和汇总 owner 当天用量、资产字节和 AI 任务估算成本。
- `BillingService`：维护默认商业套餐、owner subscription、checkout session 和 subscription cancellation；通过 `BillingCheckoutProvider` 抽象支付 provider。它支持按本地 checkout id 完成 mock checkout，也支持按外部 checkout session id 激活订阅、按外部 subscription id 更新/取消订阅。任务入队会读取它来决定 owner 的 daily job/text/image quota。
- `AuditService`：记录 project/job/asset 写入动作，支持 owner 维度查询。
- `ContentSafetyService`：本地 deterministic 审核导入小说、项目 JSON 和图片生成 prompt，记录 hash、命中规则和 decision，不保存完整原文。
- `AccessTokenService`：生成、认证、列出和撤销动态 access token；明文 token 只返回一次，持久化层只保存 SHA-256 hash 和短 prefix。
- `UserAccountService`：注册/登录 email/password 账号，使用 scrypt 保存密码 hash，生成和撤销 session token；明文 session 只返回一次，持久化层只保存 SHA-256 hash 和短 prefix。它还负责邮箱验证、密码重置 action token 生命周期、账号失败登录锁定、TOTP MFA setup/confirm/disable、恢复码再生成和 MFA trusted device token 生命周期；MFA secret 通过服务端 `AUTH_MFA_ENCRYPTION_KEY` 派生密钥后 AES-GCM 加密入库，恢复码和 trusted device token 只以 SHA-256 hash 保存。
- `OAuthService`：封装 OAuth/OIDC start/callback，创建 `oauth_states`、校验 state 一次性使用和过期时间、调用 `OAuthLoginProvider` 换取 profile、写入 `oauth_identities`，并通过 `UserAccountService.loginWithExternalIdentity()` 创建或复用本地账号和 session。`MockOAuthLoginProvider` 用于本地闭环，`OidcOAuthLoginProvider` 用于标准 OIDC provider。
- `TeamService`：维护 team、member 和 owner/admin/editor/viewer 角色授权；当前 team id 复用项目记录中的 ownerId。
- `TeamInvitationService`：维护团队邀请、一次性邀请 token hash、接受/撤销/过期状态、邀请审计和可选邀请 webhook 通知；通知失败只写审计，不阻断邀请生命周期。
- `LocalAssetStorage`：本地资产落盘，并限制路径穿越。
- `PostgresProjectRepository` / `PostgresJobRepository` / `PostgresAssetRepository` / `PostgresUsageRepository` / `PostgresBillingPlanRepository` / `PostgresBillingSubscriptionRepository` / `PostgresBillingCheckoutSessionRepository` / `PostgresAuditRepository` / `PostgresContentSafetyRepository` / `PostgresAccessTokenRepository` / `PostgresUserAccountRepository` / `PostgresUserAccountActionTokenRepository` / `PostgresUserSessionRepository` / `PostgresOAuthStateRepository` / `PostgresOAuthIdentityRepository` / `PostgresTeamRepository` / `PostgresTeamInvitationRepository`：生产 Postgres 持久化实现。
- `PostgresReleaseApprovalRepository`：生产记录发布审批请求、审批状态和发布 release 关联。
- `PostgresReleaseApprovalCommentRepository`：生产记录审批评论线程，支持审批详情和 Studio 审阅协作。
- `WebhookReleaseApprovalNotifier`：对审批申请、评论、审批结果和 stale 防护发送 signed webhook。Payload 不包含评论正文或完整项目 JSON。
- `WebhookUserAccountNotifier`：对邮箱验证和密码重置事件发送 signed webhook。请求类事件可携带一次性 action token 和可打开的验证/重置链接；payload 不包含 token hash。
- `WebhookTeamInvitationNotifier`：对团队邀请 create/accept/revoke/expire 发送 signed webhook。创建事件可包含一次性 token 和接受链接；payload 不包含 token hash。
- `PostgresNotificationDeliveryRepository`：生产记录 notification delivery outbox、投递状态、重试次数和错误。
- `PostgresDeploymentInvalidationRepository`：生产记录发布/回滚后的 cache invalidation 结果。
- `NodePostgresExecutor`：基于 `pg` 的 SQL executor。
- `S3CompatibleAssetStorage`：S3/R2/MinIO 兼容对象存储上传实现。
- `StripeBillingCheckoutProvider`：服务端 Stripe Checkout provider，调用 Stripe `POST /v1/checkout/sessions` 创建 hosted subscription checkout session，把 owner/plan/local checkout id 写入 checkout 和 subscription metadata。API webhook 层负责 `Stripe-Signature` 校验、subscription 状态事件映射和 invoice billing event 记录。

生产运行方式：

- 设置 `DATABASE_URL` 后，API 使用 Postgres repositories。
- 设置 `ASSET_STORAGE_PROVIDER=s3` 后，API 使用 S3-compatible object storage。
- `GenerationJobService` 可以由 HTTP API 进程调用，也可以由独立 worker 进程调用。

## Production Worker

`apps/api/src/worker.ts` 是后台任务入口。它和 API 使用同一套 `loadConfig()` / `createApiPlatform()`，但不暴露 HTTP。

worker 职责：

- 轮询 queued `generation_jobs`。
- 调用 `GenerationJobService.runNext()`。
- 轮询 pending `notification_deliveries`。
- 调用 `NotificationDeliveryService.runNext()`。
- 输出结构化 lifecycle/job/notification 日志。
- 支持 `WORKER_RUN_ONCE=true` 做 smoke 或 CI。

Docker Compose 中的 `worker` 服务使用同一 API 镜像，通过 `pnpm --filter @agentic-galgame/api worker` 启动。`studio` 和 `player` 使用独立静态镜像。正式部署时，API、worker、Studio 和 Player 可以分别扩容或放到不同域名/CDN。

## Database Schema

生产 Postgres schema 位于：

```text
packages/vn-platform/migrations/0001_production_schema.sql
packages/vn-platform/migrations/0002_billing_refund_dispute_events.sql
packages/vn-platform/migrations/0003_oauth_sso_identity.sql
```

迁移执行入口：

```bash
pnpm db:migrate
pnpm db:migrate:dist
```

`runPostgresMigrations()` 位于 `packages/vn-platform/src/migrations`。它维护 `schema_migrations`，按文件名顺序执行 SQL，跳过已应用文件，并在单个文件失败时 rollback。API 的 `migrate.ts` CLI 只负责读取 `DATABASE_URL`、创建 `NodePostgresExecutor` 并调用平台迁移 runner。

包含：

- `studio_projects`：保存项目、owner、source 和 `vn_project` JSON。
- `generation_jobs`：保存任务状态、输入、输出、错误、attempts、max attempts、next run time 和时间戳。
- `project_assets`：保存资产索引、storage key、content type、public URL。
- `usage_events`：保存 owner 用量事件、任务关联、资产字节和估算成本。
- `billing_plans`：保存商业套餐、价格、币种、周期和每日 quota。
- `billing_subscriptions`：保存 owner 当前订阅、周期、状态、取消信息和外部 subscription/customer id，并对外部 subscription id 建唯一索引。
- `billing_checkout_sessions`：保存 checkout URL、provider session id、状态、过期时间和完成时间，并对外部 checkout session id 建唯一索引。
- `billing_events`：保存支付 provider event、invoice id、charge id、金额、退款金额、争议金额、状态、invoice URL 和 subscription 关联，并对 provider 外部 event id 建唯一索引。
- `audit_events`：保存 owner 审计事件、动作、目标和结果。
- `content_safety_reviews`：保存 owner 内容审核结果、输入 hash、输入长度、命中规则和 metadata，不保存完整原文。
- `access_tokens`：保存动态访问令牌 hash、prefix、role、owner、撤销时间、过期时间和最近使用时间。
- `user_accounts`、`user_account_action_tokens`、`user_sessions`：保存账号、邮箱验证/密码重置 token hash 和 session token hash。
- `oauth_states`：保存 OAuth state hash、provider、PKCE code verifier、return URL、状态、过期和使用时间；用于 callback 防 CSRF 和重放。
- `oauth_identities`：保存外部 `provider + subject` 到本地 user account 的绑定、profile email/name 和最近登录时间；`provider + subject` 建唯一约束。
- `team_invitations`：保存团队邀请 token hash、prefix、role、status、过期时间和接受/撤销时间。

开发环境默认写入：

```text
DATA_DIR/db.json
```

这是本地开发数据库，不是最终商用数据库。

## Production Job Flow

当前 job 类型：

- `novel_to_project`
- `asset_generation`

`novel_to_project` 当前使用本地 heuristic workflow 生成 `VNProject` 并保存。

配置 `AI_PROVIDER_ENABLED=true` 和 `AI_TEXT_PROVIDER=openai-compatible` 后，`novel_to_project` 可以通过 `OpenAITextModelProvider` 调用 OpenAI-compatible Chat Completions。API 适配层会把小说文本和本地 heuristic baseline `VNProject` 一起放入 prompt，要求模型返回完整 `VNProject` JSON，并在保存前调用 `validateProject()`。

`asset_generation` 已接入可注入图片 provider。API 配置 `AI_PROVIDER_ENABLED=true`、`AI_IMAGE_PROVIDER=openai-compatible` 和 `OPENAI_API_KEY` 后，worker 会调用 OpenAI-compatible Images API，接收 `b64_json` 或图片 URL，并通过 `AssetService.store()` 写入本地文件或 S3-compatible object storage。

任务入队前会检查 owner 当天配额，并审核输入内容。执行失败时会按 `JOB_RETRY_DELAY_MS` 做指数退避，并在达到 `JOB_MAX_ATTEMPTS` 后标记为 `failed`。内容安全阻断会标记为 `blocked`，不会重试。成功、失败和阻断都会写入 usage/audit/content safety review，便于后续接计费、运营后台和监控。

默认 `AI_PROVIDER_ENABLED=false`。在未配置凭据时，任务状态会变成：

```text
waiting_for_credentials
```

这样可以先验证任务、状态、API 和数据库路径，而不会意外调用真实 AI。

## Production Security Boundary

生产部署必须设置：

```text
API_AUTH_TOKEN
CORS_ORIGIN
DATA_DIR
API_BODY_LIMIT_BYTES
API_RATE_LIMIT_MAX_REQUESTS
API_DAILY_JOB_LIMIT
API_DAILY_TEXT_JOB_LIMIT
API_DAILY_IMAGE_JOB_LIMIT
AUTH_MFA_ENCRYPTION_KEY (when AUTH_MFA_ENABLED=true)
AUTH_OAUTH_ENABLED / AUTH_OAUTH_PROVIDER / AUTH_OAUTH_REDIRECT_URI (when SSO is enabled)
AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL / AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS / AUTH_SSO_REQUIRED_EMAIL_DOMAINS / AUTH_OAUTH_GROUP_ROLE_MAPPINGS (optional SSO policy)
SCIM_ENABLED / SCIM_BEARER_TOKEN / SCIM_BASE_URL (optional SCIM user lifecycle)
AUTH_OAUTH_CLIENT_ID / AUTH_OAUTH_CLIENT_SECRET / AUTH_OAUTH_AUTHORIZATION_URL / AUTH_OAUTH_TOKEN_URL / AUTH_OAUTH_USERINFO_URL (when AUTH_OAUTH_PROVIDER=oidc)
JOB_MAX_ATTEMPTS
JOB_RETRY_DELAY_MS
CONTENT_SAFETY_ENABLED
CONTENT_SAFETY_BLOCK_REVIEW
CONTENT_SAFETY_BLOCKED_TERMS
CONTENT_SAFETY_REVIEW_TERMS
```

AI 密钥规则：

- key 不写入仓库。
- key 不打印到日志。
- 只通过 env / secret manager 注入。
- 未确认密钥前不启用真实 provider。

更多部署说明见 `docs/PRODUCTION.md`。
