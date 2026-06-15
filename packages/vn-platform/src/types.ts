import type { VNProject } from "@agentic-galgame/vn-core";

export type ProjectSource = "imported_novel" | "uploaded_project" | "api";
export type JobKind = "novel_to_project" | "asset_generation";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "blocked" | "waiting_for_credentials";
export type AssetStorageProvider = "local_fs" | "s3_compatible";
export type UsageMetric =
  | "job_enqueued"
  | "text_job_enqueued"
  | "image_job_enqueued"
  | "job_succeeded"
  | "job_failed"
  | "job_blocked"
  | "asset_bytes"
  | "estimated_cost_cents";
export type AuditOutcome = "succeeded" | "failed" | "blocked";
export type ContentSafetySource = "novel_text" | "project_json" | "asset_prompt";
export type ContentSafetyDecision = "approved" | "review_required" | "blocked";
export type AccessTokenRole = "admin" | "owner" | "user";
export type TeamMemberRole = "owner" | "admin" | "editor" | "viewer";
export type TeamInvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type DeploymentCacheProviderId = "none" | "cloudflare";
export type DeploymentInvalidationStatus = "skipped" | "succeeded" | "failed";
export type DeploymentInvalidationReason = "publish" | "rollback";
export type ReleaseApprovalStatus = "pending" | "published" | "rejected" | "cancelled";
export type ReleaseApprovalNotificationEvent =
  | "release_approval_requested"
  | "release_approval_updated"
  | "release_approval_commented"
  | "release_approval_published"
  | "release_approval_rejected"
  | "release_approval_stale";
export type TeamInvitationNotificationEvent =
  | "team_invitation_created"
  | "team_invitation_accepted"
  | "team_invitation_revoked"
  | "team_invitation_expired";
export type UserAccountActionTokenPurpose = "email_verification" | "password_reset";
export type UserAccountActionTokenStatus = "pending" | "used" | "revoked" | "expired";
export type UserAccountNotificationEvent =
  | "user_email_verification_requested"
  | "user_email_verified"
  | "user_password_reset_requested"
  | "user_password_reset_completed";
export type OAuthProviderId = "mock" | "oidc";
export type OAuthStateStatus = "pending" | "used" | "expired";
export type NotificationDeliveryStatus = "pending" | "running" | "succeeded" | "failed";
export type OperationsStatus = "healthy" | "degraded" | "critical";
export type OperationsIncidentSeverity = "warning" | "critical";
export type OperationsIncidentSource =
  | "job"
  | "notification"
  | "content_safety"
  | "deployment"
  | "release_approval";
export type BillingPlanInterval = "month" | "year";
export type BillingSubscriptionStatus = "trialing" | "active" | "past_due" | "cancelled";
export type BillingCheckoutSessionStatus = "created" | "completed" | "cancelled" | "expired";
export type BillingCheckoutProviderId = "mock" | "stripe";
export type BillingProviderEventType =
  | "checkout_completed"
  | "subscription_updated"
  | "subscription_cancelled"
  | "invoice_paid"
  | "invoice_payment_failed"
  | "invoice_payment_action_required"
  | "refund_created"
  | "dispute_created"
  | "dispute_closed";

export interface StudioProjectRecord {
  id: string;
  title: string;
  ownerId: string;
  source: ProjectSource;
  vnProject: VNProject;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  currentReleaseId?: string;
  publishedProjectUrl?: string;
  publishedPlayableUrl?: string;
}

export interface GenerationJobRecord {
  id: string;
  kind: JobKind;
  status: JobStatus;
  projectId?: string;
  ownerId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  nextRunAt?: string;
}

export interface AssetRecord {
  id: string;
  projectId: string;
  ownerId: string;
  assetId: string;
  provider: AssetStorageProvider;
  contentType: string;
  byteLength: number;
  storageKey: string;
  publicUrl?: string;
  createdAt: string;
}

