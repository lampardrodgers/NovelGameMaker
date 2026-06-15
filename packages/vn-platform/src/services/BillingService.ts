import type {
  BillingCheckoutProvider,
  BillingCheckoutSessionRecord,
  BillingCheckoutSessionRepository,
  BillingCustomerPortalSession,
  BillingEventRecord,
  BillingEventRepository,
  BillingProviderEventType,
  BillingPlanRecord,
  BillingPlanRepository,
  BillingSubscriptionRecord,
  BillingSubscriptionRepository,
  BillingSubscriptionStatus
} from "../types.js";
import { AuditService } from "./AuditService.js";

export const DEFAULT_BILLING_PLANS: BillingPlanRecord[] = [
  {
    id: "free",
    name: "Free",
    description: "本地试用和小样片验证。",
    priceCents: 0,
    currency: "USD",
    interval: "month",
    dailyJobLimit: 20,
    dailyTextJobLimit: 10,
    dailyImageJobLimit: 2,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "pro",
    name: "Pro",
    description: "面向独立创作者和小团队的商业制作额度。",
    priceCents: 1900,
    currency: "USD",
    interval: "month",
    dailyJobLimit: 1_000,
    dailyTextJobLimit: 500,
    dailyImageJobLimit: 100,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "studio",
    name: "Studio",
    description: "面向商业工作室的高配额生产套餐。",
    priceCents: 9_900,
    currency: "USD",
    interval: "month",
    dailyJobLimit: 10_000,
    dailyTextJobLimit: 5_000,
    dailyImageJobLimit: 1_000,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
];

export class MockBillingCheckoutProvider implements BillingCheckoutProvider {
  readonly id = "mock";

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
    return {
      checkoutUrl: `https://billing.local/checkout/${encodeURIComponent(input.sessionId)}`,
      externalSessionId: `mock_${input.sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: {
        provider: this.id,
        ownerId: input.ownerId,
        planId: input.plan.id,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl
      }
    };
  }

  async createCustomerPortalSession(input: {
    sessionId: string;
    ownerId: string;
    subscription: BillingSubscriptionRecord;
    returnUrl?: string;
  }): Promise<{
    portalUrl: string;
    externalSessionId?: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }> {
    return {
      portalUrl: `https://billing.local/portal/${encodeURIComponent(input.sessionId)}`,
      externalSessionId: `mock_portal_${input.sessionId}`,
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      metadata: {
        provider: this.id,
        ownerId: input.ownerId,
        subscriptionId: input.subscription.id,
        planId: input.subscription.planId,
        returnUrl: input.returnUrl
      }
    };
  }
}

export class BillingService {
  constructor(
    private readonly plans: BillingPlanRepository,
    private readonly subscriptions: BillingSubscriptionRepository,
    private readonly checkoutSessions: BillingCheckoutSessionRepository,
    private readonly billingEvents: BillingEventRepository,
    private readonly checkoutProvider: BillingCheckoutProvider = new MockBillingCheckoutProvider(),
    private readonly auditService?: AuditService
  ) {}

  async listPlans(): Promise<BillingPlanRecord[]> {
    await this.ensureDefaultPlans();
    return this.plans.listActive();
  }

  async getPlan(id: string): Promise<BillingPlanRecord | undefined> {
    await this.ensureDefaultPlans();
    return this.plans.getById(id);
  }

  async getSubscription(ownerId: string): Promise<BillingSubscriptionRecord | undefined> {
    return this.subscriptions.getByOwner(ownerId);
  }

  async listCheckoutSessions(ownerId: string, limit = 20): Promise<BillingCheckoutSessionRecord[]> {
    return this.checkoutSessions.listByOwner(ownerId, limit);
  }

  async listBillingEvents(ownerId: string, limit = 50): Promise<BillingEventRecord[]> {
    return this.billingEvents.listByOwner(ownerId, limit);
  }

  async getCheckoutSession(id: string): Promise<BillingCheckoutSessionRecord | undefined> {
    return this.checkoutSessions.getById(id);
  }

