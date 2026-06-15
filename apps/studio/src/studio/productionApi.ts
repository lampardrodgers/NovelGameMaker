import { loadProjectFromJson } from "@novel-game-maker/vn-runtime";
import type { VNProject } from "@novel-game-maker/vn-core";

export interface ProductionProjectRecord {
  id: string;
  title: string;
  ownerId: string;
  vnProject: VNProject;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  currentReleaseId?: string;
  publishedProjectUrl?: string;
  publishedPlayableUrl?: string;
}

export interface ProductionJobRecord {
  id: string;
  kind: "novel_to_project" | "asset_generation";
  status: "queued" | "running" | "succeeded" | "failed" | "blocked" | "waiting_for_credentials";
  projectId?: string;
  ownerId: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  attempts?: number;
  maxAttempts?: number;
  nextRunAt?: string;
}

export interface ProductionAssetRecord {
  id: string;
  projectId: string;
  ownerId: string;
  assetId: string;
  contentType: string;
  byteLength: number;
  storageKey: string;
  publicUrl?: string;
}

export interface ProductionPublishResult {
  project: ProductionProjectRecord;
  projectUrl: string;
  playableUrl?: string;
  currentProjectUrl?: string;
  currentPlayableUrl?: string;
  release: {
    id: string;
    version: number;
  };
  deploymentInvalidation?: {
    status: string;
    provider: string;
    urls: string[];
  };
}

export interface ProductionReleaseApprovalRecord {
  id: string;
  projectId: string;
  ownerId: string;
  status: "pending" | "published" | "rejected" | "cancelled";
  requestedBy: string;
  requestedAt: string;
  updatedAt: string;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  publishedReleaseId?: string;
}

export interface ProductionReleaseApprovalCommentRecord {
  id: string;
  approvalId: string;
  projectId: string;
  ownerId: string;
  author: string;
  body: string;
  createdAt: string;
}

export interface ProductionNotificationDeliveryRecord {
  id: string;
  ownerId: string;
  projectId: string;
  approvalId: string;
  event: string;
  provider: string;
  status: "pending" | "running" | "succeeded" | "failed";
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  nextRunAt?: string;
  lastAttemptAt?: string;
  deliveredAt?: string;
  error?: string;
}

export interface ProductionOperationsSummary {
  ownerId: string;
  generatedAt: string;
  status: "healthy" | "degraded" | "critical";
  usage: {
    jobEnqueued: number;
    textJobEnqueued: number;
    imageJobEnqueued: number;
    jobSucceeded: number;
    jobFailed: number;
    jobBlocked: number;
    assetBytes: number;
    estimatedCostCents: number;
  };
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
  incidents: Array<{
    id: string;
    severity: "warning" | "critical";
    source: string;
    message: string;
    targetId?: string;
    createdAt?: string;
  }>;
}

