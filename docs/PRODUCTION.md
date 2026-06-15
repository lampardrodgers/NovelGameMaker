# 商用生产版推进说明

当前仓库已经从纯 MVP 增加生产版地基：

- `apps/api`：后端 API 服务。
- `packages/vn-platform`：项目持久化、生成任务、资产存储和平台服务层。
- `packages/vn-platform/migrations/0001_production_schema.sql`：Postgres 生产 schema。
- `packages/vn-platform/migrations/0002_billing_refund_dispute_events.sql`：补充 refund/dispute billing event 字段和索引。
- `packages/vn-platform/migrations/0003_oauth_sso_identity.sql`：补充 OAuth state 和外部身份绑定表。

这不是最终 SaaS 完成态，但已经把后端、数据库、任务、存储和部署边界从 React MVP 中拆出来。

## 本地开发启动

安装依赖：

```bash
pnpm install
```

启动 Studio：

```bash
pnpm dev
```

启动 API：

```bash
pnpm dev:api
```

启动本地 worker：

```bash
pnpm dev:worker
```

启动独立玩家端：

```bash
pnpm dev:player
```

默认 Player 地址：

```text
http://127.0.0.1:5175/
```

Player 默认加载 `/project.vn.json`，也支持：

```text
?projectUrl=https://cdn.example.com/project.vn.json
```

默认 API 地址：

```text
http://127.0.0.1:8787
```

健康检查：

```bash
curl http://127.0.0.1:8787/health
```

`/health` 不要求 bearer token，方便容器 healthcheck、负载均衡探针和 uptime 监控直接使用；它仍经过限流保护。业务接口在配置 `API_AUTH_TOKEN`、owner token、user token 或 session 后继续要求鉴权。

## Docker 部署骨架

单独构建镜像：

```bash
pnpm docker:build:api
pnpm docker:build:studio
pnpm docker:build:player
```

也可以直接使用 `docker build -f Dockerfile.api`、`Dockerfile.studio`、`Dockerfile.player`。Studio 和 Player 镜像是静态 nginx 容器；API 和 worker 使用 Node 镜像。Studio 镜像构建时只接收公开 API URL 和资产 job 轮询配置，不应把 bearer token 烘进前端镜像。

使用 compose：

```bash
CORS_ORIGIN=https://studio.example.com \
API_PUBLIC_BASE_URL=https://api.example.com \
VITE_API_BASE_URL=https://api.example.com \
PLAYER_BASE_URL=https://play.example.com \
API_OWNER_TOKENS=owner_a:<strong-random-token> \
docker compose -f docker-compose.production.yml up -d --build
```

`docker-compose.production.yml` 包含四个服务：

```text
api      Node HTTP API
worker   后台 generation/notification worker
studio   静态 Studio nginx 镜像
player   静态 Player nginx 镜像
```

本地文件模式下，API 和 worker 会把数据挂载到持久 volume：

```text
agentic_galgame_data:/data
```

Studio / Player 的 nginx 配置来自 `nginx.static.conf`，包含 SPA fallback、`/health` 静态健康检查、`/project.vn.json` no-cache、`/assets/` 长缓存和基础安全响应头。端口可通过 `STUDIO_PORT`、`PLAYER_PORT` 覆盖。

如果不用 Docker，也可以单独构建并部署静态目录：

```bash
pnpm assets:studio
pnpm --filter @agentic-galgame/studio build
pnpm assets:player
pnpm --filter @agentic-galgame/player build
```

部署目录：

```text
apps/studio/dist/
apps/player/dist/
```

Studio、API、Player 可以部署在不同域名；Player 只需要能读取 `project.vn.json` 和资产 URL。

## 生产环境变量

```text
API_HOST=0.0.0.0
API_PORT=8787
DATA_DIR=/var/lib/agentic-galgame
DATABASE_URL=postgres://user:password@postgres:5432/agentic_galgame
POSTGRES_SSL=true
CORS_ORIGIN=https://studio.example.com
API_PUBLIC_BASE_URL=https://api.example.com
PLAYER_BASE_URL=https://play.example.com
API_AUTH_TOKEN=<server-side bearer token>
API_OWNER_TOKENS=owner_a:<owner-a-token>,owner_b:<owner-b-token>
API_USER_TOKENS=user_a:<user-a-token>,user_b:<user-b-token>
API_BODY_LIMIT_BYTES=1000000
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX_REQUESTS=300
API_ACCESS_LOG=true
API_METRICS_PUBLIC=false
API_ERROR_WEBHOOK_URL=https://hooks.example.com/api-errors
API_ERROR_WEBHOOK_SECRET=<secret>
API_ERROR_WEBHOOK_TIMEOUT_MS=5000
AUTH_PASSWORD_MIN_LENGTH=8
AUTH_PASSWORD_REQUIRE_LETTER=true
AUTH_PASSWORD_REQUIRE_NUMBER=true
AUTH_PASSWORD_REQUIRE_SYMBOL=false
AUTH_PASSWORD_BLOCKED_TERMS=password,123456,qwerty
AUTH_MAX_FAILED_LOGIN_ATTEMPTS=5
AUTH_LOGIN_LOCKOUT_MS=900000
AUTH_MFA_ENABLED=true
AUTH_MFA_ISSUER=Agentic Galgame Studio
AUTH_MFA_ENCRYPTION_KEY=<32+ char secret>
AUTH_MFA_TOTP_STEP_SECONDS=30
AUTH_MFA_TOTP_WINDOW_STEPS=1
AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS=30
AUTH_MFA_MAX_TRUSTED_DEVICES=10
AUTH_OAUTH_ENABLED=false
AUTH_OAUTH_PROVIDER=mock
AUTH_OAUTH_REDIRECT_URI=https://api.example.com/v1/auth/oauth/callback
AUTH_OAUTH_ALLOWED_RETURN_ORIGINS=https://studio.example.com
AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL=true
AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS=example.com
AUTH_SSO_REQUIRED_EMAIL_DOMAINS=example.com
AUTH_OAUTH_GROUP_CLAIM=groups
AUTH_OAUTH_GROUP_ROLE_MAPPINGS=vn-editors:team_alpha:editor,vn-admins:team_alpha:admin
AUTH_OAUTH_CLIENT_ID=<oidc client id>
AUTH_OAUTH_CLIENT_SECRET=<oidc client secret>
AUTH_OAUTH_AUTHORIZATION_URL=https://idp.example.com/oauth2/v1/authorize
AUTH_OAUTH_TOKEN_URL=https://idp.example.com/oauth2/v1/token
AUTH_OAUTH_USERINFO_URL=https://idp.example.com/oauth2/v1/userinfo
SCIM_ENABLED=false
SCIM_BEARER_TOKEN=<scim bearer token>
SCIM_BASE_URL=https://api.example.com/v1/scim/v2
RELEASE_APPROVAL_REQUIRED=true
RELEASE_APPROVAL_WEBHOOK_URL=https://hooks.example.com/release-approvals
RELEASE_APPROVAL_WEBHOOK_SECRET=<secret>
RELEASE_APPROVAL_WEBHOOK_TIMEOUT_MS=5000
TEAM_INVITATION_WEBHOOK_URL=https://hooks.example.com/team-invitations
TEAM_INVITATION_WEBHOOK_SECRET=<secret>
TEAM_INVITATION_WEBHOOK_TIMEOUT_MS=5000
TEAM_INVITATION_ACCEPT_BASE_URL=https://studio.example.com/invitations/accept
USER_ACCOUNT_WEBHOOK_URL=https://hooks.example.com/user-accounts
USER_ACCOUNT_WEBHOOK_SECRET=<secret>
USER_ACCOUNT_WEBHOOK_TIMEOUT_MS=5000
EMAIL_VERIFICATION_BASE_URL=https://studio.example.com/auth/verify-email
PASSWORD_RESET_BASE_URL=https://studio.example.com/auth/reset-password
API_DAILY_JOB_LIMIT=1000
API_DAILY_TEXT_JOB_LIMIT=500
API_DAILY_IMAGE_JOB_LIMIT=100
AI_TEXT_JOB_COST_CENTS=2
AI_IMAGE_JOB_COST_CENTS=8
JOB_MAX_ATTEMPTS=3
JOB_RETRY_DELAY_MS=30000
NOTIFICATION_MAX_ATTEMPTS=3
NOTIFICATION_RETRY_DELAY_MS=30000
CONTENT_SAFETY_ENABLED=true
CONTENT_SAFETY_BLOCK_REVIEW=false
CONTENT_SAFETY_BLOCKED_TERMS=儿童色情,未成年色情,真实自残教程,爆炸物制作,信用卡盗刷
CONTENT_SAFETY_REVIEW_TERMS=自残,血腥,露骨,仇恨
AI_PROVIDER_ENABLED=false
AI_TEXT_PROVIDER=none
AI_IMAGE_PROVIDER=none
OPENAI_API_KEY=<secret>
OPENAI_BASE_URL=https://www.packyapi.com
OPENAI_TEXT_API_KEY=<secret>
OPENAI_TEXT_MODEL=gpt-4.1-mini
OPENAI_TEXT_TEMPERATURE=0.2
OPENAI_IMAGE_MODEL=gpt-image-1
OPENAI_IMAGE_SIZE=1024x1024
OPENAI_IMAGE_RESPONSE_FORMAT=b64_json
ASSET_STORAGE_PROVIDER=s3
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=agentic-galgame-assets
S3_ACCESS_KEY_ID=<secret>
S3_SECRET_ACCESS_KEY=<secret>
S3_PUBLIC_BASE_URL=https://cdn.example.com
S3_FORCE_PATH_STYLE=true
DEPLOYMENT_CACHE_PROVIDER=cloudflare
CLOUDFLARE_ZONE_ID=<zone-id>
CLOUDFLARE_API_TOKEN=<secret>
CLOUDFLARE_API_BASE_URL=
VITE_API_BASE_URL=https://api.example.com
VITE_ASSET_JOB_RUN_MODE=worker
VITE_ASSET_JOB_POLL_INTERVAL_MS=1200
VITE_ASSET_JOB_POLL_ATTEMPTS=60
WORKER_POLL_INTERVAL_MS=5000
WORKER_RUN_ONCE=false
```

