# Agentic Galgame Studio

Agentic Galgame Studio 是一个 Web 视觉小说 / Galgame 系统。它可以把小说文本导入 Studio，通过 Agent 流水线拆成章节、场景和两行以内的 beat，生成可编辑的 `VNProject`，并用 Web Runtime 播放传统 Galgame 风格画面。

当前仓库包含两层能力：

- MVP 闭环：本地 Studio、heuristic Agent、Runtime、静态导出。
- 生产版地基：`apps/api` 后端、`packages/vn-platform` 平台服务层、项目持久化、生成任务、资产存储抽象、Postgres schema 和生产验证脚本。

当前优先级是把核心 Galgame 创作和播放链路做到可商用：小说导入、Agent 拆 beat、Studio 编辑预览、Runtime 播放、静态可玩导出。账号、收费、SSO、团队和运营面板属于可选生产集成，不影响本地核心链路。

MVP 默认不接真实 AI API。生产版 AI provider 已保留开关和任务模型，但在没有确认密钥前不会调用外部 API。

当前基础闭环是：

```text
小说文本 -> 本地 Agent -> VNProject JSON -> Studio 编辑预览 -> Runtime 播放 -> 静态 playable 导出
```

## 安装

```bash
pnpm install
```

## 启动 Studio

```bash
pnpm dev
```

默认启动 Vite Studio：

```text
http://127.0.0.1:5173/
```

这是创作者编辑器，不是纯玩家界面。它包含导入、生成、beat tree、Inspector 和中间 Runtime Preview。

Studio 支持加载 sample、粘贴小说、生成 VNProject、查看 beat tree、编辑文本、切换旁白/对话/内心、修改说话人、切换 CG、修改角色 expression/position/visible、next/previous 预览、localStorage save/load、导出 JSON 和浏览器端导出单文件 playable HTML。

连接生产 API 后，Studio 还支持账号注册/登录、保存 session token、OAuth/OIDC SSO start/callback、TOTP MFA 设置/确认/关闭、一次性恢复码展示/再生成、MFA 设备记忆/撤销、重发邮箱验证、确认邮箱验证、请求/确认密码重置、批量生成 placeholder 图片资产：先保存项目到 API，再为背景、立绘、CG 创建 `asset_generation` job，job 成功后把返回的资产 URL 回填到 `VNProject` 并再次保存。默认本地开发使用 inline 模式直接触发 job；生产可设置 `VITE_ASSET_JOB_RUN_MODE=worker`，让 Studio 只入队并轮询 `GET /v1/jobs/:id`，由独立 worker 消费队列。Studio 也提供 `Notification Delivery Monitor` 和 `Audit Log`，用于刷新审批通知 outbox、查看 pending/failed/succeeded 状态、手动投递下一条通知，并按 owner 查看审计事件与安全相关动作。

## 启动生产 API 骨架

```bash
pnpm dev:api
```

默认地址：

```text
http://127.0.0.1:8787
```

可用接口包括：

