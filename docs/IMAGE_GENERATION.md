# Image Generation

## Current Default

当前默认图片生成方式是 deterministic 场景化 SVG placeholder。

这条路径不调用真实 AI：

```text
createProjectFromNovel
-> createPlaceholderAssets
-> VNAsset(src: assets/*.svg, placeholder: true)
-> exportStaticBundle writes SVG placeholder files
```

因此，默认运行 `pnpm dev`、`pnpm export:sample` 或 Studio 的 Generate VN Project 时，不会调用 Codex image2，也不会调用 OpenAI API。

sample 的默认资产会绘制夜晚实验室、林雪立绘、手机屏幕 CG、世界线偏移 CG 等轻量 SVG 场景，但它们仍然是本地 placeholder，不是照片级或真实 AI 生成图片。

## Codex / image2 Path

项目现在支持 Codex image generation / image2 的资产生成计划。

生成 manifest：

```bash
pnpm image2:manifest
```

默认输出：

```text
dist/image2-assets-manifest.json
```

manifest 包含：

- `assetId`
- `assetType`
- `prompt`
- `outputPath`
- `replaceProjectSrc`

使用方式：

1. 对 manifest 中每个 asset prompt 使用 Codex image generation / image2 生成图片。
2. 把生成结果保存到对应 `outputPath`。
3. 用 `applyGeneratedAssetManifest(project, manifest)` 或手动把 `VNAsset.src` 改成 `replaceProjectSrc`，并把 `placeholder` 改成 `false`。

这个路径适合 Codex 作为创作代理时批量生成背景、立绘和 CG。它不是浏览器运行时 API，也不需要 OpenAI API key。

## OpenAI-Compatible Images API Path

项目现在支持 OpenAI-compatible 图片生成 provider：

```ts
new OpenAIImageGenerationProvider({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: "https://www.packyapi.com",
  model: "gpt-image-1",
  responseFormat: "b64_json"
})
```

也支持第三方常用参数名：

```ts
new OpenAIImageGenerationProvider({
  apiKey,
  urlbase: "https://www.packyapi.com"
})
```

环境变量入口：

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_URLBASE
OPENAI_IMAGE_MODEL
OPENAI_IMAGE_SIZE
OPENAI_IMAGE_QUALITY
OPENAI_IMAGE_RESPONSE_FORMAT
OPENAI_IMAGE_OUTPUT_FORMAT
```

`baseURL` / `urlbase` 会被规范成 `/v1/images/generations`：

```text
https://www.packyapi.com
-> https://www.packyapi.com/v1/images/generations

https://www.packyapi.com/v1
-> https://www.packyapi.com/v1/images/generations
```

provider 支持解析两种响应：

- `data[0].b64_json`：返回 `data:image/...;base64,...`
- `data[0].url`：返回图片 URL

仓库不保存 API key。单元测试使用 mock fetch 验证第三方 URL base、鉴权头、请求 body、`b64_json` 和 `url` 响应解析。真实 API smoke test 需要在运行环境中临时注入 key。

## Backend Asset Generation Job

生产 API/worker 现在可以把 OpenAI-compatible provider 接入 `asset_generation` 任务：

```text
POST /v1/jobs
kind: asset_generation
input: { assetId, kind, title, prompt }
-> worker runNext()
-> OpenAI-compatible Images API
-> AssetService.store()
-> LocalAssetStorage or S3CompatibleAssetStorage
-> job output: storageKey, publicUrl, provider, revisedPrompt
```

默认配置仍然不调用外部 AI：

```text
AI_PROVIDER_ENABLED=false
AI_IMAGE_PROVIDER=none
```

启用时需要：

```text
AI_PROVIDER_ENABLED=true
AI_IMAGE_PROVIDER=openai-compatible
OPENAI_API_KEY=<secret>
OPENAI_BASE_URL=https://www.packyapi.com
OPENAI_IMAGE_RESPONSE_FORMAT=b64_json
```

API 集成测试使用 mock fetch 证明 `/v1/jobs/:id/run` 可以触发 provider、接收 `b64_json`、存储生成图片，并在 job output 中返回 `publicUrl`。测试不会调用真实外部服务，也不会保存 key。

## Studio Backfill

Studio 的 `AssetGenerationPanel` 会统计当前 `VNProject.assets.items` 中仍为 `placeholder: true` 的 background、characterSprite 和 CG。

点击 `Generate Placeholder Assets` 后：

```text
Studio saveProject
-> create asset_generation job for each placeholder image asset
-> run job
-> output.publicUrl
-> resolve relative /assets URL against VITE_API_BASE_URL
-> VNAsset.src = resolved URL
-> VNAsset.placeholder = false
-> saveProject again
```

本地 API 会提供 `GET /assets/<storageKey>`，所以回填后的 URL 可以直接在 Studio Runtime Preview 中加载。生产 S3/CDN 模式下，`publicUrl` 应是 CDN URL。

## Provider Status

| Provider | Status | Calls Real AI | Notes |
|---|---:|---:|---|
| SVG placeholder | done | no | 默认 MVP 路径 |
| Codex/image2 manifest | done | via Codex outside app runtime | 生成 prompt manifest，支持回填资产 |
| OpenAI-compatible Images API | done | yes when configured | 支持 `baseURL` / `urlbase` / `OPENAI_BASE_URL` / `OPENAI_URLBASE` |
| Backend `asset_generation` job | done | yes when configured | Worker 可调用 OpenAI-compatible provider 并落盘到本地或 S3-compatible storage |