export interface PublishedProjectResult {
  project: StudioProjectRecord;
  projectUrl: string;
  playableUrl?: string;
  currentProjectUrl?: string;
  currentPlayableUrl?: string;
  publishedProject: VNProject;
  projectJsonAsset: AssetRecord;
  assetRecords: AssetRecord[];
  release: PublishedProjectReleaseRecord;
  deploymentInvalidation?: DeploymentInvalidationRecord;
  publishedAt: string;
}

export interface PublishedProjectRollbackResult {
  project: StudioProjectRecord;
  release: PublishedProjectReleaseRecord;
  rolledBackAt: string;
  currentProjectUrl?: string;
  currentPlayableUrl?: string;
  deploymentInvalidation?: DeploymentInvalidationRecord;
}

export interface ProjectReleaseSummary {
  fingerprint: string;
  title: string;
  chapterCount: number;
  sceneCount: number;
  shotCount: number;
  beatCount: number;
  characterCount: number;
  assetCount: number;
  cgBeatCount: number;
  beats: ProjectReleaseBeatSummary[];
  assets: ProjectReleaseAssetSummary[];
  characters: ProjectReleaseCharacterSummary[];
}

export interface ProjectReleaseBeatSummary {
  id: string;
  chapterTitle: string;
  sceneTitle: string;
  shotTitle: string;
  lineKind: string;
  speakerId?: string;
  speakerName?: string;
  textHash: string;
  textPreview: string;
  renderMode?: string;
  cgAssetId?: string;
}

export interface ProjectReleaseAssetSummary {
  id: string;
  type: string;
  name: string;
  srcHash: string;
  placeholder: boolean;
  characterId?: string;
}

export interface ProjectReleaseCharacterSummary {
  id: string;
  name: string;
  role?: string;
  defaultSpriteId?: string;
  defaultExpression?: string;
}

export type ProjectReleaseDiffKind = "added" | "removed" | "changed";

export interface ProjectReleaseDiffItem {
  id: string;
  kind: ProjectReleaseDiffKind;
  label: string;
  previous?: string;
  current?: string;
}

export interface ProjectReleaseDiff {
  projectId: string;
  baseRelease?: {
    id: string;
    version: number;
    createdAt: string;
  };
  baseUnavailable: boolean;
  changed: boolean;
  current: Omit<ProjectReleaseSummary, "beats" | "assets" | "characters">;
  published?: Omit<ProjectReleaseSummary, "beats" | "assets" | "characters">;
  totals: {
    addedBeats: number;
    removedBeats: number;
    changedBeats: number;
    addedAssets: number;
    removedAssets: number;
    changedAssets: number;
    addedCharacters: number;
    removedCharacters: number;
    changedCharacters: number;
  };
  beatChanges: ProjectReleaseDiffItem[];
  assetChanges: ProjectReleaseDiffItem[];
  characterChanges: ProjectReleaseDiffItem[];
}

