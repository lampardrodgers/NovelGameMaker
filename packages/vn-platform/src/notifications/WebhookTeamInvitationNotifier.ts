import { createHmac, randomUUID } from "node:crypto";
import type { TeamInvitationNotificationPayload, TeamInvitationNotifier } from "../types.js";

export interface WebhookTeamInvitationNotifierOptions {
  url: string;
  secret?: string;
  timeoutMs?: number;
  acceptBaseUrl?: string;
  fetchImpl?: typeof fetch;
}

export class WebhookTeamInvitationNotifier implements TeamInvitationNotifier {
  readonly id = "team_invitation_webhook";

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: WebhookTeamInvitationNotifierOptions) {
    if (!options.url.trim()) {
      throw new Error("WebhookTeamInvitationNotifier requires a URL.");
    }
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
  }

  async notify(input: TeamInvitationNotificationPayload): Promise<void> {
    const payload = withInvitationAcceptUrl(input, this.options.acceptBaseUrl);
    const body = JSON.stringify(payload);
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
        throw new Error(`Team invitation webhook failed with HTTP ${response.status}.`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }
}

function withInvitationAcceptUrl(
  input: TeamInvitationNotificationPayload,
  acceptBaseUrl: string | undefined
): TeamInvitationNotificationPayload {
  if (!acceptBaseUrl || !input.invitationToken || input.invitationAcceptUrl) {
    return input;
  }
  return {
    ...input,
    invitationAcceptUrl: appendInvitationToken(acceptBaseUrl, input.invitationToken)
  };
}

function appendInvitationToken(baseUrl: string, token: string): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}invitationToken=${encodeURIComponent(token)}`;
}

function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}