```text
GET  /health
GET  /metrics
GET  /v1/projects?ownerId=<id>
GET  /v1/projects/:id
POST /v1/projects
POST /v1/projects/from-novel
GET  /v1/projects/:id/assets
POST /v1/projects/:id/publish
GET  /v1/projects/:id/releases
POST /v1/projects/:id/rollback
GET  /v1/projects/:id/release-diff
GET  /v1/projects/:id/release-approvals
POST /v1/projects/:id/release-approvals
GET  /v1/release-approvals/:id/comments
POST /v1/release-approvals/:id/comments
POST /v1/release-approvals/:id/approve
POST /v1/release-approvals/:id/reject
GET  /v1/public/projects/:id/project.vn.json
GET  /v1/projects/:id/deployment-invalidations
GET  /v1/deployment-invalidations?ownerId=<id>
POST /v1/assets
POST /v1/jobs
GET  /v1/jobs/:id
POST /v1/jobs/:id/run
POST /v1/jobs/run-next
GET  /v1/notification-deliveries?ownerId=<id>
POST /v1/notification-deliveries/run-next
GET  /v1/ops/summary?ownerId=<id>
GET  /v1/usage?ownerId=<id>
GET  /v1/billing/plans
GET  /v1/billing/subscription?ownerId=<id>
GET  /v1/billing/checkout-sessions?ownerId=<id>
GET  /v1/billing/events?ownerId=<id>
POST /v1/billing/checkout
POST /v1/billing/payment-method-session
POST /v1/billing/checkout-sessions/:id/complete
POST /v1/billing/subscription/cancel
POST /v1/billing/stripe/webhook
GET  /v1/audit?ownerId=<id>
GET  /v1/content-safety?ownerId=<id>
POST /v1/content-safety/review
POST /v1/access-tokens
GET  /v1/access-tokens?ownerId=<id>
POST /v1/access-tokens/:id/revoke
POST /v1/auth/register
POST /v1/auth/login
POST /v1/auth/oauth/start
POST /v1/auth/oauth/callback
GET  /v1/auth/oauth/callback
POST /v1/auth/verify-email
POST /v1/auth/email-verification/request
POST /v1/auth/password-reset/request
POST /v1/auth/password-reset/confirm
GET  /v1/auth/me
GET  /v1/auth/sessions
POST /v1/auth/sessions/:id/revoke
POST /v1/auth/logout
POST /v1/teams
GET  /v1/teams?userId=<id>
GET  /v1/teams/:id/members
POST /v1/teams/:id/members
GET  /v1/teams/:id/invitations
POST /v1/teams/:id/invitations
POST /v1/team-invitations/:id/revoke
POST /v1/team-invitations/accept
```

`GET /health` 是公开健康检查，用于 Docker、负载均衡和 uptime probe；业务 API 在配置鉴权后仍需要 bearer token。

后台任务 worker：

```bash
pnpm dev:worker
```

生产构建后的 worker：

```bash
pnpm worker:api
```

worker 会轮询生成任务队列。默认不调用外部 API。配置 `AI_PROVIDER_ENABLED=true`、`AI_TEXT_PROVIDER=openai-compatible` 和文本 key 后，`novel_to_project` 可以调用 OpenAI-compatible Chat Completions 返回完整 `VNProject`；配置 `AI_IMAGE_PROVIDER=openai-compatible` 和图片 key 后，图片任务会调用 OpenAI-compatible Images API，并把生成结果写入本地资产目录或 S3-compatible object storage。

生产配置和部署说明见 [docs/PRODUCTION.md](docs/PRODUCTION.md)。

## 启动独立 Player

```bash
pnpm dev:player
```

默认地址：

```text
http://127.0.0.1:5175/
```

这是玩家端 Runtime shell，不包含 Studio 编辑器、Inspector 或 Agent 操作区。默认加载 `apps/player/public/project.vn.json`，也可以通过 URL 指定项目：

```text
http://127.0.0.1:5175/?projectUrl=https://cdn.example.com/project.vn.json
```

生产部署时可以把 `apps/player/dist/` 独立部署到 CDN / 静态托管，再把 `projectUrl` 指向已发布的 `VNProject` JSON。

生产 API 提供 `POST /v1/projects/:id/publish`。它会把项目依赖的 placeholder / generated assets 写入当前 `AssetStorage`，生成不可变 release JSON，并在配置 `PLAYER_BASE_URL` 后返回可直接打开的 `playableUrl`。跨域部署时需要设置 `API_PUBLIC_BASE_URL`，确保发布后的资产 URL 是绝对地址。每次发布都会生成 release version，可通过 `GET /v1/projects/:id/releases` 查看历史，也可用 `POST /v1/projects/:id/rollback` 回滚当前发布指针，并可用 `GET /v1/projects/:id/release-diff` 比较当前草稿和最新发布版本。响应中的 `currentProjectUrl` 使用稳定公开入口 `GET /v1/public/projects/:id/project.vn.json`，适合长期分享；`currentPlayableUrl` 会让独立 Player 始终加载当前发布版本。配置 `DEPLOYMENT_CACHE_PROVIDER=cloudflare` 后，publish / rollback 会对稳定入口发起 Cloudflare URL purge，并记录 deployment invalidation。