  async createCustomerPortalSession(input: {
    ownerId: string;
    returnUrl?: string;
  }): Promise<BillingCustomerPortalSession | undefined> {
    const subscription = await this.subscriptions.getByOwner(input.ownerId);
    if (!subscription) {
      return undefined;
    }
    const sessionId = createRecordId("portal");
    const providerSession = await this.checkoutProvider.createCustomerPortalSession({
      sessionId,
      ownerId: input.ownerId,
      subscription,
      returnUrl: input.returnUrl
    });
    const session: BillingCustomerPortalSession = {
      id: sessionId,
      ownerId: input.ownerId,
      subscriptionId: subscription.id,
      provider: this.checkoutProvider.id,
      portalUrl: providerSession.portalUrl,
      returnUrl: input.returnUrl,
      externalSessionId: providerSession.externalSessionId,
      createdAt: new Date().toISOString(),
      expiresAt: providerSession.expiresAt,
      metadata: providerSession.metadata
    };
    await this.auditService?.record({
      ownerId: input.ownerId,
      action: "billing_payment_method_update_started",
      targetType: "billing_subscription",
      targetId: subscription.id,
      details: {
        planId: subscription.planId,
        status: subscription.status,
        provider: session.provider,
        externalSessionId: session.externalSessionId
      }
    });
    return session;
  }

