import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type {
  AccessTokenRecord,
  AccessTokenRepository,
  AssetRecord,
  AssetRepository,
  AuditEventRecord,
  AuditRepository,
  BillingCheckoutSessionRecord,
  BillingCheckoutSessionRepository,
  BillingEventRecord,
  BillingEventRepository,
  BillingPlanRecord,
  BillingPlanRepository,
  BillingSubscriptionRecord,
  BillingSubscriptionRepository,
  ContentSafetyRepository,
  ContentSafetyReviewRecord,
  DeploymentInvalidationRecord,
  DeploymentInvalidationRepository,
  GenerationJobRecord,
  JobRepository,
  NotificationDeliveryRecord,
  NotificationDeliveryRepository,
  OAuthIdentityRecord,
  OAuthIdentityRepository,
  OAuthStateRecord,
  OAuthStateRepository,
  PublishedProjectReleaseRecord,
  PublishedProjectReleaseRepository,
  ProjectRepository,
  ReleaseApprovalCommentRecord,
  ReleaseApprovalCommentRepository,
  ReleaseApprovalRecord,
  ReleaseApprovalRepository,
  StudioProjectRecord,
  TeamInvitationRecord,
  TeamInvitationRepository,
  TeamMemberRecord,
  TeamRecord,
  TeamRepository,
  UserAccountActionTokenRecord,
  UserAccountActionTokenRepository,
  UserAccountRecord,
  UserAccountRepository,
  UserSessionRecord,
  UserSessionRepository,
  UsageEventRecord,
  UsageMetric,
  UsageRepository
} from "../types";

interface DatabaseShape {
  projects: StudioProjectRecord[];
  jobs: GenerationJobRecord[];
  assets: AssetRecord[];
  publishedProjectReleases: PublishedProjectReleaseRecord[];
  releaseApprovals: ReleaseApprovalRecord[];
  releaseApprovalComments: ReleaseApprovalCommentRecord[];
  notificationDeliveries: NotificationDeliveryRecord[];
  deploymentInvalidations: DeploymentInvalidationRecord[];
  usageEvents: UsageEventRecord[];
  billingPlans: BillingPlanRecord[];
  billingSubscriptions: BillingSubscriptionRecord[];
  billingCheckoutSessions: BillingCheckoutSessionRecord[];
  billingEvents: BillingEventRecord[];
  auditEvents: AuditEventRecord[];
  contentSafetyReviews: ContentSafetyReviewRecord[];
  accessTokens: AccessTokenRecord[];
  userAccounts: UserAccountRecord[];
  userAccountActionTokens: UserAccountActionTokenRecord[];
  userSessions: UserSessionRecord[];
  oauthStates: OAuthStateRecord[];
  oauthIdentities: OAuthIdentityRecord[];
  teams: TeamRecord[];
  teamMembers: TeamMemberRecord[];
  teamInvitations: TeamInvitationRecord[];
}

export class FileDatabase {
  constructor(private readonly filePath: string) {}

  projects(): ProjectRepository {
    return new FileProjectRepository(this);
  }

  jobs(): JobRepository {
    return new FileJobRepository(this);
  }

  assets(): AssetRepository {
    return new FileAssetRepository(this);
  }

  publishedProjectReleases(): PublishedProjectReleaseRepository {
    return new FilePublishedProjectReleaseRepository(this);
  }

  deploymentInvalidations(): DeploymentInvalidationRepository {
    return new FileDeploymentInvalidationRepository(this);
  }

  releaseApprovals(): ReleaseApprovalRepository {
    return new FileReleaseApprovalRepository(this);
  }

  releaseApprovalComments(): ReleaseApprovalCommentRepository {
    return new FileReleaseApprovalCommentRepository(this);
  }

  notificationDeliveries(): NotificationDeliveryRepository {
    return new FileNotificationDeliveryRepository(this);
  }

  usage(): UsageRepository {
    return new FileUsageRepository(this);
  }

  billingPlans(): BillingPlanRepository {
    return new FileBillingPlanRepository(this);
  }

  billingSubscriptions(): BillingSubscriptionRepository {
    return new FileBillingSubscriptionRepository(this);
  }

