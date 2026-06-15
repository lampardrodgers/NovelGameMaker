import type { DeploymentCacheProvider, DeploymentCachePurgeResult } from "../types.js";

export interface CloudflareCachePurgeProviderOptions {
  zoneId: string;
  apiToken: string;
  apiBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class CloudflareCachePurgeProvider implements DeploymentCacheProvider {
  readonly id = "cloudflare";
  private readonly apiBaseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: CloudflareCachePurgeProviderOptions) {
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.cloudflare.com/client/v4").replace(/\/+$/g, "");
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async purge(input: {
    urls: string[];
    ownerId: string;
    projectId: string;
    releaseId?: string;
    reason: "publish" | "rollback";
  }): Promise<DeploymentCachePurgeResult> {
    if (input.urls.length === 0) {
      return {};
    }
    const response = await this.fetchImpl(`${this.apiBaseUrl}/zones/${encodeURIComponent(this.options.zoneId)}/purge_cache`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.options.apiToken}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ files: input.urls })
    });
    const text = await response.text();
    const body = text ? parseJsonObject(text) : {};
    if (!response.ok || body.success === false) {
      throw new Error(`Cloudflare cache purge failed: ${response.status} ${summarizeCloudflareErrors(body)}`);
    }
    return {
      requestId: readString((body.result as Record<string, unknown> | undefined)?.id),
      metadata: {
        purgedFiles: input.urls.length
      }
    };
  }
}

function parseJsonObject(text: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function summarizeCloudflareErrors(body: Record<string, unknown>): string {
  const errors = Array.isArray(body.errors) ? body.errors : [];
  if (errors.length === 0) {
    return "unknown error";
  }
  return errors
    .map((error) => {
      if (!error || typeof error !== "object") {
        return String(error);
      }
      const record = error as Record<string, unknown>;
      return readString(record.message) ?? readString(record.code) ?? "unknown error";
    })
    .join("; ");
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
