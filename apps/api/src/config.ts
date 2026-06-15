import { resolve } from "node:path";
import type {
  BillingCheckoutProviderId,
  BillingEntitlementPolicy,
  ContentSafetyPolicy,
  CostPolicy,
  NotificationRetryPolicy,
  OAuthGroupRoleMapping,
  QuotaPolicy,
  RetryPolicy,
  TeamMemberRole,
  UserAccountAccessPolicy,
  UserAccountMfaPolicy
} from "@agentic-galgame/vn-platform";

export interface ApiConfig {
  host: string;
  port: number;
  dataDir: string;
  apiPublicBaseUrl?: string;
  playerBaseUrl?: string;
  databaseUrl?: string;
  postgresSsl: boolean;
  apiAuthToken?: string;
  ownerAccessTokens: OwnerAccessToken[];
  userAccessTokens: UserAccessToken[];
  corsOrigin: string;
  requestBodyLimitBytes: number;
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;
  accessLogEnabled: boolean;
  metricsPublic: boolean;
  billingCheckoutProvider: BillingCheckoutProviderId;
  billingEntitlementPolicy: BillingEntitlementPolicy;
  stripeBilling?: {
    secretKey: string;
    webhookSecret: string;
    priceIds: Record<string, string>;
    apiBaseUrl?: string;
    requestTimeoutMs: number;
    webhookToleranceSeconds: number;
  };
  errorWebhook?: {
    url: string;
    secret?: string;
    timeoutMs: number;
  };
  releaseApprovalRequired: boolean;
  releaseApprovalWebhook?: {
    url: string;
    secret?: string;
    timeoutMs: number;
  };
  teamInvitationWebhook?: {
    url: string;
    secret?: string;
    timeoutMs: number;
    acceptBaseUrl?: string;
  };
  userAccountWebhook?: {
    url: string;
    secret?: string;
    timeoutMs: number;
    emailVerificationBaseUrl?: string;
    passwordResetBaseUrl?: string;
  };
  quotaPolicy: QuotaPolicy;
  costPolicy: CostPolicy;
  retryPolicy: RetryPolicy;
  notificationRetryPolicy: NotificationRetryPolicy;
  contentSafetyPolicy: ContentSafetyPolicy;
  userAccountSecurityPolicy: {
    passwordMinLength: number;
    passwordRequireLetter: boolean;
    passwordRequireNumber: boolean;
    passwordRequireSymbol: boolean;
    blockedPasswordTerms: string[];
    maxFailedLoginAttempts: number;
    failedLoginLockoutMs: number;
  };
  userAccountMfaPolicy: UserAccountMfaPolicy;
  userAccountAccessPolicy: UserAccountAccessPolicy;
  oauth: {
    enabled: boolean;
    provider: "mock" | "oidc";
    redirectUri: string;
    stateTtlMs: number;
    allowedReturnUrlOrigins: string[];
    requireVerifiedEmail: boolean;
    allowedEmailDomains: string[];
    groupRoleMappings: OAuthGroupRoleMapping[];
    mockAuthorizationBaseUrl?: string;
    oidc?: {
      issuer?: string;
      clientId: string;
      clientSecret: string;
      authorizationUrl: string;
      tokenUrl: string;
      userInfoUrl: string;
      scopes: string[];
      groupsClaim: string;
      requestTimeoutMs: number;
    };
  };
  scim: {
    enabled: boolean;
    bearerToken?: string;
    baseUrl?: string;
  };
  aiEnabled: boolean;
  aiTextProvider: "none" | "openai-compatible";
  aiImageProvider: "none" | "openai-compatible";
  openAIText?: {
    OPENAI_API_KEY?: string;
    OPENAI_TEXT_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_URLBASE?: string;
    OPENAI_TEXT_MODEL?: string;
    OPENAI_TEXT_TEMPERATURE?: string;
  };
  openAIImage?: {
    OPENAI_API_KEY?: string;
    OPENAI_BASE_URL?: string;
    OPENAI_URLBASE?: string;
    OPENAI_IMAGE_MODEL?: string;
    OPENAI_IMAGE_SIZE?: string;
    OPENAI_IMAGE_QUALITY?: string;
    OPENAI_IMAGE_RESPONSE_FORMAT?: string;
    OPENAI_IMAGE_OUTPUT_FORMAT?: string;
  };
  assetStorageProvider: "local" | "s3";
  deploymentCacheProvider: "none" | "cloudflare";
  cloudflare?: {
    zoneId: string;
    apiToken: string;
    apiBaseUrl?: string;
  };
  s3?: {
    endpoint: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    publicBaseUrl?: string;
    forcePathStyle: boolean;
  };
}