说明：

- `API_AUTH_TOKEN`：admin bearer token，用于后台、worker 管理或运维接口。
- `API_PUBLIC_BASE_URL`：API 对外公开根地址，用于把本地资产 `/assets/...` 发布为绝对 URL；Studio/Player 分域部署时必须配置。
- `PLAYER_BASE_URL`：独立 Player 对外地址；发布项目时 API 会返回 `PLAYER_BASE_URL/?projectUrl=...`。
- `API_OWNER_TOKENS`：owner-scoped bearer token 列表，格式是 `ownerId:token,ownerId2:token2`。Studio 面向创作者时应优先使用 owner-scoped token。
- `API_USER_TOKENS`：user-scoped bearer token 列表，格式是 `userId:token,userId2:token2`。user token 需要通过 team membership 才能访问具体 owner/team。
- `NODE_ENV=production`：会强制要求 `API_AUTH_TOKEN`、`API_OWNER_TOKENS` 或 `API_USER_TOKENS` 至少有一个 24 字符以上的非 placeholder token，并拒绝 `CORS_ORIGIN=*`。
- `API_RATE_LIMIT_MAX_REQUESTS`：每个客户端 key 在窗口期内最多请求数；设为 `0` 可禁用内存限流。
- `API_ACCESS_LOG`：生产默认开启。开启后 API 输出一行 JSON access log：`event=http_request`、`requestId`、method、path、statusCode、durationMs、authRole；不会记录 query、body 或 bearer token。设为 `false` 可关闭。
- `API_METRICS_PUBLIC`：默认 `false`。`GET /metrics` 默认需要 admin bearer；只有设置为 `true` 时才允许匿名 Prometheus 抓取。公开 metrics 应放在内网、监控网关或其他受控网络后。
- `BILLING_CHECKOUT_PROVIDER`：默认 `mock`。设为 `stripe` 后，API 会使用服务端 Stripe secret 创建 hosted Checkout subscription session。
- `BILLING_BLOCK_PAST_DUE`：默认 `true`。开启后，超过宽限期的 `past_due` subscription 会阻断新生成任务，worker 执行已排队任务时也会二次检查。
- `BILLING_PAST_DUE_GRACE_DAYS`：默认 `3`。`invoice.payment_failed` 或 provider subscription 更新把 subscription 置为 `past_due` 后，在宽限期内仅按 free quota 继续允许入队；设为 `0` 表示立即阻断。
- `STRIPE_SECRET_KEY`：Stripe 服务端 secret key。只在 API/worker 环境中配置，不进入 Studio bundle。
- `STRIPE_WEBHOOK_SECRET`：Stripe webhook endpoint secret，用于校验 `Stripe-Signature`。
- `STRIPE_PRICE_PRO`、`STRIPE_PRICE_STUDIO`：`pro`、`studio` 套餐对应的 Stripe recurring price id。
- `STRIPE_API_BASE_URL`、`STRIPE_REQUEST_TIMEOUT_MS`、`STRIPE_WEBHOOK_TOLERANCE_SECONDS`：Stripe API base URL、创建 checkout 的超时时间和 webhook 签名时间窗口。
- `API_ERROR_WEBHOOK_URL`：可选。设置后，未捕获 500 会发送 signed error webhook，用于接 Sentry relay、告警网关、飞书/Slack bot 或内部错误追踪系统。
- `API_ERROR_WEBHOOK_SECRET`：可选。设置后 error webhook 请求会带 `x-agentic-galgame-signature: sha256=<hmac>`，签名内容是 `timestamp.body`。
- `API_ERROR_WEBHOOK_TIMEOUT_MS`：error webhook 请求超时时间。默认 `5000`。
- `AUTH_PASSWORD_MIN_LENGTH`：账号注册和密码重置的最小密码长度，默认 `8`，不能低于 `8`。
- `AUTH_PASSWORD_REQUIRE_LETTER`：默认 `true`。设为 `false` 可关闭至少一个字母的要求。
- `AUTH_PASSWORD_REQUIRE_NUMBER`：默认 `false`。设为 `true` 后密码必须包含至少一个数字。
- `AUTH_PASSWORD_REQUIRE_SYMBOL`：默认 `false`。设为 `true` 后密码必须包含至少一个非字母数字符号。
- `AUTH_PASSWORD_BLOCKED_TERMS`：逗号分隔的弱密码片段，大小写不敏感；例如 `password,123456,qwerty`。
- `AUTH_MAX_FAILED_LOGIN_ATTEMPTS`：同一账号连续失败登录达到该次数后临时锁定。默认 `5`；设为 `0` 可关闭账号级锁定，仅保留全局限流。
- `AUTH_LOGIN_LOCKOUT_MS`：账号临时锁定时长，默认 `900000`，即 15 分钟。
- `AUTH_MFA_ENABLED`：默认 `false`。设为 `true` 后启用账号 TOTP MFA setup/confirm/disable API。
- `AUTH_MFA_ENCRYPTION_KEY`：MFA 启用时用于 AES-GCM 加密 TOTP secret 的服务端密钥。`NODE_ENV=production` 且 `AUTH_MFA_ENABLED=true` 时必须提供至少 32 字符的非 placeholder 值。
- `AUTH_MFA_ISSUER`、`AUTH_MFA_TOTP_STEP_SECONDS`、`AUTH_MFA_TOTP_WINDOW_STEPS`：TOTP issuer、时间步长和容忍窗口。默认 issuer 为 `Agentic Galgame Studio`，步长 30 秒，窗口 1 步。
- `AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS`、`AUTH_MFA_MAX_TRUSTED_DEVICES`：MFA 设备记忆 token 的有效天数和每个账号保留的最大设备数。默认 30 天、10 台。
- `AUTH_OAUTH_ENABLED`：默认 `false`。设为 `true` 后启用 `/v1/auth/oauth/start` 和 `/v1/auth/oauth/callback`。
- `AUTH_OAUTH_PROVIDER`：`mock` 或 `oidc`。`mock` 用于本地开发和自动化验证；`oidc` 用于 Auth0、Okta、Keycloak、Google Workspace 等标准 OIDC provider。
- `AUTH_OAUTH_REDIRECT_URI`：OAuth callback URL。`NODE_ENV=production` 且 OAuth 启用时必须是 HTTPS。
- `AUTH_OAUTH_ALLOWED_RETURN_ORIGINS`：允许 Studio 传入的 return URL origin 列表，逗号分隔；相对路径始终允许。
- `AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL`：默认 `true`。要求 OIDC userinfo profile 返回 `email_verified=true` 后才创建/登录本地账号。
- `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS`：可选企业邮箱域名 allowlist，逗号分隔。非空时，只有这些域名的 SSO email 可以登录或创建本地账号。
- `AUTH_SSO_REQUIRED_EMAIL_DOMAINS`：可选受管企业邮箱域名列表，逗号分隔。命中这些域名时，密码注册、密码登录和密码重置会返回 `ssoRequired`，只能通过 OAuth/OIDC callback 登录；生产环境配置该项时必须同时启用 `AUTH_OAUTH_ENABLED=true`。
- `AUTH_OAUTH_GROUP_CLAIM`：OIDC userinfo profile 中承载 group 列表的 claim 名，默认 `groups`。支持字符串数组或逗号分隔字符串。
- `AUTH_OAUTH_GROUP_ROLE_MAPPINGS`：可选 IdP group 到 Studio team role 的自动映射，格式为 `group:teamId:role`，多条用逗号分隔，例如 `vn-editors:team_alpha:editor`。role 只允许 `owner/admin/editor/viewer`；如果用户已有更高角色，SSO 映射不会自动降权。
- `AUTH_OAUTH_CLIENT_ID`、`AUTH_OAUTH_CLIENT_SECRET`、`AUTH_OAUTH_AUTHORIZATION_URL`、`AUTH_OAUTH_TOKEN_URL`、`AUTH_OAUTH_USERINFO_URL`：`AUTH_OAUTH_PROVIDER=oidc` 时必填。生产会拒绝过短 client secret 和非 HTTPS OIDC endpoint。
- `AUTH_OAUTH_SCOPES`、`AUTH_OAUTH_STATE_TTL_MS`、`AUTH_OAUTH_REQUEST_TIMEOUT_MS`：OIDC scope、state 有效期和 provider 请求超时；默认 `openid,email,profile`、10 分钟、10 秒。
- `SCIM_ENABLED`：默认 `false`。设为 `true` 后启用 `/v1/scim/v2` 企业用户生命周期接口，供 Okta、Auth0、Entra ID、Keycloak 等 IdP 创建、更新、启用和禁用 Studio 用户。
- `SCIM_BEARER_TOKEN`：SCIM 专用 bearer token，不复用 `API_AUTH_TOKEN`。`NODE_ENV=production` 且 `SCIM_ENABLED=true` 时必须提供至少 24 字符的非 placeholder 值。
- `SCIM_BASE_URL`：可选。用于 SCIM User `meta.location`，建议配置为公开 HTTPS 地址，例如 `https://api.example.com/v1/scim/v2`；生产环境配置该项时必须是 HTTPS。
- `RELEASE_APPROVAL_REQUIRED`：默认 `false`。设为 `true` 后，editor 只能提交发布审批申请，team admin/owner 或 admin token 才能直接 publish 或 approve。
- `RELEASE_APPROVAL_WEBHOOK_URL`：可选。设置后，发布审批 request/update/comment/approve/reject/stale 会发送 signed webhook，用于接 Slack、飞书、企业微信或内部审核系统。
- `RELEASE_APPROVAL_WEBHOOK_SECRET`：可选。设置后 webhook 请求会带 `x-agentic-galgame-signature: sha256=<hmac>`，签名内容是 `timestamp.body`。
- `RELEASE_APPROVAL_WEBHOOK_TIMEOUT_MS`：webhook 请求超时时间。默认 `5000`。
- `TEAM_INVITATION_WEBHOOK_URL`：可选。设置后，团队邀请 create/accept/revoke/expire 会同步发送 signed webhook，用于接邮件、飞书、企业微信或内部账号系统。
- `TEAM_INVITATION_WEBHOOK_SECRET`：可选。使用同一套 `x-agentic-galgame-signature` HMAC 签名头。
- `TEAM_INVITATION_WEBHOOK_TIMEOUT_MS`：团队邀请 webhook 请求超时时间。默认 `5000`。
- `TEAM_INVITATION_ACCEPT_BASE_URL`：可选。设置后，邀请创建事件会附带 `invitationAcceptUrl=<base>?invitationToken=...`。
- `USER_ACCOUNT_WEBHOOK_URL`：可选。设置后，邮箱验证请求、邮箱验证完成、密码重置请求和密码重置完成会发送 signed webhook，用于接邮件、IM 或内部账号系统。
- `USER_ACCOUNT_WEBHOOK_SECRET`：可选。使用同一套 `x-agentic-galgame-signature` HMAC 签名头。
- `USER_ACCOUNT_WEBHOOK_TIMEOUT_MS`：账号 webhook 请求超时时间。默认 `5000`。
- `EMAIL_VERIFICATION_BASE_URL`：可选。设置后，邮箱验证 webhook payload 会附带 `actionUrl=<base>?verificationToken=...`。
- `PASSWORD_RESET_BASE_URL`：可选。设置后，密码重置 webhook payload 会附带 `actionUrl=<base>?resetToken=...`。
- `API_DAILY_JOB_LIMIT`：每个 owner 每天最多入队 job 数；`0` 表示不限制。
- `API_DAILY_TEXT_JOB_LIMIT`：每个 owner 每天最多入队 `novel_to_project` 数；`0` 表示不限制。
- `API_DAILY_IMAGE_JOB_LIMIT`：每个 owner 每天最多入队 `asset_generation` 数；`0` 表示不限制。
- `AI_TEXT_JOB_COST_CENTS` / `AI_IMAGE_JOB_COST_CENTS`：usage summary 中的单任务估算成本，单位为美分；这是运营估算，不是支付结算。
- `JOB_MAX_ATTEMPTS`：provider 或下载失败时，任务最多尝试次数。
- `NOTIFICATION_MAX_ATTEMPTS`：审批通知 delivery 最多投递次数。
- `NOTIFICATION_RETRY_DELAY_MS`：审批通知首次失败后的退避基准时间，后续按指数退避。
- `JOB_RETRY_DELAY_MS`：首次失败后的退避基准时间，后续按指数退避。
- `CONTENT_SAFETY_ENABLED`：默认 `true`，启用本地 deterministic 内容审核。
- `CONTENT_SAFETY_BLOCK_REVIEW`：默认 `false`，复核词只记录 `review_required`；设为 `true` 后也阻断。
- `CONTENT_SAFETY_BLOCKED_TERMS`：逗号分隔的硬阻断词。
- `CONTENT_SAFETY_REVIEW_TERMS`：逗号分隔的人工复核词。
- `DATABASE_URL`：设置后 API 使用 `NodePostgresExecutor` 和 Postgres repositories；不设置时使用本地 `DATA_DIR/db.json`。
- `DATA_DIR`：本地文件数据库和本地资产存储目录。开发可用；正式商用应优先使用 Postgres + S3-compatible object storage。
- `ASSET_STORAGE_PROVIDER`：`local` 使用本地文件，`s3` 使用 `S3CompatibleAssetStorage`。
- `AI_PROVIDER_ENABLED`：默认 `false`。在没有确认并配置密钥前，资产生成任务会进入 `waiting_for_credentials`，不会调用外部 AI。
- `AI_TEXT_PROVIDER`：设置为 `openai-compatible` 后，`novel_to_project` 可通过 OpenAI-compatible Chat Completions 生成完整 `VNProject`。不设置时继续使用本地 heuristic。
- `AI_IMAGE_PROVIDER`：设置为 `openai-compatible` 后，worker/API 可通过 OpenAI-compatible Images API 执行 `asset_generation`。
- `OPENAI_API_KEY` / `OPENAI_BASE_URL`：只通过环境变量或 secret manager 注入。`OPENAI_BASE_URL` 可设置为第三方 OpenAI-compatible 网关。
- `OPENAI_TEXT_API_KEY`：可单独给文本模型使用；未设置时文本 provider 使用 `OPENAI_API_KEY`。
- `DEPLOYMENT_CACHE_PROVIDER`：默认 `none`。设置为 `cloudflare` 后，publish / rollback 会对稳定 current project URL 发起 Cloudflare URL purge。
- `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN`：Cloudflare cache purge 所需配置；API token 至少需要对应 zone 的 cache purge 权限。不要写入仓库。
- `CLOUDFLARE_API_BASE_URL`：可选，默认 `https://api.cloudflare.com/client/v4`；测试或私有代理时才需要覆盖。
- `VITE_API_BASE_URL`：Studio 构建时注入的生产 API 根地址。
- `VITE_ASSET_JOB_RUN_MODE`：Studio 资产生成模式。开发默认 `inline`；生产建议 `worker`，让浏览器只入队并轮询 job 状态。
- `VITE_ASSET_JOB_POLL_INTERVAL_MS` / `VITE_ASSET_JOB_POLL_ATTEMPTS`：Studio 在 `worker` 模式下等待资产生成 job 的轮询间隔和最大次数。
- `WORKER_POLL_INTERVAL_MS`：worker 轮询任务队列的间隔。

