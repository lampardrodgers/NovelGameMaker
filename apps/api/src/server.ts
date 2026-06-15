import { readFile } from "node:fs/promises";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import {
  BillingEntitlementError,
  ContentSafetyBlockedError,
  QuotaExceededError,
  ReleaseApprovalStaleError,
  TeamInvitationExpiredError,
  TeamInvitationUnavailableError,
  TeamInvitationValidationError,
  OAuthValidationError,
  UserAccountLockedError,
  UserAccountSsoRequiredError,
  UserAccountValidationError,
  UserAuthenticationError,
  UserMfaRequiredError,
  type AccessTokenRecord,
  type BillingSubscriptionStatus,
  type ContentSafetySource,
  type OAuthIdentityRecord,
  type TeamInvitationRecord,
  type TeamMemberRole,
  type UserAccountRecord,
  type UserSessionRecord,
  type VNPlatform
} from "@novel-game-maker/vn-platform";
import type { VNProject } from "@novel-game-maker/vn-core";
import type { ApiConfig } from "./config.js";
import { createApiPlatform } from "./platform.js";

export interface ApiServerOptions {
  config: ApiConfig;
  platform?: VNPlatform;
}

interface RequestContext {
  request: IncomingMessage;
  response: ServerResponse;
  url: URL;
  platform: VNPlatform;
  config: ApiConfig;
  auth: AuthContext;
  requestId: string;
  startedAt: number;
  authenticated: boolean;
}

type AuthContext =
  | { role: "admin" }
  | { role: "owner"; ownerId: string }
  | { role: "user"; userId: string; email?: string; sessionId?: string };

type PublicAccessTokenRecord = Omit<AccessTokenRecord, "tokenHash">;
type PublicOAuthIdentityRecord = Omit<OAuthIdentityRecord, "subject">;
type PublicTeamInvitationRecord = Omit<TeamInvitationRecord, "tokenHash">;
type PublicUserAccountRecord = Omit<UserAccountRecord, "passwordHash" | "failedLoginCount" | "lastFailedLoginAt" | "lockedUntil" | "mfaTotpSecretEncrypted" | "mfaTotpLastUsedCounter" | "mfaRecoveryCodeHashes" | "mfaTrustedDevices">;
type PublicUserSessionRecord = Omit<UserSessionRecord, "tokenHash">;

