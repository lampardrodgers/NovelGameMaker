import { mkdtemp, readFile, stat } from "node:fs/promises";
import { createHmac } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { sampleNovelText, type VNProject } from "@novel-game-maker/vn-core";
import { createPlatform } from "../createPlatform";
import { StripeBillingCheckoutProvider } from "../billing/StripeBillingCheckoutProvider";
import { MockOAuthLoginProvider } from "../services/OAuthService";
import type { ReleaseApprovalNotificationPayload, TeamInvitationNotificationPayload, UserAccountNotificationPayload } from "../types";
import { ContentSafetyBlockedError } from "../services/ContentSafetyService";
import { PROJECT_RELEASE_SUMMARY_METADATA_KEY } from "../services/ProjectDiffService";
import { ReleaseApprovalStaleError } from "../services/ReleaseApprovalService";
import { TeamInvitationExpiredError, TeamInvitationUnavailableError } from "../services/TeamInvitationService";
import { UserAccountLockedError, UserAccountSsoRequiredError, UserAccountValidationError, UserAuthenticationError, UserMfaRequiredError } from "../services/UserAccountService";
import { BillingEntitlementError } from "../services/GenerationJobService";
import { QuotaExceededError } from "../services/UsageService";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("vn-platform", () => {
  it("runs a novel-to-project job and persists the generated project", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    const job = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }
    });

    const completed = await platform.jobs.runJob(job);
    const projects = await platform.projects.listProjects("owner_test");

    expect(completed.status).toBe("succeeded");
    expect(completed.output?.projectId).toBe(projects[0]?.id);
    expect(projects[0]?.vnProject.characters.some((character) => character.name === "林雪")).toBe(true);
  });

  it("records usage, cost estimate, and audit events for a successful generation job", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      costPolicy: {
        textJobCostCents: 3,
        imageJobCostCents: 11
      }
    });
    const job = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }
    });

    await platform.jobs.runJob(job);
    const usage = await platform.usage.getDailySummary("owner_test");
    const audit = await platform.audit.listByOwner("owner_test");

    expect(usage.jobEnqueued).toBe(1);
    expect(usage.textJobEnqueued).toBe(1);
    expect(usage.jobSucceeded).toBe(1);
    expect(usage.estimatedCostCents).toBe(3);
    expect(audit.map((event) => event.action)).toContain("job_succeeded");
    expect(audit.map((event) => event.action)).toContain("project_created");
  });

  it("enforces daily text generation quotas before enqueueing jobs", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      quotaPolicy: {
        dailyJobLimit: 0,
        dailyTextJobLimit: 1,
        dailyImageJobLimit: 0
      }
    });
    await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "第一次",
        novelText: sampleNovelText
      }
    });

    await expect(
      platform.jobs.enqueue({
        kind: "novel_to_project",
        ownerId: "owner_test",
        input: {
          title: "第二次",
          novelText: sampleNovelText
        }
      })
    ).rejects.toThrow(QuotaExceededError);
    const usage = await platform.usage.getDailySummary("owner_test");

    expect(usage.textJobEnqueued).toBe(1);
  });

  it("creates hashed access tokens and rejects revoked or expired tokens", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    const created = await platform.accessTokens.createToken({
      role: "owner",
      ownerId: "owner_test",
      label: "Studio token"
    });
    const listed = await platform.accessTokens.listByOwner("owner_test");
    const authenticated = await platform.accessTokens.authenticate(created.token);
    await platform.accessTokens.revokeToken(created.record.id);
    const revoked = await platform.accessTokens.authenticate(created.token);
    const expired = await platform.accessTokens.createToken({
      role: "owner",
      ownerId: "owner_test",
      label: "Expired token",
      expiresAt: "2000-01-01T00:00:00.000Z"
    });

    expect(created.token).toMatch(/^vn_/);
    expect(created.record.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.record.tokenHash).not.toBe(created.token);
    expect(listed[0]?.tokenPrefix).toBe(created.token.slice(0, 12));
    expect(authenticated?.ownerId).toBe("owner_test");
    expect(authenticated?.lastUsedAt).toBeTruthy();
    expect(revoked).toBeUndefined();
    await expect(platform.accessTokens.authenticate(expired.token)).resolves.toBeUndefined();
  });

  it("manages billing plans, checkout sessions, subscription activation, and cancellation", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });

    const plans = await platform.billing.listPlans();
    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_test",
      planId: "pro",
      successUrl: "https://studio.example.com/billing/success",
      cancelUrl: "https://studio.example.com/billing/cancel"
    });
    const completed = await platform.billing.completeCheckout(checkout.id);
    const subscription = await platform.billing.getSubscription("owner_test");
    const portal = await platform.billing.createCustomerPortalSession({
      ownerId: "owner_test",
      returnUrl: "https://studio.example.com/billing/payment-method"
    });
    const sessions = await platform.billing.listCheckoutSessions("owner_test");
    const cancelled = await platform.billing.cancelSubscription("owner_test");
    const audit = await platform.audit.listByOwner("owner_test");

    expect(plans.map((plan) => plan.id)).toEqual(["free", "pro", "studio"]);
    expect(checkout.status).toBe("created");
    expect(checkout.checkoutUrl).toContain("https://billing.local/checkout/");
    expect(completed?.session.status).toBe("completed");
    expect(completed?.subscription.planId).toBe("pro");
    expect(subscription?.status).toBe("active");
    expect(subscription?.currentPeriodEnd).toBeTruthy();
    expect(portal?.portalUrl).toContain("https://billing.local/portal/");
    expect(portal?.subscriptionId).toBe(subscription?.id);
    expect(portal?.provider).toBe("mock");
    expect(sessions[0]?.id).toBe(checkout.id);
    expect(cancelled?.status).toBe("cancelled");
    expect(audit.map((event) => event.action)).toContain("billing_checkout_started");
    expect(audit.map((event) => event.action)).toContain("billing_subscription_activated");
    expect(audit.map((event) => event.action)).toContain("billing_payment_method_update_started");
    expect(audit.map((event) => event.action)).toContain("billing_subscription_cancelled");
  });

  it("creates Stripe checkout sessions through a replaceable billing provider", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = init?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      const params = body as URLSearchParams;
      expect(params.get("mode")).toBe("subscription");
      expect(params.get("line_items[0][price]")).toBe("price_pro_test");
      expect(params.get("metadata[ownerId]")).toBe("owner_test");
      expect(params.get("metadata[planId]")).toBe("pro");
      expect(String(init?.headers && (init.headers as Record<string, string>).authorization)).toBe("Bearer stripe-unit-secret");
      return new Response(JSON.stringify({
        id: "cs_test_123",
        object: "checkout.session",
        url: "https://checkout.stripe.com/c/pay/cs_test_123",
        expires_at: 1_800_000_000
      }), {
        status: 200,
        headers: {
          "content-type": "application/json"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      billingCheckoutProvider: new StripeBillingCheckoutProvider({
        secretKey: "stripe-unit-secret",
        priceIds: {
          pro: "price_pro_test"
        },
        apiBaseUrl: "https://stripe.test"
      })
    });

    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_test",
      planId: "pro",
      successUrl: "https://studio.example.com/billing/success",
      cancelUrl: "https://studio.example.com/billing/cancel"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://stripe.test/v1/checkout/sessions", expect.objectContaining({
      method: "POST"
    }));
    expect(checkout.checkoutUrl).toBe("https://checkout.stripe.com/c/pay/cs_test_123");
    expect(checkout.externalSessionId).toBe("cs_test_123");
    expect(checkout.expiresAt).toBe("2027-01-15T08:00:00.000Z");
    expect(JSON.stringify(checkout.metadata)).not.toContain("stripe-unit-secret");
  });

  it("creates Stripe customer portal sessions for payment method updates", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = init?.body;
      expect(body).toBeInstanceOf(URLSearchParams);
      const params = body as URLSearchParams;
      expect(String(init?.headers && (init.headers as Record<string, string>).authorization)).toBe("Bearer stripe-unit-secret");
      if (url === "https://stripe.test/v1/checkout/sessions") {
        return new Response(JSON.stringify({
          id: "cs_test_123",
          object: "checkout.session",
          url: "https://checkout.stripe.com/c/pay/cs_test_123"
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
      expect(url).toBe("https://stripe.test/v1/billing_portal/sessions");
      expect(params.get("customer")).toBe("cus_test_123");
      expect(params.get("return_url")).toBe("https://studio.example.com/billing/payment-method");
      return new Response(JSON.stringify({
        id: "bps_test_123",
        object: "billing_portal.session",
        url: "https://billing.stripe.com/p/session/bps_test_123"
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      billingCheckoutProvider: new StripeBillingCheckoutProvider({
        secretKey: "stripe-unit-secret",
        priceIds: {
          pro: "price_pro_test"
        },
        apiBaseUrl: "https://stripe.test"
      })
    });

    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_test",
      planId: "pro",
      successUrl: "https://studio.example.com/billing/success",
      cancelUrl: "https://studio.example.com/billing/cancel"
    });
    await platform.billing.completeCheckoutByExternalSessionId(checkout.externalSessionId ?? "", {
      externalCustomerId: "cus_test_123",
      externalSubscriptionId: "sub_test_123"
    });
    const portal = await platform.billing.createCustomerPortalSession({
      ownerId: "owner_test",
      returnUrl: "https://studio.example.com/billing/payment-method"
    });

    expect(fetchMock).toHaveBeenCalledWith("https://stripe.test/v1/billing_portal/sessions", expect.objectContaining({
      method: "POST"
    }));
    expect(portal?.portalUrl).toBe("https://billing.stripe.com/p/session/bps_test_123");
    expect(portal?.externalSessionId).toBe("bps_test_123");
    expect(JSON.stringify(portal?.metadata)).not.toContain("stripe-unit-secret");
  });

  it("records provider billing events and updates subscription payment state idempotently", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_test",
      planId: "pro"
    });
    await platform.billing.completeCheckoutByExternalSessionId(checkout.externalSessionId ?? "", {
      externalCustomerId: "cus_test_123",
      externalSubscriptionId: "sub_test_123"
    });

    const event = await platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: "invoice_payment_failed",
      externalEventId: "evt_invoice_failed",
      externalCustomerId: "cus_test_123",
      externalSubscriptionId: "sub_test_123",
      externalInvoiceId: "in_test_123",
      amountDueCents: 1900,
      amountPaidCents: 0,
      currency: "usd",
      status: "open",
      hostedInvoiceUrl: "https://invoice.stripe.test/in_test_123",
      occurredAt: "2026-06-08T00:00:00.000Z",
      updateSubscriptionStatus: "past_due"
    });
    const duplicate = await platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: "invoice_payment_failed",
      externalEventId: "evt_invoice_failed",
      externalSubscriptionId: "sub_test_123"
    });
    const refund = await platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: "refund_created",
      externalEventId: "evt_refund_created",
      externalCustomerId: "cus_test_123",
      externalChargeId: "ch_test_123",
      amountRefundedCents: 900,
      currency: "usd",
      status: "succeeded",
      occurredAt: "2026-06-08T00:00:00.000Z"
    });
    const subscription = await platform.billing.getSubscription("owner_test");
    const events = await platform.billing.listBillingEvents("owner_test");
    const refundEvent = events.find((item) => item.eventType === "refund_created");
    const failedInvoiceEvent = events.find((item) => item.eventType === "invoice_payment_failed");
    const audit = await platform.audit.listByOwner("owner_test");

    expect(event?.eventType).toBe("invoice_payment_failed");
    expect(event?.externalInvoiceId).toBe("in_test_123");
    expect(duplicate?.id).toBe(event?.id);
    expect(refund?.eventType).toBe("refund_created");
    expect(refund?.subscriptionId).toBe(subscription?.id);
    expect(refund?.externalSubscriptionId).toBe("sub_test_123");
    expect(subscription?.status).toBe("past_due");
    expect(events).toHaveLength(2);
    expect(refundEvent?.externalChargeId).toBe("ch_test_123");
    expect(refundEvent?.amountRefundedCents).toBe(900);
    expect(failedInvoiceEvent?.amountDueCents).toBe(1900);
    expect(audit.map((item) => item.action)).toContain("billing_provider_event_recorded");
  });

  it("blocks generation for past-due subscriptions after the billing grace period", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      billingEntitlementPolicy: {
        blockPastDue: true,
        pastDueGracePeriodMs: 0
      }
    });
    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_test",
      planId: "pro"
    });
    await platform.billing.completeCheckoutByExternalSessionId(checkout.externalSessionId ?? "", {
      externalCustomerId: "cus_test_123",
      externalSubscriptionId: "sub_test_123"
    });
    const queuedBeforePastDue = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "已排队任务",
        novelText: sampleNovelText
      }
    });
    await platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: "invoice_payment_failed",
      externalEventId: "evt_invoice_failed",
      externalSubscriptionId: "sub_test_123",
      updateSubscriptionStatus: "past_due"
    });

    await expect(platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "欠费新任务",
        novelText: sampleNovelText
      }
    })).rejects.toThrow(BillingEntitlementError);
    const blockedQueuedJob = await platform.jobs.runJob(queuedBeforePastDue);
    const usage = await platform.usage.getDailySummary("owner_test");
    const audit = await platform.audit.listByOwner("owner_test");

    expect(blockedQueuedJob.status).toBe("blocked");
    expect(blockedQueuedJob.error).toContain("past due");
    expect(usage.jobBlocked).toBe(1);
    expect(audit.map((item) => item.action)).toContain("job_blocked_billing_entitlement");
  });

  it("uses billing subscriptions to enforce generation quotas", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });

    await platform.jobs.enqueue(createAssetJob("owner_free", "asset_1"));
    await platform.jobs.enqueue(createAssetJob("owner_free", "asset_2"));
    await expect(platform.jobs.enqueue(createAssetJob("owner_free", "asset_3"))).rejects.toThrow(QuotaExceededError);

    const checkout = await platform.billing.startCheckout({
      ownerId: "owner_pro",
      planId: "pro"
    });
    await platform.billing.completeCheckout(checkout.id);
    await platform.jobs.enqueue(createAssetJob("owner_pro", "asset_1"));
    await platform.jobs.enqueue(createAssetJob("owner_pro", "asset_2"));
    await platform.jobs.enqueue(createAssetJob("owner_pro", "asset_3"));

    const freeUsage = await platform.usage.getDailySummary("owner_free");
    const proUsage = await platform.usage.getDailySummary("owner_pro");

    expect(freeUsage.imageJobEnqueued).toBe(2);
    expect(proUsage.imageJobEnqueued).toBe(3);
  });

  it("registers user accounts and authenticates hashed session tokens", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });

    const registered = await platform.userAccounts.register({
      email: "Editor@Example.COM",
      password: "correct-password",
      name: "Editor"
    });
    const loggedIn = await platform.userAccounts.login({
      email: "editor@example.com",
      password: "correct-password"
    });
    const otherUser = await platform.userAccounts.register({
      email: "other@example.com",
      password: "correct-password"
    });
    const authenticated = await platform.userAccounts.authenticate(loggedIn.sessionToken);
    const sessions = await platform.userAccounts.listSessions(registered.user.id);
    const forbiddenRevoke = await platform.userAccounts.revokeUserSession(otherUser.user.id, loggedIn.session.id);
    const stillAuthenticated = await platform.userAccounts.authenticate(loggedIn.sessionToken);
    const revokedOwnSession = await platform.userAccounts.revokeUserSession(registered.user.id, loggedIn.session.id);
    const afterRevoke = await platform.userAccounts.authenticate(loggedIn.sessionToken);

    expect(registered.user.email).toBe("editor@example.com");
    expect(registered.user.passwordHash).toMatch(/^scrypt\$/);
    expect(registered.user.passwordHash).not.toContain("correct-password");
    expect(registered.sessionToken).toMatch(/^vns_/);
    expect(registered.session.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(registered.session.tokenHash).not.toBe(registered.sessionToken);
    expect(loggedIn.user.lastLoginAt).toBeTruthy();
    expect(authenticated?.user.id).toBe(registered.user.id);
    expect(authenticated?.session.lastUsedAt).toBeTruthy();
    expect(sessions.map((session) => session.tokenPrefix)).toContain(registered.session.tokenPrefix);
    expect(forbiddenRevoke).toBeUndefined();
    expect(stillAuthenticated?.user.id).toBe(registered.user.id);
    expect(revokedOwnSession?.id).toBe(loggedIn.session.id);
    expect(revokedOwnSession?.revokedAt).toBeTruthy();
    expect(afterRevoke).toBeUndefined();
    await expect(platform.userAccounts.register({
      email: "editor@example.com",
      password: "another-password"
    })).rejects.toThrow(UserAccountValidationError);
    await expect(platform.userAccounts.login({
      email: "editor@example.com",
      password: "wrong-password"
    })).rejects.toThrow(UserAuthenticationError);
  });

  it("provisions and disables SCIM users while revoking active sessions", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });

    const provisioned = await platform.userAccounts.provisionScimUser({
      email: "Managed@Example.COM",
      name: "Managed Editor"
    });
    const disabled = await platform.userAccounts.provisionScimUser({
      email: "managed@example.com",
      active: false
    });
    const reenabled = await platform.userAccounts.provisionScimUser({
      email: "managed@example.com",
      active: true,
      name: "Managed Renamed"
    });
    const registered = await platform.userAccounts.register({
      email: "sessioned@example.com",
      password: "correct-password"
    });
    const loggedIn = await platform.userAccounts.login({
      email: "sessioned@example.com",
      password: "correct-password"
    });
    const disabledSessioned = await platform.userAccounts.disableScimUser({
      userId: registered.user.id
    });
    const afterDisable = await platform.userAccounts.authenticate(loggedIn.sessionToken);

    expect(provisioned.email).toBe("managed@example.com");
    expect(provisioned.emailVerifiedAt).toBeTruthy();
    expect(provisioned.passwordHash).toMatch(/^scrypt\$/);
    expect(disabled.id).toBe(provisioned.id);
    expect(disabled.disabledAt).toBeTruthy();
    expect(reenabled.id).toBe(provisioned.id);
    expect(reenabled.disabledAt).toBeUndefined();
    expect(reenabled.name).toBe("Managed Renamed");
    expect(disabledSessioned?.disabledAt).toBeTruthy();
    expect(afterDisable).toBeUndefined();
  });

  it("starts and completes mock OAuth login through persistent SSO identity binding", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      oauthProvider: new MockOAuthLoginProvider("https://auth.example.com/mock"),
      oauthPolicy: {
        enabled: true,
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        allowedReturnUrlOrigins: ["https://studio.example.com"],
        allowedEmailDomains: ["example.com"]
      }
    });

    const started = await platform.oauth.startLogin({
      returnUrl: "https://studio.example.com/projects"
    });
    const completed = await platform.oauth.completeLogin({
      state: started.state,
      code: "editor@example.com|Editor"
    });
    const authenticated = await platform.userAccounts.authenticate(completed.sessionToken);
    const identities = await platform.oauth.listIdentitiesForUser(completed.user.id);

    expect(started.authorizationUrl).toContain("https://auth.example.com/mock");
    expect(started.authorizationUrl).toContain("code_challenge=");
    expect(started.state).toMatch(/^vno_/);
    expect(completed.user.email).toBe("editor@example.com");
    expect(completed.user.emailVerifiedAt).toBeTruthy();
    expect(completed.identity.provider).toBe("mock");
    expect(completed.identity.subject).toBe("mock:editor@example.com");
    expect(authenticated?.user.id).toBe(completed.user.id);
    expect(identities[0]?.id).toBe(completed.identity.id);
    await expect(platform.oauth.completeLogin({
      state: started.state,
      code: "editor@example.com|Editor"
    })).rejects.toThrow("OAuth state has already been used.");
    const blocked = await platform.oauth.startLogin();
    await expect(platform.oauth.completeLogin({
      state: blocked.state,
      code: "editor@blocked.test|Blocked"
    })).rejects.toThrow("OAuth profile email domain is not allowed.");
  });

  it("requires SSO for managed email domains", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      userAccountAccessPolicy: {
        ssoRequiredEmailDomains: ["example.com"]
      },
      oauthProvider: new MockOAuthLoginProvider("https://auth.example.com/mock"),
      oauthPolicy: {
        enabled: true,
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        allowedEmailDomains: ["example.com"]
      }
    });

    await expect(platform.userAccounts.register({
      email: "editor@example.com",
      password: "correct-password"
    })).rejects.toThrow(UserAccountSsoRequiredError);

    const started = await platform.oauth.startLogin();
    const completed = await platform.oauth.completeLogin({
      state: started.state,
      code: "editor@example.com|Editor"
    });
    const authenticated = await platform.userAccounts.authenticate(completed.sessionToken);

    expect(completed.user.email).toBe("editor@example.com");
    expect(authenticated?.user.id).toBe(completed.user.id);
    await expect(platform.userAccounts.login({
      email: "editor@example.com",
      password: "correct-password"
    })).rejects.toThrow("SSO is required for this email domain.");
    await expect(platform.userAccounts.requestPasswordReset("editor@example.com")).rejects.toThrow("SSO is required for this email domain.");
  });

  it("maps OAuth provider groups to team roles without downgrading higher roles", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      oauthProvider: new MockOAuthLoginProvider("https://auth.example.com/mock"),
      oauthPolicy: {
        enabled: true,
        redirectUri: "https://api.example.com/v1/auth/oauth/callback",
        allowedEmailDomains: ["example.com"],
        groupRoleMappings: [
          { group: "vn-editors", teamId: "team_alpha", role: "editor" },
          { group: "vn-viewers", teamId: "team_alpha", role: "viewer" }
        ]
      }
    });
    await platform.teams.createTeam({
      id: "team_alpha",
      name: "Alpha Studio"
    });

    const started = await platform.oauth.startLogin();
    const completed = await platform.oauth.completeLogin({
      state: started.state,
      code: "grouped@example.com|Grouped|vn-editors,vn-viewers"
    });
    const member = await platform.teams.getMember("team_alpha", completed.user.id);
    const audit = await platform.audit.listByOwner("team_alpha");

    expect(member?.role).toBe("editor");
    expect(completed.mappedTeamMemberships?.[0]?.teamId).toBe("team_alpha");
    await expect(platform.teams.authorize({
      teamId: "team_alpha",
      userId: completed.user.id,
      requiredRole: "editor"
    })).resolves.toBe(true);
    expect(audit.map((event) => event.action)).toContain("oauth_group_role_mapping_applied");
  });

  it("enforces configurable password complexity policy", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      userAccountSecurityPolicy: {
        passwordMinLength: 10,
        passwordRequireNumber: true,
        passwordRequireSymbol: true,
        blockedPasswordTerms: ["password"]
      }
    });

    await expect(platform.userAccounts.register({
      email: "weak@example.com",
      password: "correct-password"
    })).rejects.toThrow("Password must include at least one number.");
    await expect(platform.userAccounts.register({
      email: "blocked@example.com",
      password: "Password1!"
    })).rejects.toThrow("Password contains a blocked common term.");

    const registered = await platform.userAccounts.register({
      email: "strong@example.com",
      password: "Stronger1!"
    });

    expect(registered.user.email).toBe("strong@example.com");
  });

  it("enables TOTP MFA with encrypted secret storage and requires MFA at login", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-08T00:00:00.000Z"));
    try {
      const platform = createPlatform({
        dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
        userAccountMfaPolicy: {
          enabled: true,
          issuer: "NovelGameMaker Test",
          secretEncryptionKey: "test-mfa-encryption-key-at-least-32-bytes"
        }
      });
      const registered = await platform.userAccounts.register({
        email: "mfa@example.com",
        password: "correct-password"
      });
      const setup = await platform.userAccounts.startMfaTotpSetup(registered.user.id);
      const storedAfterSetup = await platform.userAccounts.getUser(registered.user.id);
      const setupCode = createCurrentTotpCode(setup.secret);

	      const confirmed = await platform.userAccounts.confirmMfaTotpSetup({
	        userId: registered.user.id,
	        code: setupCode
	      });
	      const storedAfterConfirm = await platform.userAccounts.getUser(registered.user.id);
	      await expect(platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password"
      })).rejects.toThrow(UserMfaRequiredError);
	      const loggedIn = await platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: setupCode,
	        rememberMfaDevice: true
	      });
	      const storedAfterRememberDevice = await platform.userAccounts.getUser(registered.user.id);
	      const trustedDeviceLoggedIn = await platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaDeviceToken: loggedIn.mfaDeviceToken
	      });
	      await expect(platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: setupCode
	      })).rejects.toThrow(UserAuthenticationError);
	      const recoveryCode = confirmed.recoveryCodes[0]!;
	      const recoveryLoggedIn = await platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: recoveryCode
	      });
	      await expect(platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaCode: recoveryCode
	      })).rejects.toThrow(UserAuthenticationError);
	      const storedAfterRecoveryLogin = await platform.userAccounts.getUser(registered.user.id);
	      vi.setSystemTime(new Date("2026-06-08T00:00:30.000Z"));
	      const regenerated = await platform.userAccounts.regenerateMfaRecoveryCodes({
	        userId: registered.user.id,
	        password: "correct-password",
	        code: createCurrentTotpCode(setup.secret)
	      });
	      vi.setSystemTime(new Date("2026-06-08T00:01:00.000Z"));
	      const revokedDevices = await platform.userAccounts.revokeMfaTrustedDevices({
	        userId: registered.user.id,
	        password: "correct-password",
	        code: createCurrentTotpCode(setup.secret)
	      });
	      await expect(platform.userAccounts.login({
	        email: "mfa@example.com",
	        password: "correct-password",
	        mfaDeviceToken: loggedIn.mfaDeviceToken
	      })).rejects.toThrow(UserMfaRequiredError);
	      vi.setSystemTime(new Date("2026-06-08T00:01:30.000Z"));
	      const disabled = await platform.userAccounts.disableMfaTotp({
	        userId: registered.user.id,
	        password: "correct-password",
        code: createCurrentTotpCode(setup.secret)
      });
      const loggedInAfterDisable = await platform.userAccounts.login({
        email: "mfa@example.com",
        password: "correct-password"
      });
      const audit = (await platform.database!.read()).auditEvents;

      expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
	      expect(setup.otpauthUrl).toContain("otpauth://totp/");
	      expect(storedAfterSetup?.mfaTotpSecretEncrypted).toBeTruthy();
	      expect(storedAfterSetup?.mfaTotpSecretEncrypted).not.toContain(setup.secret);
	      expect(confirmed.user.mfaTotpEnabledAt).toBeTruthy();
	      expect(confirmed.recoveryCodes).toHaveLength(10);
	      expect(confirmed.recoveryCodes[0]).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}-[A-Z2-7]{5}$/);
	      expect(storedAfterConfirm?.mfaRecoveryCodeHashes).toHaveLength(10);
	      expect(JSON.stringify(storedAfterConfirm?.mfaRecoveryCodeHashes)).not.toContain(recoveryCode.replace(/-/g, ""));
	      expect(loggedIn.sessionToken).toMatch(/^vns_/);
	      expect(loggedIn.mfaDeviceToken).toMatch(/^vnd_/);
	      expect(storedAfterRememberDevice?.mfaTrustedDevices).toHaveLength(1);
	      expect(JSON.stringify(storedAfterRememberDevice?.mfaTrustedDevices)).not.toContain(loggedIn.mfaDeviceToken!);
	      expect(trustedDeviceLoggedIn.sessionToken).toMatch(/^vns_/);
	      expect(recoveryLoggedIn.sessionToken).toMatch(/^vns_/);
	      expect(storedAfterRecoveryLogin?.mfaRecoveryCodeHashes).toHaveLength(9);
	      expect(regenerated.recoveryCodes).toHaveLength(10);
	      expect(regenerated.recoveryCodes).not.toContain(recoveryCode);
	      expect(revokedDevices.mfaTrustedDevices).toBeUndefined();
	      expect(disabled.mfaTotpEnabledAt).toBeUndefined();
	      expect(disabled.mfaTotpSecretEncrypted).toBeUndefined();
	      expect(disabled.mfaRecoveryCodeHashes).toBeUndefined();
	      expect(loggedInAfterDisable.sessionToken).toMatch(/^vns_/);
	      expect(audit.map((event) => event.action)).toEqual(expect.arrayContaining([
	        "user_mfa_totp_setup_started",
	        "user_mfa_totp_enabled",
	        "user_mfa_recovery_code_used",
	        "user_mfa_recovery_codes_regenerated",
	        "user_mfa_trusted_device_created",
	        "user_mfa_trusted_device_used",
	        "user_mfa_trusted_devices_revoked",
	        "user_mfa_totp_failed",
	        "user_mfa_totp_disabled"
      ]));
    } finally {
      vi.useRealTimers();
    }
  });

  it("locks user logins after repeated failures and clears lockout on password reset", async () => {
    const notifications: UserAccountNotificationPayload[] = [];
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      userAccountSecurityPolicy: {
        passwordMinLength: 10,
        maxFailedLoginAttempts: 2,
        failedLoginLockoutMs: 60_000
      },
      userAccountNotifier: {
        id: "recording_user_account_webhook",
        async notify(input) {
          notifications.push(input);
        }
      }
    });

    const registered = await platform.userAccounts.register({
      email: "lockout@example.com",
      password: "correct-password"
    });

    await expect(platform.userAccounts.register({
      email: "short@example.com",
      password: "too-short"
    })).rejects.toThrow("Password must be at least 10 characters.");
    await expect(platform.userAccounts.login({
      email: "lockout@example.com",
      password: "wrong-password"
    })).rejects.toThrow(UserAuthenticationError);
    await expect(platform.userAccounts.login({
      email: "lockout@example.com",
      password: "wrong-password"
    })).rejects.toThrow(UserAuthenticationError);
    await expect(platform.userAccounts.login({
      email: "lockout@example.com",
      password: "correct-password"
    })).rejects.toThrow(UserAccountLockedError);

    const locked = await platform.userAccounts.getUser(registered.user.id);
    const audit = (await platform.database!.read()).auditEvents;
    await platform.userAccounts.requestPasswordReset("lockout@example.com");
    const reset = notifications.find((notification) => notification.event === "user_password_reset_requested")!;
    await platform.userAccounts.resetPassword({
      resetToken: reset.actionToken!,
      password: "new-correct-password"
    });
    const unlocked = await platform.userAccounts.getUser(registered.user.id);
    const loggedIn = await platform.userAccounts.login({
      email: "lockout@example.com",
      password: "new-correct-password"
    });

    expect(locked?.failedLoginCount).toBe(2);
    expect(locked?.lockedUntil).toBeTruthy();
    expect(audit.some((event) => event.action === "user_login_locked" && event.outcome === "failed")).toBe(true);
    expect(unlocked?.failedLoginCount).toBe(0);
    expect(unlocked?.lockedUntil).toBeUndefined();
    expect(loggedIn.sessionToken).toMatch(/^vns_/);
  });

  it("verifies user email and resets passwords through hashed action tokens", async () => {
    const notifications: UserAccountNotificationPayload[] = [];
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      userAccountNotifier: {
        id: "recording_user_account_webhook",
        async notify(input) {
          notifications.push(input);
        }
      }
    });

    const registered = await platform.userAccounts.register({
      email: "editor@example.com",
      password: "correct-password"
    });
    const verification = notifications.find((notification) => notification.event === "user_email_verification_requested");
    const verified = await platform.userAccounts.verifyEmail(verification!.actionToken!);
    await expect(platform.userAccounts.verifyEmail(verification!.actionToken!)).rejects.toThrow(UserAccountValidationError);

    await platform.userAccounts.requestPasswordReset("editor@example.com");
    const reset = notifications.find((notification) => notification.event === "user_password_reset_requested");
    await platform.userAccounts.resetPassword({
      resetToken: reset!.actionToken!,
      password: "new-password"
    });
    const oldSession = await platform.userAccounts.authenticate(registered.sessionToken);
    const loggedIn = await platform.userAccounts.login({
      email: "editor@example.com",
      password: "new-password"
    });

    expect(verification?.actionToken).toMatch(/^vne_/);
    expect(verification?.metadata?.tokenPrefix).toBe(verification?.actionToken?.slice(0, 12));
    expect(verification?.metadata).not.toHaveProperty("tokenHash");
    expect(verified.emailVerifiedAt).toBeTruthy();
    expect(reset?.actionToken).toMatch(/^vnr_/);
    expect(reset?.metadata?.tokenPrefix).toBe(reset?.actionToken?.slice(0, 12));
    expect(oldSession).toBeUndefined();
    expect(loggedIn.sessionToken).toMatch(/^vns_/);
    await expect(platform.userAccounts.login({
      email: "editor@example.com",
      password: "correct-password"
    })).rejects.toThrow(UserAuthenticationError);
    expect(notifications.map((notification) => notification.event)).toEqual(expect.arrayContaining([
      "user_email_verification_requested",
      "user_email_verified",
      "user_password_reset_requested",
      "user_password_reset_completed"
    ]));
  });

  it("authorizes team members by role hierarchy", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    const created = await platform.teams.createTeam({
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    });
    const editor = await platform.teams.upsertMember({
      teamId: "team_alpha",
      userId: "user_editor",
      role: "editor"
    });
    const viewer = await platform.teams.upsertMember({
      teamId: "team_alpha",
      userId: "user_viewer",
      role: "viewer"
    });
    const members = await platform.teams.listMembers("team_alpha");
    const ownerTeams = await platform.teams.listTeamsForUser("user_owner");

    await expect(platform.teams.authorize({
      teamId: "team_alpha",
      userId: "user_editor",
      requiredRole: "viewer"
    })).resolves.toBe(true);
    await expect(platform.teams.authorize({
      teamId: "team_alpha",
      userId: "user_editor",
      requiredRole: "editor"
    })).resolves.toBe(true);
    await expect(platform.teams.authorize({
      teamId: "team_alpha",
      userId: "user_viewer",
      requiredRole: "editor"
    })).resolves.toBe(false);
    await expect(platform.teams.authorize({
      teamId: "team_alpha",
      userId: "missing_user",
      requiredRole: "viewer"
    })).resolves.toBe(false);

    expect(created.team.id).toBe("team_alpha");
    expect(created.ownerMember?.role).toBe("owner");
    expect(editor.role).toBe("editor");
    expect(viewer.role).toBe("viewer");
    expect(members.map((member) => member.userId)).toEqual(expect.arrayContaining(["user_owner", "user_editor", "user_viewer"]));
    expect(ownerTeams[0]?.id).toBe("team_alpha");
  });

  it("creates, accepts, expires, and revokes team invitations without storing plaintext tokens", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    await platform.teams.createTeam({
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    });
    const created = await platform.teamInvitations.createInvitation({
      teamId: "team_alpha",
      email: "Editor@Example.COM",
      role: "editor",
      invitedBy: "user:user_owner"
    });
    const accepted = await platform.teamInvitations.acceptInvitation({
      invitationToken: created.invitationToken,
      userId: "user_editor"
    });
    const listed = await platform.teamInvitations.listByTeam("team_alpha");
    const audit = await platform.audit.listByOwner("team_alpha");
    const expired = await platform.teamInvitations.createInvitation({
      teamId: "team_alpha",
      email: "expired@example.com",
      role: "viewer",
      invitedBy: "user:user_owner",
      expiresAt: "2000-01-01T00:00:00.000Z"
    });
    const revoked = await platform.teamInvitations.createInvitation({
      teamId: "team_alpha",
      email: "revoked@example.com",
      role: "viewer",
      invitedBy: "user:user_owner"
    });
    await platform.teamInvitations.revokeInvitation(revoked.invitation.id, "user:user_owner");

    expect(created.invitationToken).toMatch(/^vni_/);
    expect(created.invitation.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(created.invitation.tokenHash).not.toBe(created.invitationToken);
    expect(created.invitation.tokenPrefix).toBe(created.invitationToken.slice(0, 12));
    expect(created.invitation.email).toBe("editor@example.com");
    expect(accepted.invitation.status).toBe("accepted");
    expect(accepted.member.userId).toBe("user_editor");
    expect(accepted.member.role).toBe("editor");
    expect(listed.find((invitation) => invitation.id === created.invitation.id)?.acceptedByUserId).toBe("user_editor");
    expect(audit.map((event) => event.action)).toEqual(expect.arrayContaining([
      "team_invitation_created",
      "team_invitation_accepted"
    ]));
    await expect(platform.teamInvitations.acceptInvitation({
      invitationToken: expired.invitationToken,
      userId: "user_expired"
    })).rejects.toThrow(TeamInvitationExpiredError);
    await expect(platform.teamInvitations.acceptInvitation({
      invitationToken: revoked.invitationToken,
      userId: "user_revoked"
    })).rejects.toThrow(TeamInvitationUnavailableError);
  });

  it("notifies external systems for team invitations without persisting plaintext tokens", async () => {
    const notifications: TeamInvitationNotificationPayload[] = [];
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      teamInvitationNotifier: {
        id: "recording_invitation_webhook",
        async notify(input) {
          notifications.push(input);
        }
      }
    });
    await platform.teams.createTeam({
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    });

    const created = await platform.teamInvitations.createInvitation({
      teamId: "team_alpha",
      email: "editor@example.com",
      role: "editor",
      invitedBy: "user:user_owner"
    });
    await platform.teamInvitations.acceptInvitation({
      invitationToken: created.invitationToken,
      userId: "user_editor"
    });

    expect(created.invitation.tokenHash).not.toBe(created.invitationToken);
    expect(notifications.map((notification) => notification.event)).toEqual([
      "team_invitation_created",
      "team_invitation_accepted"
    ]);
    expect(notifications[0]).toMatchObject({
      invitationId: created.invitation.id,
      teamId: "team_alpha",
      email: "editor@example.com",
      role: "editor",
      invitationToken: created.invitationToken
    });
    expect(notifications[0]?.metadata?.tokenPrefix).toBe(created.invitation.tokenPrefix);
    expect(notifications[0]?.metadata).not.toHaveProperty("tokenHash");
    expect(notifications[1]?.invitationToken).toBeUndefined();
    expect(notifications[1]?.acceptedByUserId).toBe("user_editor");
  });

  it("keeps team invitation creation alive when external notification fails", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      teamInvitationNotifier: {
        id: "failing_invitation_webhook",
        async notify() {
          throw new Error("Invitation webhook unavailable");
        }
      }
    });
    await platform.teams.createTeam({
      id: "team_alpha",
      name: "Alpha Studio",
      ownerUserId: "user_owner"
    });

    const created = await platform.teamInvitations.createInvitation({
      teamId: "team_alpha",
      email: "editor@example.com",
      role: "viewer",
      invitedBy: "user:user_owner"
    });
    const audit = await platform.audit.listByOwner("team_alpha");

    expect(created.invitation.status).toBe("pending");
    expect(created.invitationToken).toMatch(/^vni_/);
    expect(audit.map((event) => event.action)).toContain("team_invitation_notification_failed");
    expect(audit.find((event) => event.action === "team_invitation_notification_failed")?.details).toMatchObject({
      event: "team_invitation_created",
      provider: "failing_invitation_webhook",
      error: "Invitation webhook unavailable"
    });
  });

  it("blocks unsafe job input before enqueueing and records a content safety review", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      contentSafetyPolicy: {
        enabled: true,
        blockOnReview: false,
        blockedTerms: ["BLOCKED_CONTENT"],
        reviewTerms: []
      }
    });

    await expect(
      platform.jobs.enqueue({
        kind: "novel_to_project",
        ownerId: "owner_test",
        input: {
          title: "测试",
          novelText: "BLOCKED_CONTENT"
        }
      })
    ).rejects.toThrow(ContentSafetyBlockedError);
    const reviews = await platform.contentSafety.listByOwner("owner_test");
    const usage = await platform.usage.getDailySummary("owner_test");

    expect(reviews[0]?.decision).toBe("blocked");
    expect(reviews[0]?.source).toBe("novel_text");
    expect(reviews[0]?.matchedRules).toEqual(["blocked:BLOCKED_CONTENT"]);
    expect(reviews[0]?.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(usage.jobEnqueued).toBe(0);
  });

  it("marks a running job blocked when generated project content fails safety review", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      contentSafetyPolicy: {
        enabled: true,
        blockOnReview: false,
        blockedTerms: ["BLOCKED_CONTENT"],
        reviewTerms: []
      },
      projectGenerator: {
        id: "unsafe-project-generator",
        async createProject(input) {
          const project = createProjectFromNovel({
            title: input.title,
            novelText: input.novelText
          });
          project.chapters[0]!.scenes[0]!.shots[0]!.beats[0]!.line.text = "BLOCKED_CONTENT";
          return project;
        }
      }
    });
    const job = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "安全标题",
        novelText: sampleNovelText
      }
    });

    const blocked = await platform.jobs.runJob(job);
    const usage = await platform.usage.getDailySummary("owner_test");
    const audit = await platform.audit.listByOwner("owner_test");
    const reviews = await platform.contentSafety.listByOwner("owner_test");

    expect(blocked.status).toBe("blocked");
    expect(blocked.output?.decision).toBe("blocked");
    expect(usage.jobBlocked).toBe(1);
    expect(audit.map((event) => event.action)).toContain("job_blocked_content_safety");
    expect(reviews.some((review) => review.source === "project_json" && review.decision === "blocked")).toBe(true);
  });

  it("uses an injected project generator for novel-to-project jobs", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-platform-"));
    const platform = createPlatform({
      dataDir,
      projectGenerator: {
        id: "fake-project-generator",
        async createProject(input) {
          return {
            ...createProjectFromNovel({
              title: input.title,
              novelText: input.novelText,
              style: input.style
            }),
            title: "AI 生成项目"
          };
        }
      }
    });
    const job = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      }
    });

    const completed = await platform.jobs.runJob(job);
    const projects = await platform.projects.listProjects("owner_test");

    expect(completed.status).toBe("succeeded");
    expect(projects[0]?.title).toBe("AI 生成项目");
  });

  it("keeps asset generation queued behind credentials by default", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });
    const job = await platform.jobs.enqueue({
      kind: "asset_generation",
      ownerId: "owner_test",
      input: {
        assetId: "cg_phone_screen"
      }
    });

    const completed = await platform.jobs.runJob(job);

    expect(completed.status).toBe("waiting_for_credentials");
    expect(completed.error).toContain("AI image provider is disabled");
  });

  it("runs asset generation through an injected image provider and stores the result", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-platform-"));
    const platform = createPlatform({
      dataDir,
      aiEnabled: true,
      imageGenerator: {
        id: "fake-image-provider",
        async generateAsset(input) {
          return {
            src: `data:image/png;base64,${Buffer.from(`generated:${input.id}`).toString("base64")}`,
            provider: "fake-image-provider",
            mimeType: "image/png",
            revisedPrompt: "revised prompt"
          };
        }
      }
    });
    const job = await platform.jobs.enqueue({
      kind: "asset_generation",
      ownerId: "owner_test",
      projectId: "project_1",
      input: {
        assetId: "cg_phone_screen",
        kind: "cg",
        title: "手机屏幕亮起",
        prompt: "phone screen close-up"
      }
    });

    const completed = await platform.jobs.runJob(job);
    const assets = await platform.assets.listByProject("project_1");

    expect(completed.status).toBe("succeeded");
    expect(completed.output?.provider).toBe("fake-image-provider");
    expect(completed.output?.publicUrl).toContain("cg_phone_screen");
    expect(assets[0]?.assetId).toBe("cg_phone_screen");
    await expect(readFile(join(dataDir, "assets", assets[0]?.storageKey ?? ""), "utf-8")).resolves.toBe("generated:cg_phone_screen");
  });

  it("retries transient asset generation failures before marking the job failed", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      aiEnabled: true,
      retryPolicy: {
        maxAttempts: 2,
        retryDelayMs: 1
      },
      imageGenerator: {
        id: "flaky-image-provider",
        async generateAsset() {
          throw new Error("provider unavailable");
        }
      }
    });
    const job = await platform.jobs.enqueue({
      kind: "asset_generation",
      ownerId: "owner_test",
      projectId: "project_1",
      input: {
        assetId: "cg_phone_screen",
        kind: "cg"
      }
    });

    const retry = await platform.jobs.runJob(job);
    const failed = await platform.jobs.runJob(retry);
    const usage = await platform.usage.getDailySummary("owner_test");
    const audit = await platform.audit.listByOwner("owner_test");

    expect(retry.status).toBe("queued");
    expect(retry.attempts).toBe(1);
    expect(retry.nextRunAt).toBeTruthy();
    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(2);
    expect(usage.jobFailed).toBe(1);
    expect(audit.map((event) => event.action)).toContain("job_retry_scheduled");
    expect(audit.map((event) => event.action)).toContain("job_failed");
  });

  it("stores assets under the configured data directory", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-platform-"));
    const platform = createPlatform({ dataDir });

    const record = await platform.assets.store({
      projectId: "project_1",
      ownerId: "owner_test",
      assetId: "cg_phone_screen",
      fileName: "phone.svg",
      contentType: "image/svg+xml",
      bytes: new TextEncoder().encode("<svg />")
    });

    await expect(stat(join(dataDir, "assets", record.storageKey))).resolves.toBeTruthy();
    await expect(readFile(join(dataDir, "assets", record.storageKey), "utf-8")).resolves.toBe("<svg />");
    expect(record.publicUrl).toContain("cg_phone_screen");
  });

  it("publishes a project JSON with public asset URLs", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-platform-"));
    const purgedUrls: string[][] = [];
    const platform = createPlatform({
      dataDir,
      assetPublicBasePath: "https://api.example.com/assets",
      playerBaseUrl: "https://play.example.com",
      publicProjectBaseUrl: "https://api.example.com",
      deploymentCacheProvider: {
        id: "fake-cdn",
        async purge(input) {
          purgedUrls.push(input.urls);
          return { requestId: `purge_${purgedUrls.length}` };
        }
      }
    });
    const project = await platform.projects.createFromNovel({
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });

    const published = await platform.publishing.publishProject(project.id);
    const republished = await platform.publishing.publishProject(project.id);
    const releases = await platform.publishing.listReleases(project.id);
    const rolledBack = await platform.publishing.rollbackToRelease({
      projectId: project.id,
      releaseId: published.release.id
    });
    const assets = await platform.assets.listByProject(project.id);
    const invalidations = await platform.deployments.listByProject(project.id);
    const projectJsonText = await readFile(join(dataDir, "assets", published.projectJsonAsset.storageKey), "utf-8");
    const projectJson = JSON.parse(projectJsonText) as { assets: { items: Array<{ src: string }> } };
    const audit = await platform.audit.listByOwner("owner_test");
    const expectedCurrentProjectUrl = `https://api.example.com/v1/public/projects/${encodeURIComponent(project.id)}/project.vn.json`;

    expect(published.projectUrl).toContain("https://api.example.com/assets/");
    expect(published.playableUrl).toContain("https://play.example.com/?projectUrl=");
    expect(published.currentProjectUrl).toBe(expectedCurrentProjectUrl);
    expect(published.currentPlayableUrl).toBe(`https://play.example.com/?projectUrl=${encodeURIComponent(expectedCurrentProjectUrl)}`);
    expect(published.deploymentInvalidation?.status).toBe("succeeded");
    expect(published.project.publishedAt).toBeTruthy();
    expect(published.release.version).toBe(1);
    expect(republished.release.version).toBe(2);
    expect(releases.map((release) => release.version)).toEqual([2, 1]);
    expect(rolledBack.project.currentReleaseId).toBe(published.release.id);
    expect(rolledBack.release.version).toBe(1);
    expect(rolledBack.deploymentInvalidation?.reason).toBe("rollback");
    expect(purgedUrls.flat()).toContain(expectedCurrentProjectUrl);
    expect(invalidations.map((record) => record.reason)).toEqual(expect.arrayContaining(["publish", "rollback"]));
    expect(projectJson.assets.items.every((asset) => asset.src.startsWith("https://api.example.com/assets/"))).toBe(true);
    expect(assets.some((asset) => asset.assetId === "published_project_json")).toBe(true);
    expect(audit.map((event) => event.action)).toContain("project_published");
    expect(audit.map((event) => event.action)).toContain("project_release_rolled_back");
    expect(audit.map((event) => event.action)).toContain("deployment_cache_invalidated");
  });

  it("requests release approval and publishes through approval", async () => {
    const dataDir = await mkdtemp(join(tmpdir(), "vn-platform-"));
    const notifications: ReleaseApprovalNotificationPayload[] = [];
    const platform = createPlatform({
      dataDir,
      assetPublicBasePath: "https://api.example.com/assets",
      playerBaseUrl: "https://play.example.com",
      publicProjectBaseUrl: "https://api.example.com",
      releaseApprovalNotifier: {
        id: "recording",
        async notify(input) {
          notifications.push(input);
        }
      }
    });
    const project = await platform.projects.createFromNovel({
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });

    const approval = await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor",
      notes: "Ready for review"
    });
    const comment = await platform.releaseApprovals.addComment({
      approvalId: approval.id,
      author: "user:owner",
      body: "请确认第一幕 CG。"
    });
    const repeated = await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor"
    });
    const approved = await platform.releaseApprovals.approveAndPublish({
      approvalId: approval.id,
      reviewedBy: "user:owner",
      reviewNotes: "Approved"
    });
    const approvals = await platform.releaseApprovals.listByProject(project.id);
    const comments = await platform.releaseApprovals.listComments(approval.id);
    const audit = await platform.audit.listByOwner("owner_test");

    expect(approval.status).toBe("pending");
    expect(comment.body).toBe("请确认第一幕 CG。");
    expect(comments.map((item) => item.id)).toContain(comment.id);
    expect(repeated.id).toBe(approval.id);
    expect(approved.approval.status).toBe("published");
    expect(approved.approval.publishedReleaseId).toBe(approved.published.release.id);
    expect(approved.published.release.version).toBe(1);
    expect(approvals[0]?.status).toBe("published");
    expect(audit.map((event) => event.action)).toContain("release_approval_requested");
    expect(audit.map((event) => event.action)).toContain("release_approval_commented");
    expect(audit.map((event) => event.action)).toContain("release_approval_published");
    const deliveries = await platform.notifications.listByOwner("owner_test");
    expect(deliveries.map((delivery) => delivery.event)).toEqual(expect.arrayContaining([
      "release_approval_published",
      "release_approval_updated",
      "release_approval_commented",
      "release_approval_requested"
    ]));
    expect(deliveries).toHaveLength(4);
    expect(notifications).toEqual([]);
    await runAllNotifications(platform);
    expect(notifications.map((notification) => notification.event)).toEqual([
      "release_approval_requested",
      "release_approval_commented",
      "release_approval_updated",
      "release_approval_published"
    ]);
    expect(notifications.find((notification) => notification.event === "release_approval_commented")?.commentId).toBe(comment.id);
    expect(JSON.stringify(notifications)).not.toContain("请确认第一幕 CG。");
  });

  it("keeps release approval flow alive when notification delivery fails", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      notificationRetryPolicy: {
        maxAttempts: 1,
        retryDelayMs: 1
      },
      releaseApprovalNotifier: {
        id: "failing",
        async notify() {
          throw new Error("Webhook unavailable");
        }
      }
    });
    const project = await platform.projects.createFromNovel({
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });

    const approval = await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor",
      notes: "Ready for review"
    });
    const failed = await platform.notifications.runNext();
    const audit = await platform.audit.listByOwner("owner_test");

    expect(approval.status).toBe("pending");
    expect(failed?.status).toBe("failed");
    expect(audit.map((event) => event.action)).toContain("notification_delivery_failed");
    expect(audit.find((event) => event.action === "notification_delivery_failed")?.details?.error).toBe("Webhook unavailable");
  });

  it("diffs draft releases and blocks stale release approvals", async () => {
    const notifications: ReleaseApprovalNotificationPayload[] = [];
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      assetPublicBasePath: "https://api.example.com/assets",
      playerBaseUrl: "https://play.example.com",
      publicProjectBaseUrl: "https://api.example.com",
      releaseApprovalNotifier: {
        id: "recording",
        async notify(input) {
          notifications.push(input);
        }
      }
    });
    const project = await platform.projects.createFromNovel({
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    const published = await platform.publishing.publishProject(project.id);
    const editedProject = updateFirstBeat(project.vnProject, "实验室里的蓝光变成了刺眼的白色。");

    const saved = await platform.projects.saveProject({
      id: project.id,
      ownerId: project.ownerId,
      title: editedProject.title,
      source: "api",
      vnProject: editedProject
    });
    const diff = await platform.projectDiffs.diffCurrentDraft(project.id);
    const approval = await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor",
      notes: "Review edited text"
    });
    const changedAgain = updateFirstBeat(editedProject, "实验室里只剩下陌生的红光。");
    await platform.projects.saveProject({
      id: project.id,
      ownerId: project.ownerId,
      title: changedAgain.title,
      source: "api",
      vnProject: changedAgain
    });

    await expect(platform.releaseApprovals.approveAndPublish({
      approvalId: approval.id,
      reviewedBy: "user:owner"
    })).rejects.toThrow(ReleaseApprovalStaleError);

    const refreshed = await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor",
      notes: "Review latest text"
    });
    const approved = await platform.releaseApprovals.approveAndPublish({
      approvalId: refreshed.id,
      reviewedBy: "user:owner",
      reviewNotes: "Approved latest"
    });
    const audit = await platform.audit.listByOwner("owner_test");

    expect(published.release.metadata?.[PROJECT_RELEASE_SUMMARY_METADATA_KEY]).toBeTruthy();
    expect(saved.currentReleaseId).toBe(published.release.id);
    expect(saved.publishedProjectUrl).toBe(published.projectUrl);
    expect(diff.baseRelease?.version).toBe(1);
    expect(diff.changed).toBe(true);
    expect(diff.totals.changedBeats).toBe(1);
    expect(diff.beatChanges[0]?.previous).toContain("显示器的蓝光");
    expect(diff.beatChanges[0]?.current).toContain("刺眼的白色");
    expect(refreshed.id).toBe(approval.id);
    expect(approved.approval.status).toBe("published");
    expect(approved.published.release.version).toBe(2);
    expect(audit.map((event) => event.action)).toContain("release_approval_updated");
    expect(audit.map((event) => event.action)).toContain("release_approval_stale");
    await runAllNotifications(platform);
    expect(notifications.map((notification) => notification.event)).toContain("release_approval_stale");
  });

  it("rejects unsafe asset file names", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-"))
    });

    await expect(
      platform.assets.store({
        projectId: "project_1",
        ownerId: "owner_test",
        assetId: "..",
        fileName: ".",
        contentType: "image/svg+xml",
        bytes: new Uint8Array()
      })
    ).rejects.toThrow("Invalid storage segment");
  });

  it("summarizes owner operations across jobs, approvals, notifications, safety, and deployments", async () => {
    const platform = createPlatform({
      dataDir: await mkdtemp(join(tmpdir(), "vn-platform-")),
      retryPolicy: {
        maxAttempts: 1,
        retryDelayMs: 1
      },
      notificationRetryPolicy: {
        maxAttempts: 1,
        retryDelayMs: 1
      },
      contentSafetyPolicy: {
        enabled: true,
        blockOnReview: false,
        blockedTerms: ["BLOCKED_CONTENT"],
        reviewTerms: []
      },
      projectGenerator: {
        id: "failing-project-generator",
        createProject() {
          throw new Error("Model unavailable");
        }
      },
      releaseApprovalNotifier: {
        id: "release_approval_webhook",
        async notify() {
          throw new Error("Webhook unavailable");
        }
      },
      deploymentCacheProvider: {
        id: "cloudflare",
        async purge() {
          throw new Error("Purge unavailable");
        }
      }
    });
    const project = await platform.projects.saveProject({
      ownerId: "owner_test",
      title: "实验室里的蓝光",
      source: "api",
      vnProject: createProjectFromNovel({
        title: "实验室里的蓝光",
        novelText: sampleNovelText
      })
    });
    const job = await platform.jobs.enqueue({
      kind: "novel_to_project",
      ownerId: "owner_test",
      input: {
        title: "失败任务",
        novelText: sampleNovelText
      }
    });
    await platform.jobs.runJob(job);
    await platform.releaseApprovals.requestApproval({
      projectId: project.id,
      requestedBy: "user:editor",
      notes: "Ready for operations summary"
    });
    await platform.notifications.runNext();
    await expect(platform.contentSafety.assertApproved({
      ownerId: "owner_test",
      source: "novel_text",
      text: "BLOCKED_CONTENT",
      targetType: "manual_review"
    })).rejects.toThrow(ContentSafetyBlockedError);
    await platform.deployments.invalidate({
      ownerId: "owner_test",
      projectId: project.id,
      releaseId: "release_test",
      reason: "publish",
      urls: ["https://player.example.com/project.vn.json"]
    });

    const summary = await platform.operations.getOwnerSummary("owner_test", new Date("2026-06-08T00:00:00.000Z"));

    expect(summary.status).toBe("critical");
    expect(summary.counts.projects).toBe(1);
    expect(summary.counts.jobs.failed).toBe(1);
    expect(summary.counts.releaseApprovals.pending).toBe(1);
    expect(summary.counts.notificationDeliveries.failed).toBe(1);
    expect(summary.counts.contentSafety.blocked).toBe(1);
    expect(summary.counts.deploymentInvalidations.failed).toBe(1);
    expect(summary.recent.failedJobs[0]?.error).toBe("Model unavailable");
    expect(summary.recent.failedNotifications[0]?.error).toBe("Webhook unavailable");
    expect(summary.recent.failedDeployments[0]?.error).toBe("Purge unavailable");
    expect(summary.incidents.map((incident) => incident.source)).toEqual(expect.arrayContaining([
      "job",
      "notification",
      "content_safety",
      "deployment",
      "release_approval"
    ]));
  });
});

function updateFirstBeat(project: VNProject, text: string): VNProject {
  const next = JSON.parse(JSON.stringify(project)) as VNProject;
  next.chapters[0]!.scenes[0]!.shots[0]!.beats[0]!.line.text = text;
  next.updatedAt = new Date().toISOString();
  return next;
}

async function runAllNotifications(platform: ReturnType<typeof createPlatform>): Promise<void> {
  for (;;) {
    const delivery = await platform.notifications.runNext();
    if (!delivery) {
      return;
    }
  }
}

function createCurrentTotpCode(secret: string): string {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const counterBytes = Buffer.alloc(8);
  counterBytes.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", base32Decode(secret)).update(counterBytes).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const value = ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(value % 1_000_000).padStart(6, "0");
}

function createAssetJob(ownerId: string, assetId: string) {
  return {
    kind: "asset_generation" as const,
    ownerId,
    input: {
      assetId,
      title: assetId,
      prompt: "clean galgame production asset"
    }
  };
}

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let current = 0;
  const bytes: number[] = [];
  for (const char of value.replace(/=+$/g, "").toUpperCase()) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error("Invalid base32 test secret.");
    }
    current = (current << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((current >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}
