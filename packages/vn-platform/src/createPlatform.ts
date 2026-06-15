import { join } from "node:path";
import { FileDatabase } from "./repositories/FileDatabase.js";
import { AccessTokenService } from "./services/AccessTokenService.js";
import { AuditService } from "./services/AuditService.js";
import { AssetService } from "./services/AssetService.js";
import { BillingService, MockBillingCheckoutProvider } from "./services/BillingService.js";
import { ContentSafetyService } from "./services/ContentSafetyService.js";
import { DeploymentService } from "./services/DeploymentService.js";
import { GenerationJobService } from "./services/GenerationJobService.js";
import { NotificationDeliveryService } from "./services/NotificationDeliveryService.js";
import { OperationsService } from "./services/OperationsService.js";
import { MockOAuthLoginProvider, OAuthService } from "./services/OAuthService.js";
import { ProjectDiffService } from "./services/ProjectDiffService.js";
import { ProjectPublishService } from "./services/ProjectPublishService.js";
import { ProjectService } from "./services/ProjectService.js";
import { ReleaseApprovalService } from "./services/ReleaseApprovalService.js";
import { TeamInvitationService } from "./services/TeamInvitationService.js";
import { TeamService } from "./services/TeamService.js";
import { UsageService } from "./services/UsageService.js";
import { UserAccountService } from "./services/UserAccountService.js";
import { LocalAssetStorage } from "./storage/LocalAssetStorage.js";
import type {
  AccessTokenRepository,
  AuditRepository,
  AssetRepository,
  AssetStorage,
  BillingCheckoutProvider,
  BillingCheckoutSessionRepository,
  BillingEventRepository,
  BillingEntitlementPolicy,
  BillingPlanRepository,
  BillingSubscriptionRepository,
  ContentSafetyPolicy,
  ContentSafetyRepository,
  CostPolicy,
  DeploymentCacheProvider,
  DeploymentInvalidationRepository,
  ImageAssetGenerator,
  JobRepository,
  NotificationDeliveryRepository,
  NotificationRetryPolicy,
  OAuthGroupRoleMapping,
  OAuthIdentityRepository,
  OAuthLoginProvider,
  OAuthStateRepository,
  PublishedProjectReleaseRepository,
  NovelProjectGenerator,
  ProjectRepository,
  QuotaPolicy,
  ReleaseApprovalCommentRepository,
  ReleaseApprovalNotifier,
  ReleaseApprovalRepository,
  RetryPolicy,
  TeamInvitationNotifier,
  TeamInvitationRepository,
  TeamRepository,
	  UserAccountActionTokenRepository,
  UserAccountAccessPolicy,
	  UserAccountMfaPolicy,
	  UserAccountNotifier,
	  UserAccountRepository,
	  UserAccountSecurityPolicy,
  UserSessionRepository,
  UsageRepository
} from "./types.js";

export interface PlatformOptions {
  dataDir?: string;
  aiEnabled?: boolean;
  assetPublicBasePath?: string;
  playerBaseUrl?: string;
  publicProjectBaseUrl?: string;
  repositories?: PlatformRepositories;
  assetStorage?: AssetStorage;
  deploymentCacheProvider?: DeploymentCacheProvider;
  imageGenerator?: ImageAssetGenerator;
  projectGenerator?: NovelProjectGenerator;
  fetchGeneratedAsset?: typeof fetch;
  quotaPolicy?: QuotaPolicy;
  costPolicy?: CostPolicy;
  retryPolicy?: RetryPolicy;
  notificationRetryPolicy?: NotificationRetryPolicy;
  contentSafetyPolicy?: ContentSafetyPolicy;
  userAccountSecurityPolicy?: Partial<UserAccountSecurityPolicy>;
  userAccountMfaPolicy?: Partial<UserAccountMfaPolicy>;
  userAccountAccessPolicy?: Partial<UserAccountAccessPolicy>;
  oauthProvider?: OAuthLoginProvider;
  oauthPolicy?: {
    enabled?: boolean;
    redirectUri?: string;
    stateTtlMs?: number;
    allowedReturnUrlOrigins?: string[];
    requireVerifiedEmail?: boolean;
    allowedEmailDomains?: string[];
    groupRoleMappings?: OAuthGroupRoleMapping[];
  };
  releaseApprovalNotifier?: ReleaseApprovalNotifier;
  teamInvitationNotifier?: TeamInvitationNotifier;
  userAccountNotifier?: UserAccountNotifier;
  billingCheckoutProvider?: BillingCheckoutProvider;
  billingEntitlementPolicy?: BillingEntitlementPolicy;
}