const SCIM_USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
const SCIM_LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
const SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig";
const SCIM_ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export function createApiServer(options: ApiServerOptions): Server {
  const platform = options.platform ?? createApiPlatform(options.config);
  const rateLimiter = new InMemoryRateLimiter(
    options.config.rateLimitWindowMs,
    options.config.rateLimitMaxRequests
  );
  const metrics = new HttpMetrics();

  return createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const requestId = readRequestId(request);
    const context: RequestContext = {
      request,
      response,
      url,
      platform,
      config: options.config,
      auth: { role: "admin" },
      requestId,
      startedAt: Date.now(),
      authenticated: false
    };
    setSecurityHeaders(response, requestId);
    response.once("finish", () => metrics.record(context));
    if (options.config.accessLogEnabled) {
      response.once("finish", () => logAccess(context));
    }

    try {
      setCors(response, options.config);
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (!rateLimiter.allow(clientKey(request))) {
        sendJson(response, 429, { error: "Rate limit exceeded." });
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          service: "novel-game-maker-api"
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/metrics" && options.config.metricsPublic) {
        sendMetrics(response, metrics);
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
        await sendLocalAsset(response, options.config, url.pathname.slice("/assets/".length));
        return;
      }

      if (url.pathname.startsWith("/v1/scim/v2")) {
        await handleScimRequest(context);
        return;
      }

      const publicProjectId = matchPath(url.pathname, /^\/v1\/public\/projects\/([^/]+)\/project\.vn\.json$/);
      if (request.method === "GET" && publicProjectId) {
        await sendPublicCurrentProject(response, platform, decodeURIComponent(publicProjectId));
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/register") {
        const body = await readJsonBody(context);
        const created = await platform.userAccounts.register({
          email: readString(body, "email"),
          password: readString(body, "password"),
          name: readOptionalString(body, "name")
        });
        sendJson(response, 201, {
          sessionToken: created.sessionToken,
          session: serializeUserSession(created.session),
          user: serializeUserAccount(created.user)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/login") {
        const body = await readJsonBody(context);
	        const loggedIn = await platform.userAccounts.login({
	          email: readString(body, "email"),
	          password: readString(body, "password"),
	          mfaCode: readOptionalString(body, "mfaCode"),
	          mfaDeviceToken: readOptionalString(body, "mfaDeviceToken"),
	          rememberMfaDevice: readOptionalBoolean(body, "rememberMfaDevice")
	        });
	        sendJson(response, 200, {
	          sessionToken: loggedIn.sessionToken,
	          mfaDeviceToken: loggedIn.mfaDeviceToken,
	          session: serializeUserSession(loggedIn.session),
	          user: serializeUserAccount(loggedIn.user)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/oauth/start") {
        const body = await readJsonBody(context);
        const started = await platform.oauth.startLogin({
          provider: readOptionalString(body, "provider"),
          returnUrl: readOptionalString(body, "returnUrl")
        });
        sendJson(response, 201, started);
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/oauth/callback") {
        const body = await readJsonBody(context);
        const completed = await platform.oauth.completeLogin({
          state: readString(body, "state"),
          code: readString(body, "code")
        });
        sendJson(response, 200, {
          sessionToken: completed.sessionToken,
          session: serializeUserSession(completed.session),
          user: serializeUserAccount(completed.user),
          identity: serializeOAuthIdentity(completed.identity),
          mappedTeamMemberships: completed.mappedTeamMemberships
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/v1/auth/oauth/callback") {
        const completed = await platform.oauth.completeLogin({
          state: readQueryString(url, "state"),
          code: readQueryString(url, "code")
        });
        sendJson(response, 200, {
          sessionToken: completed.sessionToken,
          session: serializeUserSession(completed.session),
          user: serializeUserAccount(completed.user),
          identity: serializeOAuthIdentity(completed.identity),
          mappedTeamMemberships: completed.mappedTeamMemberships
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/verify-email") {
        const body = await readJsonBody(context);
        const user = await platform.userAccounts.verifyEmail(readString(body, "verificationToken"));
        sendJson(response, 200, {
          user: serializeUserAccount(user)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/password-reset/request") {
        const body = await readJsonBody(context);
        await platform.userAccounts.requestPasswordReset(readString(body, "email"));
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/auth/password-reset/confirm") {
        const body = await readJsonBody(context);
        const user = await platform.userAccounts.resetPassword({
          resetToken: readString(body, "resetToken"),
          password: readString(body, "password")
        });
        sendJson(response, 200, {
          user: serializeUserAccount(user)
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/v1/billing/stripe/webhook") {
        await handleStripeBillingWebhook(context);
        return;
      }

      const auth = await authenticate(request, options.config, platform);
      if (!auth) {
        sendJson(response, 401, { error: "Unauthorized" });
        return;
      }
      context.auth = auth;
      context.authenticated = true;

      await route(context, metrics);
    } catch (error) {
      if (error instanceof BillingEntitlementError) {
        sendJson(response, 402, {
          error: error.message,
          billingEntitlement: error.details
        });
        return;
      }
      if (error instanceof QuotaExceededError) {
        sendJson(response, 429, { error: error.message });
        return;
      }
      if (error instanceof ContentSafetyBlockedError) {
        sendJson(response, 422, {
          error: error.message,
          review: {
            id: error.review.id,
            decision: error.review.decision,
            matchedRules: error.review.matchedRules
          }
        });
        return;
      }
      if (error instanceof ReleaseApprovalStaleError) {
        sendJson(response, 409, { error: error.message, approvalId: error.approvalId });
        return;
      }
      if (error instanceof TeamInvitationExpiredError || error instanceof TeamInvitationUnavailableError) {
        sendJson(response, 409, { error: error.message, invitationId: error.invitationId });
        return;
      }
      if (error instanceof TeamInvitationValidationError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      if (error instanceof OAuthValidationError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      if (error instanceof UserAuthenticationError) {
        sendJson(response, 401, { error: error.message });
        return;
      }
      if (error instanceof UserAccountLockedError) {
        sendJson(response, 423, { error: error.message, lockedUntil: error.lockedUntil });
        return;
      }
      if (error instanceof UserMfaRequiredError) {
        sendJson(response, 202, { error: error.message, mfaRequired: true, method: "totp" });
        return;
      }
      if (error instanceof UserAccountSsoRequiredError) {
        sendJson(response, 403, { error: error.message, ssoRequired: true, domain: error.domain });
        return;
      }
      if (error instanceof UserAccountValidationError) {
        sendJson(response, 400, { error: error.message });
        return;
      }
      if (error instanceof HttpError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      emitServerError(context, error);
      sendJson(response, 500, { error: "Internal server error" });
    }
  });
}

async function handleScimRequest(context: RequestContext): Promise<void> {
  const { request, response, url, platform, config } = context;
  if (!config.scim.enabled) {
    sendScimError(response, 404, "SCIM is not enabled.");
    return;
  }
  if (!authenticateScimRequest(request, config)) {
    response.setHeader("www-authenticate", "Bearer realm=\"scim\"");
    sendScimError(response, 401, "Unauthorized");
    return;
  }
  context.auth = { role: "admin" };
  context.authenticated = true;

  if (request.method === "GET" && url.pathname === "/v1/scim/v2/ServiceProviderConfig") {
    sendJson(response, 200, {
      schemas: [SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA],
      patch: { supported: true },
      bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
      filter: { supported: true, maxResults: 1 },
      changePassword: { supported: false },
      sort: { supported: false },
      etag: { supported: false },
      authenticationSchemes: [
        {
          type: "oauthbearertoken",
          name: "Bearer Token",
          description: "SCIM bearer token configured by SCIM_BEARER_TOKEN."
        }
      ]
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/v1/scim/v2/Users") {
    const email = parseScimUserFilter(url.searchParams.get("filter"));
    const user = email ? await platform.userAccounts.getUserByEmail(email) : undefined;
    const users = user ? [serializeScimUser(user, config)] : [];
    sendJson(response, 200, {
      schemas: [SCIM_LIST_RESPONSE_SCHEMA],
      totalResults: users.length,
      startIndex: 1,
      itemsPerPage: users.length,
      Resources: users
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/v1/scim/v2/Users") {
    const body = await readJsonBody(context);
    const input = readScimUserInput(body);
    const existing = await platform.userAccounts.getUserByEmail(input.email);
    const user = await platform.userAccounts.provisionScimUser(input);
    sendJson(response, existing ? 200 : 201, serializeScimUser(user, config));
    return;
  }

  const userId = matchPath(url.pathname, /^\/v1\/scim\/v2\/Users\/([^/]+)$/);
  if (!userId) {
    sendScimError(response, 404, "SCIM resource not found.");
    return;
  }

  if (request.method === "GET") {
    const user = await platform.userAccounts.getUser(userId);
    if (!user) {
      sendScimError(response, 404, "SCIM user not found.");
      return;
    }
    sendJson(response, 200, serializeScimUser(user, config));
    return;
  }

  if (request.method === "PATCH") {
    const existing = await platform.userAccounts.getUser(userId);
    if (!existing) {
      sendScimError(response, 404, "SCIM user not found.");
      return;
    }
    const patch = readScimPatchInput(await readJsonBody(context));
    let user = existing;
    if (patch.active === false) {
      user = await platform.userAccounts.disableScimUser({ userId }) ?? existing;
    } else if (patch.active === true || patch.name !== undefined) {
      user = await platform.userAccounts.provisionScimUser({
        email: existing.email,
        name: patch.name,
        active: patch.active ?? !existing.disabledAt
      });
    }
    sendJson(response, 200, serializeScimUser(user, config));
    return;
  }

  if (request.method === "DELETE") {
    const user = await platform.userAccounts.disableScimUser({ userId });
    if (!user) {
      sendScimError(response, 404, "SCIM user not found.");
      return;
    }
    sendJson(response, 200, serializeScimUser(user, config));
    return;
  }

  sendScimError(response, 405, "SCIM method is not supported.");
}

async function route(context: RequestContext, metrics: HttpMetrics): Promise<void> {
  const { request, response, url, platform } = context;
  const pathname = url.pathname;

  if (request.method === "GET" && pathname === "/metrics") {
    assertAdmin(context.auth);
    sendMetrics(response, metrics);
    return;
  }

  if (request.method === "GET" && pathname === "/v1/auth/me") {
    sendJson(response, 200, {
      auth: context.auth,
      user: context.auth.role === "user"
        ? serializeOptionalUserAccount(await platform.userAccounts.getUser(context.auth.userId))
        : undefined
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/auth/sessions") {
    if (context.auth.role !== "user") {
      throw new HttpError(403, "User token required.");
    }
    sendJson(response, 200, {
      sessions: (await platform.userAccounts.listSessions(context.auth.userId, readLimit(url, 50))).map(serializeUserSession)
    });
    return;
  }

  const revokeSessionId = matchPath(pathname, /^\/v1\/auth\/sessions\/([^/]+)\/revoke$/);
  if (request.method === "POST" && revokeSessionId) {
    if (context.auth.role !== "user") {
      throw new HttpError(403, "User token required.");
    }
    const session = await platform.userAccounts.revokeUserSession(context.auth.userId, decodeURIComponent(revokeSessionId));
    if (!session) {
      sendJson(response, 404, { error: "Session not found" });
      return;
    }
    sendJson(response, 200, {
      session: serializeUserSession(session)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/email-verification/request") {
    const body = await readJsonBody(context);
    const userId = readAuthUserId(context.auth, body);
    const token = await platform.userAccounts.requestEmailVerification(userId);
    sendJson(response, 200, {
      requested: Boolean(token)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/mfa/totp/setup") {
    const body = await readJsonBody(context);
    const setup = await platform.userAccounts.startMfaTotpSetup(readAuthUserId(context.auth, body));
    sendJson(response, 200, {
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
      user: serializeUserAccount(setup.user)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/mfa/totp/confirm") {
    const body = await readJsonBody(context);
    const confirmed = await platform.userAccounts.confirmMfaTotpSetup({
      userId: readAuthUserId(context.auth, body),
      code: readString(body, "code")
    });
    sendJson(response, 200, {
      recoveryCodes: confirmed.recoveryCodes,
      user: serializeUserAccount(confirmed.user)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/mfa/recovery-codes/regenerate") {
    const body = await readJsonBody(context);
    const regenerated = await platform.userAccounts.regenerateMfaRecoveryCodes({
      userId: readAuthUserId(context.auth, body),
      password: readString(body, "password"),
      code: readOptionalString(body, "code")
    });
    sendJson(response, 200, {
      recoveryCodes: regenerated.recoveryCodes,
      user: serializeUserAccount(regenerated.user)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/mfa/trusted-devices/revoke") {
    const body = await readJsonBody(context);
    const user = await platform.userAccounts.revokeMfaTrustedDevices({
      userId: readAuthUserId(context.auth, body),
      password: readString(body, "password"),
      code: readOptionalString(body, "code")
    });
    sendJson(response, 200, {
      user: serializeUserAccount(user)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/mfa/totp/disable") {
    const body = await readJsonBody(context);
    const user = await platform.userAccounts.disableMfaTotp({
      userId: readAuthUserId(context.auth, body),
      password: readString(body, "password"),
      code: readOptionalString(body, "code")
    });
    sendJson(response, 200, {
      user: serializeUserAccount(user)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/auth/logout") {
    const token = readBearerToken(request);
    const session = token ? await platform.userAccounts.logout(token) : undefined;
    sendJson(response, 200, {
      revoked: Boolean(session),
      session: session ? serializeUserSession(session) : undefined
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/usage") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      usage: await platform.usage.getDailySummary(ownerId),
      events: await platform.usage.listRecent(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/billing/plans") {
    sendJson(response, 200, {
      plans: await platform.billing.listPlans()
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/billing/subscription") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "viewer");
    sendJson(response, 200, {
      subscription: await platform.billing.getSubscription(ownerId)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/billing/checkout-sessions") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      checkoutSessions: await platform.billing.listCheckoutSessions(ownerId, readLimit(url, 20))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/billing/events") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      events: await platform.billing.listBillingEvents(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/billing/checkout") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    const planId = readString(body, "planId");
    await assertOwnerAccess(context, ownerId, "admin");
    if (!await platform.billing.getPlan(planId)) {
      sendJson(response, 404, { error: "Billing plan not found" });
      return;
    }
    const session = await platform.billing.startCheckout({
      ownerId,
      planId,
      successUrl: readOptionalString(body, "successUrl"),
      cancelUrl: readOptionalString(body, "cancelUrl")
    });
    sendJson(response, 201, { checkoutSession: session });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/billing/payment-method-session") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    const portalSession = await platform.billing.createCustomerPortalSession({
      ownerId,
      returnUrl: readOptionalString(body, "returnUrl")
    });
    if (!portalSession) {
      sendJson(response, 404, { error: "Billing subscription not found" });
      return;
    }
    sendJson(response, 201, { portalSession });
    return;
  }

  const completeCheckoutSessionId = matchPath(pathname, /^\/v1\/billing\/checkout-sessions\/([^/]+)\/complete$/);
  if (request.method === "POST" && completeCheckoutSessionId) {
    const existing = await platform.billing.getCheckoutSession(completeCheckoutSessionId);
    if (!existing) {
      sendJson(response, 404, { error: "Billing checkout session not found" });
      return;
    }
    assertAdmin(context.auth);
    const completed = await platform.billing.completeCheckout(existing.id);
    if (!completed) {
      sendJson(response, 404, { error: "Billing checkout session not found" });
      return;
    }
    sendJson(response, 200, completed);
    return;
  }

  if (request.method === "POST" && pathname === "/v1/billing/subscription/cancel") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    const subscription = await platform.billing.cancelSubscription(ownerId);
    if (!subscription) {
      sendJson(response, 404, { error: "Billing subscription not found" });
      return;
    }
    sendJson(response, 200, { subscription });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/audit") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      events: await platform.audit.listByOwner(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/ops/summary") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      summary: await platform.operations.getOwnerSummary(ownerId)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/content-safety") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      reviews: await platform.contentSafety.listByOwner(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/content-safety/review") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    const review = await platform.contentSafety.review({
      ownerId,
      source: readContentSafetySource(body, "source"),
      text: readString(body, "text"),
      targetType: readString(body, "targetType"),
      targetId: readOptionalString(body, "targetId"),
      metadata: readOptionalRecord(body, "metadata")
    });
    sendJson(response, 201, { review });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/deployment-invalidations") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "viewer");
    sendJson(response, 200, {
      invalidations: await platform.deployments.listByOwner(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/notification-deliveries") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      deliveries: await platform.notifications.listByOwner(ownerId, readLimit(url, 50))
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/teams") {
    assertAdmin(context.auth);
    const body = await readJsonBody(context);
    const created = await platform.teams.createTeam({
      id: readOptionalString(body, "id"),
      name: readString(body, "name"),
      ownerUserId: readOptionalString(body, "ownerUserId")
    });
    sendJson(response, 201, created);
    return;
  }

  if (request.method === "GET" && pathname === "/v1/teams") {
    const userId = requiredQuery(url, "userId");
    assertUserSelfOrAdmin(context.auth, userId);
    sendJson(response, 200, {
      teams: await platform.teams.listTeamsForUser(userId)
    });
    return;
  }

  const teamMembersId = matchPath(pathname, /^\/v1\/teams\/([^/]+)\/members$/);
  if (request.method === "GET" && teamMembersId) {
    await assertOwnerAccess(context, teamMembersId, "admin");
    sendJson(response, 200, {
      members: await platform.teams.listMembers(teamMembersId)
    });
    return;
  }

  if (request.method === "POST" && teamMembersId) {
    await assertOwnerAccess(context, teamMembersId, "admin");
    const body = await readJsonBody(context);
    const role = readTeamMemberRole(body, "role");
    const member = await platform.teams.upsertMember({
      teamId: teamMembersId,
      userId: readString(body, "userId"),
      role
    });
    sendJson(response, 201, { member });
    return;
  }

  const teamInvitationsId = matchPath(pathname, /^\/v1\/teams\/([^/]+)\/invitations$/);
  if (request.method === "GET" && teamInvitationsId) {
    await assertOwnerAccess(context, teamInvitationsId, "admin");
    sendJson(response, 200, {
      invitations: (await platform.teamInvitations.listByTeam(teamInvitationsId, readLimit(url, 50))).map(serializeTeamInvitation)
    });
    return;
  }

  if (request.method === "POST" && teamInvitationsId) {
    await assertOwnerAccess(context, teamInvitationsId, "admin");
    const body = await readJsonBody(context);
    const created = await platform.teamInvitations.createInvitation({
      teamId: teamInvitationsId,
      email: readString(body, "email"),
      role: readTeamMemberRole(body, "role"),
      invitedBy: actorLabel(context.auth),
      invitedUserId: readOptionalString(body, "invitedUserId"),
      expiresAt: readOptionalString(body, "expiresAt")
    });
    sendJson(response, 201, {
      invitationToken: created.invitationToken,
      invitation: serializeTeamInvitation(created.invitation)
    });
    return;
  }

  const revokeInvitationId = matchPath(pathname, /^\/v1\/team-invitations\/([^/]+)\/revoke$/);
  if (request.method === "POST" && revokeInvitationId) {
    const existing = await platform.teamInvitations.getInvitation(revokeInvitationId);
    if (!existing) {
      sendJson(response, 404, { error: "Team invitation not found" });
      return;
    }
    await assertOwnerAccess(context, existing.teamId, "admin");
    const revoked = await platform.teamInvitations.revokeInvitation(revokeInvitationId, actorLabel(context.auth));
    sendJson(response, 200, {
      invitation: revoked ? serializeTeamInvitation(revoked) : serializeTeamInvitation(existing)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/team-invitations/accept") {
    const body = await readJsonBody(context);
    const accepted = await platform.teamInvitations.acceptInvitation({
      invitationToken: readString(body, "invitationToken"),
      userId: readInvitationAcceptUserId(context.auth, body),
      userEmail: context.auth.role === "user" ? context.auth.email : undefined
    });
    sendJson(response, 200, {
      invitation: serializeTeamInvitation(accepted.invitation),
      member: accepted.member
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/access-tokens") {
    const body = await readJsonBody(context);
    const role = readString(body, "role");
    if (role !== "admin" && role !== "owner" && role !== "user") {
      throw new HttpError(400, "Expected role to be admin, owner, or user.");
    }
    const ownerId = readOptionalString(body, "ownerId");
    const userId = readOptionalString(body, "userId");
    if (role === "owner" && !ownerId) {
      throw new HttpError(400, "ownerId is required for owner tokens.");
    }
    if (role === "user" && !userId) {
      throw new HttpError(400, "userId is required for user tokens.");
    }
    if (role === "admin") {
      assertAdmin(context.auth);
    }
    if (role === "owner") {
      await assertOwnerAccess(context, ownerId!, "admin");
    }
    if (role === "user") {
      assertUserSelfOrAdmin(context.auth, userId!);
    }
    const created = await platform.accessTokens.createToken({
      role,
      ownerId,
      userId,
      label: readOptionalString(body, "label"),
      expiresAt: readOptionalString(body, "expiresAt")
    });
    sendJson(response, 201, {
      token: created.token,
      accessToken: serializeAccessToken(created.record)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/access-tokens") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "admin");
    sendJson(response, 200, {
      accessTokens: (await platform.accessTokens.listByOwner(ownerId, readLimit(url, 50))).map(serializeAccessToken)
    });
    return;
  }

  const revokeTokenId = matchPath(pathname, /^\/v1\/access-tokens\/([^/]+)\/revoke$/);
  if (request.method === "POST" && revokeTokenId) {
    const existing = await platform.accessTokens.getToken(revokeTokenId);
    if (!existing) {
      sendJson(response, 404, { error: "Access token not found" });
      return;
    }
    await assertAccessTokenAccess(context, existing);
    sendJson(response, 200, {
      accessToken: serializeAccessToken((await platform.accessTokens.revokeToken(revokeTokenId)) ?? existing)
    });
    return;
  }

  if (request.method === "GET" && pathname === "/v1/projects") {
    const ownerId = requiredQuery(url, "ownerId");
    await assertOwnerAccess(context, ownerId, "viewer");
    sendJson(response, 200, {
      projects: await platform.projects.listProjects(ownerId)
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/projects/from-novel") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "editor");
    const title = readString(body, "title");
    const novelText = readString(body, "novelText");
    const project = await platform.projects.createFromNovel({
      ownerId,
      title,
      novelText
    });
    sendJson(response, 201, { project });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/projects") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "editor");
    const title = readString(body, "title");
    const vnProject = readRecord(body, "vnProject");
    const existingProjectId = readOptionalString(body, "id");
    if (existingProjectId) {
      const existing = await platform.projects.getProject(existingProjectId);
      if (existing) {
        await assertOwnerAccess(context, existing.ownerId, "editor");
        if (existing.ownerId !== ownerId) {
          throw new HttpError(403, "Cannot change project owner.");
        }
      }
    }
    const project = await platform.projects.saveProject({
      id: existingProjectId,
      ownerId,
      title,
      source: "api",
      vnProject: vnProject as unknown as VNProject
    });
    sendJson(response, 201, { project });
    return;
  }

  const projectId = matchPath(pathname, /^\/v1\/projects\/([^/]+)$/);
  if (request.method === "GET" && projectId) {
    const project = await platform.projects.getProject(projectId);
    if (!project) {
      sendJson(response, 404, { error: "Project not found" });
      return;
    }
    await assertOwnerAccess(context, project.ownerId, "viewer");
    sendJson(response, 200, { project });
    return;
  }

  const projectAssetsId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/assets$/);
  if (request.method === "GET" && projectAssetsId) {
    await assertProjectAccess(context, projectAssetsId);
    sendJson(response, 200, {
      assets: await platform.assets.listByProject(projectAssetsId)
    });
    return;
  }

  const projectReleaseDiffId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/release-diff$/);
  if (request.method === "GET" && projectReleaseDiffId) {
    await assertProjectAccess(context, projectReleaseDiffId, "viewer");
    sendJson(response, 200, {
      diff: await platform.projectDiffs.diffCurrentDraft(projectReleaseDiffId)
    });
    return;
  }

  const publishProjectId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/publish$/);
  if (request.method === "POST" && publishProjectId) {
    await assertProjectAccess(context, publishProjectId, context.config.releaseApprovalRequired ? "admin" : "editor");
    const published = await platform.publishing.publishProject(publishProjectId);
    sendJson(response, 200, {
      project: published.project,
      projectUrl: published.projectUrl,
      playableUrl: published.playableUrl,
      currentProjectUrl: published.currentProjectUrl,
      currentPlayableUrl: published.currentPlayableUrl,
      publishedAt: published.publishedAt,
      release: published.release,
      deploymentInvalidation: published.deploymentInvalidation,
      projectJsonAsset: published.projectJsonAsset,
      assetRecords: published.assetRecords,
      publishedProject: published.publishedProject
    });
    return;
  }

  const releaseApprovalsProjectId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/release-approvals$/);
  if (request.method === "GET" && releaseApprovalsProjectId) {
    await assertProjectAccess(context, releaseApprovalsProjectId, "viewer");
    sendJson(response, 200, {
      approvals: await platform.releaseApprovals.listByProject(releaseApprovalsProjectId, readLimit(url, 20))
    });
    return;
  }

  if (request.method === "POST" && releaseApprovalsProjectId) {
    await assertProjectAccess(context, releaseApprovalsProjectId, "editor");
    const body = await readJsonBody(context);
    const approval = await platform.releaseApprovals.requestApproval({
      projectId: releaseApprovalsProjectId,
      requestedBy: actorLabel(context.auth),
      notes: readOptionalString(body, "notes")
    });
    sendJson(response, 201, { approval });
    return;
  }

  const projectDeploymentInvalidationsId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/deployment-invalidations$/);
  if (request.method === "GET" && projectDeploymentInvalidationsId) {
    await assertProjectAccess(context, projectDeploymentInvalidationsId, "viewer");
    sendJson(response, 200, {
      invalidations: await platform.deployments.listByProject(projectDeploymentInvalidationsId, readLimit(url, 20))
    });
    return;
  }

  const projectReleasesId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/releases$/);
  if (request.method === "GET" && projectReleasesId) {
    await assertProjectAccess(context, projectReleasesId, "viewer");
    sendJson(response, 200, {
      releases: await platform.publishing.listReleases(projectReleasesId, readLimit(url, 20))
    });
    return;
  }

  const rollbackProjectId = matchPath(pathname, /^\/v1\/projects\/([^/]+)\/rollback$/);
  if (request.method === "POST" && rollbackProjectId) {
    await assertProjectAccess(context, rollbackProjectId, "editor");
    const body = await readJsonBody(context);
    const rolledBack = await platform.publishing.rollbackToRelease({
      projectId: rollbackProjectId,
      releaseId: readString(body, "releaseId")
    });
    sendJson(response, 200, rolledBack);
    return;
  }

  const releaseApprovalAction = matchPathGroups(pathname, /^\/v1\/release-approvals\/([^/]+)\/(approve|reject)$/);
  if (request.method === "POST" && releaseApprovalAction) {
    const approvalId = releaseApprovalAction[0]!;
    const action = releaseApprovalAction[1]!;
    const approval = await platform.releaseApprovals.getById(approvalId);
    if (!approval) {
      sendJson(response, 404, { error: "Release approval not found" });
      return;
    }
    await assertOwnerAccess(context, approval.ownerId, "admin");
    const body = await readJsonBody(context);
    if (action === "approve") {
      const approved = await platform.releaseApprovals.approveAndPublish({
        approvalId,
        reviewedBy: actorLabel(context.auth),
        reviewNotes: readOptionalString(body, "reviewNotes")
      });
      sendJson(response, 200, approved);
      return;
    }
    const rejected = await platform.releaseApprovals.reject({
      approvalId,
      reviewedBy: actorLabel(context.auth),
      reviewNotes: readOptionalString(body, "reviewNotes")
    });
    sendJson(response, 200, { approval: rejected });
    return;
  }

  const releaseApprovalCommentsId = matchPath(pathname, /^\/v1\/release-approvals\/([^/]+)\/comments$/);
  if ((request.method === "GET" || request.method === "POST") && releaseApprovalCommentsId) {
    const approval = await platform.releaseApprovals.getById(releaseApprovalCommentsId);
    if (!approval) {
      sendJson(response, 404, { error: "Release approval not found" });
      return;
    }
    if (request.method === "GET") {
      await assertOwnerAccess(context, approval.ownerId, "viewer");
      sendJson(response, 200, {
        comments: await platform.releaseApprovals.listComments(approval.id, readLimit(url, 50))
      });
      return;
    }
    await assertOwnerAccess(context, approval.ownerId, "editor");
    const body = await readJsonBody(context);
    const commentBody = readString(body, "body").trim();
    if (!commentBody) {
      throw new HttpError(400, "Release approval comment body is required.");
    }
    const comment = await platform.releaseApprovals.addComment({
      approvalId: approval.id,
      author: actorLabel(context.auth),
      body: commentBody
    });
    sendJson(response, 201, { comment });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/assets") {
    const body = await readJsonBody(context);
    const asset = await platform.assets.store({
      ownerId: await assertAndReadOwner(context, body),
      projectId: await assertAndReadProjectId(context, body),
      assetId: readString(body, "assetId"),
      fileName: readString(body, "fileName"),
      contentType: readString(body, "contentType"),
      bytes: decodeBase64(readString(body, "base64"))
    });
    sendJson(response, 201, { asset });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/jobs") {
    const body = await readJsonBody(context);
    const ownerId = readString(body, "ownerId");
    await assertOwnerAccess(context, ownerId, "editor");
    const kind = readString(body, "kind");
    if (kind !== "novel_to_project" && kind !== "asset_generation") {
      sendJson(response, 400, { error: `Unsupported job kind: ${kind}` });
      return;
    }
    const projectId = readOptionalString(body, "projectId");
    if (projectId) {
      await assertProjectAccess(context, projectId, "editor");
    }
    const job = await platform.jobs.enqueue({
      ownerId,
      kind,
      projectId,
      input: readRecord(body, "input")
    });
    sendJson(response, 201, { job });
    return;
  }

  const jobId = matchPath(pathname, /^\/v1\/jobs\/([^/]+)$/);
  if (request.method === "GET" && jobId) {
    const job = await platform.jobs.getJob(jobId);
    if (!job) {
      sendJson(response, 404, { error: "Job not found" });
      return;
    }
    await assertOwnerAccess(context, job.ownerId, "viewer");
    sendJson(response, 200, { job });
    return;
  }

  const runJobId = matchPath(pathname, /^\/v1\/jobs\/([^/]+)\/run$/);
  if (request.method === "POST" && runJobId) {
    const job = await platform.jobs.getJob(runJobId);
    if (!job) {
      sendJson(response, 404, { error: "Job not found" });
      return;
    }
    await assertOwnerAccess(context, job.ownerId, "editor");
    sendJson(response, 200, { job: await platform.jobs.runJob(job) });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/jobs/run-next") {
    assertAdmin(context.auth);
    sendJson(response, 200, {
      job: await platform.jobs.runNext()
    });
    return;
  }

  if (request.method === "POST" && pathname === "/v1/notification-deliveries/run-next") {
    assertAdmin(context.auth);
    sendJson(response, 200, {
      delivery: await platform.notifications.runNext()
    });
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function handleStripeBillingWebhook(context: RequestContext): Promise<void> {
  const stripe = context.config.stripeBilling;
  if (context.config.billingCheckoutProvider !== "stripe" || !stripe) {
    throw new HttpError(404, "Stripe billing webhook is not configured.");
  }
  const rawBody = await readRawBody(context);
  const signature = readSingleHeader(context.request.headers["stripe-signature"]);
  if (!signature) {
    throw new HttpError(400, "Missing Stripe signature.");
  }
  verifyStripeSignature({
    rawBody,
    signatureHeader: signature,
    webhookSecret: stripe.webhookSecret,
    toleranceSeconds: stripe.webhookToleranceSeconds
  });

  let event: Record<string, unknown>;
  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Expected object.");
    }
    event = parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Invalid Stripe webhook JSON.");
  }

  const eventType = readOptionalRecordString(event, "type") ?? "unknown";
  const eventId = readOptionalRecordString(event, "id");
  const data = readOptionalRecord(event, "data");
  const object = data ? readOptionalRecord(data, "object") : undefined;
  let handled = false;
  let targetId: string | undefined;

  if (eventType === "checkout.session.completed" && object) {
    const externalSessionId = readOptionalRecordString(object, "id");
    if (!externalSessionId) {
      throw new HttpError(400, "Stripe checkout session event is missing object id.");
    }
    const completed = await context.platform.billing.completeCheckoutByExternalSessionId(externalSessionId, {
      externalCustomerId: stripeObjectId(object.customer),
      externalSubscriptionId: stripeObjectId(object.subscription),
      metadata: {
        provider: "stripe",
        stripeEventId: eventId,
        stripeEventType: eventType,
        stripePaymentStatus: readOptionalRecordString(object, "payment_status")
      }
    });
    handled = Boolean(completed);
    targetId = completed?.subscription.id;
  } else if ((eventType === "customer.subscription.updated" || eventType === "customer.subscription.deleted") && object) {
    const externalSubscriptionId = readOptionalRecordString(object, "id");
    if (!externalSubscriptionId) {
      throw new HttpError(400, "Stripe subscription event is missing object id.");
    }
    const subscription = await context.platform.billing.updateSubscriptionFromExternal({
      externalSubscriptionId,
      status: eventType === "customer.subscription.deleted"
        ? "cancelled"
        : mapStripeSubscriptionStatus(readOptionalRecordString(object, "status")),
      currentPeriodStart: isoFromStripeUnix(object.current_period_start),
      currentPeriodEnd: isoFromStripeUnix(object.current_period_end),
      cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : undefined,
      externalCustomerId: stripeObjectId(object.customer),
      metadata: {
        provider: "stripe",
        stripeEventId: eventId,
        stripeEventType: eventType
      }
    });
    handled = Boolean(subscription);
    targetId = subscription?.id;
  } else if (
    (eventType === "invoice.paid"
      || eventType === "invoice.payment_failed"
      || eventType === "invoice.payment_action_required")
    && object
  ) {
    const externalSubscriptionId = stripeObjectId(object.subscription);
    if (!externalSubscriptionId) {
      throw new HttpError(400, "Stripe invoice event is missing subscription id.");
    }
    const event = await context.platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: mapStripeInvoiceEventType(eventType),
      externalEventId: eventId,
      externalCustomerId: stripeObjectId(object.customer),
      externalSubscriptionId,
      externalInvoiceId: readOptionalRecordString(object, "id"),
      amountDueCents: readOptionalNumber(object, "amount_due"),
      amountPaidCents: readOptionalNumber(object, "amount_paid"),
      currency: readOptionalRecordString(object, "currency"),
      status: readOptionalRecordString(object, "status"),
      hostedInvoiceUrl: readOptionalRecordString(object, "hosted_invoice_url"),
      invoicePdfUrl: readOptionalRecordString(object, "invoice_pdf"),
      occurredAt: isoFromStripeUnix(object.created),
      updateSubscriptionStatus: eventType === "invoice.paid" ? "active" : "past_due",
      currentPeriodStart: isoFromStripeUnix(object.period_start),
      currentPeriodEnd: isoFromStripeUnix(object.period_end),
      metadata: {
        provider: "stripe",
        stripeEventId: eventId,
        stripeEventType: eventType,
        billingReason: readOptionalRecordString(object, "billing_reason")
      }
    });
    handled = Boolean(event);
    targetId = event?.id;
  } else if (
    (eventType === "charge.refunded"
      || eventType === "charge.dispute.created"
      || eventType === "charge.dispute.closed")
    && object
  ) {
    const externalChargeId = eventType === "charge.refunded"
      ? readOptionalRecordString(object, "id")
      : stripeObjectId(object.charge);
    const externalCustomerId = stripeObjectId(object.customer) ?? stripeObjectCustomerId(object.charge);
    if (!externalCustomerId) {
      throw new HttpError(400, "Stripe refund or dispute event is missing customer id.");
    }
    const event = await context.platform.billing.recordProviderBillingEvent({
      provider: "stripe",
      eventType: mapStripeFinancialEventType(eventType),
      externalEventId: eventId,
      externalCustomerId,
      externalChargeId,
      amountRefundedCents: eventType === "charge.refunded" ? readOptionalNumber(object, "amount_refunded") : undefined,
      amountDisputedCents: eventType !== "charge.refunded" ? readOptionalNumber(object, "amount") : undefined,
      currency: readOptionalRecordString(object, "currency"),
      status: readOptionalRecordString(object, "status"),
      occurredAt: isoFromStripeUnix(object.created),
      metadata: {
        provider: "stripe",
        stripeEventId: eventId,
        stripeEventType: eventType,
        disputeReason: readOptionalRecordString(object, "reason"),
        disputeId: eventType === "charge.refunded" ? undefined : readOptionalRecordString(object, "id")
      }
    });
    handled = Boolean(event);
    targetId = event?.id;
  }

  sendJson(context.response, 200, {
    received: true,
    handled,
    eventType,
    targetId
  });
}

async function readRawBody(context: RequestContext): Promise<string> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of context.request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > context.config.requestBodyLimitBytes) {
      throw new HttpError(413, "Request body exceeds limit.");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function readJsonBody(context: RequestContext): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of context.request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > context.config.requestBodyLimitBytes) {
      throw new HttpError(413, "Request body exceeds limit.");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf-8")) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON body.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HttpError(400, "Expected JSON object body.");
  }
  return parsed as Record<string, unknown>;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function sendMetrics(response: ServerResponse, metrics: HttpMetrics): void {
  response.writeHead(200, {
    "content-type": "text/plain; version=0.0.4; charset=utf-8"
  });
  response.end(metrics.render());
}

function readRequestId(request: IncomingMessage): string {
  const header = request.headers["x-request-id"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value && /^[A-Za-z0-9._:-]{8,128}$/.test(value)) {
    return value;
  }
  return randomUUID();
}

function setSecurityHeaders(response: ServerResponse, requestId: string): void {
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
}

function logAccess(context: RequestContext): void {
  console.log(JSON.stringify({
    event: "http_request",
    requestId: context.requestId,
    method: context.request.method,
    path: context.url.pathname,
    statusCode: context.response.statusCode,
    durationMs: Date.now() - context.startedAt,
    authRole: metricAuthRole(context)
  }));
}

function emitServerError(context: RequestContext, error: unknown): void {
  const event = buildServerErrorEvent(context, error);
  console.error(JSON.stringify({
    event: "server_error",
    ...event
  }));
  if (!context.config.errorWebhook) {
    return;
  }
  void postErrorWebhook(context.config.errorWebhook, event).catch((webhookError) => {
    console.error(JSON.stringify({
      event: "server_error_webhook_failed",
      requestId: context.requestId,
      errorName: errorName(webhookError),
      errorMessage: safeErrorMessage(webhookError)
    }));
  });
}

interface ServerErrorEvent {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  authRole: string;
  errorName: string;
  errorMessage: string;
  occurredAt: string;
}

function buildServerErrorEvent(context: RequestContext, error: unknown): ServerErrorEvent {
  return {
    requestId: context.requestId,
    method: context.request.method ?? "UNKNOWN",
    route: metricRoute(context.url.pathname),
    statusCode: 500,
    authRole: metricAuthRole(context),
    errorName: errorName(error),
    errorMessage: safeErrorMessage(error),
    occurredAt: new Date().toISOString()
  };
}

async function postErrorWebhook(
  webhook: NonNullable<ApiConfig["errorWebhook"]>,
  event: ServerErrorEvent
): Promise<void> {
  const body = JSON.stringify({
    event: "api_server_error",
    ...event
  });
  const timestamp = new Date().toISOString();
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": "novel-game-maker/0.1",
    "x-novel-game-maker-event": "api_server_error",
    "x-novel-game-maker-delivery": randomUUID(),
    "x-novel-game-maker-timestamp": timestamp
  };
  if (webhook.secret) {
    headers["x-novel-game-maker-signature"] = `sha256=${signBody(webhook.secret, timestamp, body)}`;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), webhook.timeoutMs);
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers,
      body,
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`API error webhook failed with HTTP ${response.status}.`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

function signBody(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "Error";
}

function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]{20,}/g, "[redacted-secret]")
    .slice(0, 500);
}

function metricAuthRole(context: RequestContext): string {
  return context.authenticated ? context.auth.role : "public";
}

class HttpMetrics {
  private readonly startedAt = Date.now();
  private readonly requests = new Map<string, HttpRequestMetric>();

  record(context: RequestContext): void {
    const method = context.request.method ?? "UNKNOWN";
    const route = metricRoute(context.url.pathname);
    const status = String(context.response.statusCode);
    const authRole = metricAuthRole(context);
    const key = `${method}\n${route}\n${status}\n${authRole}`;
    const existing = this.requests.get(key);
    const metric: HttpRequestMetric = {
      method,
      route,
      status,
      authRole,
      count: (existing?.count ?? 0) + 1
    };
    this.requests.set(key, metric);
  }

  render(now = Date.now()): string {
    const uptimeSeconds = Math.max(0, (now - this.startedAt) / 1000);
    const lines = [
      "# HELP agentic_galgame_api_uptime_seconds API process uptime in seconds.",
      "# TYPE agentic_galgame_api_uptime_seconds gauge",
      `agentic_galgame_api_uptime_seconds ${uptimeSeconds.toFixed(3)}`,
      "# HELP agentic_galgame_api_requests_total HTTP requests served by method, normalized route, status, and auth role.",
      "# TYPE agentic_galgame_api_requests_total counter"
    ];
    for (const metric of [...this.requests.values()].sort(compareMetric)) {
      lines.push(`agentic_galgame_api_requests_total{method="${escapeMetricLabel(metric.method)}",route="${escapeMetricLabel(metric.route)}",status="${escapeMetricLabel(metric.status)}",auth_role="${escapeMetricLabel(metric.authRole)}"} ${metric.count}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

interface HttpRequestMetric {
  method: string;
  route: string;
  status: string;
  authRole: string;
  count: number;
}

function compareMetric(left: HttpRequestMetric, right: HttpRequestMetric): number {
  return [
    left.route.localeCompare(right.route),
    left.method.localeCompare(right.method),
    left.status.localeCompare(right.status),
    left.authRole.localeCompare(right.authRole)
  ].find((value) => value !== 0) ?? 0;
}

function escapeMetricLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\n/g, "\\n");
}

function metricRoute(pathname: string): string {
  const routes: Array<[RegExp, string]> = [
    [/^\/health$/, "/health"],
    [/^\/metrics$/, "/metrics"],
    [/^\/assets\/.+$/, "/assets/:storageKey"],
    [/^\/v1\/public\/projects\/[^/]+\/project\.vn\.json$/, "/v1/public/projects/:id/project.vn.json"],
    [/^\/v1\/scim\/v2\/ServiceProviderConfig$/, "/v1/scim/v2/ServiceProviderConfig"],
    [/^\/v1\/scim\/v2\/Users$/, "/v1/scim/v2/Users"],
    [/^\/v1\/scim\/v2\/Users\/[^/]+$/, "/v1/scim/v2/Users/:id"],
    [/^\/v1\/auth\/register$/, "/v1/auth/register"],
    [/^\/v1\/auth\/login$/, "/v1/auth/login"],
    [/^\/v1\/auth\/oauth\/start$/, "/v1/auth/oauth/start"],
    [/^\/v1\/auth\/oauth\/callback$/, "/v1/auth/oauth/callback"],
    [/^\/v1\/auth\/verify-email$/, "/v1/auth/verify-email"],
    [/^\/v1\/auth\/password-reset\/request$/, "/v1/auth/password-reset/request"],
    [/^\/v1\/auth\/password-reset\/confirm$/, "/v1/auth/password-reset/confirm"],
    [/^\/v1\/auth\/me$/, "/v1/auth/me"],
    [/^\/v1\/auth\/sessions$/, "/v1/auth/sessions"],
    [/^\/v1\/auth\/sessions\/[^/]+\/revoke$/, "/v1/auth/sessions/:id/revoke"],
	    [/^\/v1\/auth\/email-verification\/request$/, "/v1/auth/email-verification/request"],
	    [/^\/v1\/auth\/mfa\/totp\/setup$/, "/v1/auth/mfa/totp/setup"],
	    [/^\/v1\/auth\/mfa\/totp\/confirm$/, "/v1/auth/mfa/totp/confirm"],
	    [/^\/v1\/auth\/mfa\/recovery-codes\/regenerate$/, "/v1/auth/mfa/recovery-codes/regenerate"],
	    [/^\/v1\/auth\/mfa\/trusted-devices\/revoke$/, "/v1/auth/mfa/trusted-devices/revoke"],
	    [/^\/v1\/auth\/mfa\/totp\/disable$/, "/v1/auth/mfa/totp/disable"],
    [/^\/v1\/auth\/logout$/, "/v1/auth/logout"],
    [/^\/v1\/usage$/, "/v1/usage"],
    [/^\/v1\/billing\/plans$/, "/v1/billing/plans"],
    [/^\/v1\/billing\/subscription$/, "/v1/billing/subscription"],
    [/^\/v1\/billing\/subscription\/cancel$/, "/v1/billing/subscription/cancel"],
    [/^\/v1\/billing\/checkout$/, "/v1/billing/checkout"],
    [/^\/v1\/billing\/checkout-sessions$/, "/v1/billing/checkout-sessions"],
    [/^\/v1\/billing\/checkout-sessions\/[^/]+\/complete$/, "/v1/billing/checkout-sessions/:id/complete"],
    [/^\/v1\/billing\/events$/, "/v1/billing/events"],
    [/^\/v1\/billing\/stripe\/webhook$/, "/v1/billing/stripe/webhook"],
    [/^\/v1\/audit$/, "/v1/audit"],
    [/^\/v1\/ops\/summary$/, "/v1/ops/summary"],
    [/^\/v1\/content-safety$/, "/v1/content-safety"],
    [/^\/v1\/content-safety\/review$/, "/v1/content-safety/review"],
    [/^\/v1\/deployment-invalidations$/, "/v1/deployment-invalidations"],
    [/^\/v1\/notification-deliveries$/, "/v1/notification-deliveries"],
    [/^\/v1\/teams$/, "/v1/teams"],
    [/^\/v1\/teams\/[^/]+\/members$/, "/v1/teams/:id/members"],
    [/^\/v1\/teams\/[^/]+\/invitations$/, "/v1/teams/:id/invitations"],
    [/^\/v1\/team-invitations\/[^/]+\/revoke$/, "/v1/team-invitations/:id/revoke"],
    [/^\/v1\/team-invitations\/accept$/, "/v1/team-invitations/accept"],
    [/^\/v1\/access-tokens$/, "/v1/access-tokens"],
    [/^\/v1\/access-tokens\/[^/]+\/revoke$/, "/v1/access-tokens/:id/revoke"],
    [/^\/v1\/projects$/, "/v1/projects"],
    [/^\/v1\/projects\/from-novel$/, "/v1/projects/from-novel"],
    [/^\/v1\/projects\/[^/]+$/, "/v1/projects/:id"],
    [/^\/v1\/projects\/[^/]+\/assets$/, "/v1/projects/:id/assets"],
    [/^\/v1\/projects\/[^/]+\/release-diff$/, "/v1/projects/:id/release-diff"],
    [/^\/v1\/projects\/[^/]+\/publish$/, "/v1/projects/:id/publish"],
    [/^\/v1\/projects\/[^/]+\/release-approvals$/, "/v1/projects/:id/release-approvals"],
    [/^\/v1\/projects\/[^/]+\/deployment-invalidations$/, "/v1/projects/:id/deployment-invalidations"],
    [/^\/v1\/projects\/[^/]+\/releases$/, "/v1/projects/:id/releases"],
    [/^\/v1\/projects\/[^/]+\/rollback$/, "/v1/projects/:id/rollback"],
    [/^\/v1\/release-approvals\/[^/]+\/approve$/, "/v1/release-approvals/:id/approve"],
    [/^\/v1\/release-approvals\/[^/]+\/reject$/, "/v1/release-approvals/:id/reject"],
    [/^\/v1\/release-approvals\/[^/]+\/comments$/, "/v1/release-approvals/:id/comments"],
    [/^\/v1\/assets$/, "/v1/assets"],
    [/^\/v1\/jobs$/, "/v1/jobs"],
    [/^\/v1\/jobs\/run-next$/, "/v1/jobs/run-next"],
    [/^\/v1\/jobs\/[^/]+$/, "/v1/jobs/:id"],
    [/^\/v1\/jobs\/[^/]+\/run$/, "/v1/jobs/:id/run"],
    [/^\/v1\/notification-deliveries\/run-next$/, "/v1/notification-deliveries/run-next"]
  ];
  return routes.find(([pattern]) => pattern.test(pathname))?.[1] ?? "unmatched";
}

async function sendLocalAsset(response: ServerResponse, config: ApiConfig, storageKey: string): Promise<void> {
  if (config.assetStorageProvider !== "local") {
    sendJson(response, 404, { error: "Asset not found" });
    return;
  }
  const assetRoot = resolve(config.dataDir, "assets");
  const assetPath = resolve(assetRoot, decodeURIComponent(storageKey));
  if (!assetPath.startsWith(`${assetRoot}/`) && assetPath !== assetRoot) {
    sendJson(response, 400, { error: "Invalid asset path" });
    return;
  }
  try {
    const bytes = await readFile(assetPath);
    response.writeHead(200, {
      "content-type": contentTypeFromPath(assetPath),
      "cache-control": "public, max-age=31536000, immutable"
    });
    response.end(bytes);
  } catch {
    sendJson(response, 404, { error: "Asset not found" });
  }
}

async function sendPublicCurrentProject(response: ServerResponse, platform: VNPlatform, projectId: string): Promise<void> {
  const project = await platform.projects.getProject(projectId);
  if (!project?.publishedProjectUrl) {
    sendJson(response, 404, { error: "Published project not found" });
    return;
  }
  response.writeHead(302, {
    location: project.publishedProjectUrl,
    "cache-control": "no-cache, max-age=0"
  });
  response.end();
}

function setCors(response: ServerResponse, config: ApiConfig): void {
  response.setHeader("access-control-allow-origin", config.corsOrigin);
  response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  response.setHeader("access-control-allow-headers", "content-type,authorization,x-request-id,stripe-signature");
}

async function authenticate(request: IncomingMessage, config: ApiConfig, platform: VNPlatform): Promise<AuthContext | undefined> {
  if (!config.apiAuthToken && config.ownerAccessTokens.length === 0 && config.userAccessTokens.length === 0) {
    const token = readBearerToken(request);
    if (token) {
      const stored = await authenticateStoredBearer(token, platform);
      if (stored) {
        return stored;
      }
    }
    return { role: "admin" };
  }
  const token = readBearerToken(request);
  if (!token) {
    return undefined;
  }
  if (config.apiAuthToken && token === config.apiAuthToken) {
    return { role: "admin" };
  }
  const ownerToken = config.ownerAccessTokens.find((entry) => entry.token === token);
  if (ownerToken) {
    return { role: "owner", ownerId: ownerToken.ownerId };
  }
  const userToken = config.userAccessTokens.find((entry) => entry.token === token);
  if (userToken) {
    return { role: "user", userId: userToken.userId };
  }
  return authenticateStoredBearer(token, platform);
}

async function authenticateStoredBearer(token: string, platform: VNPlatform): Promise<AuthContext | undefined> {
  const stored = await platform.accessTokens.authenticate(token);
  if (stored) {
    return authContextFromTokenRecord(stored);
  }
  const session = await platform.userAccounts.authenticate(token);
  if (!session) {
    return undefined;
  }
  return {
    role: "user",
    userId: session.user.id,
    email: session.user.email,
    sessionId: session.session.id
  };
}

function requiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) {
    throw new HttpError(400, `Missing query parameter: ${key}`);
  }
  return value;
}

function readLimit(url: URL, fallback: number): number {
  const raw = url.searchParams.get("limit");
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 200) {
    throw new HttpError(400, "Expected limit to be an integer between 1 and 200.");
  }
  return parsed;
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new HttpError(400, `Expected non-empty string body field: ${key}`);
  }
  return value;
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readQueryString(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value?.trim()) {
    throw new HttpError(400, `Expected non-empty query field: ${key}`);
  }
  return value;
}

function readOptionalRecordString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(input: Record<string, unknown>, key: string): number | undefined {
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readSingleHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function stripeObjectId(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return readOptionalRecordString(value as Record<string, unknown>, "id");
  }
  return undefined;
}

function stripeObjectCustomerId(value: unknown): string | undefined {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return stripeObjectId((value as Record<string, unknown>).customer);
  }
  return undefined;
}

function isoFromStripeUnix(value: unknown): string | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : undefined;
}

function mapStripeSubscriptionStatus(status: string | undefined): BillingSubscriptionStatus | undefined {
  if (!status) {
    return undefined;
  }
  if (status === "trialing" || status === "active" || status === "past_due") {
    return status;
  }
  if (status === "canceled") {
    return "cancelled";
  }
  return "past_due";
}

function mapStripeInvoiceEventType(eventType: string): "invoice_paid" | "invoice_payment_failed" | "invoice_payment_action_required" {
  if (eventType === "invoice.paid") {
    return "invoice_paid";
  }
  if (eventType === "invoice.payment_action_required") {
    return "invoice_payment_action_required";
  }
  return "invoice_payment_failed";
}

function mapStripeFinancialEventType(eventType: string): "refund_created" | "dispute_created" | "dispute_closed" {
  if (eventType === "charge.refunded") {
    return "refund_created";
  }
  if (eventType === "charge.dispute.created") {
    return "dispute_created";
  }
  return "dispute_closed";
}

function verifyStripeSignature(input: {
  rawBody: string;
  signatureHeader: string;
  webhookSecret: string;
  toleranceSeconds: number;
}): void {
  const parts = input.signatureHeader.split(",").map((part) => part.trim()).filter(Boolean);
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const timestamp = timestampPart ? Number(timestampPart.slice(2)) : Number.NaN;
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));
  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new HttpError(400, "Invalid Stripe signature header.");
  }
  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
  if (ageSeconds > input.toleranceSeconds) {
    throw new HttpError(400, "Stripe signature timestamp is outside tolerance.");
  }
  const expected = createHmac("sha256", input.webhookSecret)
    .update(`${timestamp}.${input.rawBody}`)
    .digest("hex");
  if (!signatures.some((signature) => constantTimeHexEqual(signature, expected))) {
    throw new HttpError(400, "Stripe signature verification failed.");
  }
}

function constantTimeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function constantTimeStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function readOptionalBoolean(input: Record<string, unknown>, key: string): boolean | undefined {
  const value = input[key];
  return typeof value === "boolean" ? value : undefined;
}

function readRecord(input: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = input[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `Expected object body field: ${key}`);
  }
  return value as Record<string, unknown>;
}

function readOptionalRecord(input: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const value = input[key];
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `Expected object body field: ${key}`);
  }
  return value as Record<string, unknown>;
}

interface ScimUserInput {
  email: string;
  name?: string;
  active?: boolean;
  emailVerified?: boolean;
}

interface ScimPatchInput {
  active?: boolean;
  name?: string;
}

function authenticateScimRequest(request: IncomingMessage, config: ApiConfig): boolean {
  const token = readBearerToken(request);
  return Boolean(token && config.scim.bearerToken && constantTimeStringEqual(token, config.scim.bearerToken));
}

function sendScimError(response: ServerResponse, statusCode: number, detail: string): void {
  sendJson(response, statusCode, {
    schemas: [SCIM_ERROR_SCHEMA],
    status: String(statusCode),
    detail
  });
}

function serializeScimUser(user: UserAccountRecord, config: ApiConfig): Record<string, unknown> {
  const displayName = user.name || user.email;
  return {
    schemas: [SCIM_USER_SCHEMA],
    id: user.id,
    userName: user.email,
    displayName,
    name: {
      formatted: displayName
    },
    active: !user.disabledAt,
    emails: [
      {
        value: user.email,
        primary: true
      }
    ],
    meta: {
      resourceType: "User",
      created: user.createdAt,
      lastModified: user.updatedAt,
      location: scimLocation(config, `/Users/${encodeURIComponent(user.id)}`)
    }
  };
}

function scimLocation(config: ApiConfig, path: string): string {
  const baseUrl = config.scim.baseUrl ?? "/v1/scim/v2";
  return `${baseUrl.replace(/\/+$/g, "")}${path}`;
}

function parseScimUserFilter(filter: string | null): string | undefined {
  if (!filter?.trim()) {
    return undefined;
  }
  const normalized = filter.trim();
  const quoted = normalized.match(/^(?:userName|emails\.value)\s+eq\s+"([^"]+)"$/i);
  if (quoted?.[1]) {
    return quoted[1];
  }
  const bare = normalized.match(/^(?:userName|emails\.value)\s+eq\s+(\S+)$/i);
  if (bare?.[1]) {
    return bare[1];
  }
  throw new HttpError(400, "Only SCIM userName eq or emails.value eq filters are supported.");
}

function readScimUserInput(body: Record<string, unknown>): ScimUserInput {
  const email = readOptionalString(body, "userName") ?? readPrimaryScimEmail(body);
  if (!email) {
    throw new HttpError(400, "SCIM userName or primary email is required.");
  }
  const input: ScimUserInput = {
    email,
    active: readOptionalBoolean(body, "active") ?? true,
    emailVerified: true
  };
  const displayName = readScimDisplayName(body);
  if (displayName) {
    input.name = displayName;
  }
  return input;
}

function readPrimaryScimEmail(body: Record<string, unknown>): string | undefined {
  const emails = body.emails;
  if (!Array.isArray(emails)) {
    return undefined;
  }
  const records = emails.filter((email): email is Record<string, unknown> =>
    Boolean(email && typeof email === "object" && !Array.isArray(email))
  );
  const primary = records.find((email) => email.primary === true) ?? records[0];
  return typeof primary?.value === "string" && primary.value.trim().length > 0
    ? primary.value
    : undefined;
}

function readScimDisplayName(body: Record<string, unknown>): string | undefined {
  const displayName = readOptionalString(body, "displayName");
  if (displayName) {
    return displayName;
  }
  const name = body.name;
  if (!name || typeof name !== "object" || Array.isArray(name)) {
    return undefined;
  }
  const nameRecord = name as Record<string, unknown>;
  if (typeof nameRecord.formatted === "string" && nameRecord.formatted.trim().length > 0) {
    return nameRecord.formatted;
  }
  const parts = [nameRecord.givenName, nameRecord.familyName]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length > 0 ? parts.join(" ") : undefined;
}

function readScimPatchInput(body: Record<string, unknown>): ScimPatchInput {
  const operations = body.Operations ?? body.operations;
  if (!Array.isArray(operations)) {
    throw new HttpError(400, "SCIM PATCH requires Operations array.");
  }
  const patch: ScimPatchInput = {};
  for (const operation of operations) {
    if (!operation || typeof operation !== "object" || Array.isArray(operation)) {
      throw new HttpError(400, "SCIM PATCH operation must be an object.");
    }
    applyScimPatchOperation(patch, operation as Record<string, unknown>);
  }
  return patch;
}

function applyScimPatchOperation(patch: ScimPatchInput, operation: Record<string, unknown>): void {
  const op = typeof operation.op === "string" ? operation.op.toLowerCase() : "replace";
  if (op !== "replace" && op !== "add") {
    return;
  }
  const path = typeof operation.path === "string" ? operation.path.toLowerCase() : undefined;
  const value = operation.value;
  if (!path && value && typeof value === "object" && !Array.isArray(value)) {
    applyScimPatchValueObject(patch, value as Record<string, unknown>);
    return;
  }
  if (path === "active") {
    if (typeof value !== "boolean") {
      throw new HttpError(400, "SCIM active patch value must be boolean.");
    }
    patch.active = value;
    return;
  }
  if (path === "displayname" || path === "name.formatted") {
    if (typeof value !== "string") {
      throw new HttpError(400, "SCIM displayName patch value must be string.");
    }
    patch.name = value;
    return;
  }
  if (path === "name" && value && typeof value === "object" && !Array.isArray(value)) {
    const name = readScimDisplayName({ name: value });
    if (name) {
      patch.name = name;
    }
  }
}

function applyScimPatchValueObject(patch: ScimPatchInput, value: Record<string, unknown>): void {
  if (typeof value.active === "boolean") {
    patch.active = value.active;
  }
  const name = readScimDisplayName(value);
  if (name) {
    patch.name = name;
  }
}

function readContentSafetySource(input: Record<string, unknown>, key: string): ContentSafetySource {
  const value = readString(input, key);
  if (value === "novel_text" || value === "project_json" || value === "asset_prompt") {
    return value;
  }
  throw new HttpError(400, "Expected source to be novel_text, project_json, or asset_prompt.");
}

function readTeamMemberRole(input: Record<string, unknown>, key: string): TeamMemberRole {
  const value = readString(input, key);
  if (value === "owner" || value === "admin" || value === "editor" || value === "viewer") {
    return value;
  }
  throw new HttpError(400, "Expected role to be owner, admin, editor, or viewer.");
}

function decodeBase64(value: string): Uint8Array {
  const normalized = value.trim();
  if (normalized.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) {
    throw new HttpError(400, "Invalid base64 payload.");
  }
  const buffer = Buffer.from(normalized, "base64");
  const canonical = buffer.toString("base64").replace(/=+$/g, "");
  if (canonical !== normalized.replace(/=+$/g, "")) {
    throw new HttpError(400, "Invalid base64 payload.");
  }
  return buffer;
}

function matchPath(pathname: string, pattern: RegExp): string | undefined {
  const match = pathname.match(pattern);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

function matchPathGroups(pathname: string, pattern: RegExp): string[] | undefined {
  const match = pathname.match(pattern);
  if (!match) {
    return undefined;
  }
  return match.slice(1).map((value) => decodeURIComponent(value));
}

function actorLabel(auth: AuthContext): string {
  if (auth.role === "admin") {
    return "admin";
  }
  if (auth.role === "owner") {
    return `owner:${auth.ownerId}`;
  }
  return `user:${auth.userId}`;
}

async function assertProjectAccess(context: RequestContext, projectId: string, requiredRole: TeamMemberRole = "viewer"): Promise<void> {
  const project = await context.platform.projects.getProject(projectId);
  if (!project) {
    throw new HttpError(404, "Project not found");
  }
  await assertOwnerAccess(context, project.ownerId, requiredRole);
}

async function assertAndReadOwner(context: RequestContext, body: Record<string, unknown>): Promise<string> {
  const ownerId = readString(body, "ownerId");
  await assertOwnerAccess(context, ownerId, "editor");
  return ownerId;
}

async function assertAndReadProjectId(context: RequestContext, body: Record<string, unknown>): Promise<string> {
  const projectId = readString(body, "projectId");
  await assertProjectAccess(context, projectId, "editor");
  return projectId;
}

async function assertOwnerAccess(context: RequestContext, ownerId: string, requiredRole: TeamMemberRole): Promise<void> {
  if (context.auth.role === "admin") {
    return;
  }
  if (context.auth.role === "owner" && context.auth.ownerId === ownerId) {
    return;
  }
  if (context.auth.role === "user") {
    const allowed = await context.platform.teams.authorize({
      teamId: ownerId,
      userId: context.auth.userId,
      requiredRole
    });
    if (allowed) {
      return;
    }
  }
  throw new HttpError(403, "Forbidden owner scope.");
}

function assertAdmin(auth: AuthContext): void {
  if (auth.role !== "admin") {
    throw new HttpError(403, "Admin token required.");
  }
}

function assertUserSelfOrAdmin(auth: AuthContext, userId: string): void {
  if (auth.role === "admin") {
    return;
  }
  if (auth.role === "user" && auth.userId === userId) {
    return;
  }
  throw new HttpError(403, "Forbidden user scope.");
}

function readInvitationAcceptUserId(auth: AuthContext, body: Record<string, unknown>): string {
  if (auth.role === "user") {
    const requested = readOptionalString(body, "userId");
    if (requested && requested !== auth.userId) {
      throw new HttpError(403, "Forbidden user scope.");
    }
    return auth.userId;
  }
  if (auth.role === "admin") {
    return readString(body, "userId");
  }
  throw new HttpError(403, "User token required to accept team invitation.");
}

function readAuthUserId(auth: AuthContext, body: Record<string, unknown>): string {
  if (auth.role === "user") {
    const requested = readOptionalString(body, "userId");
    if (requested && requested !== auth.userId) {
      throw new HttpError(403, "Forbidden user scope.");
    }
    return auth.userId;
  }
  if (auth.role === "admin") {
    return readString(body, "userId");
  }
  throw new HttpError(403, "User token required.");
}

async function assertAccessTokenAccess(context: RequestContext, record: AccessTokenRecord): Promise<void> {
  if (context.auth.role === "admin") {
    return;
  }
  if (record.role === "owner" && record.ownerId) {
    await assertOwnerAccess(context, record.ownerId, "admin");
    return;
  }
  throw new HttpError(403, "Forbidden access token scope.");
}

function serializeAccessToken(record: AccessTokenRecord): PublicAccessTokenRecord {
  const { tokenHash: _tokenHash, ...publicRecord } = record;
  return publicRecord;
}

function serializeTeamInvitation(record: TeamInvitationRecord): PublicTeamInvitationRecord {
  const { tokenHash: _tokenHash, ...publicRecord } = record;
  return publicRecord;
}

function serializeOAuthIdentity(record: OAuthIdentityRecord): PublicOAuthIdentityRecord {
  const { subject: _subject, ...publicRecord } = record;
  return publicRecord;
}

function serializeOptionalUserAccount(record: UserAccountRecord | undefined): PublicUserAccountRecord | undefined {
  return record ? serializeUserAccount(record) : undefined;
}

function serializeUserAccount(record: UserAccountRecord): PublicUserAccountRecord {
  const {
    passwordHash: _passwordHash,
    failedLoginCount: _failedLoginCount,
    lastFailedLoginAt: _lastFailedLoginAt,
    lockedUntil: _lockedUntil,
    mfaTotpSecretEncrypted: _mfaTotpSecretEncrypted,
    mfaTotpLastUsedCounter: _mfaTotpLastUsedCounter,
    mfaRecoveryCodeHashes: _mfaRecoveryCodeHashes,
    mfaTrustedDevices: _mfaTrustedDevices,
    ...publicRecord
  } = record;
  return publicRecord;
}

function serializeUserSession(record: UserSessionRecord): PublicUserSessionRecord {
  const { tokenHash: _tokenHash, ...publicRecord } = record;
  return publicRecord;
}

function authContextFromTokenRecord(record: AccessTokenRecord): AuthContext | undefined {
  if (record.role === "admin") {
    return { role: "admin" };
  }
  if (record.role === "owner" && record.ownerId) {
    return { role: "owner", ownerId: record.ownerId };
  }
  if (record.role === "user" && record.userId) {
    return { role: "user", userId: record.userId };
  }
  return undefined;
}

function readBearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    return undefined;
  }
  return authorization.slice("Bearer ".length);
}

class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

class InMemoryRateLimiter {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly windowMs: number,
    private readonly maxRequests: number
  ) {}

  allow(key: string): boolean {
    if (this.maxRequests === 0) {
      return true;
    }
    const now = Date.now();
    const existing = this.buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.windowMs
      });
      return true;
    }
    if (existing.count >= this.maxRequests) {
      return false;
    }
    existing.count += 1;
    return true;
  }
}

function clientKey(request: IncomingMessage): string {
  const forwardedFor = request.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim().length > 0) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.socket.remoteAddress ?? "unknown";
}

function contentTypeFromPath(pathname: string): string {
  if (pathname.endsWith(".png")) {
    return "image/png";
  }
  if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (pathname.endsWith(".webp")) {
    return "image/webp";
  }
  if (pathname.endsWith(".svg")) {
    return "image/svg+xml";
  }
  return "application/octet-stream";
}