## 当前 API

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
GET  /v1/scim/v2/ServiceProviderConfig
GET  /v1/scim/v2/Users?filter=userName%20eq%20%22email@example.com%22
POST /v1/scim/v2/Users
GET  /v1/scim/v2/Users/:id
PATCH /v1/scim/v2/Users/:id
DELETE /v1/scim/v2/Users/:id
POST /v1/teams
GET  /v1/teams?userId=<id>
GET  /v1/teams/:id/members
POST /v1/teams/:id/members
GET  /v1/teams/:id/invitations
POST /v1/teams/:id/invitations
POST /v1/team-invitations/:id/revoke
POST /v1/team-invitations/accept
```

示例：

```bash
curl -X POST http://127.0.0.1:8787/v1/projects/from-novel \
  -H 'content-type: application/json' \
  -d '{"ownerId":"local-user","title":"实验室里的蓝光","novelText":"第一章 实验室里的蓝光\n\n实验室里只剩下显示器的蓝光。"}'
```

生产开启鉴权后需要加 bearer token：

```bash
-H "authorization: Bearer $API_AUTH_TOKEN"
```

权限规则：

- admin token 可以访问所有 owner 的项目、任务和资产，并可调用 `POST /v1/jobs/run-next`。
- owner-scoped token 只能访问绑定 ownerId 的项目、任务和资产。
- user-scoped token 只代表用户身份；必须通过 `/v1/teams/:id/members` 写入 team role 后才能访问对应 owner/team。
- team role 分为 `owner`、`admin`、`editor`、`viewer`：viewer 只能读项目，editor 可创建/更新项目和任务，admin/owner 可管理团队成员、access token、usage/audit/content-safety。
- owner-scoped token 不能调用 admin-only 路由，例如 `POST /v1/jobs/run-next`。
- API 会校验 body/query 中的 `ownerId`，不再信任客户端随意传入跨 owner id。
- owner-scoped token 只能读取同 owner 的 `/v1/usage` 和 `/v1/audit`。
- owner-scoped token 只能读取同 owner 的 `/v1/content-safety`。
- 动态 access token 只保存 SHA-256 hash 和短 prefix；创建响应中的明文 token 只返回一次。

资产上传示例：

```bash
curl -X POST http://127.0.0.1:8787/v1/assets \
  -H 'content-type: application/json' \
  -d '{"ownerId":"local-user","projectId":"project_123","assetId":"cg_phone_screen","fileName":"phone.svg","contentType":"image/svg+xml","base64":"PHN2ZyAvPg=="}'