商用部署可以设置 `RELEASE_APPROVAL_REQUIRED=true`。此时 editor 不能直接 publish，只能通过 `POST /v1/projects/:id/release-approvals` 提交发布申请；team admin/owner 或 admin token 通过 `POST /v1/release-approvals/:id/approve` 审批后才会发布到 Player。Studio 提供 `Request Approval`、`Release Diff`、`Release Approval Review`、`Notification Delivery Monitor` 和 `Publish Player` 入口，支持提交审批、刷新版本差异、刷新审批列表、加载/提交审批评论、填写审核备注、批准、拒绝、查看通知投递状态和直接发布流。审批申请会记录当时的项目指纹；如果申请后草稿又变化，approve 会返回 409，必须重新提交审批。

配置 `RELEASE_APPROVAL_WEBHOOK_URL` 后，API 会对审批申请、更新、评论、批准、拒绝和 stale 阻断创建 notification delivery。worker 或 admin 可通过 `POST /v1/notification-deliveries/run-next` 投递下一条；失败会按 `NOTIFICATION_MAX_ATTEMPTS` / `NOTIFICATION_RETRY_DELAY_MS` 重试，最终状态可通过 `GET /v1/notification-deliveries?ownerId=<id>` 查询。`RELEASE_APPROVAL_WEBHOOK_SECRET` 会生成 `x-agentic-galgame-signature` HMAC 签名；通知投递失败不会阻断审批流程。Webhook payload 只包含审批、项目、actor、comment/release id 和差异统计，不包含评论正文或审核备注。

配置 `TEAM_INVITATION_WEBHOOK_URL` 后，API 会在团队邀请创建、接受、撤销、过期时同步发送 signed webhook。创建事件会携带一次性 `invitationToken`，并在配置 `TEAM_INVITATION_ACCEPT_BASE_URL` 后附带 `invitationAcceptUrl`；服务端仍只保存 token hash。`TEAM_INVITATION_WEBHOOK_SECRET` 使用同一套 HMAC 签名头。邀请 webhook 投递失败只记录 `team_invitation_notification_failed` 审计，不阻断邀请创建。

生产 API 支持账号注册登录、OAuth/OIDC SSO 和 bearer session：`POST /v1/auth/register` 创建 user account，密码用 scrypt hash 持久化；`POST /v1/auth/login` 返回一次性 session token，服务端只保存 session token hash；`POST /v1/auth/oauth/start` 创建带 PKCE code challenge 的 OAuth state，`POST /v1/auth/oauth/callback` 或 `GET /v1/auth/oauth/callback` 用授权 code 换取外部 profile，把 provider subject 绑定到本地 user account，并签发同一种 user session token；`GET /v1/auth/me`、`GET /v1/auth/sessions`、`POST /v1/auth/sessions/:id/revoke` 和 `POST /v1/auth/logout` 用于登录态检查、session 列表、指定 session 撤销和当前 session 登出。登录账号拿到 session token 后，会按 team membership 访问对应 owner/team。

配置 `USER_ACCOUNT_WEBHOOK_URL` 后，注册、邮箱验证请求、密码重置请求和密码重置完成会发送 signed webhook。邮箱验证 token 和重置 token 明文只出现在 webhook payload 里，数据库保存 hash；`POST /v1/auth/password-reset/request` 不向客户端返回 reset token。`EMAIL_VERIFICATION_BASE_URL` 和 `PASSWORD_RESET_BASE_URL` 用于在 webhook payload 中生成 Studio 侧可打开的验证/重置链接。

