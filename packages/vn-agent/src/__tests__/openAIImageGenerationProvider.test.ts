import { describe, expect, it } from "vitest";
import {
  createImagesEndpoint,
  createOpenAIImageGenerationProviderFromEnv,
  OpenAIImageGenerationProvider,
  type FetchLike
} from "../index";

interface FetchCall {
  url: string;
  init: Parameters<FetchLike>[1];
}

function createMockFetch(payload: unknown, ok = true, status = 200): {
  calls: FetchCall[];
  fetch: FetchLike;
} {
  const calls: FetchCall[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok,
      status,
      json: async () => payload
    };
  };

  return { calls, fetch };
}

describe("OpenAIImageGenerationProvider", () => {
  it("calls a third-party OpenAI-compatible urlbase and parses b64_json output", async () => {
    const { calls, fetch } = createMockFetch({
      data: [
        {
          b64_json: "ZmFrZS1pbWFnZQ==",
          revised_prompt: "revised prompt"
        }
      ]
    });
    const provider = new OpenAIImageGenerationProvider({
      apiKey: "test-key",
      urlbase: "https://www.packyapi.com",
      model: "gpt-image-1",
      responseFormat: "b64_json",
      outputFormat: "webp",
      fetch
    });
    const result = await provider.generateAsset({
      id: "cg_truth",
      title: "真相揭露",
      kind: "cg"
    });
    const call = calls[0];
    if (!call) {
      throw new Error("expected fetch call");
    }
    const body = JSON.parse(call.init.body) as Record<string, unknown>;

    expect(call.url).toBe("https://www.packyapi.com/v1/images/generations");
    expect(call.init.headers.Authorization).toBe("Bearer test-key");
    expect(body.model).toBe("gpt-image-1");
    expect(body.prompt).toContain("真相揭露");
    expect(body.response_format).toBe("b64_json");
    expect(body.output_format).toBe("webp");
    expect(result.provider).toBe("openai-compatible-images");
    expect(result.src).toBe("data:image/webp;base64,ZmFrZS1pbWFnZQ==");
    expect(result.revisedPrompt).toBe("revised prompt");
  });

  it("does not duplicate /v1 when baseURL already includes it", () => {
    expect(createImagesEndpoint("https://www.packyapi.com/v1")).toBe(
      "https://www.packyapi.com/v1/images/generations"
    );
  });

  it("parses url output from an OpenAI-compatible response", async () => {
    const { fetch } = createMockFetch({
      data: [
        {
          url: "https://cdn.example/generated.png"
        }
      ]
    });
    const provider = new OpenAIImageGenerationProvider({
      apiKey: "test-key",
      baseURL: "https://api.example/v1",
      responseFormat: "url",
      fetch
    });
    const result = await provider.generateAsset({
      id: "bg_rooftop",
      title: "天台黄昏",
      kind: "background"
    });

    expect(result.src).toBe("https://cdn.example/generated.png");
  });

  it("creates a provider from env and supports OPENAI_URLBASE alias", async () => {
    const { calls, fetch } = createMockFetch({
      data: [
        {
          b64_json: "aW1hZ2U="
        }
      ]
    });
    const provider = createOpenAIImageGenerationProviderFromEnv(
      {
        OPENAI_API_KEY: "test-key",
        OPENAI_URLBASE: "https://gateway.example",
        OPENAI_IMAGE_RESPONSE_FORMAT: "b64_json"
      },
      { fetch }
    );
    await provider.generateAsset({
      id: "sprite_lin_xue",
      title: "林雪",
      kind: "characterSprite"
    });

    expect(calls[0]?.url).toBe("https://gateway.example/v1/images/generations");
  });

  it("fails clearly when no api key is configured", async () => {
    const { fetch } = createMockFetch({ data: [] });
    const provider = new OpenAIImageGenerationProvider({
      baseURL: "https://www.packyapi.com",
      fetch
    });

    await expect(
      provider.generateAsset({
        id: "cg_default",
        title: "默认 CG",
        kind: "cg"
      })
    ).rejects.toThrow("requires apiKey");
  });
});
