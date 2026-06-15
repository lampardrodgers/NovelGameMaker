import { createHmac, randomUUID } from "node:crypto";
import type { UserAccountNotificationPayload, UserAccountNotifier } from "../types.js";

export interface WebhookUserAccountNotifierOptions {
  url: string;
  secret?: string;
  timeoutMs?: number;
  emailVerificationBaseUrl?: string;
  passwordResetBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class WebhookUserAccountNotifier implements UserAccountNotifier {
  readonly id = "user_account_webhook";

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: WebhookUserAccountNotifierOptions) {
    if (!options.url.trim()) {
      throw new Error("WebhookUserAccountNotifier requires a URL.");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async notify(input: UserAccountNotificationPayload): Promise<void> {
    const payload = withActionUrl(input, this.options);
    const body = JSON.stringify(payload);
    const timestamp = new Date().toISOString();
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "user-agent": "agentic-galgame-studio/0.1",
      "x-agentic-galgame-event": input.event,
      "x-agentic-galgame-delivery": randomUUID(),
      "x-agentic-galgame-timestamp": timestamp
    };
    if (this.options.secret) {
      headers["x-agentic-galgame-signature"] = `sha256=${signBody(this.options.secret, timestamp, body)}`;
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
        throw new Error(`User account webhook failed with HTTP ${response.status}.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function withActionUrl(
  input: UserAccountNotificationPayload,
  options: WebhookUserAccountNotifierOptions
): UserAccountNotificationPayload {
  if (!input.actionToken || input.actionUrl) {
    return input;
  }
  if (input.actionTokenPurpose === "email_verification" && options.emailVerificationBaseUrl) {
    return {
      ...input,
      actionUrl: appendToken(options.emailVerificationBaseUrl, "verificationToken", input.actionToken)
    };
  }
  if (input.actionTokenPurpose === "password_reset" && options.passwordResetBaseUrl) {
    return {
      ...input,
      actionUrl: appendToken(options.passwordResetBaseUrl, "resetToken", input.actionToken)
    };
  }
  return input;
}

function appendToken(baseUrl: string, key: string, token: string): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${key}=${encodeURIComponent(token)}`;
}

function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}