```

## 数据库

开发默认使用：

```text
DATA_DIR/db.json
```

生产 schema 位于：

```text
packages/vn-platform/migrations/0001_production_schema.sql
packages/vn-platform/migrations/0002_billing_refund_dispute_events.sql
packages/vn-platform/migrations/0003_oauth_sso_identity.sql
```

它包含：

- `studio_projects`
- `generation_jobs`
- `project_assets`
- `usage_events`
- `billing_plans`
- `billing_subscriptions`
- `billing_checkout_sessions`
- `billing_events`
- `oauth_states`
- `oauth_identities`
- `audit_events`
- `content_safety_reviews`
- `access_tokens`
- `user_accounts`
- `user_account_action_tokens`
- `user_sessions`
- `teams`
- `team_members`
- `team_invitations`
- `published_project_releases`
- `release_approvals`
- `release_approval_comments`
- `notification_deliveries`
- `deployment_invalidations`

当前已实现：

- `PostgresProjectRepository`
- `PostgresJobRepository`
- `PostgresAssetRepository`
- `PostgresUsageRepository`
- `PostgresBillingPlanRepository`
- `PostgresBillingSubscriptionRepository`
- `PostgresBillingCheckoutSessionRepository`
- `PostgresAuditRepository`
- `PostgresContentSafetyRepository`
- `PostgresAccessTokenRepository`
- `PostgresUserAccountRepository`
- `PostgresUserAccountActionTokenRepository`
- `PostgresUserSessionRepository`
- `PostgresTeamRepository`
- `PostgresTeamInvitationRepository`
- `PostgresReleaseApprovalRepository`
- `PostgresReleaseApprovalCommentRepository`
- `PostgresNotificationDeliveryRepository`
- `PostgresDeploymentInvalidationRepository`
- `NodePostgresExecutor`

设置 `DATABASE_URL` 后，API 平台工厂会切换到 Postgres repositories；服务层和 API 层保持不变。

首次部署或 schema 更新时运行迁移：

```bash
DATABASE_URL=postgres://user:password@host:5432/agentic_galgame pnpm db:migrate
```

生产镜像或已构建环境可以运行 dist 入口：

```bash
DATABASE_URL=postgres://user:password@host:5432/agentic_galgame pnpm db:migrate:dist
```

迁移 runner 会先创建 `schema_migrations` 表，按文件名顺序执行 `packages/vn-platform/migrations/*.sql`，已应用文件会跳过，失败时会 rollback 当前文件。`Dockerfile.api` 会把 migration SQL 复制进 runtime 镜像，确保 dist 迁移命令在容器里也能找到 schema 文件。

## 访问令牌生命周期

静态 `API_AUTH_TOKEN` 建议作为 bootstrap/admin token 使用。创作者端应使用动态 owner token；bootstrap admin 可创建任意 token，team admin/owner 可以创建当前 owner 的 owner token：

```bash
curl -X POST http://127.0.0.1:8787/v1/access-tokens \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"role":"owner","ownerId":"local-user","label":"Studio token","expiresAt":"2026-12-31T00:00:00.000Z"}'
```

响应中的 `token` 是唯一一次返回的明文值：

```json
{
  "token": "vn_...",
  "accessToken": {
    "id": "token_...",
    "tokenPrefix": "vn_...",
    "role": "owner",
    "ownerId": "local-user",
    "label": "Studio token"
  }
}
```

后续请求使用：

```bash
-H "authorization: Bearer vn_..."
```

列出 owner token：

```bash
curl "http://127.0.0.1:8787/v1/access-tokens?ownerId=local-user" \
  -H "authorization: Bearer vn_..."
```

撤销 token：

```bash
curl -X POST http://127.0.0.1:8787/v1/access-tokens/token_123/revoke \
  -H "authorization: Bearer vn_..."
```

Studio 的 `Access Tokens` 面板使用同一组 API：`Refresh Tokens` 列出当前 owner token，`Create Owner Token` 返回一次性明文 token，`Revoke Token` 撤销已有 token。创建 owner token 需要 bootstrap admin token，或当前账号在 owner/team 内具备 admin/owner 权限。

数据库只保存：

- `token_hash`
- `token_prefix`
- `role`
- `owner_id`
- `user_id`
- `label`
- `created_at`
- `last_used_at`
- `revoked_at`
- `expires_at`

## 用户账号和 Session

创作者账号使用 `user_accounts`、`user_account_action_tokens` 和 `user_sessions`：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/register \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","password":"correct-password","name":"Editor"}'
```

响应中的 `sessionToken` 是唯一一次返回的明文 session：

```json
{
  "sessionToken": "vns_...",
  "user": {
    "id": "user_...",
    "email": "editor@example.com",
    "name": "Editor"
  },
  "session": {
    "id": "session_...",
    "tokenPrefix": "vns_..."
  }
}
```

登录：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","password":"correct-password"}'
```

启用 MFA 后，缺少验证码的登录会返回 HTTP 202：

```json
{
  "error": "MFA code is required.",
  "mfaRequired": true,
  "method": "totp"
}
```

带验证码或恢复码登录：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","password":"correct-password","mfaCode":"123456"}'
```

记住当前 MFA 设备：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","password":"correct-password","mfaCode":"123456","rememberMfaDevice":true}'
```

该响应会额外返回一次性 `mfaDeviceToken`。后续同一设备可提交它跳过 MFA：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","password":"correct-password","mfaDeviceToken":"vnd_..."}'
```

重新发送邮箱验证：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/email-verification/request \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'
```

邮箱验证链接通常由 `USER_ACCOUNT_WEBHOOK_URL` 对接邮件/IM 系统发送。验证接口只接收明文 token：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/verify-email \
  -H "content-type: application/json" \
  -d '{"verificationToken":"vne_..."}'
```

请求密码重置不会向客户端返回 reset token，避免账号枚举和 token 泄漏：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/password-reset/request \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com"}'
```

真正的 `resetToken` 只会出现在已配置的账号 webhook payload 中；重置成功后会撤销该用户的旧 session：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/password-reset/confirm \
  -H "content-type: application/json" \
  -d '{"resetToken":"vnr_...","password":"new-correct-password"}'
```

TOTP MFA：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/mfa/totp/setup \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{}'

curl -X POST http://127.0.0.1:8787/v1/auth/mfa/totp/confirm \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{"code":"123456"}'

curl -X POST http://127.0.0.1:8787/v1/auth/mfa/recovery-codes/regenerate \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{"password":"correct-password","code":"123456"}'

curl -X POST http://127.0.0.1:8787/v1/auth/mfa/trusted-devices/revoke \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{"password":"correct-password","code":"123456"}'

curl -X POST http://127.0.0.1:8787/v1/auth/mfa/totp/disable \
  -H "authorization: Bearer $SESSION_TOKEN" \
  -H "content-type: application/json" \
  -d '{"password":"correct-password","code":"123456"}'
```

`setup` 响应会返回一次性可展示的 base32 `secret` 和 `otpauthUrl`；数据库只保存 `mfa_totp_secret_encrypted`。`confirm` 响应会返回一次性恢复码，服务端只保存 `mfa_recovery_code_hashes`。确认成功后登录需要 `mfaCode`，它可以是 TOTP，也可以是一个未使用的恢复码；TOTP 成功会记录最后使用的 counter，恢复码成功会立即移除对应 hash，避免重复使用。恢复码再生成需要当前密码和一个有效第二因子，返回新明文后替换旧 hash 集合。设备记忆 token 明文只在登录时返回一次，服务端保存 `mfa_trusted_devices` 中的 token hash、prefix、创建时间、过期时间和最后使用时间；撤销 remembered devices 会删除该账号已保存的 device token。

OAuth/OIDC SSO：

```bash
curl -X POST http://127.0.0.1:8787/v1/auth/oauth/start \
  -H "content-type: application/json" \
  -d '{"returnUrl":"/studio"}'

curl -X POST http://127.0.0.1:8787/v1/auth/oauth/callback \
  -H "content-type: application/json" \
  -d '{"state":"vno_...","code":"sso.editor@example.com|SSO Editor"}'
```

`start` 会创建一次性 `oauth_states` 记录，只保存 state hash，并在 authorization URL 中带上 PKCE `code_challenge`。`callback` 会用授权 code 通过当前 provider 换取 profile，把 `provider + subject` 写入 `oauth_identities` 并绑定到本地 user account，然后返回和密码登录相同形态的 `sessionToken`。默认 mock provider 用 `email|name|group1,group2` 形式的 code 生成 verified profile，适合本地和自动化验证；生产设为 `AUTH_OAUTH_PROVIDER=oidc` 后会调用配置的 authorization/token/userinfo endpoint。默认 `AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL=true`，并可通过 `AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS=example.com,example.org` 限制 SSO profile 域名。配置 `AUTH_SSO_REQUIRED_EMAIL_DOMAINS=example.com` 后，`example.com` 账号的密码注册、密码登录和密码重置会被 403 拒绝并返回 `ssoRequired: true`，只能走 SSO callback。配置 `AUTH_OAUTH_GROUP_ROLE_MAPPINGS=vn-editors:team_alpha:editor` 后，callback 会读取 `AUTH_OAUTH_GROUP_CLAIM` 中的 groups，并把命中的用户加入对应 team role；响应会包含 `mappedTeamMemberships`。当前身份治理仍未包含 IdP 侧会话登出同步、group 消失后的自动角色回收或设备风险评分。

SCIM 用户生命周期：

```bash
curl http://127.0.0.1:8787/v1/scim/v2/ServiceProviderConfig \
  -H "authorization: Bearer $SCIM_BEARER_TOKEN"

curl "http://127.0.0.1:8787/v1/scim/v2/Users?filter=userName%20eq%20%22editor@example.com%22" \
  -H "authorization: Bearer $SCIM_BEARER_TOKEN"

curl -X POST http://127.0.0.1:8787/v1/scim/v2/Users \
  -H "authorization: Bearer $SCIM_BEARER_TOKEN" \
  -H "content-type: application/scim+json" \
  -d '{"userName":"editor@example.com","displayName":"Editor","active":true}'

curl -X PATCH http://127.0.0.1:8787/v1/scim/v2/Users/user_... \
  -H "authorization: Bearer $SCIM_BEARER_TOKEN" \
  -H "content-type: application/scim+json" \
  -d '{"Operations":[{"op":"replace","path":"active","value":false}]}'

curl -X DELETE http://127.0.0.1:8787/v1/scim/v2/Users/user_... \
  -H "authorization: Bearer $SCIM_BEARER_TOKEN"
```

SCIM 入口和普通 API 使用不同 bearer token；普通 `API_AUTH_TOKEN`、owner token、user token 和 user session 不能调用 SCIM。`POST /Users` 会按 `userName` 或 primary email 创建/更新账号，默认视为邮箱已验证；`GET /Users` 支持 `userName eq "email"` 和 `emails.value eq "email"` 查重；`PATCH /Users/:id` 支持替换 `active`、`displayName` 和 `name.formatted`；`DELETE /Users/:id` 会把账号标记为 disabled 并撤销该用户所有 session。SCIM 响应不会暴露 `passwordHash`、session token hash、MFA secret 或 OAuth subject。

检查当前登录态、列出 session、撤销指定 session、登出当前 session：

```bash
curl http://127.0.0.1:8787/v1/auth/me \
  -H "authorization: Bearer $SESSION_TOKEN"

curl http://127.0.0.1:8787/v1/auth/sessions \
  -H "authorization: Bearer $SESSION_TOKEN"

curl -X POST http://127.0.0.1:8787/v1/auth/sessions/session_.../revoke \
  -H "authorization: Bearer $SESSION_TOKEN"

curl -X POST http://127.0.0.1:8787/v1/auth/logout \
  -H "authorization: Bearer $SESSION_TOKEN"
```

数据库只保存：

- `user_accounts.password_hash`
- `user_accounts.email_verified_at`
- `user_accounts.password_updated_at`
- `user_accounts.mfa_totp_secret_encrypted`
- `user_accounts.mfa_totp_enabled_at`
- `user_accounts.mfa_totp_last_used_counter`
- `user_accounts.mfa_recovery_code_hashes`
- `user_accounts.mfa_recovery_codes_updated_at`
- `user_accounts.mfa_trusted_devices`
- `user_account_action_tokens.token_hash`
- `oauth_states.state_hash`
- `oauth_identities.provider / subject / user_id`
- `user_sessions.token_hash`
- `token_prefix`
- 创建、更新时间和撤销/过期时间

API 响应不会返回 `passwordHash`、`tokenHash`、OAuth subject、失败登录计数、MFA secret 密文、MFA 恢复码 hash、MFA trusted device hash、邮箱验证 token hash 或密码重置 token hash。登录账号拿到 session token 后，仍然通过 `team_members` 的 owner/admin/editor/viewer 角色访问项目；这和静态 user token、动态 user access token 使用同一套授权逻辑。用户只能通过 `/v1/auth/sessions/:id/revoke` 撤销自己的 session，不能用 session id 撤销其他用户 session。当前账号系统已经包含 email/password、OAuth/OIDC SSO 基线、受管域名强制 SSO、IdP group/team role 映射、SCIM 用户创建/更新/启用/禁用基线、session 列表/撤销、邮箱验证、密码重置、TOTP MFA、一次性恢复码、MFA 设备记忆、可配置密码复杂度、弱词阻断、失败登录临时锁定；IdP 单点登出同步、group 消失后的自动角色回收、设备风险控制和企业密码历史/轮换策略仍需要继续扩展。

失败登录锁定只针对已存在账号的登录尝试：错误密码会增加 `failed_login_count`，达到 `AUTH_MAX_FAILED_LOGIN_ATTEMPTS` 后写入 `locked_until`，锁定期间即使密码正确也返回 HTTP 423。成功登录或完成密码重置会清空失败计数和锁定状态。失败登录和锁定事件会写入 audit，响应体不返回失败计数。

Studio 的 `Account` 面板会调用同一组 API：Register/Login/Complete SSO 成功后把 session token 存入本机 localStorage，后续生产 API 请求自动使用 bearer session；`Start SSO` 显示授权 URL 和 state，`Complete SSO` 用 state/code 完成登录；`Refresh Sessions` 会列出当前账号 session，`Revoke Session` 会撤销指定 session，撤销当前本机 session 时会清掉 localStorage；`Setup MFA`、`Confirm MFA`、`Disable MFA` 对应 TOTP MFA；`Confirm MFA` 和 `Regenerate Codes` 会展示一次性恢复码；`Remember MFA device` 保存一次性 device token 到本机，`Forget Devices` 撤销服务端 remembered devices 并清掉本机 token；`Send Verification`、`Verify Email`、`Request Reset`、`Confirm Reset` 分别对应邮箱验证和密码重置接口。密码重置确认后，Studio 会清掉本机旧 session，避免继续使用服务端已撤销的 token。

## 团队和角色权限

当前 `teamId` 复用项目记录里的 `ownerId`，这样已有项目数据不需要迁移字段。admin token 创建 team 后，可以把 user 加入团队：

```bash
curl -X POST http://127.0.0.1:8787/v1/teams \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"id":"owner_a","name":"Alpha Studio","ownerUserId":"user_owner"}'

curl -X POST http://127.0.0.1:8787/v1/teams/owner_a/members \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"userId":"user_editor","role":"editor"}'
```

创建动态 user token：

```bash
curl -X POST http://127.0.0.1:8787/v1/access-tokens \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"role":"user","userId":"user_editor","label":"Editor token"}'
```

使用 user token 时，API 会按 team role 判断权限：

```bash
curl "http://127.0.0.1:8787/v1/projects?ownerId=owner_a" \
  -H "authorization: Bearer vn_..."
```

团队相关端点：

- `POST /v1/teams`
- `GET /v1/teams?userId=<id>`
- `GET /v1/teams/:id/members`
- `POST /v1/teams/:id/members`
- `GET /v1/teams/:id/invitations`
- `POST /v1/teams/:id/invitations`
- `POST /v1/team-invitations/:id/revoke`
- `POST /v1/team-invitations/accept`

团队邀请用于商用 Studio 的异步协作准入。team admin/owner 可以创建邀请：

```bash
curl -X POST http://127.0.0.1:8787/v1/teams/owner_a/invitations \
  -H "authorization: Bearer $OWNER_TOKEN" \
  -H "content-type: application/json" \
  -d '{"email":"editor@example.com","role":"editor","invitedUserId":"user_editor"}'
```

响应里的 `invitationToken` 明文只返回一次，服务端只保存 `token_hash` 和 `token_prefix`：

```json
{
  "invitationToken": "vni_...",
  "invitation": {
    "id": "invite_...",
    "teamId": "owner_a",
    "email": "editor@example.com",
    "role": "editor",
    "status": "pending",
    "tokenPrefix": "vni_..."
  }
}
```

user token 接受邀请后会写入 `team_members`，随后按 team role 访问项目：

```bash
curl -X POST http://127.0.0.1:8787/v1/team-invitations/accept \
  -H "authorization: Bearer $USER_TOKEN" \
  -H "content-type: application/json" \
  -d '{"invitationToken":"vni_..."}'
```

动态 access token 不会保存明文 token，撤销或过期后 API 会返回 401。团队邀请 token 同样只保存 hash；邀请被撤销、过期或重复接受时，接受接口会返回 409。

## 资产存储

开发默认使用：

```text
DATA_DIR/assets/
```

`LocalAssetStorage` 会限制路径，避免 asset id 或文件名造成目录穿越。

当前已实现：

- `LocalAssetStorage`
- `S3CompatibleAssetStorage`

设置 `ASSET_STORAGE_PROVIDER=s3` 后，API 会使用 S3-compatible PUT 上传资产，例如 S3、R2 或 MinIO。建议通过 `S3_PUBLIC_BASE_URL` 接 CDN 地址，让 Runtime 读取公开资产 URL。

开发和本地文件存储模式下，API 会公开读取：

```text
GET /assets/<storageKey>
```

这让 Studio 回填的 `http://127.0.0.1:8787/assets/...` URL 可以直接在预览中显示。S3-compatible 模式下应使用 `S3_PUBLIC_BASE_URL` 返回 CDN URL。

## AI 流水线

当前生产骨架支持任务：

- `novel_to_project`：默认本地 heuristic；配置文本 provider 后可调用 OpenAI-compatible Chat Completions 生成并保存 `VNProject`。
- `asset_generation`：可通过 OpenAI-compatible image provider 生成图片，并把结果写入 `AssetStorage`。

在没有配置密钥时：

```text
asset_generation -> waiting_for_credentials
```

启用文本生成任务：

```bash
AI_PROVIDER_ENABLED=true \
AI_TEXT_PROVIDER=openai-compatible \
OPENAI_TEXT_API_KEY=<secret> \
OPENAI_BASE_URL=https://www.packyapi.com \
pnpm worker:api
```

文本 provider 会收到小说文本和本地 heuristic 生成的 baseline `VNProject`，要求返回完整 `VNProject` JSON。返回结果必须通过 `validateProject()`，否则任务失败，不会把无效项目写入库。

启用图片生成任务：

```bash
AI_PROVIDER_ENABLED=true \
AI_IMAGE_PROVIDER=openai-compatible \
OPENAI_API_KEY=<secret> \
OPENAI_BASE_URL=https://www.packyapi.com \
pnpm worker:api
```

任务输入示例：

```json
{
  "ownerId": "local-user",
  "projectId": "project_123",
  "kind": "asset_generation",
  "input": {
    "assetId": "cg_phone_screen",
    "kind": "cg",
    "title": "手机屏幕亮起",
    "prompt": "traditional galgame CG, close-up of an old phone screen glowing in a dark lab"
  }
}
```

provider 返回 `b64_json` 或图片 URL 后，平台会下载/解码图片并调用 `AssetService.store()`，最终写入本地资产目录或 S3-compatible object storage。

Studio 工作流：

1. 点击 `Generate Placeholder Assets`。
2. Studio 先通过 `POST /v1/projects` 保存当前项目。
3. 对每个 placeholder background/sprite/CG 调用 `POST /v1/jobs` 创建 `asset_generation` job。
4. 默认 `VITE_ASSET_JOB_RUN_MODE=inline` 会直接调用 `POST /v1/jobs/:id/run`，用于本地闭环和手动调试。
5. 生产部署建议设置 `VITE_ASSET_JOB_RUN_MODE=worker`，Studio 只入队并按 `VITE_ASSET_JOB_POLL_INTERVAL_MS` / `VITE_ASSET_JOB_POLL_ATTEMPTS` 轮询 `GET /v1/jobs/:id`；实际执行由 `pnpm worker:api` 或容器里的 worker service 消费队列。
6. job 成功后，Studio 把 `output.publicUrl` 解析为可访问 URL，回填到对应 `VNAsset.src`，把 `placeholder` 改为 `false`，再保存项目。

发布给独立 Player：

```bash
curl -X POST http://127.0.0.1:8787/v1/projects/project_123/publish \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

响应包含：

- `projectUrl`：已发布的 `project.vn.json` 公开 URL。
- `playableUrl`：当配置了 `PLAYER_BASE_URL` 时返回，可直接打开独立 Player。
- `currentProjectUrl`：稳定公开入口，格式为 `/v1/public/projects/:id/project.vn.json`。它会 302 到当前 release 的不可变 JSON。
- `currentPlayableUrl`：独立 Player 加载 `currentProjectUrl` 的长期入口；发布和回滚后不需要换分享链接。
- `publishedProject`：资产 URL 已改写为公开绝对 URL 的 VNProject。

发布服务会把缺失的 placeholder SVG 写入 `AssetStorage`，再写入 `published_project_json`。S3 模式下这些产物会进入对象存储；local 模式下会进入 `DATA_DIR/assets`。每次发布都会创建不可变 release version。`projectUrl` 指向具体 release JSON，`currentProjectUrl` 是固定 current 指针，适合配置到 Player 或对外分享。

公开 current JSON：

```bash
curl -L "http://127.0.0.1:8787/v1/public/projects/project_123/project.vn.json"
```

查看发布历史：

```bash
curl "http://127.0.0.1:8787/v1/projects/project_123/releases" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

回滚当前发布指针到历史 release：

```bash
curl -X POST http://127.0.0.1:8787/v1/projects/project_123/rollback \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"releaseId":"release_123"}'
```

回滚不会删除或覆盖历史 JSON；它只更新项目的 `currentReleaseId`、`publishedProjectUrl`、`publishedPlayableUrl` 和 `publishedAt`，并写入 `project_release_rolled_back` 审计事件。

发布审批流：

```bash
curl -X POST http://127.0.0.1:8787/v1/projects/project_123/release-approvals \
  -H "authorization: Bearer $EDITOR_TOKEN" \
  -H "content-type: application/json" \
  -d '{"notes":"Ready for release"}'
```

审批并发布：

```bash
curl -X POST http://127.0.0.1:8787/v1/release-approvals/release_approval_123/approve \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"reviewNotes":"Approved"}'
```

`RELEASE_APPROVAL_REQUIRED=true` 时，editor 直接调用 `POST /v1/projects/:id/publish` 会被拒绝。审批通过会复用同一套 `ProjectPublishService`，因此仍会创建 release、更新 current URL、触发 deployment invalidation，并写入 `release_approval_published` 审计事件。

`GET /v1/projects/:id/release-diff` 会比较当前草稿和最新发布 release metadata 中保存的项目 summary，返回 beat、asset、character 的新增/删除/变更计数以及前 20 条摘要。新发布会写入 `projectSummary` metadata；旧 release 如果没有 summary，会返回 `baseUnavailable=true`。

审批评论：

```bash
curl -X POST http://127.0.0.1:8787/v1/release-approvals/release_approval_123/comments \
  -H "authorization: Bearer $EDITOR_TOKEN" \
  -H "content-type: application/json" \
  -d '{"body":"第二幕台词已检查。"}'
```

`GET /v1/release-approvals/:id/comments` 可以读取审批下的评论线程，viewer 以上角色可读，editor 以上角色可写。评论会持久化到 FileDatabase 或 Postgres 的 `release_approval_comments`，并写入不包含正文的 `release_approval_commented` 审计事件，避免审计日志保存完整讨论内容。

Studio 里对应的 `Release Diff` 面板可以刷新版本差异，`Release Approval Review` 面板会在项目保存或加载 API 后列出审批记录。审阅者可以加载/提交审批评论，填写 `Review Notes`，然后对 pending approval 执行 Approve 或 Reject；Approve 会调用 `/v1/release-approvals/:id/approve` 并返回发布后的 release version，Reject 会调用 `/v1/release-approvals/:id/reject` 并保留拒绝备注。`Notification Delivery Monitor` 面板可以刷新 owner 维度的通知 delivery，查看 pending/failed/succeeded 状态、重试次数、下一次投递时间和错误，并可手动运行下一条 runnable delivery。审批申请会记录项目指纹；如果申请后草稿被修改，approve 会返回 409，编辑者需要重新提交审批来刷新指纹和 diff。

审批 webhook：

```text
POST RELEASE_APPROVAL_WEBHOOK_URL
headers:
  x-agentic-galgame-event: release_approval_requested
  x-agentic-galgame-delivery: <uuid>
  x-agentic-galgame-timestamp: <iso timestamp>
  x-agentic-galgame-signature: sha256=<hmac when secret is configured>
```

Webhook payload 包含 `event`、`approvalId`、`projectId`、`ownerId`、`approvalStatus`、`actor`、`commentId`、`releaseId`、`createdAt` 和有限 metadata。它不会发送评论正文、审核备注或完整项目 JSON。

审批通知使用 outbox delivery：

```bash
curl "http://127.0.0.1:8787/v1/notification-deliveries?ownerId=owner_123" \
  -H "authorization: Bearer $API_AUTH_TOKEN"

curl -X POST http://127.0.0.1:8787/v1/notification-deliveries/run-next \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

审批主流程只负责写入 `notification_deliveries`。worker 会轮询并调用 `NotificationDeliveryService.runNext()` 投递 webhook；非 2xx 或超时会进入 retry，达到 `NOTIFICATION_MAX_ATTEMPTS` 后标记为 `failed`。通知失败不会阻断审批或发布。Studio 的 `Notification Delivery Monitor` 使用同一组 API 查询和手动运行 delivery，便于本地联调、运营排障和 webhook 配置验证。

团队邀请 webhook：

```text
POST TEAM_INVITATION_WEBHOOK_URL
headers:
  x-agentic-galgame-event: team_invitation_created
  x-agentic-galgame-delivery: <uuid>
  x-agentic-galgame-timestamp: <iso timestamp>
  x-agentic-galgame-signature: sha256=<hmac when secret is configured>
```

Payload 包含 `event`、`invitationId`、`teamId`、`email`、`role`、`invitedBy`、`invitedUserId`、`acceptedByUserId`、`actor`、`createdAt`、`expiresAt` 和有限 metadata。只有 `team_invitation_created` 会携带一次性 `invitationToken`；如果设置 `TEAM_INVITATION_ACCEPT_BASE_URL`，payload 还会包含 `invitationAcceptUrl`。服务端只保存 token hash，不保存明文 token。

团队邀请 webhook 是同步投递，不写入 `notification_deliveries`，避免把邀请明文 token 持久化到通用通知 outbox。非 2xx 或超时会记录 `team_invitation_notification_failed` 审计事件，但不会阻断邀请创建。完整邮件模板、IM 模板、bounce 处理和可重试邀请通知队列仍需要接入方或后续 provider 补齐。

账号 webhook：

```text
POST USER_ACCOUNT_WEBHOOK_URL
headers:
  x-agentic-galgame-event: user_email_verification_requested
  x-agentic-galgame-delivery: <uuid>
  x-agentic-galgame-timestamp: <iso timestamp>
  x-agentic-galgame-signature: sha256=<hmac when secret is configured>
```

Payload 包含 `event`、`userId`、`email`、`name`、`actionTokenPurpose`、`actionTokenPrefix`、`createdAt`、`expiresAt` 和有限 metadata。只有需要用户点击的 `user_email_verification_requested` 与 `user_password_reset_requested` 会携带一次性 `actionToken`；如果设置 `EMAIL_VERIFICATION_BASE_URL` 或 `PASSWORD_RESET_BASE_URL`，payload 还会包含 `actionUrl`。服务端只保存 action token hash，不保存明文 token。

账号 webhook 是同步投递，不写入 `notification_deliveries`，避免把邮箱验证和密码重置明文 token 持久化到通用 outbox。非 2xx 或超时会记录 `user_account_notification_failed` 审计事件；注册、验证或重置主流程不会因为外部通知失败而写入 token 明文。

Owner 级运维摘要：

```bash
curl "http://127.0.0.1:8787/v1/ops/summary?ownerId=owner_123" \
  -H "authorization: Bearer $OWNER_TOKEN"
```

`OperationsService` 会聚合项目数、job 状态、release approval 状态、notification delivery 状态、content safety decision、deployment invalidation、今日 usage 和最近 audit，返回 `healthy` / `degraded` / `critical` 以及有限 incidents。Studio 的 `Operations Summary` 面板使用同一 API 做运营巡检和排障。这是内置可观测入口，不替代生产级外部监控、日志集中化和错误追踪。

`GET /metrics` 输出 Prometheus 文本格式的进程级指标，包含 `agentic_galgame_api_uptime_seconds` 和 `agentic_galgame_api_requests_total`。请求计数标签只包含 method、规范化 route、status 和 auth role；动态项目 id、ownerId query、请求 body、authorization header、session token、邀请 token、邮箱验证 token 和密码重置 token 都不会进入指标标签。默认需要 admin bearer：

```bash
curl http://127.0.0.1:8787/metrics \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

API 会为每个响应写入 `x-request-id`。调用方传入合法 `x-request-id` 时会原样透传；否则服务端生成 UUID。所有响应还会带基础安全头：`x-content-type-options: nosniff`、`x-frame-options: DENY`、`referrer-policy` 和 `permissions-policy`。CORS 允许 `x-request-id` header，便于前端、网关和日志系统串联排障。

开启 `API_ACCESS_LOG=true` 后，API 输出结构化 access log：

```json
{"event":"http_request","requestId":"...","method":"GET","path":"/health","statusCode":200,"durationMs":3,"authRole":"public"}
```

日志刻意不记录 query、body、authorization header、session token、邀请 token、邮箱验证 token 或密码重置 token。

配置 `API_ERROR_WEBHOOK_URL` 后，未处理的 500 会异步发送 `api_server_error` webhook：

```json
{"event":"api_server_error","requestId":"...","method":"GET","route":"/v1/projects/:id","statusCode":500,"authRole":"admin","errorName":"Error","errorMessage":"Database unavailable","occurredAt":"..."}
```

Error webhook payload 只包含 requestId、method、规范化 route、status、auth role、错误类型和脱敏后的错误摘要；不会包含 query、真实 project id、ownerId、请求 body、authorization header、session token、邀请 token、邮箱验证 token、密码重置 token 或 `sk-...` 形式的 provider key。Webhook 投递失败不会改变原 API 响应，只会写入一条 `server_error_webhook_failed` 结构化日志。

如果配置 `DEPLOYMENT_CACHE_PROVIDER=cloudflare`，publish / rollback 会调用 Cloudflare `purge_cache` URL purge，清理 `currentProjectUrl` 和 `currentPlayableUrl`。结果会写入 `deployment_invalidations`，也可查询：

```bash
curl "http://127.0.0.1:8787/v1/projects/project_123/deployment-invalidations" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

Cloudflare purge 失败不会覆盖 release 记录；API 会返回 `deploymentInvalidation.status=failed` 并写入审计事件，运维可以重试或手动 purge。

启用真实 AI 的安全要求：

1. 不把 key 写入代码或文档。
2. 只通过 `.env.local`、部署平台 secret 或运行时环境变量注入。
3. 配置 `AI_PROVIDER_ENABLED=true` 前，需要确认 OpenAI-compatible key 和 base URL。
4. 服务日志只输出 provider 是否启用，不输出 key。

## 配额、用量和审计

任务入队会先检查 owner 当天配额。超额时 API 返回：

```text
429 Daily job quota exceeded.
```

查询当天用量：

```bash
curl "http://127.0.0.1:8787/v1/usage?ownerId=local-user" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

返回内容包含：

```text
jobEnqueued
textJobEnqueued
imageJobEnqueued
jobSucceeded
jobFailed
assetBytes
estimatedCostCents
```

Studio 的 `Usage & Billing` 面板会调用同一端点，展示今日 text/image job、成功/失败/阻断、资产字节、最近 usage events 和 `estimatedCostCents` 的美元化展示。这里的金额只用于 AI/资产运营成本估算，不是发票、支付结算或收入确认。

## Billing 订阅基线

Billing 基线提供套餐、订阅、checkout session 和 provider billing event 的持久化模型：

```bash
curl "http://127.0.0.1:8787/v1/billing/plans" \
  -H "authorization: Bearer $API_AUTH_TOKEN"

curl -X POST "http://127.0.0.1:8787/v1/billing/checkout" \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"ownerId":"local-user","planId":"pro","successUrl":"https://studio.example.com/billing/success","cancelUrl":"https://studio.example.com/billing/cancel"}'

curl -X POST "http://127.0.0.1:8787/v1/billing/payment-method-session" \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{"ownerId":"local-user","returnUrl":"https://studio.example.com/billing/payment-method"}'

curl "http://127.0.0.1:8787/v1/billing/events?ownerId=local-user" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

默认套餐为 `free`、`pro`、`studio`，每档包含价格、币种、周期和每日 job/text/image 配额。`GenerationJobService` 入队前会读取 owner 的 active/trialing subscription；有订阅时按套餐 quota 限制，没有订阅时按 free plan 和基础 quota policy 的较低值限制。`BillingService` 通过 `BillingCheckoutProvider` 抽象创建 checkout 和 customer portal；当前实现是 `MockBillingCheckoutProvider`，返回 `https://billing.local/checkout/<sessionId>` 和 `https://billing.local/portal/<sessionId>`，用于本地开发、自动化测试和 UI 闭环。`POST /v1/billing/payment-method-session` 会为已有 subscription 创建 hosted payment method update URL，并记录 `billing_payment_method_update_started` 审计事件；Stripe provider 对应调用 `POST /v1/billing_portal/sessions`，用于 `past_due` 后自助更新支付方式。`POST /v1/billing/checkout-sessions/:id/complete` 只用于本地 mock completion 或管理后台验证；真实生产接 Stripe、Paddle 或自有支付网关时，应该由签名 webhook 完成 subscription activation，而不是让普通 Studio 用户手动调用。`billing_events` 会保存 provider event id、invoice id、charge id、金额、退款金额、争议金额、币种、invoice URL、subscription 关联和事件发生时间，供运营追踪、客服排查、后续欠费停机、退款/争议处理和对账流程使用。`BILLING_BLOCK_PAST_DUE=true` 时，`past_due` 账号超过 `BILLING_PAST_DUE_GRACE_DAYS` 后会收到 402 Payment Required，新任务不会入队；worker 执行早先排队的任务时也会把任务标记为 `blocked` 并写入 `job_blocked_billing_entitlement` 审计事件。

Stripe-compatible Checkout provider 已经可以通过环境变量启用：

```env
BILLING_CHECKOUT_PROVIDER=stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_STUDIO=price_...
STRIPE_API_BASE_URL=https://api.stripe.com
STRIPE_REQUEST_TIMEOUT_MS=10000
STRIPE_WEBHOOK_TOLERANCE_SECONDS=300
```

启用后，`POST /v1/billing/checkout` 会调用 Stripe `POST /v1/checkout/sessions` 创建 hosted subscription checkout session，并把 `ownerId`、`planId` 和本地 checkout session id 写入 Checkout 与 Subscription metadata。Stripe webhook endpoint 是：

```text
POST /v1/billing/stripe/webhook
```

该 endpoint 不需要 bearer token，但必须通过 `Stripe-Signature` HMAC 签名校验；服务端使用 raw body、`STRIPE_WEBHOOK_SECRET` 和 `STRIPE_WEBHOOK_TOLERANCE_SECONDS` 验证，签名错误、时间戳超窗或 JSON 格式错误都会返回 400。当前处理的事件：

- `checkout.session.completed`：按 Stripe checkout session id 找到本地 checkout session，激活本地 subscription，写入 `externalCustomerId` 和 `externalSubscriptionId`。
- `customer.subscription.updated`：按 Stripe subscription id 更新本地 subscription status、账期和 `cancelAtPeriodEnd`。
- `customer.subscription.deleted`：按 Stripe subscription id 把本地 subscription 标记为 `cancelled`。
- `invoice.payment_failed`：按 Stripe subscription id 找到本地 subscription，记录 `invoice_payment_failed` billing event，并把 subscription 标记为 `past_due`。
- `invoice.payment_action_required`：记录 `invoice_payment_action_required` billing event，并把 subscription 标记为 `past_due`。
- `invoice.paid`：记录 `invoice_paid` billing event，并把 subscription 恢复为 `active`。
- `charge.refunded`：按 Stripe customer id 找到本地 subscription，记录 `refund_created` billing event、charge id 和退款金额。
- `charge.dispute.created`：按 Stripe customer id 或 expanded charge.customer 找到本地 subscription，记录 `dispute_created` billing event、charge id、争议金额和 reason。
- `charge.dispute.closed`：记录 `dispute_closed` billing event、charge id、争议金额和最终 status。

Studio 的 `Billing` 面板会读取 plans、当前 subscription、最近 checkout session 和最近 billing events，支持选择套餐、开始 checkout、展示 checkout URL、创建支付方式更新 URL、查看 invoice/refund/dispute event 和取消订阅。当前已经具备 Stripe Checkout + customer portal + 签名 webhook 的订阅状态回写、账务事件流水、退款/争议事件记录和 past_due 生成阻断基线，但还不是完整支付财务系统：税务、发票 PDF 归档、优惠券、退款审批、争议证据提交、收入确认和财务对账仍需要接入支付 provider 的更多事件和后台流程。

查询审计事件：

```bash
curl "http://127.0.0.1:8787/v1/audit?ownerId=local-user&limit=50" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

Studio 的 `Audit Log` 面板会调用同一端点，按 owner 展示最近审计事件，并把账号、MFA、access token 和团队邀请相关动作标记为 security，方便运营排查登录、权限和发布治理问题。

当前会记录：

- `project_created`
- `project_updated`
- `job_enqueued`
- `job_started`
- `job_succeeded`
- `job_failed`
- `job_retry_scheduled`
- `job_waiting_for_credentials`
- `asset_stored`
- `project_published`
- `release_approval_requested`
- `release_approval_published`
- `access_token_created`
- `team_invitation_created`
- `user_login_succeeded`
- `user_mfa_trusted_device_used`

这些记录是商用生产底座，能支持后续运营后台、计费核对、故障排查和合规追踪；Studio 已提供基础审计查看入口，但它还不是完整支付系统、SIEM、审计报表系统或安全运营后台。

## 内容安全审核

`ContentSafetyService` 会审核：

- 导入小说文本。
- 保存的 `VNProject` 标题、角色名和 line 文本。
- 图片生成任务的 asset id、标题和 prompt。

默认策略：

- 命中 `CONTENT_SAFETY_BLOCKED_TERMS`：阻断请求或 job，API 返回 422。
- 命中 `CONTENT_SAFETY_REVIEW_TERMS`：记录 `review_required`，默认不阻断；设置 `CONTENT_SAFETY_BLOCK_REVIEW=true` 后阻断。
- review 记录只保存 `inputHash`、`inputLength`、`matchedRules` 和 metadata，不保存完整原文。

查询 review：

```bash
curl "http://127.0.0.1:8787/v1/content-safety?ownerId=local-user&limit=50" \
  -H "authorization: Bearer $API_AUTH_TOKEN"
```

手动复核当前项目 JSON 或外部运营输入：

```bash
curl -X POST "http://127.0.0.1:8787/v1/content-safety/review" \
  -H "authorization: Bearer $API_AUTH_TOKEN" \
  -H "content-type: application/json" \
  -d '{
    "ownerId":"local-user",
    "source":"project_json",
    "targetType":"project",
    "targetId":"project_123",
    "text":"{\"title\":\"Project JSON to review\"}",
    "metadata":{"title":"Project JSON to review"}
  }'
```

Studio 的 `Content Safety` 面板可刷新最近 review，显示 decision、source、target、命中规则和输入 hash 摘要，并可对当前项目 JSON 重新运行同一套本地策略。面板不展示原文，因为 review 记录只保存 hash、长度、规则和 metadata。

内容安全阻断的 job 会进入：

```text
blocked
```

这不是完整人工审核后台，也不是第三方合规模型。它是生产上线前必须具备的本地阻断、复核和审计底座，后续可接入外部 moderation provider、人工审核队列和申诉流程。

## 任务重试

`GenerationJobService` 会在 provider 失败时重新把任务排回队列：

```text
queued -> running -> queued(nextRunAt) -> running -> failed
```

重试次数由 `JOB_MAX_ATTEMPTS` 控制，退避由 `JOB_RETRY_DELAY_MS` 控制。`runNext()` 只会消费 `nextRunAt` 已到期的 queued job，避免 worker 在 provider 不可用时忙等。

## Worker

HTTP API 和后台任务处理可以分开运行：

```bash
pnpm worker:api
```

Docker Compose 中包含 `worker` 服务，使用同一镜像运行：

```text
pnpm --filter @agentic-galgame/api worker
```

worker 会轮询 `generation_jobs`：

- 有 queued job 时调用 `runNext()`。
- 输出结构化 JSON lifecycle/job 日志。
- `WORKER_RUN_ONCE=true` 可用于一次性 smoke 或 CI。
- 在 `AI_PROVIDER_ENABLED=false` 时，`asset_generation` 会稳定停在 `waiting_for_credentials`，不会调用外部 AI。

## 验证

MVP 门禁：

```bash
pnpm verify:mvp
```

生产骨架门禁：

```bash
pnpm verify:production
```

`verify:production` 会运行：

```text
pnpm test
pnpm typecheck
pnpm build
pnpm audit:production
```

Postgres 迁移门禁：

```bash
pnpm db:migrate
```

该命令需要真实 `DATABASE_URL`，不会在默认 CI 门禁里连接外部数据库。

## 当前未完成的商用项

这些仍然不是完成态：

- IdP 单点登出同步、SCIM group deprovisioning、设备风险控制、更细密码策略配置和完整账号安全生命周期。
- 真实外部 AI 凭据下的生产 smoke、外部 moderation provider、完整人工审核后台、完整可视化版本 diff、原生邮件/IM provider、通知模板、bounce 处理、可重试账号通知队列和生成质量评估。
- 支付、套餐、发票、用量结算和更细粒度 provider 成本治理。
- SIEM 级审计检索、报表导出、异常检测、告警升级和安全运营后台。
- 外部集中监控、日志集中化、错误追踪和告警升级。
- Kubernetes 或云平台一键部署模板。
