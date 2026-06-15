import { join } from "node:path";
import {
  createOpenAIImageGenerationProviderFromEnv,
  createOpenAITextModelProviderFromEnv,
  createProjectFromNovel
} from "@agentic-galgame/vn-agent";
import { validateProject, type VNProject } from "@agentic-galgame/vn-core";
import {
  CloudflareCachePurgeProvider,
  createPlatform,
  FileDatabase,
  LocalAssetStorage,
  NodePostgresExecutor,
  MockOAuthLoginProvider,
  OidcOAuthLoginProvider,
  PostgresAccessTokenRepository,
  PostgresAssetRepository,
  PostgresAuditRepository,
  PostgresBillingCheckoutSessionRepository,
  PostgresBillingEventRepository,
  PostgresBillingPlanRepository,
  PostgresBillingSubscriptionRepository,
  PostgresContentSafetyRepository,
  PostgresDeploymentInvalidationRepository,
  PostgresJobRepository,
  PostgresNotificationDeliveryRepository,
  PostgresOAuthIdentityRepository,
  PostgresOAuthStateRepository,
  PostgresPublishedProjectReleaseRepository,
  PostgresProjectRepository,
  PostgresReleaseApprovalCommentRepository,
  PostgresReleaseApprovalRepository,
  PostgresTeamInvitationRepository,
  PostgresTeamRepository,
  PostgresUserAccountActionTokenRepository,
  PostgresUserAccountRepository,
  PostgresUserSessionRepository,
  PostgresUsageRepository,
  S3CompatibleAssetStorage,
  StripeBillingCheckoutProvider,
  WebhookReleaseApprovalNotifier,
  WebhookTeamInvitationNotifier,
  WebhookUserAccountNotifier,
  type AssetRepository,
  type BillingCheckoutProvider,
  type PlatformRepositories,
  type VNPlatform
} from "@agentic-galgame/vn-platform";
import type { ApiConfig } from "./config.js";

export function createApiPlatform(config: ApiConfig): VNPlatform {
  if (!config.databaseUrl && config.assetStorageProvider === "local") {
    return createPlatform({
      dataDir: config.dataDir,
      assetPublicBasePath: config.apiPublicBaseUrl ? `${config.apiPublicBaseUrl}/assets` : undefined,
      playerBaseUrl: config.playerBaseUrl,
      publicProjectBaseUrl: config.apiPublicBaseUrl,
      deploymentCacheProvider: createDeploymentCacheProvider(config),
      projectGenerator: createProjectGenerator(config),
      imageGenerator: createImageGenerator(config),
      aiEnabled: config.aiEnabled,
      quotaPolicy: config.quotaPolicy,
      costPolicy: config.costPolicy,
      retryPolicy: config.retryPolicy,
      notificationRetryPolicy: config.notificationRetryPolicy,
      contentSafetyPolicy: config.contentSafetyPolicy,
      userAccountSecurityPolicy: config.userAccountSecurityPolicy,
      userAccountMfaPolicy: config.userAccountMfaPolicy,
      userAccountAccessPolicy: config.userAccountAccessPolicy,
      oauthProvider: createOAuthProvider(config),
      oauthPolicy: createOAuthPolicy(config),
      billingCheckoutProvider: createBillingCheckoutProvider(config),
      billingEntitlementPolicy: config.billingEntitlementPolicy,
      releaseApprovalNotifier: createReleaseApprovalNotifier(config),
      teamInvitationNotifier: createTeamInvitationNotifier(config),
      userAccountNotifier: createUserAccountNotifier(config)
    });
  }

  const repositories = createRepositories(config);
  const assetStorage = createAssetStorage(config, repositories.assets);
  return createPlatform({
    dataDir: config.dataDir,
    repositories,
    assetStorage,
    playerBaseUrl: config.playerBaseUrl,
    publicProjectBaseUrl: config.apiPublicBaseUrl,
    deploymentCacheProvider: createDeploymentCacheProvider(config),
    projectGenerator: createProjectGenerator(config),
    imageGenerator: createImageGenerator(config),
    aiEnabled: config.aiEnabled,
    quotaPolicy: config.quotaPolicy,
    costPolicy: config.costPolicy,
    retryPolicy: config.retryPolicy,
    notificationRetryPolicy: config.notificationRetryPolicy,
    contentSafetyPolicy: config.contentSafetyPolicy,
    userAccountSecurityPolicy: config.userAccountSecurityPolicy,
    userAccountMfaPolicy: config.userAccountMfaPolicy,
    userAccountAccessPolicy: config.userAccountAccessPolicy,
    oauthProvider: createOAuthProvider(config),
    oauthPolicy: createOAuthPolicy(config),
    billingCheckoutProvider: createBillingCheckoutProvider(config),
    billingEntitlementPolicy: config.billingEntitlementPolicy,
    releaseApprovalNotifier: createReleaseApprovalNotifier(config),
    teamInvitationNotifier: createTeamInvitationNotifier(config),
    userAccountNotifier: createUserAccountNotifier(config)
  });
}