export interface PlatformRepositories {
  projects: ProjectRepository;
  jobs: JobRepository;
  assets: AssetRepository;
  publishedProjectReleases: PublishedProjectReleaseRepository;
  releaseApprovals: ReleaseApprovalRepository;
  releaseApprovalComments: ReleaseApprovalCommentRepository;
  notificationDeliveries: NotificationDeliveryRepository;
  usage: UsageRepository;
  billingPlans: BillingPlanRepository;
  billingSubscriptions: BillingSubscriptionRepository;
  billingCheckoutSessions: BillingCheckoutSessionRepository;
  billingEvents: BillingEventRepository;
  audit: AuditRepository;
  contentSafety: ContentSafetyRepository;
  accessTokens: AccessTokenRepository;
  teams: TeamRepository;
  teamInvitations: TeamInvitationRepository;
  userAccounts: UserAccountRepository;
  userAccountActionTokens: UserAccountActionTokenRepository;
  userSessions: UserSessionRepository;
  oauthStates: OAuthStateRepository;
  oauthIdentities: OAuthIdentityRepository;
  deploymentInvalidations: DeploymentInvalidationRepository;
}

export interface VNPlatform {
  database?: FileDatabase;
  projects: ProjectService;
  jobs: GenerationJobService;
  assets: AssetService;
  billing: BillingService;
  usage: UsageService;
  audit: AuditService;
  contentSafety: ContentSafetyService;
  accessTokens: AccessTokenService;
  userAccounts: UserAccountService;
  oauth: OAuthService;
  teams: TeamService;
  teamInvitations: TeamInvitationService;
  deployments: DeploymentService;
  notifications: NotificationDeliveryService;
  operations: OperationsService;
  publishing: ProjectPublishService;
  projectDiffs: ProjectDiffService;
  releaseApprovals: ReleaseApprovalService;
}

