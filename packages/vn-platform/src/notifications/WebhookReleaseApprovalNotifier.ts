import { createHmac, randomUUID } from "node:crypto";
import type { ReleaseApprovalNotificationPayload, ReleaseApprovalNotifier } from "../types.js";

export interface WebhookReleaseApprovalNotifierOptions {
  url: string;
  secret?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class WebhookReleaseApprovalNotifier implements ReleaseApprovalNotifier {
  readonly id = "webhook";

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: WebhookReleaseApprovalNotifierOptions) {
    if (!options.url.trim()) {
      throw new Error("WebhookReleaseApprovalNotifier requires a URL.");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async notify(input: ReleaseApprovalNotificationPayload): Promise<void> {
    const body = JSON.stringify(input);
    const timestamp = new Date().toISOString();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "novel-game-maker/0.1",
      "x-novel-game-maker-event": input.event,
      "x-novel-game-maker-delivery": randomUUID(),
      "x-novel-game-maker-timestamp": timestamp
    };
    if (this.options.secret) {
      headers["x-novel-game-maker-signature"] = `sha256=${signBody(this.options.secret, timestamp, body)}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(this.options.url, {
        method: "POST",
        headers,
        body,
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Release approval webhook failed with HTTP ${response.status}.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}