export interface ReleaseApprovalRecord {
  id: string;
  projectId: string;
  ownerId: string;
  status: ReleaseApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  publishedReleaseId?: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseApprovalCommentRecord {
  id: string;
  approvalId: string;
  projectId: string;
  ownerId: string;
  author: string;
  body: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface ReleaseApprovalPublishResult {
  approval: ReleaseApprovalRecord;
  published: PublishedProjectResult;
}

export interface ReleaseApprovalNotificationPayload {
  event: ReleaseApprovalNotificationEvent;
  approvalId: string;
  projectId: string;
  ownerId: string;
  approvalStatus: ReleaseApprovalStatus;
  actor?: string;
  commentId?: string;
  releaseId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TeamInvitationNotificationPayload {
  event: TeamInvitationNotificationEvent;
  invitationId: string;
  teamId: string;
  email: string;
  role: TeamMemberRole;
  invitedBy: string;
  invitedUserId?: string;
  acceptedByUserId?: string;
  actor?: string;
  invitationToken?: string;
  invitationAcceptUrl?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface UserAccountNotificationPayload {
  event: UserAccountNotificationEvent;
  userId: string;
  email: string;
  actionTokenId?: string;
  actionTokenPurpose?: UserAccountActionTokenPurpose;
  actionToken?: string;
  actionUrl?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface NotificationDeliveryRecord {
  id: string;
  ownerId: string;
  projectId: string;
  approvalId: string;
  event: ReleaseApprovalNotificationEvent;
  provider: string;
  status: NotificationDeliveryStatus;
  payload: ReleaseApprovalNotificationPayload;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface PublishedProjectReleaseRecord {
  id: string;
  projectId: string;
  ownerId: string;
  version: number;
  projectUrl: string;
  playableUrl?: string;
  projectJsonAssetId: string;
  projectJsonAssetStorageKey: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface UsageEventRecord {
  id: string;
  ownerId: string;
  metric: UsageMetric;
  quantity: number;
  projectId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface UsageSummary {
  ownerId: string;
  windowStart: string;
  windowEnd: string;
  jobEnqueued: number;
  textJobEnqueued: number;
  imageJobEnqueued: number;
  jobSucceeded: number;
  jobFailed: number;
  jobBlocked: number;
  assetBytes: number;
  estimatedCostCents: number;
}

export interface BillingPlanRecord {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  interval: BillingPlanInterval;
  dailyJobLimit: number;
  dailyTextJobLimit: number;
  dailyImageJobLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

export interface BillingSubscriptionRecord {
  id: string;
  ownerId: string;
  planId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingCheckoutSessionRecord {
  id: string;
  ownerId: string;
  planId: string;
  status: BillingCheckoutSessionStatus;
  checkoutUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  externalSessionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingEventRecord {
  id: string;
  ownerId: string;
  provider: BillingCheckoutProviderId | string;
  eventType: BillingProviderEventType;
  externalEventId?: string;
  subscriptionId?: string;
  checkoutSessionId?: string;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
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
  occurredAt: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface BillingCustomerPortalSession {
  id: string;
  ownerId: string;
  subscriptionId: string;
  provider: BillingCheckoutProviderId | string;
  portalUrl: string;
  returnUrl?: string;
  externalSessionId?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BillingCheckoutProvider {
  id: BillingCheckoutProviderId;
  createCheckoutSession(input: {
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
  }>;
  createCustomerPortalSession(input: {
    sessionId: string;
    ownerId: string;
    subscription: BillingSubscriptionRecord;
    returnUrl?: string;
  }): Promise<{
    portalUrl: string;
    externalSessionId?: string;
    expiresAt?: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface BillingEntitlementPolicy {
  blockPastDue: boolean;
  pastDueGracePeriodMs: number;
}

export interface OwnerOperationsSummary {
  ownerId: string;
  generatedAt: string;
  status: OperationsStatus;
  usage: UsageSummary;
  counts: {
    projects: number;
    jobs: {
      total: number;
      queued: number;
      running: number;
      succeeded: number;
      failed: number;
      blocked: number;
      waitingForCredentials: number;
      retryScheduled: number;
    };
    releaseApprovals: {
      pending: number;
      published: number;
      rejected: number;
      cancelled: number;
    };
    notificationDeliveries: {
      pending: number;
      running: number;
      succeeded: number;
      failed: number;
    };
    contentSafety: {
      approved: number;
      reviewRequired: number;
      blocked: number;
    };
    deploymentInvalidations: {
      skipped: number;
      succeeded: number;
      failed: number;
    };
  };
  incidents: OwnerOperationsIncident[];
  recent: {
    failedJobs: GenerationJobRecord[];
    failedNotifications: NotificationDeliveryRecord[];
    blockedReviews: ContentSafetyReviewRecord[];
    failedDeployments: DeploymentInvalidationRecord[];
    auditEvents: AuditEventRecord[];
  };
}

export interface OwnerOperationsIncident {
  id: string;
  severity: OperationsIncidentSeverity;
  source: OperationsIncidentSource;
  message: string;
  targetId?: string;
  createdAt?: string;
}

export interface AuditEventRecord {
  id: string;
  ownerId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: AuditOutcome;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface QuotaPolicy {
  dailyJobLimit: number;
  dailyTextJobLimit: number;
  dailyImageJobLimit: number;
}

export interface CostPolicy {
  textJobCostCents: number;
  imageJobCostCents: number;
}

export interface RetryPolicy {
  maxAttempts: number;
  retryDelayMs: number;
}

export type NotificationRetryPolicy = RetryPolicy;

export interface ContentSafetyPolicy {
  enabled: boolean;
  blockOnReview: boolean;
  blockedTerms: string[];
  reviewTerms: string[];
}

export interface ContentSafetyReviewRecord {
  id: string;
  ownerId: string;
  source: ContentSafetySource;
  decision: ContentSafetyDecision;
  targetType: string;
  targetId?: string;
  inputHash: string;
  inputLength: number;
  matchedRules: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AccessTokenRecord {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  role: AccessTokenRole;
  ownerId?: string;
  userId?: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

export interface CreatedAccessToken {
  token: string;
  record: AccessTokenRecord;
}

export interface UserAccountRecord {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  lastFailedLoginAt?: string;
  failedLoginCount?: number;
  lockedUntil?: string;
  passwordUpdatedAt?: string;
  mfaTotpSecretEncrypted?: string;
  mfaTotpEnabledAt?: string;
  mfaTotpLastUsedCounter?: number;
  mfaRecoveryCodeHashes?: string[];
  mfaRecoveryCodesUpdatedAt?: string;
  mfaTrustedDevices?: UserAccountMfaTrustedDeviceRecord[];
  disabledAt?: string;
}

export interface UserAccountMfaTrustedDeviceRecord {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface UserSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  tokenPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

export interface CreatedUserSession {
  sessionToken: string;
  session: UserSessionRecord;
  user: UserAccountRecord;
  mfaDeviceToken?: string;
}

export interface UserAccountActionTokenRecord {
  id: string;
  userId: string;
  email: string;
  purpose: UserAccountActionTokenPurpose;
  tokenHash: string;
  tokenPrefix: string;
  status: UserAccountActionTokenStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  usedAt?: string;
  revokedAt?: string;
}

export interface CreatedUserAccountActionToken {
  actionToken: string;
  record: UserAccountActionTokenRecord;
}

export interface UserAccountSecurityPolicy {
  passwordMinLength: number;
  passwordRequireLetter: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSymbol: boolean;
  blockedPasswordTerms: string[];
  maxFailedLoginAttempts: number;
  failedLoginLockoutMs: number;
}

export interface UserAccountAccessPolicy {
  ssoRequiredEmailDomains: string[];
}

export interface UserAccountMfaPolicy {
  enabled: boolean;
  issuer: string;
  secretEncryptionKey?: string;
  totpStepSeconds: number;
  totpWindowSteps: number;
  trustedDeviceTtlMs: number;
  maxTrustedDevices: number;
}

export interface UserAccountMfaTotpSetup {
  secret: string;
  otpauthUrl: string;
  user: UserAccountRecord;
}

export interface UserAccountMfaRecoveryCodes {
  recoveryCodes: string[];
  user: UserAccountRecord;
}

export interface OAuthStateRecord {
  id: string;
  provider: OAuthProviderId | string;
  stateHash: string;
  codeVerifier?: string;
  returnUrl?: string;
  status: OAuthStateStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  usedAt?: string;
}

export interface OAuthIdentityRecord {
  id: string;
  provider: OAuthProviderId | string;
  subject: string;
  userId: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  metadata?: Record<string, unknown>;
}

export interface OAuthProviderProfile {
  subject: string;
  email: string;
  emailVerified?: boolean;
  name?: string;
  groups?: string[];
  metadata?: Record<string, unknown>;
}

export interface OAuthGroupRoleMapping {
  group: string;
  teamId: string;
  role: TeamMemberRole;
}

export interface OAuthLoginProvider {
  id: OAuthProviderId | string;
  createAuthorizationUrl(input: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
    returnUrl?: string;
  }): string;
  exchangeCode(input: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<OAuthProviderProfile>;
}

export interface OAuthLoginStartResult {
  provider: OAuthProviderId | string;
  authorizationUrl: string;
  state: string;
  expiresAt: string;
  returnUrl?: string;
}

export interface OAuthLoginCompleteResult extends CreatedUserSession {
  identity: OAuthIdentityRecord;
  mappedTeamMemberships?: TeamMemberRecord[];
}

export interface TeamRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMemberRecord {
  id: string;
  teamId: string;
  userId: string;
  role: TeamMemberRole;
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface TeamInvitationRecord {
  id: string;
  teamId: string;
  email: string;
  role: TeamMemberRole;
  tokenHash: string;
  tokenPrefix: string;
  status: TeamInvitationStatus;
  invitedBy: string;
  invitedUserId?: string;
  acceptedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface CreatedTeamInvitation {
  invitationToken: string;
  invitation: TeamInvitationRecord;
}

export interface DeploymentInvalidationRecord {
  id: string;
  ownerId: string;
  projectId: string;
  releaseId?: string;
  provider: DeploymentCacheProviderId | string;
  status: DeploymentInvalidationStatus;
  reason: DeploymentInvalidationReason;
  urls: string[];
  createdAt: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface DeploymentCachePurgeResult {
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface DeploymentCacheProvider {
  id: DeploymentCacheProviderId | string;
  purge(input: {
    urls: string[];
    ownerId: string;
    projectId: string;
    releaseId?: string;
    reason: DeploymentInvalidationReason;
  }): Promise<DeploymentCachePurgeResult>;
}

export interface ReleaseApprovalNotifier {
  id: string;
  notify(input: ReleaseApprovalNotificationPayload): Promise<void>;
}

export interface TeamInvitationNotifier {
  id: string;
  notify(input: TeamInvitationNotificationPayload): Promise<void>;
}

export interface UserAccountNotifier {
  id: string;
  notify(input: UserAccountNotificationPayload): Promise<void>;
}

export interface CreateProjectFromNovelRequest {
  title: string;
  novelText: string;
  ownerId: string;
  style?: {
    name?: string;
    mood?: string;
  };
}

export interface NovelProjectGenerator {
  id: string;
  createProject(input: CreateProjectFromNovelRequest): VNProject | Promise<VNProject>;
}

export interface CreateGenerationJobRequest {
  kind: JobKind;
  ownerId: string;
  projectId?: string;
  input: Record<string, unknown>;
}

export interface StoredAssetInput {
  projectId: string;
  ownerId: string;
  assetId: string;
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

export type GeneratedImageAssetKind = "background" | "characterSprite" | "cg";

export interface GenerateImageAssetRequest {
  id: string;
  title: string;
  kind: GeneratedImageAssetKind;
  prompt?: string;
}

export interface GeneratedImageAssetResult {
  src: string;
  provider: string;
  mimeType?: string;
  revisedPrompt?: string;
}

export interface ImageAssetGenerator {
  id: string;
  generateAsset(input: GenerateImageAssetRequest): Promise<GeneratedImageAssetResult>;
}

export interface ProjectRepository {
  create(record: StudioProjectRecord): Promise<StudioProjectRecord>;
  update(record: StudioProjectRecord): Promise<StudioProjectRecord>;
  getById(id: string): Promise<StudioProjectRecord | undefined>;
  listByOwner(ownerId: string): Promise<StudioProjectRecord[]>;
  deleteById(id: string): Promise<boolean>;
}

export interface PublishedProjectReleaseRepository {
  create(record: PublishedProjectReleaseRecord): Promise<PublishedProjectReleaseRecord>;
  getById(id: string): Promise<PublishedProjectReleaseRecord | undefined>;
  listByProject(projectId: string, limit: number): Promise<PublishedProjectReleaseRecord[]>;
  getLatestByProject(projectId: string): Promise<PublishedProjectReleaseRecord | undefined>;
}

export interface ReleaseApprovalRepository {
  create(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord>;
  update(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord>;
  getById(id: string): Promise<ReleaseApprovalRecord | undefined>;
  listByProject(projectId: string, limit: number): Promise<ReleaseApprovalRecord[]>;
  listByOwner(ownerId: string, limit: number): Promise<ReleaseApprovalRecord[]>;
  getPendingByProject(projectId: string): Promise<ReleaseApprovalRecord | undefined>;
}

export interface ReleaseApprovalCommentRepository {
  create(record: ReleaseApprovalCommentRecord): Promise<ReleaseApprovalCommentRecord>;
  listByApproval(approvalId: string, limit: number): Promise<ReleaseApprovalCommentRecord[]>;
}

export interface NotificationDeliveryRepository {
  create(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord>;
  update(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord>;
  listByOwner(ownerId: string, limit: number): Promise<NotificationDeliveryRecord[]>;
  listRunnable(limit: number, nowIso?: string): Promise<NotificationDeliveryRecord[]>;
}

export interface JobRepository {
  create(record: GenerationJobRecord): Promise<GenerationJobRecord>;
  update(record: GenerationJobRecord): Promise<GenerationJobRecord>;
  getById(id: string): Promise<GenerationJobRecord | undefined>;
  listByOwner(ownerId: string): Promise<GenerationJobRecord[]>;
  listQueued(limit: number, nowIso?: string): Promise<GenerationJobRecord[]>;
}

export interface AssetRepository {
  create(record: AssetRecord): Promise<AssetRecord>;
  listByProject(projectId: string): Promise<AssetRecord[]>;
}

export interface AssetStorage {
  store(input: StoredAssetInput): Promise<AssetRecord>;
}

export interface UsageRepository {
  create(record: UsageEventRecord): Promise<UsageEventRecord>;
  listByOwnerSince(ownerId: string, sinceIso: string, limit: number): Promise<UsageEventRecord[]>;
  sumByOwnerSince(ownerId: string, metric: UsageMetric, sinceIso: string): Promise<number>;
}

export interface BillingPlanRepository {
  upsert(record: BillingPlanRecord): Promise<BillingPlanRecord>;
  getById(id: string): Promise<BillingPlanRecord | undefined>;
  listActive(): Promise<BillingPlanRecord[]>;
}

export interface BillingSubscriptionRepository {
  upsert(record: BillingSubscriptionRecord): Promise<BillingSubscriptionRecord>;
  getByOwner(ownerId: string): Promise<BillingSubscriptionRecord | undefined>;
  getById(id: string): Promise<BillingSubscriptionRecord | undefined>;
  getByExternalSubscriptionId(externalSubscriptionId: string): Promise<BillingSubscriptionRecord | undefined>;
  getByExternalCustomerId(externalCustomerId: string): Promise<BillingSubscriptionRecord | undefined>;
}

export interface BillingCheckoutSessionRepository {
  create(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord>;
  update(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord>;
  getById(id: string): Promise<BillingCheckoutSessionRecord | undefined>;
  getByExternalSessionId(externalSessionId: string): Promise<BillingCheckoutSessionRecord | undefined>;
  listByOwner(ownerId: string, limit: number): Promise<BillingCheckoutSessionRecord[]>;
}

export interface BillingEventRepository {
  create(record: BillingEventRecord): Promise<BillingEventRecord>;
  getByExternalEventId(provider: string, externalEventId: string): Promise<BillingEventRecord | undefined>;
  listByOwner(ownerId: string, limit: number): Promise<BillingEventRecord[]>;
}

export interface AuditRepository {
  create(record: AuditEventRecord): Promise<AuditEventRecord>;
  listByOwner(ownerId: string, limit: number): Promise<AuditEventRecord[]>;
}

export interface ContentSafetyRepository {
  create(record: ContentSafetyReviewRecord): Promise<ContentSafetyReviewRecord>;
  listByOwner(ownerId: string, limit: number): Promise<ContentSafetyReviewRecord[]>;
}

export interface AccessTokenRepository {
  create(record: AccessTokenRecord): Promise<AccessTokenRecord>;
  update(record: AccessTokenRecord): Promise<AccessTokenRecord>;
  getById(id: string): Promise<AccessTokenRecord | undefined>;
  getByHash(tokenHash: string): Promise<AccessTokenRecord | undefined>;
  listByOwner(ownerId: string, limit: number): Promise<AccessTokenRecord[]>;
}

export interface UserAccountRepository {
  create(record: UserAccountRecord): Promise<UserAccountRecord>;
  update(record: UserAccountRecord): Promise<UserAccountRecord>;
  getById(id: string): Promise<UserAccountRecord | undefined>;
  getByEmail(email: string): Promise<UserAccountRecord | undefined>;
}

export interface UserAccountActionTokenRepository {
  create(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord>;
  update(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord>;
  getById(id: string): Promise<UserAccountActionTokenRecord | undefined>;
  getByHash(tokenHash: string): Promise<UserAccountActionTokenRecord | undefined>;
  listByUser(userId: string, limit: number): Promise<UserAccountActionTokenRecord[]>;
}

export interface UserSessionRepository {
  create(record: UserSessionRecord): Promise<UserSessionRecord>;
  update(record: UserSessionRecord): Promise<UserSessionRecord>;
  getById(id: string): Promise<UserSessionRecord | undefined>;
  getByHash(tokenHash: string): Promise<UserSessionRecord | undefined>;
  listByUser(userId: string, limit: number): Promise<UserSessionRecord[]>;
}

export interface OAuthStateRepository {
  create(record: OAuthStateRecord): Promise<OAuthStateRecord>;
  update(record: OAuthStateRecord): Promise<OAuthStateRecord>;
  getByHash(stateHash: string): Promise<OAuthStateRecord | undefined>;
}

export interface OAuthIdentityRepository {
  upsert(record: OAuthIdentityRecord): Promise<OAuthIdentityRecord>;
  getByProviderSubject(provider: string, subject: string): Promise<OAuthIdentityRecord | undefined>;
  listByUser(userId: string, limit: number): Promise<OAuthIdentityRecord[]>;
}

export interface TeamRepository {
  createTeam(record: TeamRecord): Promise<TeamRecord>;
  getTeam(id: string): Promise<TeamRecord | undefined>;
  listTeamsForUser(userId: string): Promise<TeamRecord[]>;
  upsertMember(record: TeamMemberRecord): Promise<TeamMemberRecord>;
  getMember(teamId: string, userId: string): Promise<TeamMemberRecord | undefined>;
  listMembers(teamId: string): Promise<TeamMemberRecord[]>;
}

export interface TeamInvitationRepository {
  create(record: TeamInvitationRecord): Promise<TeamInvitationRecord>;
  update(record: TeamInvitationRecord): Promise<TeamInvitationRecord>;
  getById(id: string): Promise<TeamInvitationRecord | undefined>;
  getByTokenHash(tokenHash: string): Promise<TeamInvitationRecord | undefined>;
  listByTeam(teamId: string, limit: number): Promise<TeamInvitationRecord[]>;
}

export interface DeploymentInvalidationRepository {
  create(record: DeploymentInvalidationRecord): Promise<DeploymentInvalidationRecord>;
  listByProject(projectId: string, limit: number): Promise<DeploymentInvalidationRecord[]>;
  listByOwner(ownerId: string, limit: number): Promise<DeploymentInvalidationRecord[]>;
}