export interface OwnerAccessToken {
  ownerId: string;
  token: string;
}

export interface UserAccessToken {
  userId: string;
  token: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  const config: ApiConfig = {
    host: env.API_HOST ?? "127.0.0.1",
    port: parsePort(env.API_PORT),
    dataDir: resolve(env.DATA_DIR ?? "data/local"),
    apiPublicBaseUrl: normalizeBaseUrl(emptyToUndefined(env.API_PUBLIC_BASE_URL)),
    playerBaseUrl: normalizeBaseUrl(emptyToUndefined(env.PLAYER_BASE_URL)),
    databaseUrl: emptyToUndefined(env.DATABASE_URL),
    postgresSsl: env.POSTGRES_SSL === "true",
    apiAuthToken: emptyToUndefined(env.API_AUTH_TOKEN),
    ownerAccessTokens: parseOwnerAccessTokens(env.API_OWNER_TOKENS),
    userAccessTokens: parseUserAccessTokens(env.API_USER_TOKENS),
    corsOrigin: env.CORS_ORIGIN ?? "http://127.0.0.1:5173",
    requestBodyLimitBytes: parsePositiveInteger(env.API_BODY_LIMIT_BYTES, 1_000_000),
    rateLimitWindowMs: parsePositiveInteger(env.API_RATE_LIMIT_WINDOW_MS, 60_000),
    rateLimitMaxRequests: parseNonNegativeInteger(env.API_RATE_LIMIT_MAX_REQUESTS, 300),
    accessLogEnabled: env.API_ACCESS_LOG === "true" || (env.NODE_ENV === "production" && env.API_ACCESS_LOG !== "false"),
    metricsPublic: env.API_METRICS_PUBLIC === "true",
    billingCheckoutProvider: env.BILLING_CHECKOUT_PROVIDER === "stripe" ? "stripe" : "mock",
    billingEntitlementPolicy: {
      blockPastDue: env.BILLING_BLOCK_PAST_DUE !== "false",
      pastDueGracePeriodMs: parseNonNegativeInteger(env.BILLING_PAST_DUE_GRACE_DAYS, 3) * 24 * 60 * 60 * 1000
    },
    stripeBilling: env.BILLING_CHECKOUT_PROVIDER === "stripe"
      ? {
          secretKey: requireConfigEnv(env, "STRIPE_SECRET_KEY", "BILLING_CHECKOUT_PROVIDER=stripe"),
          webhookSecret: requireConfigEnv(env, "STRIPE_WEBHOOK_SECRET", "BILLING_CHECKOUT_PROVIDER=stripe"),
          priceIds: parseStripePriceIds(env),
          apiBaseUrl: normalizeBaseUrl(emptyToUndefined(env.STRIPE_API_BASE_URL)),
          requestTimeoutMs: parsePositiveInteger(env.STRIPE_REQUEST_TIMEOUT_MS, 10_000),
          webhookToleranceSeconds: parsePositiveInteger(env.STRIPE_WEBHOOK_TOLERANCE_SECONDS, 300)
      }
      : undefined,
    errorWebhook: emptyToUndefined(env.API_ERROR_WEBHOOK_URL)
      ? {
          url: env.API_ERROR_WEBHOOK_URL!,
          secret: emptyToUndefined(env.API_ERROR_WEBHOOK_SECRET),
          timeoutMs: parsePositiveInteger(env.API_ERROR_WEBHOOK_TIMEOUT_MS, 5_000)
      }
      : undefined,
    releaseApprovalRequired: env.RELEASE_APPROVAL_REQUIRED === "true",
    releaseApprovalWebhook: emptyToUndefined(env.RELEASE_APPROVAL_WEBHOOK_URL)
      ? {
          url: env.RELEASE_APPROVAL_WEBHOOK_URL!,
          secret: emptyToUndefined(env.RELEASE_APPROVAL_WEBHOOK_SECRET),
          timeoutMs: parsePositiveInteger(env.RELEASE_APPROVAL_WEBHOOK_TIMEOUT_MS, 5_000)
      }
      : undefined,
    teamInvitationWebhook: emptyToUndefined(env.TEAM_INVITATION_WEBHOOK_URL)
      ? {
          url: env.TEAM_INVITATION_WEBHOOK_URL!,
          secret: emptyToUndefined(env.TEAM_INVITATION_WEBHOOK_SECRET),
          timeoutMs: parsePositiveInteger(env.TEAM_INVITATION_WEBHOOK_TIMEOUT_MS, 5_000),
          acceptBaseUrl: normalizeBaseUrl(emptyToUndefined(env.TEAM_INVITATION_ACCEPT_BASE_URL))
      }
      : undefined,
    userAccountWebhook: emptyToUndefined(env.USER_ACCOUNT_WEBHOOK_URL)
      ? {
          url: env.USER_ACCOUNT_WEBHOOK_URL!,
          secret: emptyToUndefined(env.USER_ACCOUNT_WEBHOOK_SECRET),
          timeoutMs: parsePositiveInteger(env.USER_ACCOUNT_WEBHOOK_TIMEOUT_MS, 5_000),
          emailVerificationBaseUrl: normalizeBaseUrl(emptyToUndefined(env.EMAIL_VERIFICATION_BASE_URL)),
          passwordResetBaseUrl: normalizeBaseUrl(emptyToUndefined(env.PASSWORD_RESET_BASE_URL))
      }
      : undefined,
    quotaPolicy: {
      dailyJobLimit: parseNonNegativeInteger(env.API_DAILY_JOB_LIMIT, 1_000),
      dailyTextJobLimit: parseNonNegativeInteger(env.API_DAILY_TEXT_JOB_LIMIT, 500),
      dailyImageJobLimit: parseNonNegativeInteger(env.API_DAILY_IMAGE_JOB_LIMIT, 100)
    },
    costPolicy: {
      textJobCostCents: parseNonNegativeInteger(env.AI_TEXT_JOB_COST_CENTS, 2),
      imageJobCostCents: parseNonNegativeInteger(env.AI_IMAGE_JOB_COST_CENTS, 8)
    },
    retryPolicy: {
      maxAttempts: parsePositiveInteger(env.JOB_MAX_ATTEMPTS, 3),
      retryDelayMs: parsePositiveInteger(env.JOB_RETRY_DELAY_MS, 30_000)
    },
    notificationRetryPolicy: {
      maxAttempts: parsePositiveInteger(env.NOTIFICATION_MAX_ATTEMPTS, 3),
      retryDelayMs: parsePositiveInteger(env.NOTIFICATION_RETRY_DELAY_MS, 30_000)
    },
    contentSafetyPolicy: {
      enabled: env.CONTENT_SAFETY_ENABLED !== "false",
      blockOnReview: env.CONTENT_SAFETY_BLOCK_REVIEW === "true",
      blockedTerms: parseCsvList(env.CONTENT_SAFETY_BLOCKED_TERMS, defaultBlockedTerms()),
      reviewTerms: parseCsvList(env.CONTENT_SAFETY_REVIEW_TERMS, defaultReviewTerms())
    },
    userAccountSecurityPolicy: {
      passwordMinLength: parsePositiveInteger(env.AUTH_PASSWORD_MIN_LENGTH, 8),
      passwordRequireLetter: env.AUTH_PASSWORD_REQUIRE_LETTER !== "false",
      passwordRequireNumber: env.AUTH_PASSWORD_REQUIRE_NUMBER === "true",
      passwordRequireSymbol: env.AUTH_PASSWORD_REQUIRE_SYMBOL === "true",
      blockedPasswordTerms: parseCsvList(env.AUTH_PASSWORD_BLOCKED_TERMS, []),
      maxFailedLoginAttempts: parseNonNegativeInteger(env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS, 5),
      failedLoginLockoutMs: parsePositiveInteger(env.AUTH_LOGIN_LOCKOUT_MS, 15 * 60_000)
    },
    userAccountMfaPolicy: {
      enabled: env.AUTH_MFA_ENABLED === "true",
      issuer: env.AUTH_MFA_ISSUER?.trim() || "Agentic Galgame Studio",
	      secretEncryptionKey: emptyToUndefined(env.AUTH_MFA_ENCRYPTION_KEY),
	      totpStepSeconds: parsePositiveInteger(env.AUTH_MFA_TOTP_STEP_SECONDS, 30),
	      totpWindowSteps: parseNonNegativeInteger(env.AUTH_MFA_TOTP_WINDOW_STEPS, 1),
	      trustedDeviceTtlMs: parsePositiveInteger(env.AUTH_MFA_TRUSTED_DEVICE_TTL_DAYS, 30) * 24 * 60 * 60 * 1000,
	      maxTrustedDevices: parsePositiveInteger(env.AUTH_MFA_MAX_TRUSTED_DEVICES, 10)
    },
    userAccountAccessPolicy: {
      ssoRequiredEmailDomains: parseCsvList(env.AUTH_SSO_REQUIRED_EMAIL_DOMAINS, [])
        .map((domain) => domain.toLowerCase().replace(/^@+/, ""))
        .filter(Boolean)
    },
    oauth: createOAuthConfig(env),
    scim: createScimConfig(env),
    aiEnabled: env.AI_PROVIDER_ENABLED === "true",
    aiTextProvider: env.AI_TEXT_PROVIDER === "openai-compatible" ? "openai-compatible" : "none",
    aiImageProvider: env.AI_IMAGE_PROVIDER === "openai-compatible" ? "openai-compatible" : "none",
    openAIText: {
      OPENAI_API_KEY: emptyToUndefined(env.OPENAI_API_KEY),
      OPENAI_TEXT_API_KEY: emptyToUndefined(env.OPENAI_TEXT_API_KEY),
      OPENAI_BASE_URL: emptyToUndefined(env.OPENAI_BASE_URL),
      OPENAI_URLBASE: emptyToUndefined(env.OPENAI_URLBASE),
      OPENAI_TEXT_MODEL: emptyToUndefined(env.OPENAI_TEXT_MODEL),
      OPENAI_TEXT_TEMPERATURE: emptyToUndefined(env.OPENAI_TEXT_TEMPERATURE)
    },
    openAIImage: {
      OPENAI_API_KEY: emptyToUndefined(env.OPENAI_API_KEY),
      OPENAI_BASE_URL: emptyToUndefined(env.OPENAI_BASE_URL),
      OPENAI_URLBASE: emptyToUndefined(env.OPENAI_URLBASE),
      OPENAI_IMAGE_MODEL: emptyToUndefined(env.OPENAI_IMAGE_MODEL),
      OPENAI_IMAGE_SIZE: emptyToUndefined(env.OPENAI_IMAGE_SIZE),
      OPENAI_IMAGE_QUALITY: emptyToUndefined(env.OPENAI_IMAGE_QUALITY),
      OPENAI_IMAGE_RESPONSE_FORMAT: emptyToUndefined(env.OPENAI_IMAGE_RESPONSE_FORMAT),
      OPENAI_IMAGE_OUTPUT_FORMAT: emptyToUndefined(env.OPENAI_IMAGE_OUTPUT_FORMAT)
    },
    assetStorageProvider: env.ASSET_STORAGE_PROVIDER === "s3" ? "s3" : "local",
    deploymentCacheProvider: env.DEPLOYMENT_CACHE_PROVIDER === "cloudflare" ? "cloudflare" : "none",
    cloudflare: env.DEPLOYMENT_CACHE_PROVIDER === "cloudflare"
      ? {
          zoneId: requireEnv(env, "CLOUDFLARE_ZONE_ID"),
          apiToken: requireEnv(env, "CLOUDFLARE_API_TOKEN"),
          apiBaseUrl: normalizeBaseUrl(emptyToUndefined(env.CLOUDFLARE_API_BASE_URL))
      }
      : undefined,
    s3: env.ASSET_STORAGE_PROVIDER === "s3"
      ? {
          endpoint: requireEnv(env, "S3_ENDPOINT"),
          region: env.S3_REGION ?? "auto",
          bucket: requireEnv(env, "S3_BUCKET"),
          accessKeyId: requireEnv(env, "S3_ACCESS_KEY_ID"),
          secretAccessKey: requireEnv(env, "S3_SECRET_ACCESS_KEY"),
          publicBaseUrl: env.S3_PUBLIC_BASE_URL,
          forcePathStyle: env.S3_FORCE_PATH_STYLE !== "false"
      }
      : undefined
  };
  assertProductionSafety(env, config);
  return config;
}

