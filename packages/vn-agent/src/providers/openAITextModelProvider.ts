import type { TextModelProvider } from "./interfaces.js";

export interface OpenAITextModelProviderOptions {
  apiKey?: string;
  baseURL?: string;
  urlbase?: string;
  model?: string;
  temperature?: number;
  fetch?: TextFetchLike;
}

export interface OpenAITextModelEnv {
  OPENAI_API_KEY?: string;
  OPENAI_TEXT_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_URLBASE?: string;
  OPENAI_TEXT_MODEL?: string;
  OPENAI_TEXT_TEMPERATURE?: string;
}

export type TextFetchLike = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<TextResponseLike>;

interface TextResponseLike {
  ok: boolean;
  status: number;
  json?: () => Promise<unknown>;
  text?: () => Promise<string>;
}

interface ChatCompletionPayload {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

const defaultModel = "gpt-4.1-mini";

export class OpenAITextModelProvider implements TextModelProvider {
  readonly id = "openai-compatible-text";

  private readonly apiKey?: string;
  private readonly endpoint: string;
  private readonly model: string;
  private readonly temperature: number;
  private readonly fetchImpl: TextFetchLike;

  constructor(options: OpenAITextModelProviderOptions = {}) {
    const baseURL = options.baseURL ?? options.urlbase ?? "https://api.openai.com";
    const fetchImpl = options.fetch ?? (globalThis.fetch as TextFetchLike | undefined);
    if (!fetchImpl) {
      throw new Error("OpenAITextModelProvider requires a fetch implementation.");
    }

    this.apiKey = options.apiKey;
    this.endpoint = createChatCompletionsEndpoint(baseURL);
    this.model = options.model ?? defaultModel;
    this.temperature = options.temperature ?? 0.2;
    this.fetchImpl = fetchImpl;
  }

  async generateStructured<T>(input: {
    task: string;
    schemaName: string;
    prompt: string;
  }): Promise<T> {
    const content = await this.complete([
      `Task: ${input.task}`,
      `Return only valid JSON for schema: ${input.schemaName}.`,
      input.prompt
    ].join("\n\n"));
    return parseJsonContent(content) as T;
  }

  async complete(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("OpenAITextModelProvider requires apiKey or OPENAI_API_KEY.");
    }

    const response = await this.fetchImpl(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a production visual novel planning agent. Return strict JSON when asked for structured output."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: this.temperature,
        response_format: {
          type: "json_object"
        }
      })
    });
    const payload = await readChatResponse(response);

    if (!response.ok) {
      const message = payload.error?.message ?? "unknown text generation error";
      throw new Error(`OpenAI-compatible text generation failed with status ${response.status}: ${message}`);
    }

    const content = readFirstContent(payload);
    if (!content) {
      throw new Error("OpenAI-compatible text generation returned no content.");
    }
    return content;
  }
}

export function createOpenAITextModelProviderFromEnv(
  env: OpenAITextModelEnv,
  overrides: Omit<OpenAITextModelProviderOptions, "apiKey" | "baseURL"> = {}
): OpenAITextModelProvider {
  return new OpenAITextModelProvider({
    apiKey: env.OPENAI_TEXT_API_KEY ?? env.OPENAI_API_KEY,
    baseURL: env.OPENAI_BASE_URL ?? env.OPENAI_URLBASE,
    model: env.OPENAI_TEXT_MODEL,
    temperature: parseTemperature(env.OPENAI_TEXT_TEMPERATURE),
    ...overrides
  });
}

export function createChatCompletionsEndpoint(baseURL: string): string {
  const trimmed = baseURL.replace(/\/+$/g, "");
  return trimmed.endsWith("/v1") ? `${trimmed}/chat/completions` : `${trimmed}/v1/chat/completions`;
}

async function readChatResponse(response: TextResponseLike): Promise<ChatCompletionPayload> {
  const payload = await readJsonPayload(response);
  return isRecord(payload) ? payload as ChatCompletionPayload : {};
}

async function readJsonPayload(response: TextResponseLike): Promise<unknown> {
  if (response.json) {
    return response.json();
  }
  if (response.text) {
    const text = await response.text();
    return text ? JSON.parse(text) : {};
  }
  return {};
}

function readFirstContent(payload: ChatCompletionPayload): string | undefined {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content.map((part) => part.text ?? "").join("").trim();
  }
  return undefined;
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1]);
    }
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("OpenAI-compatible text generation returned invalid JSON.");
  }
}

function parseTemperature(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