  billingCheckoutSessions(): BillingCheckoutSessionRepository {
    return new FileBillingCheckoutSessionRepository(this);
  }

  billingEvents(): BillingEventRepository {
    return new FileBillingEventRepository(this);
  }

  audit(): AuditRepository {
    return new FileAuditRepository(this);
  }

  contentSafety(): ContentSafetyRepository {
    return new FileContentSafetyRepository(this);
  }

  accessTokens(): AccessTokenRepository {
    return new FileAccessTokenRepository(this);
  }

  userAccounts(): UserAccountRepository {
    return new FileUserAccountRepository(this);
  }

  userAccountActionTokens(): UserAccountActionTokenRepository {
    return new FileUserAccountActionTokenRepository(this);
  }

  userSessions(): UserSessionRepository {
    return new FileUserSessionRepository(this);
  }

  oauthStates(): OAuthStateRepository {
    return new FileOAuthStateRepository(this);
  }

  oauthIdentities(): OAuthIdentityRepository {
    return new FileOAuthIdentityRepository(this);
  }

  teams(): TeamRepository {
    return new FileTeamRepository(this);
  }

  teamInvitations(): TeamInvitationRepository {
    return new FileTeamInvitationRepository(this);
  }

  async read(): Promise<DatabaseShape> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<DatabaseShape>;
      return {
        projects: parsed.projects ?? [],
        jobs: (parsed.jobs ?? []).map(normalizeJob),
        assets: parsed.assets ?? [],
        publishedProjectReleases: parsed.publishedProjectReleases ?? [],
        releaseApprovals: parsed.releaseApprovals ?? [],
        releaseApprovalComments: parsed.releaseApprovalComments ?? [],
        notificationDeliveries: parsed.notificationDeliveries ?? [],
        deploymentInvalidations: parsed.deploymentInvalidations ?? [],
        usageEvents: parsed.usageEvents ?? [],
        billingPlans: parsed.billingPlans ?? [],
        billingSubscriptions: parsed.billingSubscriptions ?? [],
        billingCheckoutSessions: parsed.billingCheckoutSessions ?? [],
        billingEvents: parsed.billingEvents ?? [],
        auditEvents: parsed.auditEvents ?? [],
        contentSafetyReviews: parsed.contentSafetyReviews ?? [],
        accessTokens: parsed.accessTokens ?? [],
        userAccounts: parsed.userAccounts ?? [],
        userAccountActionTokens: parsed.userAccountActionTokens ?? [],
        userSessions: parsed.userSessions ?? [],
        oauthStates: parsed.oauthStates ?? [],
        oauthIdentities: parsed.oauthIdentities ?? [],
        teams: parsed.teams ?? [],
        teamMembers: parsed.teamMembers ?? [],
        teamInvitations: parsed.teamInvitations ?? []
      };
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") {
        return {
          projects: [],
          jobs: [],
          assets: [],
          publishedProjectReleases: [],
          releaseApprovals: [],
          releaseApprovalComments: [],
          notificationDeliveries: [],
          deploymentInvalidations: [],
          usageEvents: [],
          billingPlans: [],
          billingSubscriptions: [],
          billingCheckoutSessions: [],
          billingEvents: [],
          auditEvents: [],
          contentSafetyReviews: [],
          accessTokens: [],
          userAccounts: [],
          userAccountActionTokens: [],
          userSessions: [],
          oauthStates: [],
          oauthIdentities: [],
          teams: [],
          teamMembers: [],
          teamInvitations: []
        };
      }
      throw error;
    }
  }

  async write(database: DatabaseShape): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(database, null, 2), "utf-8");
  }
}