function parsePort(value: string | undefined): number {
  return parsePositiveInteger(value, 8787);
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, got: ${value}`);
  }
  return parsed;
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected non-negative integer, got: ${value}`);
  }
  return parsed;
}

function requireEnv(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required when ASSET_STORAGE_PROVIDER=s3.`);
  }
  return value;
}

function requireConfigEnv(env: NodeJS.ProcessEnv, key: string, context: string): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is required when ${context}.`);
  }
  return value;
}

function parseStripePriceIds(env: NodeJS.ProcessEnv): Record<string, string> {
  return {
    pro: requireConfigEnv(env, "STRIPE_PRICE_PRO", "BILLING_CHECKOUT_PROVIDER=stripe"),
    studio: requireConfigEnv(env, "STRIPE_PRICE_STUDIO", "BILLING_CHECKOUT_PROVIDER=stripe")
  };
}

function parseOAuthGroupRoleMappings(value: string | undefined): OAuthGroupRoleMapping[] {
  return parseCsvList(value, []).map((entry) => {
    const [group, teamId, role] = entry.split(":").map((part) => part.trim());
    if (!group || !teamId || !role) {
      throw new Error("AUTH_OAUTH_GROUP_ROLE_MAPPINGS entries must use group:teamId:role.");
    }
    return {
      group,
      teamId,
      role: parseTeamMemberRole(role)
    };
  });
}