function createBillingCheckoutProvider(config: ApiConfig): BillingCheckoutProvider | undefined {
  if (config.billingCheckoutProvider !== "stripe") {
    return undefined;
  }
  if (!config.stripeBilling) {
    throw new Error("Stripe billing config is required when BILLING_CHECKOUT_PROVIDER=stripe.");
  }
  return new StripeBillingCheckoutProvider({
    secretKey: config.stripeBilling.secretKey,
    priceIds: config.stripeBilling.priceIds,
    apiBaseUrl: config.stripeBilling.apiBaseUrl,
    requestTimeoutMs: config.stripeBilling.requestTimeoutMs
  });
}

function createRepositories(config: ApiConfig): PlatformRepositories {
  if (config.databaseUrl) {
    const executor = new NodePostgresExecutor({
      connectionString: config.databaseUrl,
      ssl: config.postgresSsl
    });
    return {
      projects: new PostgresProjectRepository(executor),
      jobs: new PostgresJobRepository(executor),
      assets: new PostgresAssetRepository(executor),
      publishedProjectReleases: new PostgresPublishedProjectReleaseRepository(executor),
      releaseApprovals: new PostgresReleaseApprovalRepository(executor),
      releaseApprovalComments: new PostgresReleaseApprovalCommentRepository(executor),
      notificationDeliveries: new PostgresNotificationDeliveryRepository(executor),
      usage: new PostgresUsageRepository(executor),
      billingPlans: new PostgresBillingPlanRepository(executor),
      billingSubscriptions: new PostgresBillingSubscriptionRepository(executor),
      billingCheckoutSessions: new PostgresBillingCheckoutSessionRepository(executor),
      billingEvents: new PostgresBillingEventRepository(executor),
      audit: new PostgresAuditRepository(executor),
      contentSafety: new PostgresContentSafetyRepository(executor),
      accessTokens: new PostgresAccessTokenRepository(executor),
      userAccounts: new PostgresUserAccountRepository(executor),
      userAccountActionTokens: new PostgresUserAccountActionTokenRepository(executor),
      userSessions: new PostgresUserSessionRepository(executor),
      oauthStates: new PostgresOAuthStateRepository(executor),
      oauthIdentities: new PostgresOAuthIdentityRepository(executor),
      teams: new PostgresTeamRepository(executor),
      teamInvitations: new PostgresTeamInvitationRepository(executor),
      deploymentInvalidations: new PostgresDeploymentInvalidationRepository(executor)
    };
  }

  const database = new FileDatabase(join(config.dataDir, "db.json"));
  return {
    projects: database.projects(),
    jobs: database.jobs(),
    assets: database.assets(),
    publishedProjectReleases: database.publishedProjectReleases(),
    releaseApprovals: database.releaseApprovals(),
    releaseApprovalComments: database.releaseApprovalComments(),
    notificationDeliveries: database.notificationDeliveries(),
    usage: database.usage(),
    billingPlans: database.billingPlans(),
    billingSubscriptions: database.billingSubscriptions(),
    billingCheckoutSessions: database.billingCheckoutSessions(),
    billingEvents: database.billingEvents(),
    audit: database.audit(),
    contentSafety: database.contentSafety(),
    accessTokens: database.accessTokens(),
    userAccounts: database.userAccounts(),
    userAccountActionTokens: database.userAccountActionTokens(),
    userSessions: database.userSessions(),
    oauthStates: database.oauthStates(),
    oauthIdentities: database.oauthIdentities(),
    teams: database.teams(),
    teamInvitations: database.teamInvitations(),
    deploymentInvalidations: database.deploymentInvalidations()
  };
}

function createOAuthPolicy(config: ApiConfig) {
  return {
    enabled: config.oauth.enabled,
    redirectUri: config.oauth.redirectUri,
    stateTtlMs: config.oauth.stateTtlMs,
    allowedReturnUrlOrigins: config.oauth.allowedReturnUrlOrigins,
    requireVerifiedEmail: config.oauth.requireVerifiedEmail,
    allowedEmailDomains: config.oauth.allowedEmailDomains,
    groupRoleMappings: config.oauth.groupRoleMappings
  };
}

function createOAuthProvider(config: ApiConfig) {
  if (!config.oauth.enabled) {
    return undefined;
  }
  if (config.oauth.provider === "oidc") {
    if (!config.oauth.oidc) {
      throw new Error("OIDC OAuth config is required when AUTH_OAUTH_PROVIDER=oidc.");
    }
    return new OidcOAuthLoginProvider({
      issuer: config.oauth.oidc.issuer,
      clientId: config.oauth.oidc.clientId,
      clientSecret: config.oauth.oidc.clientSecret,
      authorizationUrl: config.oauth.oidc.authorizationUrl,
      tokenUrl: config.oauth.oidc.tokenUrl,
      userInfoUrl: config.oauth.oidc.userInfoUrl,
      scopes: config.oauth.oidc.scopes,
      groupsClaim: config.oauth.oidc.groupsClaim,
      requestTimeoutMs: config.oauth.oidc.requestTimeoutMs
    });
  }
  return new MockOAuthLoginProvider(config.oauth.mockAuthorizationBaseUrl);
}