export interface ProductionUsageSummary {
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

export interface ProductionUsageEventRecord {
  id: string;
  ownerId: string;
  metric:
    | "job_enqueued"
    | "text_job_enqueued"
    | "image_job_enqueued"
    | "job_succeeded"
    | "job_failed"
    | "job_blocked"
    | "asset_bytes"
    | "estimated_cost_cents";
  quantity: number;
  projectId?: string;
  jobId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ProductionBillingPlanRecord {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  interval: "month" | "year";
  dailyJobLimit: number;
  dailyTextJobLimit: number;
  dailyImageJobLimit: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionBillingSubscriptionRecord {
  id: string;
  ownerId: string;
  planId: string;
  status: "trialing" | "active" | "past_due" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  externalCustomerId?: string;
  externalSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
}

export interface ProductionBillingCheckoutSessionRecord {
  id: string;
  ownerId: string;
  planId: string;
  status: "created" | "completed" | "cancelled" | "expired";
  checkoutUrl: string;
  successUrl?: string;
  cancelUrl?: string;
  externalSessionId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  expiresAt?: string;
}

export interface ProductionBillingEventRecord {
  id: string;
  ownerId: string;
  provider: string;
  eventType:
    | "checkout_completed"
    | "subscription_updated"
    | "subscription_cancelled"
    | "invoice_paid"
    | "invoice_payment_failed"
    | "invoice_payment_action_required"
    | "refund_created"
    | "dispute_created"
    | "dispute_closed";
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

export interface ProductionBillingCustomerPortalSession {
  id: string;
  ownerId: string;
  subscriptionId: string;
  provider: string;
  portalUrl: string;
  returnUrl?: string;
  externalSessionId?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductionAuditEventRecord {
  id: string;
  ownerId?: string;
  action: string;
  targetType: string;
  targetId?: string;
  outcome: "succeeded" | "failed" | "blocked";
  details?: Record<string, unknown>;
  createdAt: string;
}

export type ProductionContentSafetySource = "novel_text" | "project_json" | "asset_prompt";

export interface ProductionContentSafetyReviewRecord {
  id: string;
  ownerId: string;
  source: ProductionContentSafetySource;
  decision: "approved" | "review_required" | "blocked";
  targetType: string;
  targetId?: string;
  inputHash: string;
  inputLength: number;
  matchedRules: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface ProductionAccessTokenRecord {
  id: string;
  tokenPrefix: string;
  role: "admin" | "owner" | "user";
  ownerId?: string;
  userId?: string;
  label: string;
  createdAt: string;
  lastUsedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
}

export interface ProductionTeamInvitationRecord {
  id: string;
  teamId: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
  tokenPrefix: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  invitedBy: string;
  invitedUserId?: string;
  acceptedByUserId?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  revokedAt?: string;
}

export interface ProductionTeamMemberRecord {
  id: string;
  teamId: string;
  userId: string;
  role: ProductionTeamInvitationRecord["role"];
  createdAt: string;
  updatedAt: string;
  revokedAt?: string;
}

export interface ProductionUserAccountRecord {
  id: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  emailVerifiedAt?: string;
  lastLoginAt?: string;
  passwordUpdatedAt?: string;
  mfaTotpEnabledAt?: string;
  mfaRecoveryCodesUpdatedAt?: string;
  disabledAt?: string;
}

export interface ProductionUserSessionRecord {
  id: string;
  userId: string;
  tokenPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
}

export type ProductionAuthContext =
  | { role: "admin" }
  | { role: "owner"; ownerId: string }
  | { role: "user"; userId: string; email?: string; sessionId?: string };

export interface ProductionAuthResult {
  sessionToken: string;
  mfaDeviceToken?: string;
  user: ProductionUserAccountRecord;
  session: ProductionUserSessionRecord;
}

export interface ProductionOAuthStartResult {
  provider: string;
  authorizationUrl: string;
  state: string;
  expiresAt: string;
  returnUrl?: string;
}

export interface ProductionOAuthIdentityRecord {
  id: string;
  provider: string;
  userId: string;
  email: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductionOAuthAuthResult extends ProductionAuthResult {
  identity: ProductionOAuthIdentityRecord;
  mappedTeamMemberships?: ProductionTeamMemberRecord[];
}

export interface ProductionMfaRequiredResult {
  error: string;
  mfaRequired: true;
  method: "totp";
}

export interface ProductionMfaTotpSetup {
  secret: string;
  otpauthUrl: string;
  user: ProductionUserAccountRecord;
}

export interface ProductionMfaRecoveryCodes {
  recoveryCodes: string[];
  user: ProductionUserAccountRecord;
}

export interface ProductionReleaseDiff {
  projectId: string;
  baseRelease?: {
    id: string;
    version: number;
    createdAt: string;
  };
  baseUnavailable: boolean;
  changed: boolean;
  current: {
    fingerprint: string;
    title: string;
    chapterCount: number;
    sceneCount: number;
    shotCount: number;
    beatCount: number;
    characterCount: number;
    assetCount: number;
    cgBeatCount: number;
  };
  published?: {
    fingerprint: string;
    title: string;
    chapterCount: number;
    sceneCount: number;
    shotCount: number;
    beatCount: number;
    characterCount: number;
    assetCount: number;
    cgBeatCount: number;
  };
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
  beatChanges: ProductionReleaseDiffItem[];
  assetChanges: ProductionReleaseDiffItem[];
  characterChanges: ProductionReleaseDiffItem[];
}

export interface ProductionReleaseDiffItem {
  id: string;
  kind: "added" | "removed" | "changed";
  label: string;
  previous?: string;
  current?: string;
}

export interface ProductionApiConfig {
  baseUrl: string;
  authToken?: string;
}

export type AssetJobRunMode = "inline" | "worker";

export interface StudioAssetJobConfig {
  runMode: AssetJobRunMode;
  pollIntervalMs: number;
  pollAttempts: number;
}

export class ProductionApiClient {
  constructor(private readonly config: ProductionApiConfig) {}

  get enabled(): boolean {
    return this.config.baseUrl.trim().length > 0;
  }

  resolvePublicUrl(publicUrl: string): string {
    if (/^https?:\/\//.test(publicUrl) || publicUrl.startsWith("data:")) {
      return publicUrl;
    }
    return `${this.config.baseUrl.replace(/\/+$/g, "")}/${publicUrl.replace(/^\/+/g, "")}`;
  }

  async saveProject(input: {
    id?: string;
    ownerId: string;
    title: string;
    vnProject: VNProject;
  }): Promise<ProductionProjectRecord> {
    const body = await this.request<{ project: ProductionProjectRecord }>("/v1/projects", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return normalizeProjectRecord(body.project);
  }

  async listProjects(ownerId: string): Promise<ProductionProjectRecord[]> {
    const body = await this.request<{ projects: ProductionProjectRecord[] }>(
      `/v1/projects?ownerId=${encodeURIComponent(ownerId)}`,
      { method: "GET" }
    );
    return body.projects.map(normalizeProjectRecord);
  }

  async createJob(input: {
    ownerId: string;
    projectId?: string;
    kind: "novel_to_project" | "asset_generation";
    input: Record<string, unknown>;
  }): Promise<ProductionJobRecord> {
    const body = await this.request<{ job: ProductionJobRecord }>("/v1/jobs", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.job;
  }

  async runJob(jobId: string): Promise<ProductionJobRecord> {
    const body = await this.request<{ job: ProductionJobRecord }>(`/v1/jobs/${encodeURIComponent(jobId)}/run`, {
      method: "POST",
      body: JSON.stringify({})
    });
    return body.job;
  }

  async getJob(jobId: string): Promise<ProductionJobRecord> {
    const body = await this.request<{ job: ProductionJobRecord }>(`/v1/jobs/${encodeURIComponent(jobId)}`, {
      method: "GET"
    });
    return body.job;
  }

  async listAssets(projectId: string): Promise<ProductionAssetRecord[]> {
    const body = await this.request<{ assets: ProductionAssetRecord[] }>(
      `/v1/projects/${encodeURIComponent(projectId)}/assets`,
      { method: "GET" }
    );
    return body.assets;
  }

  async publishProject(projectId: string): Promise<ProductionPublishResult> {
    const body = await this.request<ProductionPublishResult>(
      `/v1/projects/${encodeURIComponent(projectId)}/publish`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    return {
      ...body,
      project: normalizeProjectRecord(body.project)
    };
  }

  async requestReleaseApproval(projectId: string, notes?: string): Promise<ProductionReleaseApprovalRecord> {
    const body = await this.request<{ approval: ProductionReleaseApprovalRecord }>(
      `/v1/projects/${encodeURIComponent(projectId)}/release-approvals`,
      {
        method: "POST",
        body: JSON.stringify({ notes })
      }
    );
    return body.approval;
  }

  async listReleaseApprovals(projectId: string): Promise<ProductionReleaseApprovalRecord[]> {
    const body = await this.request<{ approvals: ProductionReleaseApprovalRecord[] }>(
      `/v1/projects/${encodeURIComponent(projectId)}/release-approvals`,
      { method: "GET" }
    );
    return body.approvals;
  }

  async getReleaseDiff(projectId: string): Promise<ProductionReleaseDiff> {
    const body = await this.request<{ diff: ProductionReleaseDiff }>(
      `/v1/projects/${encodeURIComponent(projectId)}/release-diff`,
      { method: "GET" }
    );
    return body.diff;
  }

  async listReleaseApprovalComments(approvalId: string): Promise<ProductionReleaseApprovalCommentRecord[]> {
    const body = await this.request<{ comments: ProductionReleaseApprovalCommentRecord[] }>(
      `/v1/release-approvals/${encodeURIComponent(approvalId)}/comments`,
      { method: "GET" }
    );
    return body.comments;
  }

  async addReleaseApprovalComment(
    approvalId: string,
    bodyText: string
  ): Promise<ProductionReleaseApprovalCommentRecord> {
    const body = await this.request<{ comment: ProductionReleaseApprovalCommentRecord }>(
      `/v1/release-approvals/${encodeURIComponent(approvalId)}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ body: bodyText })
      }
    );
    return body.comment;
  }

  async approveReleaseApproval(
    approvalId: string,
    reviewNotes?: string
  ): Promise<{ approval: ProductionReleaseApprovalRecord; published: ProductionPublishResult }> {
    const body = await this.request<{
      approval: ProductionReleaseApprovalRecord;
      published: ProductionPublishResult;
    }>(
      `/v1/release-approvals/${encodeURIComponent(approvalId)}/approve`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNotes })
      }
    );
    return {
      approval: body.approval,
      published: {
        ...body.published,
        project: normalizeProjectRecord(body.published.project)
      }
    };
  }

  async rejectReleaseApproval(
    approvalId: string,
    reviewNotes?: string
  ): Promise<ProductionReleaseApprovalRecord> {
    const body = await this.request<{ approval: ProductionReleaseApprovalRecord }>(
      `/v1/release-approvals/${encodeURIComponent(approvalId)}/reject`,
      {
        method: "POST",
        body: JSON.stringify({ reviewNotes })
      }
    );
    return body.approval;
  }

  async listNotificationDeliveries(ownerId: string): Promise<ProductionNotificationDeliveryRecord[]> {
    const body = await this.request<{ deliveries: ProductionNotificationDeliveryRecord[] }>(
      `/v1/notification-deliveries?ownerId=${encodeURIComponent(ownerId)}`,
      { method: "GET" }
    );
    return body.deliveries;
  }

  async runNextNotificationDelivery(): Promise<ProductionNotificationDeliveryRecord | undefined> {
    const body = await this.request<{ delivery?: ProductionNotificationDeliveryRecord }>(
      "/v1/notification-deliveries/run-next",
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    return body.delivery;
  }

  async getOperationsSummary(ownerId: string): Promise<ProductionOperationsSummary> {
    const body = await this.request<{ summary: ProductionOperationsSummary }>(
      `/v1/ops/summary?ownerId=${encodeURIComponent(ownerId)}`,
      { method: "GET" }
    );
    return body.summary;
  }

  async getUsageSummary(ownerId: string, limit = 20): Promise<{
    usage: ProductionUsageSummary;
    events: ProductionUsageEventRecord[];
  }> {
    return this.request<{
      usage: ProductionUsageSummary;
      events: ProductionUsageEventRecord[];
    }>(
      `/v1/usage?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
  }

  async listBillingPlans(): Promise<ProductionBillingPlanRecord[]> {
    const body = await this.request<{ plans: ProductionBillingPlanRecord[] }>("/v1/billing/plans", {
      method: "GET"
    });
    return body.plans;
  }

  async getBillingSubscription(ownerId: string): Promise<ProductionBillingSubscriptionRecord | undefined> {
    const body = await this.request<{ subscription?: ProductionBillingSubscriptionRecord }>(
      `/v1/billing/subscription?ownerId=${encodeURIComponent(ownerId)}`,
      { method: "GET" }
    );
    return body.subscription;
  }

  async listBillingCheckoutSessions(ownerId: string, limit = 20): Promise<ProductionBillingCheckoutSessionRecord[]> {
    const body = await this.request<{ checkoutSessions: ProductionBillingCheckoutSessionRecord[] }>(
      `/v1/billing/checkout-sessions?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
    return body.checkoutSessions;
  }

  async listBillingEvents(ownerId: string, limit = 20): Promise<ProductionBillingEventRecord[]> {
    const body = await this.request<{ events: ProductionBillingEventRecord[] }>(
      `/v1/billing/events?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
    return body.events;
  }

  async startBillingCheckout(input: {
    ownerId: string;
    planId: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<ProductionBillingCheckoutSessionRecord> {
    const body = await this.request<{ checkoutSession: ProductionBillingCheckoutSessionRecord }>("/v1/billing/checkout", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.checkoutSession;
  }

  async createBillingPaymentMethodSession(input: {
    ownerId: string;
    returnUrl?: string;
  }): Promise<ProductionBillingCustomerPortalSession> {
    const body = await this.request<{ portalSession: ProductionBillingCustomerPortalSession }>("/v1/billing/payment-method-session", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.portalSession;
  }

  async cancelBillingSubscription(ownerId: string): Promise<ProductionBillingSubscriptionRecord> {
    const body = await this.request<{ subscription: ProductionBillingSubscriptionRecord }>("/v1/billing/subscription/cancel", {
      method: "POST",
      body: JSON.stringify({ ownerId })
    });
    return body.subscription;
  }

  async listAuditEvents(ownerId: string, limit = 20): Promise<ProductionAuditEventRecord[]> {
    const body = await this.request<{ events: ProductionAuditEventRecord[] }>(
      `/v1/audit?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
    return body.events;
  }

  async listContentSafetyReviews(ownerId: string, limit = 20): Promise<ProductionContentSafetyReviewRecord[]> {
    const body = await this.request<{ reviews: ProductionContentSafetyReviewRecord[] }>(
      `/v1/content-safety?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
    return body.reviews;
  }

  async reviewContentSafety(input: {
    ownerId: string;
    source: ProductionContentSafetySource;
    text: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<ProductionContentSafetyReviewRecord> {
    const body = await this.request<{ review: ProductionContentSafetyReviewRecord }>("/v1/content-safety/review", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.review;
  }

  async listAccessTokens(ownerId: string, limit = 20): Promise<ProductionAccessTokenRecord[]> {
    const body = await this.request<{ accessTokens: ProductionAccessTokenRecord[] }>(
      `/v1/access-tokens?ownerId=${encodeURIComponent(ownerId)}&limit=${encodeURIComponent(String(limit))}`,
      { method: "GET" }
    );
    return body.accessTokens;
  }

  async createOwnerAccessToken(input: {
    ownerId: string;
    label?: string;
    expiresAt?: string;
  }): Promise<{ token: string; accessToken: ProductionAccessTokenRecord }> {
    return this.request<{ token: string; accessToken: ProductionAccessTokenRecord }>("/v1/access-tokens", {
      method: "POST",
      body: JSON.stringify({
        role: "owner",
        ownerId: input.ownerId,
        label: input.label,
        expiresAt: input.expiresAt
      })
    });
  }

  async revokeAccessToken(accessTokenId: string): Promise<ProductionAccessTokenRecord> {
    const body = await this.request<{ accessToken: ProductionAccessTokenRecord }>(
      `/v1/access-tokens/${encodeURIComponent(accessTokenId)}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    return body.accessToken;
  }

  async createTeamInvitation(input: {
    teamId: string;
    email: string;
    role: ProductionTeamInvitationRecord["role"];
    invitedUserId?: string;
    expiresAt?: string;
  }): Promise<{ invitationToken: string; invitation: ProductionTeamInvitationRecord }> {
    return this.request<{ invitationToken: string; invitation: ProductionTeamInvitationRecord }>(
      `/v1/teams/${encodeURIComponent(input.teamId)}/invitations`,
      {
        method: "POST",
        body: JSON.stringify({
          email: input.email,
          role: input.role,
          invitedUserId: input.invitedUserId,
          expiresAt: input.expiresAt
        })
      }
    );
  }

  async listTeamInvitations(teamId: string): Promise<ProductionTeamInvitationRecord[]> {
    const body = await this.request<{ invitations: ProductionTeamInvitationRecord[] }>(
      `/v1/teams/${encodeURIComponent(teamId)}/invitations`,
      { method: "GET" }
    );
    return body.invitations;
  }

  async revokeTeamInvitation(invitationId: string): Promise<ProductionTeamInvitationRecord> {
    const body = await this.request<{ invitation: ProductionTeamInvitationRecord }>(
      `/v1/team-invitations/${encodeURIComponent(invitationId)}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    return body.invitation;
  }

  async acceptTeamInvitation(invitationToken: string, userId?: string): Promise<{
    invitation: ProductionTeamInvitationRecord;
    member: { teamId: string; userId: string; role: ProductionTeamInvitationRecord["role"] };
  }> {
    return this.request<{
      invitation: ProductionTeamInvitationRecord;
      member: { teamId: string; userId: string; role: ProductionTeamInvitationRecord["role"] };
    }>("/v1/team-invitations/accept", {
      method: "POST",
      body: JSON.stringify({ invitationToken, userId })
    });
  }

  async registerUser(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<ProductionAuthResult> {
    return this.request<ProductionAuthResult>("/v1/auth/register", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async loginUser(input: {
    email: string;
    password: string;
    mfaCode?: string;
    mfaDeviceToken?: string;
    rememberMfaDevice?: boolean;
  }): Promise<ProductionAuthResult | ProductionMfaRequiredResult> {
    return this.request<ProductionAuthResult | ProductionMfaRequiredResult>("/v1/auth/login", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async startOAuthLogin(input: {
    provider?: string;
    returnUrl?: string;
  } = {}): Promise<ProductionOAuthStartResult> {
    return this.request<ProductionOAuthStartResult>("/v1/auth/oauth/start", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async completeOAuthLogin(input: {
    state: string;
    code: string;
  }): Promise<ProductionOAuthAuthResult> {
    return this.request<ProductionOAuthAuthResult>("/v1/auth/oauth/callback", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  async getCurrentUser(): Promise<{
    auth: ProductionAuthContext;
    user?: ProductionUserAccountRecord;
  }> {
    return this.request<{
      auth: ProductionAuthContext;
      user?: ProductionUserAccountRecord;
    }>("/v1/auth/me", { method: "GET" });
  }

  async listUserSessions(): Promise<ProductionUserSessionRecord[]> {
    const body = await this.request<{ sessions: ProductionUserSessionRecord[] }>("/v1/auth/sessions", { method: "GET" });
    return body.sessions;
  }

  async revokeUserSession(sessionId: string): Promise<ProductionUserSessionRecord> {
    const body = await this.request<{ session: ProductionUserSessionRecord }>(
      `/v1/auth/sessions/${encodeURIComponent(sessionId)}/revoke`,
      {
        method: "POST",
        body: JSON.stringify({})
      }
    );
    return body.session;
  }

  async logoutUser(): Promise<{
    revoked: boolean;
    session?: ProductionUserSessionRecord;
  }> {
    return this.request<{
      revoked: boolean;
      session?: ProductionUserSessionRecord;
    }>("/v1/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
  }

  async requestEmailVerification(userId?: string): Promise<boolean> {
    const body = await this.request<{ requested: boolean }>("/v1/auth/email-verification/request", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
    return body.requested;
  }

  async verifyEmail(verificationToken: string): Promise<ProductionUserAccountRecord> {
    const body = await this.request<{ user: ProductionUserAccountRecord }>("/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ verificationToken })
    });
    return body.user;
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.request<{ ok: true }>("/v1/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ email })
    });
  }

  async confirmPasswordReset(resetToken: string, password: string): Promise<ProductionUserAccountRecord> {
    const body = await this.request<{ user: ProductionUserAccountRecord }>("/v1/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({ resetToken, password })
    });
    return body.user;
  }

  async startMfaTotpSetup(userId?: string): Promise<ProductionMfaTotpSetup> {
    return this.request<ProductionMfaTotpSetup>("/v1/auth/mfa/totp/setup", {
      method: "POST",
      body: JSON.stringify({ userId })
    });
  }

  async confirmMfaTotpSetup(code: string, userId?: string): Promise<ProductionMfaRecoveryCodes> {
    return this.request<ProductionMfaRecoveryCodes>("/v1/auth/mfa/totp/confirm", {
      method: "POST",
      body: JSON.stringify({ userId, code })
    });
  }

  async disableMfaTotp(input: {
    password: string;
    code?: string;
    userId?: string;
  }): Promise<ProductionUserAccountRecord> {
    const body = await this.request<{ user: ProductionUserAccountRecord }>("/v1/auth/mfa/totp/disable", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.user;
  }

  async revokeMfaTrustedDevices(input: {
    password: string;
    code?: string;
    userId?: string;
  }): Promise<ProductionUserAccountRecord> {
    const body = await this.request<{ user: ProductionUserAccountRecord }>("/v1/auth/mfa/trusted-devices/revoke", {
      method: "POST",
      body: JSON.stringify(input)
    });
    return body.user;
  }

  async regenerateMfaRecoveryCodes(input: {
    password: string;
    code?: string;
    userId?: string;
  }): Promise<ProductionMfaRecoveryCodes> {
    return this.request<ProductionMfaRecoveryCodes>("/v1/auth/mfa/recovery-codes/regenerate", {
      method: "POST",
      body: JSON.stringify(input)
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.enabled) {
      throw new Error("Production API is not configured. Set VITE_API_BASE_URL.");
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...(this.config.authToken ? { authorization: `Bearer ${this.config.authToken}` } : {}),
        ...init.headers
      }
    });

    const body = await response.json() as T & { error?: string };
    if (!response.ok) {
      throw new Error(body.error ?? `Production API request failed: ${response.status}`);
    }
    return body;
  }
}

export function createProductionApiClient(authTokenOverride?: string): ProductionApiClient {
  const env = readViteEnv();
  return new ProductionApiClient({
    baseUrl: env.VITE_API_BASE_URL ?? "",
    authToken: authTokenOverride ?? env.VITE_API_AUTH_TOKEN
  });
}

export function readStudioAssetJobConfig(): StudioAssetJobConfig {
  const env = readViteEnv();
  return {
    runMode: env.VITE_ASSET_JOB_RUN_MODE === "worker" ? "worker" : "inline",
    pollIntervalMs: parsePositiveInteger(env.VITE_ASSET_JOB_POLL_INTERVAL_MS, 1_200),
    pollAttempts: parsePositiveInteger(env.VITE_ASSET_JOB_POLL_ATTEMPTS, 60)
  };
}

function normalizeProjectRecord(record: ProductionProjectRecord): ProductionProjectRecord {
  return {
    ...record,
    vnProject: loadProjectFromJson(JSON.stringify(record.vnProject))
  };
}

function readViteEnv(): Record<string, string | undefined> {
  return {
    ...readProcessEnv(),
    ...((import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {})
  };
}

function readProcessEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" ? {} : process.env;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