function parseTeamMemberRole(value: string): TeamMemberRole {
  if (value === "owner" || value === "admin" || value === "editor" || value === "viewer") {
    return value;
  }
  throw new Error(`Invalid team member role: ${value}`);
}

function createOAuthConfig(env: NodeJS.ProcessEnv): ApiConfig["oauth"] {
  const enabled = env.AUTH_OAUTH_ENABLED === "true";
  const provider = env.AUTH_OAUTH_PROVIDER === "oidc" ? "oidc" : "mock";
  const redirectUri = emptyToUndefined(env.AUTH_OAUTH_REDIRECT_URI) ??
    normalizeBaseUrl(emptyToUndefined(env.API_PUBLIC_BASE_URL))?.concat("/v1/auth/oauth/callback") ??
    "http://127.0.0.1:8787/v1/auth/oauth/callback";
  return {
    enabled,
    provider,
    redirectUri,
    stateTtlMs: parsePositiveInteger(env.AUTH_OAUTH_STATE_TTL_MS, 10 * 60_000),
    allowedReturnUrlOrigins: parseCsvList(env.AUTH_OAUTH_ALLOWED_RETURN_ORIGINS, []),
    requireVerifiedEmail: env.AUTH_OAUTH_REQUIRE_VERIFIED_EMAIL !== "false",
    allowedEmailDomains: parseCsvList(env.AUTH_OAUTH_ALLOWED_EMAIL_DOMAINS, []).map((domain) => domain.toLowerCase()),
    groupRoleMappings: parseOAuthGroupRoleMappings(env.AUTH_OAUTH_GROUP_ROLE_MAPPINGS),
    mockAuthorizationBaseUrl: normalizeBaseUrl(emptyToUndefined(env.AUTH_OAUTH_MOCK_AUTHORIZATION_URL)),
    oidc: enabled && provider === "oidc"
      ? {
          issuer: emptyToUndefined(env.AUTH_OAUTH_ISSUER),
          clientId: requireConfigEnv(env, "AUTH_OAUTH_CLIENT_ID", "AUTH_OAUTH_ENABLED=true and AUTH_OAUTH_PROVIDER=oidc"),
          clientSecret: requireConfigEnv(env, "AUTH_OAUTH_CLIENT_SECRET", "AUTH_OAUTH_ENABLED=true and AUTH_OAUTH_PROVIDER=oidc"),
          authorizationUrl: requireConfigEnv(env, "AUTH_OAUTH_AUTHORIZATION_URL", "AUTH_OAUTH_ENABLED=true and AUTH_OAUTH_PROVIDER=oidc"),
          tokenUrl: requireConfigEnv(env, "AUTH_OAUTH_TOKEN_URL", "AUTH_OAUTH_ENABLED=true and AUTH_OAUTH_PROVIDER=oidc"),
          userInfoUrl: requireConfigEnv(env, "AUTH_OAUTH_USERINFO_URL", "AUTH_OAUTH_ENABLED=true and AUTH_OAUTH_PROVIDER=oidc"),
          scopes: parseCsvList(env.AUTH_OAUTH_SCOPES, ["openid", "email", "profile"]),
          groupsClaim: emptyToUndefined(env.AUTH_OAUTH_GROUP_CLAIM) ?? "groups",
          requestTimeoutMs: parsePositiveInteger(env.AUTH_OAUTH_REQUEST_TIMEOUT_MS, 10_000)
      }
      : undefined
  };
}

