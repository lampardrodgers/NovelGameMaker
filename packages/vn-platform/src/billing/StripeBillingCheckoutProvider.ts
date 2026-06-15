import type { BillingCheckoutProvider, BillingPlanRecord, BillingSubscriptionRecord } from "../types.js";

export interface StripeBillingCheckoutProviderOptions {
  secretKey: string;
  priceIds: Record<string, string>;
  apiBaseUrl?: string;
  requestTimeoutMs?: number;
}

interface StripeCheckoutSessionResponse {
  id?: string;
  url?: string | null;
  expires_at?: number | null;
  object?: string;
  error?: {
    message?: string;
    type?: string;
  };
}

interface StripePortalSessionResponse {
  id?: string;
  url?: string | null;
  object?: string;
  error?: {
    message?: string;
    type?: string;
  };
}

export class StripeBillingCheckoutProvider implements BillingCheckoutProvider {
  readonly id = "stripe";
  private readonly apiBaseUrl: string;
  private readonly requestTimeoutMs: number;

  constructor(private readonly options: StripeBillingCheckoutProviderOptions) {
    this.apiBaseUrl = (options.apiBaseUrl ?? "https://api.stripe.com").replace(/\/+$/g, "");
    this.requestTimeoutMs = options.requestTimeoutMs ?? 10_000;
  }

  async createCheckoutSession(input: {
    sessionId: string;
    ownerId: string;
    plan: BillingPlanRecord;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    checkoutUrl: string;
    externalSessionId?: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }> {
    const priceId = this.options.priceIds[input.plan.id];
    if (!priceId) {
      throw new Error(`Stripe price id is not configured for billing plan: ${input.plan.id}`);
    }
    if (!input.successUrl || !input.cancelUrl) {
      throw new Error("Stripe checkout requires successUrl and cancelUrl.");
    }

    const body = new URLSearchParams();
    body.set("mode", "subscription");
    body.set("success_url", input.successUrl);
    body.set("cancel_url", input.cancelUrl);
    body.set("client_reference_id", input.ownerId);
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
    body.set("metadata[ownerId]", input.ownerId);
    body.set("metadata[planId]", input.plan.id);
    body.set("metadata[localCheckoutSessionId]", input.sessionId);
    body.set("subscription_data[metadata][ownerId]", input.ownerId);
    body.set("subscription_data[metadata][planId]", input.plan.id);
    body.set("subscription_data[metadata][localCheckoutSessionId]", input.sessionId);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/checkout/sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "novel-game-maker/0.1"
        },
        body,
        signal: controller.signal
      });
      const payload = await response.json() as StripeCheckoutSessionResponse;
      if (!response.ok) {
        throw new Error(`Stripe checkout session failed: ${payload.error?.message ?? response.status}`);
      }
      if (!payload.id || !payload.url) {
        throw new Error("Stripe checkout session response did not include id and url.");
      }
      return {
        checkoutUrl: payload.url,
        externalSessionId: payload.id,
        expiresAt: typeof payload.expires_at === "number" ? new Date(payload.expires_at * 1000).toISOString() : undefined,
        metadata: {
          provider: this.id,
          stripePriceId: priceId,
          stripeMode: "subscription",
          ownerId: input.ownerId,
          planId: input.plan.id
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async createCustomerPortalSession(input: {
    sessionId: string;
    ownerId: string;
    subscription: BillingSubscriptionRecord;
    returnUrl?: string;
  }): Promise<{
    portalUrl: string;
    externalSessionId?: string;
    metadata?: Record<string, unknown>;
  }> {
    if (!input.subscription.externalCustomerId) {
      throw new Error("Stripe customer portal requires a billing subscription with an external customer id.");
    }
    if (!input.returnUrl) {
      throw new Error("Stripe customer portal requires returnUrl.");
    }

    const body = new URLSearchParams();
    body.set("customer", input.subscription.externalCustomerId);
    body.set("return_url", input.returnUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await fetch(`${this.apiBaseUrl}/v1/billing_portal/sessions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${this.options.secretKey}`,
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "novel-game-maker/0.1"
        },
        body,
        signal: controller.signal
      });
      const payload = await response.json() as StripePortalSessionResponse;
      if (!response.ok) {
        throw new Error(`Stripe customer portal session failed: ${payload.error?.message ?? response.status}`);
      }
      if (!payload.id || !payload.url) {
        throw new Error("Stripe customer portal response did not include id and url.");
      }
      return {
        portalUrl: payload.url,
        externalSessionId: payload.id,
        metadata: {
          provider: this.id,
          ownerId: input.ownerId,
          localPortalSessionId: input.sessionId,
          subscriptionId: input.subscription.id,
          externalCustomerId: input.subscription.externalCustomerId
        }
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