export function createPlatform(options: PlatformOptions): VNPlatform {
  let database: FileDatabase | undefined;
  let repositories = options.repositories;
  if (!repositories) {
    database = new FileDatabase(join(requireDataDir(options), "db.json"));
    repositories = {
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
  const assetStorage = options.assetStorage ?? new LocalAssetStorage(
    join(requireDataDir(options), "assets"),
    repositories.assets,
    options.assetPublicBasePath
  );
  const usage = new UsageService(repositories.usage);
  const audit = new AuditService(repositories.audit);
  const billing = new BillingService(
    repositories.billingPlans,
    repositories.billingSubscriptions,
    repositories.billingCheckoutSessions,
    repositories.billingEvents,
    options.billingCheckoutProvider ?? new MockBillingCheckoutProvider(),
    audit
  );
  const accessTokens = new AccessTokenService(repositories.accessTokens, audit);
  const userAccounts = new UserAccountService(
    repositories.userAccounts,
    repositories.userSessions,
    repositories.userAccountActionTokens,
    audit,
    options.userAccountNotifier,
    options.userAccountSecurityPolicy,
    options.userAccountMfaPolicy,
    options.userAccountAccessPolicy
  );
  const teams = new TeamService(repositories.teams, audit);
  const oauth = new OAuthService(
    repositories.oauthStates,
    repositories.oauthIdentities,
    userAccounts,
    audit,
    options.oauthProvider ?? (options.oauthPolicy?.enabled ? new MockOAuthLoginProvider() : undefined),
    {
      enabled: options.oauthPolicy?.enabled ?? false,
      redirectUri: options.oauthPolicy?.redirectUri ?? "",
      stateTtlMs: options.oauthPolicy?.stateTtlMs,
      allowedReturnUrlOrigins: options.oauthPolicy?.allowedReturnUrlOrigins,
      requireVerifiedEmail: options.oauthPolicy?.requireVerifiedEmail,
      allowedEmailDomains: options.oauthPolicy?.allowedEmailDomains,
      groupRoleMappings: options.oauthPolicy?.groupRoleMappings
    },
    teams
  );
  const teamInvitations = new TeamInvitationService(
    repositories.teamInvitations,
    teams,
    audit,
    options.teamInvitationNotifier
  );
  const deployments = new DeploymentService(
    repositories.deploymentInvalidations,
    audit,
    options.deploymentCacheProvider
  );
  const notifications = new NotificationDeliveryService(
    repositories.notificationDeliveries,
    audit,
    options.releaseApprovalNotifier,
    options.notificationRetryPolicy ?? defaultNotificationRetryPolicy()
  );
  const contentSafety = new ContentSafetyService(
    repositories.contentSafety,
    options.contentSafetyPolicy ?? defaultContentSafetyPolicy()
  );
  const assets = new AssetService(assetStorage, repositories.assets, usage, audit);
  const projects = new ProjectService(repositories.projects, options.projectGenerator, audit, contentSafety);
  const publishing = new ProjectPublishService(
    projects,
    assets,
    repositories.publishedProjectReleases,
    options.playerBaseUrl,
    options.publicProjectBaseUrl,
    deployments
  );
  const projectDiffs = new ProjectDiffService(
    projects,
    repositories.publishedProjectReleases
  );
  const releaseApprovals = new ReleaseApprovalService(
    repositories.releaseApprovals,
    repositories.releaseApprovalComments,
    projects,
    publishing,
    projectDiffs,
    audit,
    options.releaseApprovalNotifier ? notifications : undefined
  );
  const jobs = new GenerationJobService({
    jobs: repositories.jobs,
    projectService: projects,
    assetService: assets,
    usageService: usage,
    billingService: billing,
    auditService: audit,
    contentSafetyService: contentSafety,
    imageGenerator: options.imageGenerator,
    fetchAsset: options.fetchGeneratedAsset,
    aiEnabled: options.aiEnabled,
    quotaPolicy: options.quotaPolicy ?? defaultQuotaPolicy(),
    billingEntitlementPolicy: options.billingEntitlementPolicy ?? defaultBillingEntitlementPolicy(),
    costPolicy: options.costPolicy ?? defaultCostPolicy(),
    retryPolicy: options.retryPolicy ?? defaultRetryPolicy()
  });
  const operations = new OperationsService(
    projects,
    jobs,
    releaseApprovals,
    notifications,
    contentSafety,
    deployments,
    usage,
    audit
  );

  return {
    database,
    projects,
    jobs,
    assets,
    billing,
    usage,
    audit,
    contentSafety,
    accessTokens,
    userAccounts,
    oauth,
    teams,
    teamInvitations,
    deployments,
    notifications,
    operations,
    publishing,
    projectDiffs,
    releaseApprovals
  };
}

function requireDataDir(options: PlatformOptions): string {
  if (!options.dataDir) {
    throw new Error("createPlatform requires dataDir when repositories are not injected.");
  }
  return options.dataDir;
}

function defaultQuotaPolicy(): QuotaPolicy {
  return {
    dailyJobLimit: 1_000,
    dailyTextJobLimit: 500,
    dailyImageJobLimit: 100
  };
}

function defaultCostPolicy(): CostPolicy {
  return {
    textJobCostCents: 2,
    imageJobCostCents: 8
  };
}

function defaultBillingEntitlementPolicy(): BillingEntitlementPolicy {
  return {
    blockPastDue: true,
    pastDueGracePeriodMs: 3 * 24 * 60 * 60 * 1000
  };
}

function defaultRetryPolicy(): RetryPolicy {
  return {
    maxAttempts: 3,
    retryDelayMs: 30_000
  };
}

function defaultNotificationRetryPolicy(): NotificationRetryPolicy {
  return {
    maxAttempts: 3,
    retryDelayMs: 30_000
  };
}

function defaultContentSafetyPolicy(): ContentSafetyPolicy {
  return {
    enabled: true,
    blockOnReview: false,
    blockedTerms: defaultBlockedTerms(),
    reviewTerms: defaultReviewTerms()
  };
}

function defaultBlockedTerms(): string[] {
  return ["儿童色情", "未成年色情", "真实自残教程", "爆炸物制作", "信用卡盗刷"];
}

function defaultReviewTerms(): string[] {
  return ["自残", "血腥", "露骨", "仇恨"];
}