class FileProjectRepository implements ProjectRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: StudioProjectRecord): Promise<StudioProjectRecord> {
    const data = await this.database.read();
    data.projects.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: StudioProjectRecord): Promise<StudioProjectRecord> {
    const data = await this.database.read();
    data.projects = data.projects.map((project) => (project.id === record.id ? record : project));
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<StudioProjectRecord | undefined> {
    const data = await this.database.read();
    return data.projects.find((project) => project.id === id);
  }

  async listByOwner(ownerId: string): Promise<StudioProjectRecord[]> {
    const data = await this.database.read();
    return data.projects
      .filter((project) => project.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async deleteById(id: string): Promise<boolean> {
    const data = await this.database.read();
    const before = data.projects.length;
    data.projects = data.projects.filter((project) => project.id !== id);
    await this.database.write(data);
    return data.projects.length !== before;
  }
}

class FileJobRepository implements JobRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: GenerationJobRecord): Promise<GenerationJobRecord> {
    const data = await this.database.read();
    data.jobs.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: GenerationJobRecord): Promise<GenerationJobRecord> {
    const data = await this.database.read();
    data.jobs = data.jobs.map((job) => (job.id === record.id ? record : job));
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<GenerationJobRecord | undefined> {
    const data = await this.database.read();
    return data.jobs.find((job) => job.id === id);
  }

  async listByOwner(ownerId: string): Promise<GenerationJobRecord[]> {
    const data = await this.database.read();
    return data.jobs
      .filter((job) => job.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async listQueued(limit: number, nowIso = new Date().toISOString()): Promise<GenerationJobRecord[]> {
    const data = await this.database.read();
    return data.jobs
      .filter((job) => job.status === "queued" && (!job.nextRunAt || job.nextRunAt <= nowIso))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileAssetRepository implements AssetRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: AssetRecord): Promise<AssetRecord> {
    const data = await this.database.read();
    data.assets.push(record);
    await this.database.write(data);
    return record;
  }

  async listByProject(projectId: string): Promise<AssetRecord[]> {
    const data = await this.database.read();
    return data.assets
      .filter((asset) => asset.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

class FilePublishedProjectReleaseRepository implements PublishedProjectReleaseRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: PublishedProjectReleaseRecord): Promise<PublishedProjectReleaseRecord> {
    const data = await this.database.read();
    data.publishedProjectReleases.push(record);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<PublishedProjectReleaseRecord | undefined> {
    const data = await this.database.read();
    return data.publishedProjectReleases.find((release) => release.id === id);
  }

  async listByProject(projectId: string, limit: number): Promise<PublishedProjectReleaseRecord[]> {
    const data = await this.database.read();
    return data.publishedProjectReleases
      .filter((release) => release.projectId === projectId)
      .sort((a, b) => b.version - a.version)
      .slice(0, Math.max(0, limit));
  }

  async getLatestByProject(projectId: string): Promise<PublishedProjectReleaseRecord | undefined> {
    const releases = await this.listByProject(projectId, 1);
    return releases[0];
  }
}

class FileReleaseApprovalRepository implements ReleaseApprovalRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord> {
    const data = await this.database.read();
    data.releaseApprovals.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord> {
    const data = await this.database.read();
    data.releaseApprovals = data.releaseApprovals.map((approval) => approval.id === record.id ? record : approval);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<ReleaseApprovalRecord | undefined> {
    const data = await this.database.read();
    return data.releaseApprovals.find((approval) => approval.id === id);
  }

  async listByProject(projectId: string, limit: number): Promise<ReleaseApprovalRecord[]> {
    const data = await this.database.read();
    return data.releaseApprovals
      .filter((approval) => approval.projectId === projectId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }

  async listByOwner(ownerId: string, limit: number): Promise<ReleaseApprovalRecord[]> {
    const data = await this.database.read();
    return data.releaseApprovals
      .filter((approval) => approval.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }

  async getPendingByProject(projectId: string): Promise<ReleaseApprovalRecord | undefined> {
    const data = await this.database.read();
    return data.releaseApprovals.find((approval) => approval.projectId === projectId && approval.status === "pending");
  }
}

class FileReleaseApprovalCommentRepository implements ReleaseApprovalCommentRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: ReleaseApprovalCommentRecord): Promise<ReleaseApprovalCommentRecord> {
    const data = await this.database.read();
    data.releaseApprovalComments.push(record);
    await this.database.write(data);
    return record;
  }

  async listByApproval(approvalId: string, limit: number): Promise<ReleaseApprovalCommentRecord[]> {
    const data = await this.database.read();
    return data.releaseApprovalComments
      .filter((comment) => comment.approvalId === approvalId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileNotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord> {
    const data = await this.database.read();
    data.notificationDeliveries.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord> {
    const data = await this.database.read();
    data.notificationDeliveries = data.notificationDeliveries.map((delivery) =>
      delivery.id === record.id ? record : delivery
    );
    await this.database.write(data);
    return record;
  }

  async listByOwner(ownerId: string, limit: number): Promise<NotificationDeliveryRecord[]> {
    const data = await this.database.read();
    return data.notificationDeliveries
      .filter((delivery) => delivery.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }

  async listRunnable(limit: number, nowIso = new Date().toISOString()): Promise<NotificationDeliveryRecord[]> {
    const data = await this.database.read();
    return data.notificationDeliveries
      .filter((delivery) => delivery.status === "pending" && (!delivery.nextRunAt || delivery.nextRunAt <= nowIso))
      .sort((a, b) => {
        const nextRun = (a.nextRunAt ?? a.createdAt).localeCompare(b.nextRunAt ?? b.createdAt);
        return nextRun === 0 ? a.createdAt.localeCompare(b.createdAt) : nextRun;
      })
      .slice(0, Math.max(0, limit));
  }
}

class FileDeploymentInvalidationRepository implements DeploymentInvalidationRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: DeploymentInvalidationRecord): Promise<DeploymentInvalidationRecord> {
    const data = await this.database.read();
    data.deploymentInvalidations.push(record);
    await this.database.write(data);
    return record;
  }

  async listByProject(projectId: string, limit: number): Promise<DeploymentInvalidationRecord[]> {
    const data = await this.database.read();
    return data.deploymentInvalidations
      .filter((record) => record.projectId === projectId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }

  async listByOwner(ownerId: string, limit: number): Promise<DeploymentInvalidationRecord[]> {
    const data = await this.database.read();
    return data.deploymentInvalidations
      .filter((record) => record.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileUsageRepository implements UsageRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: UsageEventRecord): Promise<UsageEventRecord> {
    const data = await this.database.read();
    data.usageEvents.push(record);
    await this.database.write(data);
    return record;
  }

  async listByOwnerSince(ownerId: string, sinceIso: string, limit: number): Promise<UsageEventRecord[]> {
    const data = await this.database.read();
    return data.usageEvents
      .filter((event) => event.ownerId === ownerId && event.createdAt >= sinceIso)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }

  async sumByOwnerSince(ownerId: string, metric: UsageMetric, sinceIso: string): Promise<number> {
    const data = await this.database.read();
    return data.usageEvents
      .filter((event) => event.ownerId === ownerId && event.metric === metric && event.createdAt >= sinceIso)
      .reduce((sum, event) => sum + event.quantity, 0);
  }
}

class FileBillingPlanRepository implements BillingPlanRepository {
  constructor(private readonly database: FileDatabase) {}

  async upsert(record: BillingPlanRecord): Promise<BillingPlanRecord> {
    const data = await this.database.read();
    const existing = data.billingPlans.find((plan) => plan.id === record.id);
    if (existing) {
      data.billingPlans = data.billingPlans.map((plan) => plan.id === record.id ? record : plan);
    } else {
      data.billingPlans.push(record);
    }
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<BillingPlanRecord | undefined> {
    const data = await this.database.read();
    return data.billingPlans.find((plan) => plan.id === id);
  }

  async listActive(): Promise<BillingPlanRecord[]> {
    const data = await this.database.read();
    return data.billingPlans
      .filter((plan) => plan.active)
      .sort((a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id));
  }
}

class FileBillingSubscriptionRepository implements BillingSubscriptionRepository {
  constructor(private readonly database: FileDatabase) {}

  async upsert(record: BillingSubscriptionRecord): Promise<BillingSubscriptionRecord> {
    const data = await this.database.read();
    const existing = data.billingSubscriptions.find((subscription) => subscription.id === record.id);
    if (existing) {
      data.billingSubscriptions = data.billingSubscriptions.map((subscription) =>
        subscription.id === record.id ? record : subscription
      );
    } else {
      data.billingSubscriptions.push(record);
    }
    await this.database.write(data);
    return record;
  }

  async getByOwner(ownerId: string): Promise<BillingSubscriptionRecord | undefined> {
    const data = await this.database.read();
    return data.billingSubscriptions
      .filter((subscription) => subscription.ownerId === ownerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }

  async getById(id: string): Promise<BillingSubscriptionRecord | undefined> {
    const data = await this.database.read();
    return data.billingSubscriptions.find((subscription) => subscription.id === id);
  }

  async getByExternalSubscriptionId(externalSubscriptionId: string): Promise<BillingSubscriptionRecord | undefined> {
    const data = await this.database.read();
    return data.billingSubscriptions.find((subscription) =>
      subscription.externalSubscriptionId === externalSubscriptionId
    );
  }

  async getByExternalCustomerId(externalCustomerId: string): Promise<BillingSubscriptionRecord | undefined> {
    const data = await this.database.read();
    return data.billingSubscriptions
      .filter((subscription) => subscription.externalCustomerId === externalCustomerId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  }
}

class FileBillingCheckoutSessionRepository implements BillingCheckoutSessionRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord> {
    const data = await this.database.read();
    data.billingCheckoutSessions.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord> {
    const data = await this.database.read();
    data.billingCheckoutSessions = data.billingCheckoutSessions.map((session) =>
      session.id === record.id ? record : session
    );
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<BillingCheckoutSessionRecord | undefined> {
    const data = await this.database.read();
    return data.billingCheckoutSessions.find((session) => session.id === id);
  }

  async getByExternalSessionId(externalSessionId: string): Promise<BillingCheckoutSessionRecord | undefined> {
    const data = await this.database.read();
    return data.billingCheckoutSessions.find((session) => session.externalSessionId === externalSessionId);
  }

  async listByOwner(ownerId: string, limit: number): Promise<BillingCheckoutSessionRecord[]> {
    const data = await this.database.read();
    return data.billingCheckoutSessions
      .filter((session) => session.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileBillingEventRepository implements BillingEventRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: BillingEventRecord): Promise<BillingEventRecord> {
    const data = await this.database.read();
    const existing = data.billingEvents.find((event) => event.id === record.id);
    if (existing) {
      data.billingEvents = data.billingEvents.map((event) => event.id === record.id ? record : event);
    } else {
      data.billingEvents.push(record);
    }
    await this.database.write(data);
    return record;
  }

  async getByExternalEventId(provider: string, externalEventId: string): Promise<BillingEventRecord | undefined> {
    const data = await this.database.read();
    return data.billingEvents.find((event) =>
      event.provider === provider && event.externalEventId === externalEventId
    );
  }

  async listByOwner(ownerId: string, limit: number): Promise<BillingEventRecord[]> {
    const data = await this.database.read();
    return data.billingEvents
      .filter((event) => event.ownerId === ownerId)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt) || b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileAuditRepository implements AuditRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: AuditEventRecord): Promise<AuditEventRecord> {
    const data = await this.database.read();
    data.auditEvents.push(record);
    await this.database.write(data);
    return record;
  }

  async listByOwner(ownerId: string, limit: number): Promise<AuditEventRecord[]> {
    const data = await this.database.read();
    return data.auditEvents
      .filter((event) => event.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileContentSafetyRepository implements ContentSafetyRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: ContentSafetyReviewRecord): Promise<ContentSafetyReviewRecord> {
    const data = await this.database.read();
    data.contentSafetyReviews.push(record);
    await this.database.write(data);
    return record;
  }

  async listByOwner(ownerId: string, limit: number): Promise<ContentSafetyReviewRecord[]> {
    const data = await this.database.read();
    return data.contentSafetyReviews
      .filter((review) => review.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: AccessTokenRecord): Promise<AccessTokenRecord> {
    const data = await this.database.read();
    data.accessTokens.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: AccessTokenRecord): Promise<AccessTokenRecord> {
    const data = await this.database.read();
    data.accessTokens = data.accessTokens.map((token) => token.id === record.id ? record : token);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<AccessTokenRecord | undefined> {
    const data = await this.database.read();
    return data.accessTokens.find((token) => token.id === id);
  }

  async getByHash(tokenHash: string): Promise<AccessTokenRecord | undefined> {
    const data = await this.database.read();
    return data.accessTokens.find((token) => token.tokenHash === tokenHash);
  }

  async listByOwner(ownerId: string, limit: number): Promise<AccessTokenRecord[]> {
    const data = await this.database.read();
    return data.accessTokens
      .filter((token) => token.ownerId === ownerId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileUserAccountRepository implements UserAccountRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: UserAccountRecord): Promise<UserAccountRecord> {
    const data = await this.database.read();
    data.userAccounts.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: UserAccountRecord): Promise<UserAccountRecord> {
    const data = await this.database.read();
    data.userAccounts = data.userAccounts.map((user) => user.id === record.id ? record : user);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<UserAccountRecord | undefined> {
    const data = await this.database.read();
    return data.userAccounts.find((user) => user.id === id);
  }

  async getByEmail(email: string): Promise<UserAccountRecord | undefined> {
    const data = await this.database.read();
    return data.userAccounts.find((user) => user.email === email);
  }
}

class FileUserAccountActionTokenRepository implements UserAccountActionTokenRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord> {
    const data = await this.database.read();
    data.userAccountActionTokens.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord> {
    const data = await this.database.read();
    data.userAccountActionTokens = data.userAccountActionTokens.map((token) => token.id === record.id ? record : token);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<UserAccountActionTokenRecord | undefined> {
    const data = await this.database.read();
    return data.userAccountActionTokens.find((token) => token.id === id);
  }

  async getByHash(tokenHash: string): Promise<UserAccountActionTokenRecord | undefined> {
    const data = await this.database.read();
    return data.userAccountActionTokens.find((token) => token.tokenHash === tokenHash);
  }

  async listByUser(userId: string, limit: number): Promise<UserAccountActionTokenRecord[]> {
    const data = await this.database.read();
    return data.userAccountActionTokens
      .filter((token) => token.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileUserSessionRepository implements UserSessionRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: UserSessionRecord): Promise<UserSessionRecord> {
    const data = await this.database.read();
    data.userSessions.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: UserSessionRecord): Promise<UserSessionRecord> {
    const data = await this.database.read();
    data.userSessions = data.userSessions.map((session) => session.id === record.id ? record : session);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<UserSessionRecord | undefined> {
    const data = await this.database.read();
    return data.userSessions.find((session) => session.id === id);
  }

  async getByHash(tokenHash: string): Promise<UserSessionRecord | undefined> {
    const data = await this.database.read();
    return data.userSessions.find((session) => session.tokenHash === tokenHash);
  }

  async listByUser(userId: string, limit: number): Promise<UserSessionRecord[]> {
    const data = await this.database.read();
    return data.userSessions
      .filter((session) => session.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileOAuthStateRepository implements OAuthStateRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: OAuthStateRecord): Promise<OAuthStateRecord> {
    const data = await this.database.read();
    data.oauthStates.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: OAuthStateRecord): Promise<OAuthStateRecord> {
    const data = await this.database.read();
    data.oauthStates = data.oauthStates.map((state) => state.id === record.id ? record : state);
    await this.database.write(data);
    return record;
  }

  async getByHash(stateHash: string): Promise<OAuthStateRecord | undefined> {
    const data = await this.database.read();
    return data.oauthStates.find((state) => state.stateHash === stateHash);
  }
}

class FileOAuthIdentityRepository implements OAuthIdentityRepository {
  constructor(private readonly database: FileDatabase) {}

  async upsert(record: OAuthIdentityRecord): Promise<OAuthIdentityRecord> {
    const data = await this.database.read();
    const existing = data.oauthIdentities.find((identity) =>
      identity.provider === record.provider && identity.subject === record.subject
    );
    if (existing) {
      data.oauthIdentities = data.oauthIdentities.map((identity) =>
        identity.provider === record.provider && identity.subject === record.subject
          ? { ...record, id: existing.id, createdAt: existing.createdAt }
          : identity
      );
    } else {
      data.oauthIdentities.push(record);
    }
    await this.database.write(data);
    return data.oauthIdentities.find((identity) =>
      identity.provider === record.provider && identity.subject === record.subject
    ) ?? record;
  }

  async getByProviderSubject(provider: string, subject: string): Promise<OAuthIdentityRecord | undefined> {
    const data = await this.database.read();
    return data.oauthIdentities.find((identity) => identity.provider === provider && identity.subject === subject);
  }

  async listByUser(userId: string, limit: number): Promise<OAuthIdentityRecord[]> {
    const data = await this.database.read();
    return data.oauthIdentities
      .filter((identity) => identity.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }
}

class FileTeamRepository implements TeamRepository {
  constructor(private readonly database: FileDatabase) {}

  async createTeam(record: TeamRecord): Promise<TeamRecord> {
    const data = await this.database.read();
    const existing = data.teams.find((team) => team.id === record.id);
    if (existing) {
      data.teams = data.teams.map((team) => team.id === record.id ? { ...record, createdAt: team.createdAt } : team);
      await this.database.write(data);
      return data.teams.find((team) => team.id === record.id) ?? record;
    }
    data.teams.push(record);
    await this.database.write(data);
    return record;
  }

  async getTeam(id: string): Promise<TeamRecord | undefined> {
    const data = await this.database.read();
    return data.teams.find((team) => team.id === id);
  }

  async listTeamsForUser(userId: string): Promise<TeamRecord[]> {
    const data = await this.database.read();
    const teamIds = new Set(
      data.teamMembers
        .filter((member) => member.userId === userId && !member.revokedAt)
        .map((member) => member.teamId)
    );
    return data.teams
      .filter((team) => teamIds.has(team.id))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async upsertMember(record: TeamMemberRecord): Promise<TeamMemberRecord> {
    const data = await this.database.read();
    const existing = data.teamMembers.find((member) => member.teamId === record.teamId && member.userId === record.userId);
    if (existing) {
      data.teamMembers = data.teamMembers.map((member) =>
        member.teamId === record.teamId && member.userId === record.userId
          ? { ...record, id: existing.id, createdAt: existing.createdAt }
          : member
      );
    } else {
      data.teamMembers.push(record);
    }
    await this.database.write(data);
    return data.teamMembers.find((member) => member.teamId === record.teamId && member.userId === record.userId) ?? record;
  }

  async getMember(teamId: string, userId: string): Promise<TeamMemberRecord | undefined> {
    const data = await this.database.read();
    return data.teamMembers.find((member) => member.teamId === teamId && member.userId === userId);
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    const data = await this.database.read();
    return data.teamMembers
      .filter((member) => member.teamId === teamId && !member.revokedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
}

class FileTeamInvitationRepository implements TeamInvitationRepository {
  constructor(private readonly database: FileDatabase) {}

  async create(record: TeamInvitationRecord): Promise<TeamInvitationRecord> {
    const data = await this.database.read();
    data.teamInvitations.push(record);
    await this.database.write(data);
    return record;
  }

  async update(record: TeamInvitationRecord): Promise<TeamInvitationRecord> {
    const data = await this.database.read();
    data.teamInvitations = data.teamInvitations.map((invitation) => invitation.id === record.id ? record : invitation);
    await this.database.write(data);
    return record;
  }

  async getById(id: string): Promise<TeamInvitationRecord | undefined> {
    const data = await this.database.read();
    return data.teamInvitations.find((invitation) => invitation.id === id);
  }

  async getByTokenHash(tokenHash: string): Promise<TeamInvitationRecord | undefined> {
    const data = await this.database.read();
    return data.teamInvitations.find((invitation) => invitation.tokenHash === tokenHash);
  }

  async listByTeam(teamId: string, limit: number): Promise<TeamInvitationRecord[]> {
    const data = await this.database.read();
    return data.teamInvitations
      .filter((invitation) => invitation.teamId === teamId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, Math.max(0, limit));
  }
}

function normalizeJob(job: GenerationJobRecord): GenerationJobRecord {
  return {
    ...job,
    attempts: job.attempts ?? 0,
    maxAttempts: job.maxAttempts ?? 3
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