Studio 的 `Account` 面板可以直接调用这些账号接口。登录、注册或 SSO callback 成功后，session token 会保存到本机 localStorage，后续 Save API、Publish Player、审批、团队邀请等请求会自动带上 bearer session；`Start SSO` 会请求授权 URL 和 state，`Complete SSO` 用 state/code 完成登录；`Refresh Sessions` 可列出当前账号 session，`Revoke Session` 可撤销指定 session，撤销当前本机 session 时会清掉 localStorage；密码重置确认后也会清掉本地旧 session。账号密码策略和失败登录锁定可通过 `AUTH_PASSWORD_MIN_LENGTH`、`AUTH_PASSWORD_REQUIRE_NUMBER`、`AUTH_PASSWORD_REQUIRE_SYMBOL`、`AUTH_PASSWORD_BLOCKED_TERMS`、`AUTH_MAX_FAILED_LOGIN_ATTEMPTS`、`AUTH_LOGIN_LOCKOUT_MS` 配置，默认 5 次失败后临时锁定 15 分钟。设置 `AUTH_MFA_ENABLED=true` 和 `AUTH_MFA_ENCRYPTION_KEY` 后，账号可启用 TOTP MFA；MFA secret 使用 AES-GCM 加密后入库，确认 MFA 时会返回一次性恢复码，服务端只保存恢复码 hash。登录时缺少验证码会返回 `mfaRequired` challenge，`mfaCode` 可以是 TOTP 或未使用的恢复码，恢复码使用后立即失效。勾选 `Remember MFA device` 后，API 会返回一次性 `mfaDeviceToken`，Studio 存在本机，后续登录可用它跳过 MFA；服务端只保存 device token hash，并可通过 `Forget Devices` 撤销。当前 SSO 基线支持 mock provider 和通用 OIDC provider，默认要求 provider 返回 verified email，并可用 `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS` 限制 SSO profile 域名；配置 `AUTH_SSO_REQUIRED_EMAIL_DOMAINS` 后，对应企业邮箱域名会禁止密码注册、密码登录和密码重置，只允许通过 SSO 登录；配置 `AUTH_OAUTH_GROUP_ROLE_MAPPINGS` 后，IdP group 会在 SSO callback 时自动映射为 Studio team role。SCIM 基线可通过 `SCIM_ENABLED=true` 和独立 `SCIM_BEARER_TOKEN` 启用，支持 IdP 创建/更新用户、按 `userName` 查找用户、PATCH active 启用/禁用用户、DELETE 禁用用户并撤销其 session；尚未包含 IdP 单点登出同步、group 消失后的自动角色回收和设备风险评分。