function createDeploymentCacheProvider(config: ApiConfig) {
  if (config.deploymentCacheProvider !== "cloudflare" || !config.cloudflare) {
    return undefined;
  }
  return new CloudflareCachePurgeProvider({
    zoneId: config.cloudflare.zoneId,
    apiToken: config.cloudflare.apiToken,
    apiBaseUrl: config.cloudflare.apiBaseUrl
  });
}

function createReleaseApprovalNotifier(config: ApiConfig) {
  if (!config.releaseApprovalWebhook) {
    return undefined;
  }
  return new WebhookReleaseApprovalNotifier({
    url: config.releaseApprovalWebhook.url,
    secret: config.releaseApprovalWebhook.secret,
    timeoutMs: config.releaseApprovalWebhook.timeoutMs
  });
}

function createTeamInvitationNotifier(config: ApiConfig) {
  if (!config.teamInvitationWebhook) {
    return undefined;
  }
  return new WebhookTeamInvitationNotifier({
    url: config.teamInvitationWebhook.url,
    secret: config.teamInvitationWebhook.secret,
    timeoutMs: config.teamInvitationWebhook.timeoutMs,
    acceptBaseUrl: config.teamInvitationWebhook.acceptBaseUrl
  });
}

function createUserAccountNotifier(config: ApiConfig) {
  if (!config.userAccountWebhook) {
    return undefined;
  }
  return new WebhookUserAccountNotifier({
    url: config.userAccountWebhook.url,
    secret: config.userAccountWebhook.secret,
    timeoutMs: config.userAccountWebhook.timeoutMs,
    emailVerificationBaseUrl: config.userAccountWebhook.emailVerificationBaseUrl,
    passwordResetBaseUrl: config.userAccountWebhook.passwordResetBaseUrl
  });
}

function createAssetStorage(config: ApiConfig, assets: AssetRepository) {
  if (config.assetStorageProvider === "s3") {
    if (!config.s3) {
      throw new Error("S3 config is required when ASSET_STORAGE_PROVIDER=s3.");
    }
    return new S3CompatibleAssetStorage({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      bucket: config.s3.bucket,
      accessKeyId: config.s3.accessKeyId,
      secretAccessKey: config.s3.secretAccessKey,
      publicBaseUrl: config.s3.publicBaseUrl,
      forcePathStyle: config.s3.forcePathStyle,
      repository: assets
    });
  }

  return new LocalAssetStorage(
    join(config.dataDir, "assets"),
    assets,
    config.apiPublicBaseUrl ? `${config.apiPublicBaseUrl}/assets` : undefined
  );
}

function createImageGenerator(config: ApiConfig) {
  if (!config.aiEnabled || config.aiImageProvider !== "openai-compatible" || !config.openAIImage?.OPENAI_API_KEY) {
    return undefined;
  }
  return createOpenAIImageGenerationProviderFromEnv(config.openAIImage);
}

function createProjectGenerator(config: ApiConfig) {
  if (!config.aiEnabled || config.aiTextProvider !== "openai-compatible" || !config.openAIText?.OPENAI_API_KEY && !config.openAIText?.OPENAI_TEXT_API_KEY) {
    return undefined;
  }
  const provider = createOpenAITextModelProviderFromEnv(config.openAIText);
  return {
    id: provider.id,
    async createProject(input: {
      title: string;
      novelText: string;
      style?: {
        name?: string;
        mood?: string;
      };
    }): Promise<VNProject> {
      const baselineProject = createProjectFromNovel(input);
      const generated = await provider.generateStructured<VNProject>({
        task: "novel_to_project",
        schemaName: "VNProject",
        prompt: createVNProjectPrompt(input, baselineProject)
      });
      const validation = validateProject(generated);
      if (!validation.valid) {
        throw new Error(`Text provider returned invalid VNProject: ${validation.errors.join("; ")}`);
      }
      return generated;
    }
  };
}

function createVNProjectPrompt(input: { title: string; novelText: string }, baselineProject: VNProject): string {
  return [
    "Create a complete VNProject JSON for this imported novel.",
    "Requirements:",
    "- Keep VNProject serializable JSON.",
    "- Keep every beat line text short enough for a two-line visual novel textbox.",
    "- Use dialogue/narration/monologue line kinds correctly.",
    "- Preserve or improve the schema shape from the baseline project.",
    "- Return only the VNProject JSON object, no markdown.",
    "",
    `Title: ${input.title}`,
    "",
    "Novel text:",
    input.novelText,
    "",
    "Baseline valid VNProject JSON that you may refine:",
    JSON.stringify(baselineProject)
  ].join("\n");
}