function createScimConfig(env: NodeJS.ProcessEnv): ApiConfig["scim"] {
  return {
    enabled: env.SCIM_ENABLED === "true",
    bearerToken: emptyToUndefined(env.SCIM_BEARER_TOKEN),
    baseUrl: normalizeBaseUrl(emptyToUndefined(env.SCIM_BASE_URL))
  };
}

function emptyToUndefined(value: string | undefined): string | undefined {
  return value && value.trim().length > 0 ? value : undefined;
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  return value ? value.replace(/\/+$/g, "") : undefined;
}

function assertProductionSafety(env: NodeJS.ProcessEnv, config: ApiConfig): void {
  if (env.NODE_ENV !== "production") {
    return;
  }
  const hasStrongAdminToken = Boolean(config.apiAuthToken) &&
    config.apiAuthToken !== "change-me-in-production" &&
    (config.apiAuthToken?.length ?? 0) >= 24;
  const hasStrongOwnerTokens = config.ownerAccessTokens.length > 0 &&
    config.ownerAccessTokens.every((entry) => entry.token.length >= 24);
  const hasStrongUserTokens = config.userAccessTokens.length > 0 &&
    config.userAccessTokens.every((entry) => entry.token.length >= 24);
  if (!hasStrongAdminToken && !hasStrongOwnerTokens && !hasStrongUserTokens) {
    throw new Error("NODE_ENV=production requires API_AUTH_TOKEN, API_OWNER_TOKENS, or API_USER_TOKENS with at least 24 non-placeholder characters.");
  }
  if (config.corsOrigin === "*") {
    throw new Error("NODE_ENV=production does not allow CORS_ORIGIN=*.");
  }
  if (config.userAccountMfaPolicy.enabled) {
    const key = config.userAccountMfaPolicy.secretEncryptionKey;
    if (!key || key === "change-me-32-byte-minimum-mfa-key" || key.length < 32) {
      throw new Error("NODE_ENV=production with AUTH_MFA_ENABLED=true requires AUTH_MFA_ENCRYPTION_KEY with at least 32 non-placeholder characters.");
    }
  }
  if (config.oauth.enabled) {
    if (!config.oauth.redirectUri.startsWith("https://")) {
      throw new Error("NODE_ENV=production with AUTH_OAUTH_ENABLED=true requires an HTTPS AUTH_OAUTH_REDIRECT_URI.");
    }
    if (config.oauth.provider === "oidc") {
      const oidc = config.oauth.oidc;
      if (!oidc || oidc.clientSecret.length < 16) {
        throw new Error("NODE_ENV=production with AUTH_OAUTH_PROVIDER=oidc requires a strong AUTH_OAUTH_CLIENT_SECRET.");
      }
      if (!oidc.authorizationUrl.startsWith("https://") || !oidc.tokenUrl.startsWith("https://") || !oidc.userInfoUrl.startsWith("https://")) {
        throw new Error("NODE_ENV=production with AUTH_OAUTH_PROVIDER=oidc requires HTTPS OIDC endpoints.");
      }
    }
  }
  if (config.userAccountAccessPolicy.ssoRequiredEmailDomains.length > 0 && !config.oauth.enabled) {
    throw new Error("NODE_ENV=production with AUTH_SSO_REQUIRED_EMAIL_DOMAINS requires AUTH_OAUTH_ENABLED=true.");
  }
  if (config.scim.enabled) {
    if (!config.scim.bearerToken || config.scim.bearerToken === "change-me-scim-token" || config.scim.bearerToken.length < 24) {
      throw new Error("NODE_ENV=production with SCIM_ENABLED=true requires SCIM_BEARER_TOKEN with at least 24 non-placeholder characters.");
    }
    if (config.scim.baseUrl && !config.scim.baseUrl.startsWith("https://")) {
      throw new Error("NODE_ENV=production with SCIM_ENABLED=true requires HTTPS SCIM_BASE_URL.");
    }
  }
  if (config.billingCheckoutProvider === "stripe") {
    const stripe = config.stripeBilling;
    if (!stripe || stripe.secretKey.length < 16 || stripe.webhookSecret.length < 16) {
      throw new Error("NODE_ENV=production with BILLING_CHECKOUT_PROVIDER=stripe requires strong STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.");
    }
    if (!stripe.priceIds.pro || !stripe.priceIds.studio) {
      throw new Error("NODE_ENV=production with BILLING_CHECKOUT_PROVIDER=stripe requires STRIPE_PRICE_PRO and STRIPE_PRICE_STUDIO.");
    }
  }
}

function parseOwnerAccessTokens(value: string | undefined): OwnerAccessToken[] {
  return parseScopedTokens(value, "ownerId").map((entry) => ({
    ownerId: entry.subjectId,
    token: entry.token
  }));
}

function parseUserAccessTokens(value: string | undefined): UserAccessToken[] {
  return parseScopedTokens(value, "userId").map((entry) => ({
    userId: entry.subjectId,
    token: entry.token
  }));
}

function parseScopedTokens(value: string | undefined, subjectLabel: string): Array<{ subjectId: string; token: string }> {
  if (!value) {
    return [];
  }
  return value.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separator = entry.indexOf(":");
      if (separator <= 0 || separator === entry.length - 1) {
        throw new Error(`Token entries must use ${subjectLabel}:token format.`);
      }
      return {
        subjectId: entry.slice(0, separator),
        token: entry.slice(separator + 1)
      };
    });
}

function parseCsvList(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback;
  }
  return value.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function defaultBlockedTerms(): string[] {
  return ["儿童色情", "未成年色情", "真实自残教程", "爆炸物制作", "信用卡盗刷"];
}

function defaultReviewTerms(): string[] {
  return ["自残", "血腥", "露骨", "仇恨"];
}