生产 API 仍支持四类运维/兼容 bearer token：`API_AUTH_TOKEN` 是静态 bootstrap admin token，`API_OWNER_TOKENS` 是静态 owner token，`API_USER_TOKENS` 是静态 user token，`access_tokens` 是数据库持久化的动态 token。动态 token 只存 SHA-256 hash，创建时明文只返回一次，并可撤销或设置过期时间。API 会拒绝跨 owner 读写；admin 可创建任意动态 token，team admin/owner 可创建当前 owner 的 owner token。Studio 的 `Access Tokens` 面板可刷新、创建和撤销当前 owner token，并只在创建后显示一次明文 token。team admin/owner 可以创建团队邀请，邀请 token 明文只返回一次给 API 响应和已配置的邀请 webhook 请求，服务端只保存 hash；user session 或 user token 接受邀请后会写入 team member。
生产 API 还会按 owner 记录用量、审计日志和内容安全 review，并支持每日 job/text/image 配额、AI 任务成本估算、失败重试退避和可配置内容阻断。`GET /v1/ops/summary?ownerId=<id>` 会聚合项目、任务、审批、通知、内容安全、部署、usage 和 audit，返回 `healthy` / `degraded` / `critical` 状态与 incidents；Studio 的 `Usage & Billing`、`Operations Summary`、`Audit Log` 和 `Content Safety` 面板可直接刷新查看今日用量/估算成本、汇总、审计明细、内容安全记录，并可对当前项目 JSON 重新运行本地安全策略复核。`Billing` 面板会读取套餐、当前订阅、最近 checkout session 和最近 billing events，并可发起 checkout、创建支付方式更新链接或取消订阅；任务入队会按 active/trialing subscription 的套餐 quota 执行，没有订阅时按 free plan 限制。默认 provider 是 `MockBillingCheckoutProvider`，用于本地和自动化验证；生产可设置 `BILLING_CHECKOUT_PROVIDER=stripe`、`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PRICE_PRO`、`STRIPE_PRICE_STUDIO` 启用 Stripe Checkout subscription session 和 Stripe customer portal session。`POST /v1/billing/payment-method-session` 会为已有 subscription 创建 hosted payment method update URL，适合 `past_due` 恢复支付；`POST /v1/billing/stripe/webhook` 会校验 `Stripe-Signature` raw-body 签名，并处理 checkout 完成、subscription 更新/删除、`invoice.payment_failed`、`invoice.payment_action_required`、`invoice.paid`、`charge.refunded`、`charge.dispute.created` 和 `charge.dispute.closed`，把外部支付状态回写为本地 subscription，同时把发票金额、invoice id、charge id、退款金额、争议金额和 invoice URL 等写入 `billing_events`。`BILLING_BLOCK_PAST_DUE=true` 时，`past_due` 账号在 `BILLING_PAST_DUE_GRACE_DAYS` 宽限期后会被阻断创建新生成任务，worker 执行已排队任务时也会二次检查并把任务标记为 `blocked`。当前仍不是完整财务系统：税务、发票 PDF 归档、优惠券、退款审批、争议证据提交、收入确认和对账还需要继续接入支付 provider 的更多事件与后台流程。API 响应会带 `x-request-id` 和基础安全响应头，生产可用 `API_ACCESS_LOG=true` 输出结构化 access log，日志不记录 query、body 或 token。`GET /metrics` 输出 Prometheus 文本格式的进程级 HTTP 指标，默认需要 admin bearer；只有显式设置 `API_METRICS_PUBLIC=true` 时才公开。配置 `API_ERROR_WEBHOOK_URL` 后，未处理 500 会发送 signed error webhook，payload 只包含 requestId、method、规范化 route、status、auth role 和脱敏后的错误摘要。

生产 Docker 镜像：

```bash
pnpm docker:build:api
pnpm docker:build:studio
pnpm docker:build:player
```

`Dockerfile.api` 用于 API / worker，`Dockerfile.studio` 和 `Dockerfile.player` 是静态 nginx 镜像，共用 `nginx.static.conf`。Studio 镜像只在构建时注入公开 API URL 和资产 job 轮询策略，不应把 bearer token 打进前端产物。

使用 Postgres 时先运行迁移：

```bash
DATABASE_URL=postgres://user:password@host:5432/agentic_galgame pnpm db:migrate
```

生产镜像内可使用构建产物迁移入口：

```bash
DATABASE_URL=postgres://user:password@host:5432/agentic_galgame pnpm db:migrate:dist
```

或：

```bash
CORS_ORIGIN=https://studio.example.com \
API_PUBLIC_BASE_URL=https://api.example.com \
VITE_API_BASE_URL=https://api.example.com \
PLAYER_BASE_URL=https://play.example.com \
API_OWNER_TOKENS=owner_a:<strong-random-token> \
docker compose -f docker-compose.production.yml up -d --build
```

Compose 会启动 `api`、`worker`、`studio`、`player` 四个服务；`STUDIO_PORT` 和 `PLAYER_PORT` 可覆盖默认本地端口。

## 打开静态导出玩家端

先导出 sample：

```bash
pnpm export:sample
```

再启动静态服务器：

