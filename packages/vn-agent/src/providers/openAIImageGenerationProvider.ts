import type {
  ImageAssetGenerationInput,
  ImageAssetGenerationResult,
  ImageGenerationProvider
} from "./interfaces.js";

export type OpenAIImageResponseFormat = "b64_json" | "url";
export type OpenAIImageOutputFormat = "png" | "webp" | "jpeg";

export interface OpenAIImageGenerationProviderOptions {
  apiKey?: string;
  baseURL?: string;
  urlbase?: string;
  model?: string;
  size?: string;
  quality?: string;
  background?: string;
  responseFormat?: OpenAIImageResponseFormat;
  outputFormat?: OpenAIImageOutputFormat;
  fetch?: FetchLike;
}

export interface OpenAIImageGenerationEnv {
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_URLBASE?: string;
  OPENAI_IMAGE_MODEL?: string;
  OPENAI_IMAGE_SIZE?: string;
  OPENAI_IMAGE_QUALITY?: string;
  OPENAI_IMAGE_RESPONSE_FORMAT?: string;
  OPENAI_IMAGE_OUTPUT_FORMAT?: string;
}

export type FetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<ResponseLike>;

interface ResponseLike {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

interface ImageResponsePayload {
  data?: Array<{
    b64_json?: string;
    url?: string;
    revised_prompt?: string;
  }>;
  error?: {
    message?: string;
  };
}

const defaultModel = "gpt-image-1";
const defaultSize = "1024x1024";
const defaultOutputFormat: OpenAIImageOutputFormat = "png";

export class OpenAIImageGenerationProvider implements ImageGenerationProvider {
  readonly id = "openai-compatible-images";

  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly size: string;
  private readonly quality?: string;
  private readonly background?: string;
  private readonly responseFormat?: OpenAIImageResponseFormat;
  private readonly outputFormat: OpenAIImageOutputFormat;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAIImageGenerationProviderOptions = {}) {
    const baseURL = options.baseURL ?? options.urlbase ?? "https://api.openai.com";
    const fetchImpl = options.fetch ?? (globalThis.fetch as FetchLike | undefined);

    if (!fetchImpl) {
      throw new Error("OpenAIImageGenerationProvider requires a fetch implementation.");
    }

    this.apiKey = options.apiKey;
    this.endpoint = createImagesEndpoint(baseURL);
    this.model = options.model ?? defaultModel;
    this.size = options.size ?? defaultSize;
    this.quality = options.quality;
    this.background = options.background;
    this.responseFormat = options.responseFormat;
    this.outputFormat = options.outputFormat ?? defaultOutputFormat;
    this.fetchImpl = fetchImpl;
  }

  async generateAsset(input: ImageAssetGenerationInput): Promise<ImageAssetGenerationResult> {
    if (!this.apiKey) {
      throw new Error("OpenAIImageGenerationProvider requires apiKey or OPENAI_API_KEY.");
    }

    const body = this.createRequestBody(input);
    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = await readImageResponse(response);

    if (!response.ok) {
      const message = payload.error?.message ?? "unknown image generation error";
      throw new Error(`OpenAI-compatible image generation failed with status ${response.status}: ${message}`);
    }

    const firstImage = payload.data?.[0];
    if (!firstImage) {
      throw new Error("OpenAI-compatible image generation returned no image data.");
    }

    if (firstImage.b64_json) {
      const mimeType = imageMimeType(this.outputFormat);
      return {
        src: `data:${mimeType};base64,${firstImage.b64_json}`,
        provider: "openai-compatible-images",
        mimeType,
        revisedPrompt: firstImage.revised_prompt
      };
    }

    if (firstImage.url) {
      return {
        src: firstImage.url,
        provider: "openai-compatible-images",
        revisedPrompt: firstImage.revised_prompt
      };
    }

    throw new Error("OpenAI-compatible image generation response had no b64_json or url field.");
  }

  async generateImage(input: {
    prompt: string;
    width: number;
    height: number;
    seed?: number;
    referenceAssetIds?: string[];
  }): Promise<{ assetUrl: string; seed?: number }> {
    const result = await this.generateAsset({
      id: "generated_image",
      title: input.prompt,
      kind: "cg",
      prompt: input.prompt
    });
    return {
      assetUrl: result.src,
      seed: input.seed
    };
  }

  async generatePlaceholderAsset(input: ImageAssetGenerationInput): Promise<{ src: string }> {
    const asset = await this.generateAsset(input);
    return { src: asset.src };
  }

  private createRequestBody(input: ImageAssetGenerationInput): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.model,
      prompt: input.prompt ?? createDefaultImagePrompt(input),
      size: this.size
    };

    if (this.quality) {
      body.quality = this.quality;
    }

    if (this.background) {
      body.background = this.background;
    }

    if (this.responseFormat) {
      body.response_format = this.responseFormat;
    }

    if (this.outputFormat !== "png") {
      body.output_format = this.outputFormat;
    }

    return body;
  }
}

export function createOpenAIImageGenerationProviderFromEnv(
  env: OpenAIImageGenerationEnv,
  overrides: Omit<OpenAIImageGenerationProviderOptions, "apiKey" | "baseURL"> = {}
): OpenAIImageGenerationProvider {
  return new OpenAIImageGenerationProvider({
    apiKey: env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL ?? env.OPENAI_URLBASE,
    model: env.OPENAI_IMAGE_MODEL,
    size: env.OPENAI_IMAGE_SIZE,
    quality: env.OPENAI_IMAGE_QUALITY,
    responseFormat: normalizeResponseFormat(env.OPENAI_IMAGE_RESPONSE_FORMAT),
    outputFormat: normalizeOutputFormat(env.OPENAI_IMAGE_OUTPUT_FORMAT),
    ...overrides
  });
}

export function createImagesEndpoint(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/g, "");
  return trimmed.endsWith("/v1") ? `${trimmed}/images/generations` : `${trimmed}/v1/images/generations`;
}

function createDefaultImagePrompt(input: ImageAssetGenerationInput): string {
  if (input.kind === "characterSprite") {
    return [
      "traditional galgame visual novel character sprite",
      "transparent background",
      "half-body front-facing portrait",
      "clean production asset",
      `character or asset title: ${input.title}`
    ].join(", ");
  }

  if (input.kind === "cg") {
    return [
      "traditional galgame visual novel CG",
      "16:9 cinematic full-frame illustration",
      "no subtitles",
      "no textbox UI",
      `scene title: ${input.title}`
    ].join(", ");
  }

  return [
    "traditional galgame visual novel background",
    "16:9 environment art",
    "no characters",
    "no subtitles",
    "no textbox UI",
    `location title: ${input.title}`
  ].join(", ");
}

async function readImageResponse(response: ResponseLike): Promise<ImageResponsePayload> {
  const payload = await readJsonPayload(response);
  if (!isRecord(payload)) {
    return {};
  }

  return payload as ImageResponsePayload;
}

async function readJsonPayload(response: ResponseLike): Promise<unknown> {
  if (response.json) {
    return response.json();
  }

  if (response.text) {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }

  return {};
}

function normalizeResponseFormat(value: string | undefined): OpenAIImageResponseFormat | undefined {
  if (value === "b64_json" || value === "url") {
    return value;
  }

  return undefined;
}

function normalizeOutputFormat(value: string | undefined): OpenAIImageOutputFormat | undefined {
  if (value === "png" || value === "webp" || value === "jpeg") {
    return value;
  }

  return undefined;
}

function imageMimeType(format: OpenAIImageOutputFormat): string {
  if (format === "jpeg") {
    return "image/jpeg";
  }

  return `image/${format}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
