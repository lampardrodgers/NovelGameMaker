import { describe, expect, it } from "vitest";
import {
  createChatCompletionsEndpoint,
  createOpenAITextModelProviderFromEnv,
  OpenAITextModelProvider,
  type TextFetchLike
} from "../index";

interface FetchCall {
  url: string;
  init: Parameters<TextFetchLike>[1];
}

function createMockFetch(payload: unknown, ok = true, status = 200): {
  calls: FetchCall[];
  fetch: TextFetchLike;
} {
  const calls: FetchCall[] = [];
  const fetch: TextFetchLike = async (url, init) => {
    calls.push({ url, init });
    return {
      ok,
      status,
      json: async () => payload
    };
  };
  return { calls, fetch };
}

describe("OpenAITextModelProvider", () => {
  it("calls an OpenAI-compatible chat completions endpoint and parses structured JSON", async () => {
    const { calls, fetch } = createMockFetch({
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: "AI 生成项目",
              beats: 12
            })
          }
        }
      ]
    });
    const provider = new OpenAITextModelProvider({
      apiKey: "test-key",
      urlbase: "https://www.packyapi.com",
      model: "gpt-4.1-mini",
      fetch
    });
    const result = await provider.generateStructured<{ title: string; beats: number }>({
      task: "novel_to_project",
      schemaName: "VNProjectPlan",
      prompt: "Generate a plan."
    });
    const call = calls[0];
    if (!call) {
      throw new Error("expected fetch call");
    }
    const body = JSON.parse(call.init.body) as {
      model: string;
      response_format?: { type?: string };
      messages: Array<{ role: string; content: string }>;
    };

    expect(call.url).toBe("https://www.packyapi.com/v1/chat/completions");
    expect(call.init.headers.Authorization).toBe("Bearer test-key");
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.response_format?.type).toBe("json_object");
    expect(body.messages[1]?.content).toContain("VNProjectPlan");
    expect(result.title).toBe("AI 生成项目");
    expect(result.beats).toBe(12);
  });

  it("does not duplicate /v1 when baseURL already includes it", () => {
    expect(createChatCompletionsEndpoint("https://www.packyapi.com/v1")).toBe(
      "https://www.packyapi.com/v1/chat/completions"
    );
  });

  it("creates a provider from env and supports OPENAI_TEXT_API_KEY", async () => {
    const { calls, fetch } = createMockFetch({
      choices: [
        {
          message: {
            content: "{\"ok\":true}"
          }
        }
      ]
    });
    const provider = createOpenAITextModelProviderFromEnv(
      {
        OPENAI_TEXT_API_KEY: "text-key",
        OPENAI_URLBASE: "https://gateway.example",
        OPENAI_TEXT_MODEL: "custom-chat-model"
      },
      { fetch }
    );
    await provider.generateStructured<{ ok: boolean }>({
      task: "test",
      schemaName: "Test",
      prompt: "Return ok"
    });

    expect(calls[0]?.url).toBe("https://gateway.example/v1/chat/completions");
    expect(calls[0]?.init.headers.Authorization).toBe("Bearer text-key");
  });

  it("fails clearly when no api key is configured", async () => {
    const { fetch } = createMockFetch({ choices: [] });
    const provider = new OpenAITextModelProvider({
      baseURL: "https://www.packyapi.com",
      fetch
    });

    await expect(
      provider.generateStructured({
        task: "test",
        schemaName: "Test",
        prompt: "Return JSON"
      })
    ).rejects.toThrow("requires apiKey");
  });
});