```bash
python3 -m http.server 5174 --bind 127.0.0.1 --directory dist/playable-sample
```

打开：

```text
http://127.0.0.1:5174/
```

这是通过 exporter 生成的纯 Runtime 页面，没有 Studio 左右栏。
播放器会占满浏览器视口，并在全屏容器内保持 16:9 Galgame 画面；非 16:9 浏览器窗口会使用黑边保护画面比例，不会拉伸变形。玩家端提供 `上一段`、`下一段`、`存档`、`读档` 和 `全屏`。

## 测试

```bash
pnpm test
```

`pnpm test` 会运行 core、agent、runtime、exporter 和 Studio 的自动化测试。Studio 测试使用 jsdom 覆盖导入、生成、预览、编辑、localStorage 和导出按钮。

## 类型检查

```bash
pnpm typecheck
```

## 构建

```bash
pnpm build
```

## 导出 sample playable

```bash
pnpm export:sample
```

导出结果：

```text
dist/playable-sample/
  index.html
  project.vn.json
  assets/
```

本地预览静态导出：

```bash
python3 -m http.server 5174 --bind 127.0.0.1 --directory dist/playable-sample
```

然后打开：

```text
http://127.0.0.1:5174/
```

## MVP 审计

可以运行完整门禁：

```bash
pnpm verify:mvp
```

它会依次执行：

```text
pnpm test
pnpm typecheck
pnpm build
pnpm export:sample
pnpm image2:manifest
pnpm audit:mvp
```

`pnpm audit:mvp` 会检查 sample 项目合法性、两行 beat 长度、原始对话不存括号、Runtime 显示括号、说话人高亮、背景复用、CG beat、导出文件、placeholder assets、文档存在和 package dist 构建卫生。

## 生产骨架审计

```bash
pnpm verify:production
```

它会运行：

```text
pnpm test
pnpm typecheck
pnpm build
pnpm audit:production
```

`audit:production` 会检查 API app、独立 Player app、Studio/Player 生产 Dockerfile、静态 nginx 配置、request id / 安全响应头 / access log / metrics / error webhook、平台服务层、项目发布链路、发布审批链路、审批通知 webhook/outbox、owner 运维摘要、任务队列、worker、限流、配额、用量、Billing 基线、审计、内容安全、任务重试、资产存储、Postgres repositories、S3-compatible storage、Postgres migration runner、生产配置文档和关键安全边界。
它也会检查 Studio 资产生成 UI、审批审阅 UI、审批评论 UI、通知投递状态 UI、运维摘要 UI、API job client、生成 URL 回填和本地 `/assets/...` 读取路径。

## 图片生成

当前默认图片路径是场景化 SVG placeholder，不会调用真实 AI。sample 会看到夜晚实验室、林雪立绘、手机屏幕 CG、世界线偏移 CG 等剧情对应资产，而不是纯文字牌。

Codex/image2 资产计划：

```bash
pnpm image2:manifest
```

它会生成 `dist/image2-assets-manifest.json`，里面包含背景、立绘、CG 的 prompt 和目标输出路径。用 Codex image generation / image2 生成文件后，可以用 `applyGeneratedAssetManifest()` 把真实图片路径回填进 `VNProject`。

OpenAI-compatible Images provider 已实现，可通过显式参数或环境变量配置：

```text
OPENAI_API_KEY
OPENAI_BASE_URL=https://www.packyapi.com
OPENAI_URLBASE=https://www.packyapi.com
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_RESPONSE_FORMAT=b64_json
```

代码层也支持 `baseURL` 和第三方常用的 `urlbase` 参数。仓库不保存 API key；测试使用 mock fetch 验证请求会打到 `/v1/images/generations` 并解析 `b64_json` / `url` 返回。详细说明见 [docs/IMAGE_GENERATION.md](docs/IMAGE_GENERATION.md)。

## 静态部署