  async startCheckout(input: {
    ownerId: string;
    planId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<BillingCheckoutSessionRecord> {
    const plan = await this.getRequiredPlan(input.planId);
    if (plan.priceCents === 0) {
      const subscription = await this.activateSubscription({
        ownerId: input.ownerId,
        planId: plan.id,
        metadata: {
          source: "free_plan"
        }
      });
      const now = new Date().toISOString();
      const session = await this.checkoutSessions.create({
        id: createRecordId("checkout"),
        ownerId: input.ownerId,
        planId: plan.id,
        status: "completed",
        checkoutUrl: input.successUrl ?? "about:blank",
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        createdAt: now,
        updatedAt: now,
        completedAt: now,
        metadata: {
          subscriptionId: subscription.id,
          provider: "internal_free_plan"
        }
      });
      await this.auditService?.record({
        ownerId: input.ownerId,
        action: "billing_checkout_completed",
        targetType: "billing_checkout_session",
        targetId: session.id,
        details: {
          planId: plan.id,
          subscriptionId: subscription.id
        }
      });
      return session;
    }

    const sessionId = createRecordId("checkout");
    const providerSession = await this.checkoutProvider.createCheckoutSession({
      sessionId,
      ownerId: input.ownerId,
      plan,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl
    });
    const now = new Date().toISOString();
    const session = await this.checkoutSessions.create({
      id: sessionId,
      ownerId: input.ownerId,
      planId: plan.id,
      status: "created",
      checkoutUrl: providerSession.checkoutUrl,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      externalSessionId: providerSession.externalSessionId,
      createdAt: now,
      updatedAt: now,
      expiresAt: providerSession.expiresAt,
      metadata: providerSession.metadata
    });
    await this.auditService?.record({
      ownerId: input.ownerId,
      action: "billing_checkout_started",
      targetType: "billing_checkout_session",
      targetId: session.id,
      details: {
        planId: plan.id,
        provider: this.checkoutProvider.id,
        externalSessionId: session.externalSessionId
      }
    });
    return session;
  }

  async completeCheckout(sessionId: string): Promise<{
    session: BillingCheckoutSessionRecord;
    subscription: BillingSubscriptionRecord;
  } | undefined> {
    const existing = await this.checkoutSessions.getById(sessionId);
    if (!existing) {
      return undefined;
    }
    return this.completeCheckoutRecord(existing);
  }

  async completeCheckoutByExternalSessionId(
    externalSessionId: string,
    input: {
      externalCustomerId?: string;
      externalSubscriptionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{
    session: BillingCheckoutSessionRecord;
    subscription: BillingSubscriptionRecord;
  } | undefined> {
    const existing = await this.checkoutSessions.getByExternalSessionId(externalSessionId);
    if (!existing) {
      return undefined;
    }
    return this.completeCheckoutRecord(existing, input);
  }

  async updateSubscriptionFromExternal(input: {
    externalSubscriptionId: string;
    status?: BillingSubscriptionStatus;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    externalCustomerId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSubscriptionRecord | undefined> {
    const existing = await this.subscriptions.getByExternalSubscriptionId(input.externalSubscriptionId);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    const status = input.status ?? existing.status;
    const subscription = await this.subscriptions.upsert({
      ...existing,
      status,
      currentPeriodStart: input.currentPeriodStart ?? existing.currentPeriodStart,
      currentPeriodEnd: input.currentPeriodEnd ?? existing.currentPeriodEnd,
      cancelAtPeriodEnd: input.cancelAtPeriodEnd ?? existing.cancelAtPeriodEnd,
      externalCustomerId: input.externalCustomerId ?? existing.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId,
      updatedAt: now,
      cancelledAt: status === "cancelled" ? existing.cancelledAt ?? now : existing.cancelledAt,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(input.metadata ?? {})
      }
    });
    await this.auditService?.record({
      ownerId: subscription.ownerId,
      action: status === "cancelled" ? "billing_subscription_cancelled" : "billing_subscription_updated",
      targetType: "billing_subscription",
      targetId: subscription.id,
      details: {
        planId: subscription.planId,
        status: subscription.status,
        externalSubscriptionId: subscription.externalSubscriptionId
      }
    });
    return subscription;
  }

  async cancelSubscriptionByExternalSubscriptionId(
    externalSubscriptionId: string,
    metadata: Record<string, unknown> = {}
  ): Promise<BillingSubscriptionRecord | undefined> {
    return this.updateSubscriptionFromExternal({
      externalSubscriptionId,
      status: "cancelled",
      cancelAtPeriodEnd: false,
      metadata
    });
  }

  async recordProviderBillingEvent(input: {
    provider: string;
    eventType: BillingProviderEventType;
    externalEventId?: string;
    externalSubscriptionId?: string;
    externalCustomerId?: string;
    externalInvoiceId?: string;
    externalChargeId?: string;
    amountDueCents?: number;
    amountPaidCents?: number;
    amountRefundedCents?: number;
    amountDisputedCents?: number;
    currency?: string;
    status?: string;
    hostedInvoiceUrl?: string;
    invoicePdfUrl?: string;
    occurredAt?: string;
    checkoutSessionId?: string;
    updateSubscriptionStatus?: BillingSubscriptionStatus;
    currentPeriodStart?: string;
    currentPeriodEnd?: string;
    cancelAtPeriodEnd?: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<BillingEventRecord | undefined> {
    if (input.externalEventId) {
      const existingEvent = await this.billingEvents.getByExternalEventId(input.provider, input.externalEventId);
      if (existingEvent) {
        return existingEvent;
      }
    }
    if (!input.externalSubscriptionId && !input.externalCustomerId) {
      return undefined;
    }
    const existingSubscription = input.externalSubscriptionId
      ? await this.subscriptions.getByExternalSubscriptionId(input.externalSubscriptionId)
      : await this.subscriptions.getByExternalCustomerId(input.externalCustomerId!);
    if (!existingSubscription) {
      return undefined;
    }
    const subscription = input.updateSubscriptionStatus && input.externalSubscriptionId
      ? await this.updateSubscriptionFromExternal({
          externalSubscriptionId: input.externalSubscriptionId,
          status: input.updateSubscriptionStatus,
          currentPeriodStart: input.currentPeriodStart,
          currentPeriodEnd: input.currentPeriodEnd,
          cancelAtPeriodEnd: input.cancelAtPeriodEnd,
          externalCustomerId: input.externalCustomerId,
          metadata: {
            provider: input.provider,
            providerEventType: input.eventType,
            externalEventId: input.externalEventId,
            externalInvoiceId: input.externalInvoiceId
          }
        })
      : existingSubscription;
    if (!subscription) {
      return undefined;
    }
    const now = new Date().toISOString();
    const event = await this.billingEvents.create({
      id: createRecordId("billing_event"),
      ownerId: subscription.ownerId,
      provider: input.provider,
      eventType: input.eventType,
      externalEventId: input.externalEventId,
      subscriptionId: subscription.id,
      checkoutSessionId: input.checkoutSessionId,
      externalCustomerId: input.externalCustomerId ?? subscription.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId ?? subscription.externalSubscriptionId,
      externalInvoiceId: input.externalInvoiceId,
      externalChargeId: input.externalChargeId,
      amountDueCents: input.amountDueCents,
      amountPaidCents: input.amountPaidCents,
      amountRefundedCents: input.amountRefundedCents,
      amountDisputedCents: input.amountDisputedCents,
      currency: input.currency,
      status: input.status,
      hostedInvoiceUrl: input.hostedInvoiceUrl,
      invoicePdfUrl: input.invoicePdfUrl,
      occurredAt: input.occurredAt ?? now,
      createdAt: now,
      metadata: input.metadata
    });
    await this.auditService?.record({
      ownerId: event.ownerId,
      action: "billing_provider_event_recorded",
      targetType: "billing_event",
      targetId: event.id,
      details: {
        provider: event.provider,
        eventType: event.eventType,
        subscriptionId: event.subscriptionId,
        externalEventId: event.externalEventId,
        externalInvoiceId: event.externalInvoiceId
      }
    });
    return event;
  }

  private async completeCheckoutRecord(
    existing: BillingCheckoutSessionRecord,
    input: {
      externalCustomerId?: string;
      externalSubscriptionId?: string;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<{
    session: BillingCheckoutSessionRecord;
    subscription: BillingSubscriptionRecord;
  } | undefined> {
    if (existing.status === "completed") {
      const subscription = await this.subscriptions.getByOwner(existing.ownerId);
      if (!subscription) {
        return undefined;
      }
      return { session: existing, subscription };
    }
    if (existing.status !== "created") {
      throw new Error(`Cannot complete checkout session with status ${existing.status}.`);
    }
    const subscription = await this.activateSubscription({
      ownerId: existing.ownerId,
      planId: existing.planId,
      externalCustomerId: input.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId,
      metadata: {
        checkoutSessionId: existing.id,
        externalSessionId: existing.externalSessionId,
        provider: this.checkoutProvider.id,
        ...(input.metadata ?? {})
      }
    });
    const now = new Date().toISOString();
    const session = await this.checkoutSessions.update({
      ...existing,
      status: "completed",
      updatedAt: now,
      completedAt: now,
      metadata: {
        ...(existing.metadata ?? {}),
        ...(input.metadata ?? {}),
        subscriptionId: subscription.id,
        externalCustomerId: input.externalCustomerId,
        externalSubscriptionId: input.externalSubscriptionId
      }
    });
    await this.auditService?.record({
      ownerId: session.ownerId,
      action: "billing_checkout_completed",
      targetType: "billing_checkout_session",
      targetId: session.id,
      details: {
        planId: session.planId,
        subscriptionId: subscription.id
      }
    });
    return { session, subscription };
  }

  async cancelSubscription(ownerId: string): Promise<BillingSubscriptionRecord | undefined> {
    const existing = await this.subscriptions.getByOwner(ownerId);
    if (!existing) {
      return undefined;
    }
    const now = new Date().toISOString();
    const cancelled = await this.subscriptions.upsert({
      ...existing,
      status: "cancelled",
      cancelAtPeriodEnd: false,
      updatedAt: now,
      cancelledAt: existing.cancelledAt ?? now
    });
    await this.auditService?.record({
      ownerId,
      action: "billing_subscription_cancelled",
      targetType: "billing_subscription",
      targetId: cancelled.id,
      details: {
        planId: cancelled.planId
      }
    });
    return cancelled;
  }

  private async activateSubscription(input: {
    ownerId: string;
    planId: string;
    externalCustomerId?: string;
    externalSubscriptionId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<BillingSubscriptionRecord> {
    const plan = await this.getRequiredPlan(input.planId);
    const existing = await this.subscriptions.getByOwner(input.ownerId);
    const now = new Date();
    const currentPeriodStart = now.toISOString();
    const currentPeriodEnd = addInterval(now, plan.interval).toISOString();
    const subscription = await this.subscriptions.upsert({
      id: existing?.id ?? createRecordId("subscription"),
      ownerId: input.ownerId,
      planId: plan.id,
      status: "active",
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: false,
      externalCustomerId: input.externalCustomerId ?? existing?.externalCustomerId,
      externalSubscriptionId: input.externalSubscriptionId ?? existing?.externalSubscriptionId,
      createdAt: existing?.createdAt ?? currentPeriodStart,
      updatedAt: currentPeriodStart,
      metadata: {
        ...(existing?.metadata ?? {}),
        ...(input.metadata ?? {}),
        planName: plan.name
      }
    });
    await this.auditService?.record({
      ownerId: input.ownerId,
      action: "billing_subscription_activated",
      targetType: "billing_subscription",
      targetId: subscription.id,
      details: {
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd
      }
    });
    return subscription;
  }

  private async getRequiredPlan(planId: string): Promise<BillingPlanRecord> {
    const plan = await this.getPlan(planId);
    if (!plan || !plan.active) {
      throw new Error(`Billing plan not found: ${planId}`);
    }
    return plan;
  }

  private async ensureDefaultPlans(): Promise<void> {
    const existing = await this.plans.listActive();
    if (existing.length > 0) {
      return;
    }
    for (const plan of DEFAULT_BILLING_PLANS) {
      await this.plans.upsert(plan);
    }
  }
}

function addInterval(date: Date, interval: BillingPlanRecord["interval"]): Date {
  const next = new Date(date);
  if (interval === "year") {
    next.setUTCFullYear(next.getUTCFullYear() + 1);
    return next;
  }
  next.setUTCMonth(next.getUTCMonth() + 1);
  return next;
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