把 `dist/playable-sample/` 整个目录部署到任意静态托管服务即可，例如 GitHub Pages、Cloudflare Pages、Netlify、Vercel static output 或 Nginx。

部署时需要保持 `index.html`、`project.vn.json`、`assets/` 的相对路径不变，因为 `index.html` 会通过 `./project.vn.json` 加载项目。

## MVP 限制

- 默认不接真实 LLM；生产任务模型已存在，但真实 provider 需要密钥确认后启用。
- 默认不接真实 AI 生图；Codex/image2 manifest 和 OpenAI-compatible Images provider 已支持为可选资产生成路径。
- 生产地基已有独立 Studio/Player 部署边界、后端项目发布 endpoint、发布版本历史、发布回滚、发布差异摘要、stale approval 防护、发布审批提交、持久化审批评论与 Studio 审阅入口、signed approval webhook、notification delivery outbox/retry、signed team invitation webhook、signed user account webhook、邮箱验证、找回密码、账号注册登录/session 列表和撤销、OAuth/OIDC SSO 基线、受管域名强制 SSO、IdP group/team role 自动映射、SCIM 用户创建/更新/禁用基线、TOTP MFA、一次性恢复码、MFA 设备记忆、密码策略、失败登录临时锁定、Studio 通知投递状态面板、owner 运维摘要 API/Studio 面板、Studio 用量与估算成本面板、Studio Billing 面板、Studio 审计日志面板、Studio 内容安全面板、本地文件持久化、Postgres repositories、S3-compatible asset storage、资产上传 API、限流、owner token、user token、团队成员角色权限、团队邀请 lifecycle、动态 hashed access token、后台 worker、OpenAI-compatible 文本生成项目路径、图片生成任务落盘路径、每日配额、成本估算、套餐/订阅/checkout provider 基线、Stripe Checkout/Webhook/customer portal 基线、billing event 账务事件流水、Stripe refund/dispute event 记录、past_due 欠费生成阻断、审计日志、内容安全 review、request id、Prometheus metrics、signed error webhook 和任务失败重试，但还没有税务、发票 PDF 归档、退款审批/争议证据提交/对账、真实外部凭据 smoke、完整 Sentry/OTel 集成、完整可视化版本 diff、原生邮件/IM provider 与通知模板、完整人工审核/申诉后台或 SIEM 级安全运营后台。
- 不包含完整支付财务运营、多人实时协作、SCIM group deprovisioning、IdP 单点登出或设备风险控制。
- 视觉资产是轻量 SVG placeholder。
- Runtime 使用 DOM + CSS 分层渲染。
- 分支剧情、BGM、语音、Live2D、复杂动画时间轴暂未实现。

## 未来扩展方向

- 扩展 `TextModelProvider` 提示词、评估和人工审核，用真实 LLM 做更强的章节、人物、场景和镜头规划。
- 扩展 Studio 资产生成队列 UI，增加重试、取消、选择性生成、成本预估和内容审核状态。
- 新增 `PixiVNRenderer`，把 Runtime 从 DOM 渲染扩展到 PixiJS。
- 增加 BGM、SFX、语音和 Live2D。
- 增加分支剧情、变量、好感度和条件跳转。
- 增加部署 provider，把 playable 导出到指定静态托管平台。
- 增加原生邮件/IM provider、通知模板、SCIM group deprovisioning、IdP 单点登出、支付财务运营、外部集中监控告警、内容安全审核、云端 worker 编排和更细粒度的 provider 成本治理。

## 目录结构

```text
apps/studio/          React + Vite Studio
apps/api/             Node HTTP API 服务
packages/vn-core/    VNProject 协议、stage、compiler、validation
packages/vn-agent/   本地 deterministic Agent pipeline
packages/vn-runtime/ Web VN Runtime 和 DOM renderer
packages/vn-exporter 静态 playable exporter
packages/vn-platform 生产平台层：持久化、任务、资产存储
samples/             sample novel 和生成后的 project JSON
docs/                架构和任务记录
```
