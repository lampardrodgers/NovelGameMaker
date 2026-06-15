import type { VNProject } from "@novel-game-maker/vn-core";
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
} from "../types.js";

export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }>;
}

interface ProjectRow {
  id: string;
  owner_id: string;
  title: string;
  source: StudioProjectRecord["source"];
  vn_project: VNProject | string;
  created_at: string | Date;
  updated_at: string | Date;
  published_at?: string | Date | null;
  current_release_id?: string | null;
  published_project_url?: string | null;
  published_playable_url?: string | null;
}

interface JobRow {
  id: string;
  kind: GenerationJobRecord["kind"];
  status: GenerationJobRecord["status"];
  project_id?: string | null;
  owner_id: string;
  input: Record<string, unknown> | string;
  output?: Record<string, unknown> | string | null;
  error?: string | null;
  attempts: number;
  max_attempts?: number;
  created_at: string | Date;
  updated_at: string | Date;
  started_at?: string | Date | null;
  finished_at?: string | Date | null;
  next_run_at?: string | Date | null;
}

interface AssetRow {
  id: string;
  project_id: string;
  owner_id: string;
  asset_id: string;
  provider: AssetRecord["provider"];
  content_type: string;
  byte_length: number;
  storage_key: string;
  public_url?: string | null;
  created_at: string | Date;
}

interface PublishedProjectReleaseRow {
  id: string;
  project_id: string;
  owner_id: string;
  version: number;
  project_url: string;
  playable_url?: string | null;
  project_json_asset_id: string;
  project_json_asset_storage_key: string;
  created_at: string | Date;
  metadata?: Record<string, unknown> | string | null;
}

interface ReleaseApprovalRow {
  id: string;
  project_id: string;
  owner_id: string;
  status: ReleaseApprovalRecord["status"];
  requested_by: string;
  requested_at: string | Date;
  updated_at: string | Date;
  notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | Date | null;
  review_notes?: string | null;
  published_release_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

interface ReleaseApprovalCommentRow {
  id: string;
  approval_id: string;
  project_id: string;
  owner_id: string;
  author: string;
  body: string;
  created_at: string | Date;
  metadata?: Record<string, unknown> | string | null;
}

interface NotificationDeliveryRow {
  id: string;
  owner_id: string;
  project_id: string;
  approval_id: string;
  event: NotificationDeliveryRecord["event"];
  provider: string;
  status: NotificationDeliveryRecord["status"];
  payload: Record<string, unknown> | string;
  attempts: number;
  max_attempts: number;
  created_at: string | Date;
  updated_at: string | Date;
  next_run_at?: string | Date | null;
  last_attempt_at?: string | Date | null;
  delivered_at?: string | Date | null;
  error?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

interface DeploymentInvalidationRow {
  id: string;
  owner_id: string;
  project_id: string;
  release_id?: string | null;
  provider: string;
  status: DeploymentInvalidationRecord["status"];
  reason: DeploymentInvalidationRecord["reason"];
  urls: string[] | string;
  created_at: string | Date;
  completed_at?: string | Date | null;
  error?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

interface UsageRow {
  id: string;
  owner_id: string;
  metric: UsageMetric;
  quantity: number | string;
  project_id?: string | null;
  job_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  created_at: string | Date;
}

interface BillingPlanRow {
  id: string;
  name: string;
  description: string;
  price_cents: number | string;
  currency: string;
  interval: BillingPlanRecord["interval"];
  daily_job_limit: number;
  daily_text_job_limit: number;
  daily_image_job_limit: number;
  active: boolean;
  created_at: string | Date;
  updated_at: string | Date;
  metadata?: Record<string, unknown> | string | null;
}

interface BillingSubscriptionRow {
  id: string;
  owner_id: string;
  plan_id: string;
  status: BillingSubscriptionRecord["status"];
  current_period_start: string | Date;
  current_period_end: string | Date;
  cancel_at_period_end: boolean;
  external_customer_id?: string | null;
  external_subscription_id?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  cancelled_at?: string | Date | null;
  metadata?: Record<string, unknown> | string | null;
}

interface BillingCheckoutSessionRow {
  id: string;
  owner_id: string;
  plan_id: string;
  status: BillingCheckoutSessionRecord["status"];
  checkout_url: string;
  success_url?: string | null;
  cancel_url?: string | null;
  external_session_id?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  completed_at?: string | Date | null;
  expires_at?: string | Date | null;
  metadata?: Record<string, unknown> | string | null;
}

interface BillingEventRow {
  id: string;
  owner_id: string;
  provider: string;
  event_type: BillingEventRecord["eventType"];
  external_event_id?: string | null;
  subscription_id?: string | null;
  checkout_session_id?: string | null;
  external_customer_id?: string | null;
  external_subscription_id?: string | null;
  external_invoice_id?: string | null;
  external_charge_id?: string | null;
  amount_due_cents?: number | string | null;
  amount_paid_cents?: number | string | null;
  amount_refunded_cents?: number | string | null;
  amount_disputed_cents?: number | string | null;
  currency?: string | null;
  status?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf_url?: string | null;
  occurred_at: string | Date;
  created_at: string | Date;
  metadata?: Record<string, unknown> | string | null;
}

interface AuditRow {
  id: string;
  owner_id?: string | null;
  action: string;
  target_type: string;
  target_id?: string | null;
  outcome: AuditEventRecord["outcome"];
  details?: Record<string, unknown> | string | null;
  created_at: string | Date;
}

interface SumRow {
  total?: number | string | null;
}

interface ContentSafetyRow {
  id: string;
  owner_id: string;
  source: ContentSafetyReviewRecord["source"];
  decision: ContentSafetyReviewRecord["decision"];
  target_type: string;
  target_id?: string | null;
  input_hash: string;
  input_length: number;
  matched_rules: string[] | string;
  metadata?: Record<string, unknown> | string | null;
  created_at: string | Date;
}

interface AccessTokenRow {
  id: string;
  token_hash: string;
  token_prefix: string;
  role: AccessTokenRecord["role"];
  owner_id?: string | null;
  user_id?: string | null;
  label: string;
  created_at: string | Date;
  last_used_at?: string | Date | null;
  revoked_at?: string | Date | null;
  expires_at?: string | Date | null;
}

interface UserAccountRow {
  id: string;
  email: string;
  password_hash: string;
  name?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  email_verified_at?: string | Date | null;
  last_login_at?: string | Date | null;
  last_failed_login_at?: string | Date | null;
  failed_login_count?: number | null;
  locked_until?: string | Date | null;
  password_updated_at?: string | Date | null;
  mfa_totp_secret_encrypted?: string | null;
  mfa_totp_enabled_at?: string | Date | null;
  mfa_totp_last_used_counter?: number | string | null;
  mfa_recovery_code_hashes?: string[] | string | null;
  mfa_recovery_codes_updated_at?: string | Date | null;
  mfa_trusted_devices?: UserAccountRecord["mfaTrustedDevices"] | string | null;
  disabled_at?: string | Date | null;
}

interface UserAccountActionTokenRow {
  id: string;
  user_id: string;
  email: string;
  purpose: UserAccountActionTokenRecord["purpose"];
  token_hash: string;
  token_prefix: string;
  status: UserAccountActionTokenRecord["status"];
  created_at: string | Date;
  updated_at: string | Date;
  expires_at?: string | Date | null;
  used_at?: string | Date | null;
  revoked_at?: string | Date | null;
}

interface UserSessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_prefix: string;
  created_at: string | Date;
  updated_at: string | Date;
  last_used_at?: string | Date | null;
  revoked_at?: string | Date | null;
  expires_at?: string | Date | null;
}

interface OAuthStateRow {
  id: string;
  provider: string;
  state_hash: string;
  code_verifier?: string | null;
  return_url?: string | null;
  status: OAuthStateRecord["status"];
  created_at: string | Date;
  updated_at: string | Date;
  expires_at: string | Date;
  used_at?: string | Date | null;
}

interface OAuthIdentityRow {
  id: string;
  provider: string;
  subject: string;
  user_id: string;
  email: string;
  name?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  last_login_at?: string | Date | null;
  metadata?: Record<string, unknown> | string | null;
}

interface TeamRow {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
}

interface TeamMemberRow {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamMemberRecord["role"];
  created_at: string | Date;
  updated_at: string | Date;
  revoked_at?: string | Date | null;
}

interface TeamInvitationRow {
  id: string;
  team_id: string;
  email: string;
  role: TeamInvitationRecord["role"];
  token_hash: string;
  token_prefix: string;
  status: TeamInvitationRecord["status"];
  invited_by: string;
  invited_user_id?: string | null;
  accepted_by_user_id?: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  expires_at?: string | Date | null;
  accepted_at?: string | Date | null;
  revoked_at?: string | Date | null;
}

export class PostgresProjectRepository implements ProjectRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: StudioProjectRecord): Promise<StudioProjectRecord> {
    const result = await this.sql.query<ProjectRow>(
      `insert into studio_projects (
        id, owner_id, title, source, vn_project, created_at, updated_at, published_at,
        current_release_id, published_project_url, published_playable_url
      ) values ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11)
      returning *`,
      [
        record.id,
        record.ownerId,
        record.title,
        record.source,
        JSON.stringify(record.vnProject),
        record.createdAt,
        record.updatedAt,
        record.publishedAt ?? null,
        record.currentReleaseId ?? null,
        record.publishedProjectUrl ?? null,
        record.publishedPlayableUrl ?? null
      ]
    );
    return mapProjectRow(requireRow(result.rows));
  }

  async update(record: StudioProjectRecord): Promise<StudioProjectRecord> {
    const result = await this.sql.query<ProjectRow>(
      `update studio_projects
      set owner_id = $2,
          title = $3,
          source = $4,
          vn_project = $5::jsonb,
          updated_at = $6,
          published_at = $7,
          current_release_id = $8,
          published_project_url = $9,
          published_playable_url = $10
      where id = $1
      returning *`,
      [
        record.id,
        record.ownerId,
        record.title,
        record.source,
        JSON.stringify(record.vnProject),
        record.updatedAt,
        record.publishedAt ?? null,
        record.currentReleaseId ?? null,
        record.publishedProjectUrl ?? null,
        record.publishedPlayableUrl ?? null
      ]
    );
    return mapProjectRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<StudioProjectRecord | undefined> {
    const result = await this.sql.query<ProjectRow>("select * from studio_projects where id = $1 limit 1", [id]);
    return result.rows[0] ? mapProjectRow(result.rows[0]) : undefined;
  }

  async listByOwner(ownerId: string): Promise<StudioProjectRecord[]> {
    const result = await this.sql.query<ProjectRow>(
      "select * from studio_projects where owner_id = $1 order by updated_at desc",
      [ownerId]
    );
    return result.rows.map(mapProjectRow);
  }

  async deleteById(id: string): Promise<boolean> {
    const result = await this.sql.query("delete from studio_projects where id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }
}

export class PostgresJobRepository implements JobRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: GenerationJobRecord): Promise<GenerationJobRecord> {
    const result = await this.sql.query<JobRow>(
      `insert into generation_jobs (
        id, kind, status, project_id, owner_id, input, output, error, attempts,
        max_attempts, created_at, updated_at, started_at, finished_at, next_run_at
      ) values ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
      returning *`,
      jobParams(record)
    );
    return mapJobRow(requireRow(result.rows));
  }

  async update(record: GenerationJobRecord): Promise<GenerationJobRecord> {
    const result = await this.sql.query<JobRow>(
      `update generation_jobs
      set kind = $2,
          status = $3,
          project_id = $4,
          owner_id = $5,
          input = $6::jsonb,
          output = $7::jsonb,
          error = $8,
          attempts = $9,
          max_attempts = $10,
          created_at = $11,
          updated_at = $12,
          started_at = $13,
          finished_at = $14,
          next_run_at = $15
      where id = $1
      returning *`,
      jobParams(record)
    );
    return mapJobRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<GenerationJobRecord | undefined> {
    const result = await this.sql.query<JobRow>("select * from generation_jobs where id = $1 limit 1", [id]);
    return result.rows[0] ? mapJobRow(result.rows[0]) : undefined;
  }

  async listByOwner(ownerId: string): Promise<GenerationJobRecord[]> {
    const result = await this.sql.query<JobRow>(
      "select * from generation_jobs where owner_id = $1 order by updated_at desc",
      [ownerId]
    );
    return result.rows.map(mapJobRow);
  }

  async listQueued(limit: number, nowIso = new Date().toISOString()): Promise<GenerationJobRecord[]> {
    const result = await this.sql.query<JobRow>(
      `select * from generation_jobs
      where status = 'queued'
        and (next_run_at is null or next_run_at <= $1)
      order by created_at asc
      limit $2`,
      [nowIso, limit]
    );
    return result.rows.map(mapJobRow);
  }
}

export class PostgresAssetRepository implements AssetRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: AssetRecord): Promise<AssetRecord> {
    const result = await this.sql.query<AssetRow>(
      `insert into project_assets (
        id, project_id, owner_id, asset_id, provider, content_type, byte_length,
        storage_key, public_url, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      [
        record.id,
        record.projectId,
        record.ownerId,
        record.assetId,
        record.provider,
        record.contentType,
        record.byteLength,
        record.storageKey,
        record.publicUrl ?? null,
        record.createdAt
      ]
    );
    return mapAssetRow(requireRow(result.rows));
  }

  async listByProject(projectId: string): Promise<AssetRecord[]> {
    const result = await this.sql.query<AssetRow>(
      "select * from project_assets where project_id = $1 order by created_at desc",
      [projectId]
    );
    return result.rows.map(mapAssetRow);
  }
}

export class PostgresPublishedProjectReleaseRepository implements PublishedProjectReleaseRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: PublishedProjectReleaseRecord): Promise<PublishedProjectReleaseRecord> {
    const result = await this.sql.query<PublishedProjectReleaseRow>(
      `insert into published_project_releases (
        id, project_id, owner_id, version, project_url, playable_url,
        project_json_asset_id, project_json_asset_storage_key, created_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
      returning *`,
      [
        record.id,
        record.projectId,
        record.ownerId,
        record.version,
        record.projectUrl,
        record.playableUrl ?? null,
        record.projectJsonAssetId,
        record.projectJsonAssetStorageKey,
        record.createdAt,
        record.metadata ? JSON.stringify(record.metadata) : null
      ]
    );
    return mapPublishedProjectReleaseRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<PublishedProjectReleaseRecord | undefined> {
    const result = await this.sql.query<PublishedProjectReleaseRow>(
      "select * from published_project_releases where id = $1 limit 1",
      [id]
    );
    return result.rows[0] ? mapPublishedProjectReleaseRow(result.rows[0]) : undefined;
  }

  async listByProject(projectId: string, limit: number): Promise<PublishedProjectReleaseRecord[]> {
    const result = await this.sql.query<PublishedProjectReleaseRow>(
      `select * from published_project_releases
      where project_id = $1
      order by version desc
      limit $2`,
      [projectId, limit]
    );
    return result.rows.map(mapPublishedProjectReleaseRow);
  }

  async getLatestByProject(projectId: string): Promise<PublishedProjectReleaseRecord | undefined> {
    const result = await this.sql.query<PublishedProjectReleaseRow>(
      `select * from published_project_releases
      where project_id = $1
      order by version desc
      limit 1`,
      [projectId]
    );
    return result.rows[0] ? mapPublishedProjectReleaseRow(result.rows[0]) : undefined;
  }
}

export class PostgresReleaseApprovalRepository implements ReleaseApprovalRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      `insert into release_approvals (
        id, project_id, owner_id, status, requested_by, requested_at, updated_at,
        notes, reviewed_by, reviewed_at, review_notes, published_release_id, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      returning *`,
      releaseApprovalParams(record)
    );
    return mapReleaseApprovalRow(requireRow(result.rows));
  }

  async update(record: ReleaseApprovalRecord): Promise<ReleaseApprovalRecord> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      `update release_approvals
      set project_id = $2,
          owner_id = $3,
          status = $4,
          requested_by = $5,
          requested_at = $6,
          updated_at = $7,
          notes = $8,
          reviewed_by = $9,
          reviewed_at = $10,
          review_notes = $11,
          published_release_id = $12,
          metadata = $13::jsonb
      where id = $1
      returning *`,
      releaseApprovalParams(record)
    );
    return mapReleaseApprovalRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<ReleaseApprovalRecord | undefined> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      "select * from release_approvals where id = $1 limit 1",
      [id]
    );
    return result.rows[0] ? mapReleaseApprovalRow(result.rows[0]) : undefined;
  }

  async listByProject(projectId: string, limit: number): Promise<ReleaseApprovalRecord[]> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      `select * from release_approvals
      where project_id = $1
      order by updated_at desc
      limit $2`,
      [projectId, limit]
    );
    return result.rows.map(mapReleaseApprovalRow);
  }

  async listByOwner(ownerId: string, limit: number): Promise<ReleaseApprovalRecord[]> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      `select * from release_approvals
      where owner_id = $1
      order by updated_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapReleaseApprovalRow);
  }

  async getPendingByProject(projectId: string): Promise<ReleaseApprovalRecord | undefined> {
    const result = await this.sql.query<ReleaseApprovalRow>(
      `select * from release_approvals
      where project_id = $1 and status = 'pending'
      order by requested_at desc
      limit 1`,
      [projectId]
    );
    return result.rows[0] ? mapReleaseApprovalRow(result.rows[0]) : undefined;
  }
}

export class PostgresReleaseApprovalCommentRepository implements ReleaseApprovalCommentRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: ReleaseApprovalCommentRecord): Promise<ReleaseApprovalCommentRecord> {
    const result = await this.sql.query<ReleaseApprovalCommentRow>(
      `insert into release_approval_comments (
        id, approval_id, project_id, owner_id, author, body, created_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
      returning *`,
      releaseApprovalCommentParams(record)
    );
    return mapReleaseApprovalCommentRow(requireRow(result.rows));
  }

  async listByApproval(approvalId: string, limit: number): Promise<ReleaseApprovalCommentRecord[]> {
    const result = await this.sql.query<ReleaseApprovalCommentRow>(
      `select * from release_approval_comments
      where approval_id = $1
      order by created_at asc
      limit $2`,
      [approvalId, limit]
    );
    return result.rows.map(mapReleaseApprovalCommentRow);
  }
}

export class PostgresNotificationDeliveryRepository implements NotificationDeliveryRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord> {
    const result = await this.sql.query<NotificationDeliveryRow>(
      `insert into notification_deliveries (
        id, owner_id, project_id, approval_id, event, provider, status,
        payload, attempts, max_attempts, created_at, updated_at, next_run_at,
        last_attempt_at, delivered_at, error, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
      returning *`,
      notificationDeliveryParams(record)
    );
    return mapNotificationDeliveryRow(requireRow(result.rows));
  }

  async update(record: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord> {
    const result = await this.sql.query<NotificationDeliveryRow>(
      `update notification_deliveries
      set owner_id = $2,
        project_id = $3,
        approval_id = $4,
        event = $5,
        provider = $6,
        status = $7,
        payload = $8::jsonb,
        attempts = $9,
        max_attempts = $10,
        created_at = $11,
        updated_at = $12,
        next_run_at = $13,
        last_attempt_at = $14,
        delivered_at = $15,
        error = $16,
        metadata = $17::jsonb
      where id = $1
      returning *`,
      notificationDeliveryParams(record)
    );
    return mapNotificationDeliveryRow(requireRow(result.rows));
  }

  async listByOwner(ownerId: string, limit: number): Promise<NotificationDeliveryRecord[]> {
    const result = await this.sql.query<NotificationDeliveryRow>(
      `select * from notification_deliveries
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapNotificationDeliveryRow);
  }

  async listRunnable(limit: number, nowIso = new Date().toISOString()): Promise<NotificationDeliveryRecord[]> {
    const result = await this.sql.query<NotificationDeliveryRow>(
      `select * from notification_deliveries
      where status = 'pending'
        and (next_run_at is null or next_run_at <= $1)
      order by next_run_at asc nulls first, created_at asc
      limit $2`,
      [nowIso, limit]
    );
    return result.rows.map(mapNotificationDeliveryRow);
  }
}

export class PostgresDeploymentInvalidationRepository implements DeploymentInvalidationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: DeploymentInvalidationRecord): Promise<DeploymentInvalidationRecord> {
    const result = await this.sql.query<DeploymentInvalidationRow>(
      `insert into deployment_invalidations (
        id, owner_id, project_id, release_id, provider, status, reason,
        urls, created_at, completed_at, error, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb)
      returning *`,
      [
        record.id,
        record.ownerId,
        record.projectId,
        record.releaseId ?? null,
        record.provider,
        record.status,
        record.reason,
        JSON.stringify(record.urls),
        record.createdAt,
        record.completedAt ?? null,
        record.error ?? null,
        record.metadata ? JSON.stringify(record.metadata) : null
      ]
    );
    return mapDeploymentInvalidationRow(requireRow(result.rows));
  }

  async listByProject(projectId: string, limit: number): Promise<DeploymentInvalidationRecord[]> {
    const result = await this.sql.query<DeploymentInvalidationRow>(
      `select * from deployment_invalidations
      where project_id = $1
      order by created_at desc
      limit $2`,
      [projectId, limit]
    );
    return result.rows.map(mapDeploymentInvalidationRow);
  }

  async listByOwner(ownerId: string, limit: number): Promise<DeploymentInvalidationRecord[]> {
    const result = await this.sql.query<DeploymentInvalidationRow>(
      `select * from deployment_invalidations
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapDeploymentInvalidationRow);
  }
}

export class PostgresUsageRepository implements UsageRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: UsageEventRecord): Promise<UsageEventRecord> {
    const result = await this.sql.query<UsageRow>(
      `insert into usage_events (
        id, owner_id, metric, quantity, project_id, job_id, metadata, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      returning *`,
      [
        record.id,
        record.ownerId,
        record.metric,
        record.quantity,
        record.projectId ?? null,
        record.jobId ?? null,
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.createdAt
      ]
    );
    return mapUsageRow(requireRow(result.rows));
  }

  async listByOwnerSince(ownerId: string, sinceIso: string, limit: number): Promise<UsageEventRecord[]> {
    const result = await this.sql.query<UsageRow>(
      `select * from usage_events
      where owner_id = $1 and created_at >= $2
      order by created_at desc
      limit $3`,
      [ownerId, sinceIso, limit]
    );
    return result.rows.map(mapUsageRow);
  }

  async sumByOwnerSince(ownerId: string, metric: UsageMetric, sinceIso: string): Promise<number> {
    const result = await this.sql.query<SumRow>(
      `select coalesce(sum(quantity), 0) as total
      from usage_events
      where owner_id = $1 and metric = $2 and created_at >= $3`,
      [ownerId, metric, sinceIso]
    );
    return Number(result.rows[0]?.total ?? 0);
  }
}

export class PostgresBillingPlanRepository implements BillingPlanRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async upsert(record: BillingPlanRecord): Promise<BillingPlanRecord> {
    const result = await this.sql.query<BillingPlanRow>(
      `insert into billing_plans (
        id, name, description, price_cents, currency, interval,
        daily_job_limit, daily_text_job_limit, daily_image_job_limit,
        active, created_at, updated_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      on conflict (id) do update
      set name = excluded.name,
          description = excluded.description,
          price_cents = excluded.price_cents,
          currency = excluded.currency,
          interval = excluded.interval,
          daily_job_limit = excluded.daily_job_limit,
          daily_text_job_limit = excluded.daily_text_job_limit,
          daily_image_job_limit = excluded.daily_image_job_limit,
          active = excluded.active,
          updated_at = excluded.updated_at,
          metadata = excluded.metadata
      returning *`,
      billingPlanParams(record)
    );
    return mapBillingPlanRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<BillingPlanRecord | undefined> {
    const result = await this.sql.query<BillingPlanRow>("select * from billing_plans where id = $1 limit 1", [id]);
    return result.rows[0] ? mapBillingPlanRow(result.rows[0]) : undefined;
  }

  async listActive(): Promise<BillingPlanRecord[]> {
    const result = await this.sql.query<BillingPlanRow>(
      "select * from billing_plans where active = true order by price_cents asc, id asc"
    );
    return result.rows.map(mapBillingPlanRow);
  }
}

export class PostgresBillingSubscriptionRepository implements BillingSubscriptionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async upsert(record: BillingSubscriptionRecord): Promise<BillingSubscriptionRecord> {
    const result = await this.sql.query<BillingSubscriptionRow>(
      `insert into billing_subscriptions (
        id, owner_id, plan_id, status, current_period_start, current_period_end,
        cancel_at_period_end, external_customer_id, external_subscription_id,
        created_at, updated_at, cancelled_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      on conflict (owner_id) do update
      set plan_id = excluded.plan_id,
          status = excluded.status,
          current_period_start = excluded.current_period_start,
          current_period_end = excluded.current_period_end,
          cancel_at_period_end = excluded.cancel_at_period_end,
          external_customer_id = excluded.external_customer_id,
          external_subscription_id = excluded.external_subscription_id,
          updated_at = excluded.updated_at,
          cancelled_at = excluded.cancelled_at,
          metadata = excluded.metadata
      returning *`,
      billingSubscriptionParams(record)
    );
    return mapBillingSubscriptionRow(requireRow(result.rows));
  }

  async getByOwner(ownerId: string): Promise<BillingSubscriptionRecord | undefined> {
    const result = await this.sql.query<BillingSubscriptionRow>(
      "select * from billing_subscriptions where owner_id = $1 order by updated_at desc limit 1",
      [ownerId]
    );
    return result.rows[0] ? mapBillingSubscriptionRow(result.rows[0]) : undefined;
  }

  async getById(id: string): Promise<BillingSubscriptionRecord | undefined> {
    const result = await this.sql.query<BillingSubscriptionRow>(
      "select * from billing_subscriptions where id = $1 limit 1",
      [id]
    );
    return result.rows[0] ? mapBillingSubscriptionRow(result.rows[0]) : undefined;
  }

  async getByExternalSubscriptionId(externalSubscriptionId: string): Promise<BillingSubscriptionRecord | undefined> {
    const result = await this.sql.query<BillingSubscriptionRow>(
      "select * from billing_subscriptions where external_subscription_id = $1 limit 1",
      [externalSubscriptionId]
    );
    return result.rows[0] ? mapBillingSubscriptionRow(result.rows[0]) : undefined;
  }

  async getByExternalCustomerId(externalCustomerId: string): Promise<BillingSubscriptionRecord | undefined> {
    const result = await this.sql.query<BillingSubscriptionRow>(
      `select * from billing_subscriptions
      where external_customer_id = $1
      order by updated_at desc
      limit 1`,
      [externalCustomerId]
    );
    return result.rows[0] ? mapBillingSubscriptionRow(result.rows[0]) : undefined;
  }
}

export class PostgresBillingCheckoutSessionRepository implements BillingCheckoutSessionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord> {
    const result = await this.sql.query<BillingCheckoutSessionRow>(
      `insert into billing_checkout_sessions (
        id, owner_id, plan_id, status, checkout_url, success_url, cancel_url,
        external_session_id, created_at, updated_at, completed_at, expires_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)
      returning *`,
      billingCheckoutSessionParams(record)
    );
    return mapBillingCheckoutSessionRow(requireRow(result.rows));
  }

  async update(record: BillingCheckoutSessionRecord): Promise<BillingCheckoutSessionRecord> {
    const result = await this.sql.query<BillingCheckoutSessionRow>(
      `update billing_checkout_sessions
      set owner_id = $2,
          plan_id = $3,
          status = $4,
          checkout_url = $5,
          success_url = $6,
          cancel_url = $7,
          external_session_id = $8,
          created_at = $9,
          updated_at = $10,
          completed_at = $11,
          expires_at = $12,
          metadata = $13::jsonb
      where id = $1
      returning *`,
      billingCheckoutSessionParams(record)
    );
    return mapBillingCheckoutSessionRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<BillingCheckoutSessionRecord | undefined> {
    const result = await this.sql.query<BillingCheckoutSessionRow>(
      "select * from billing_checkout_sessions where id = $1 limit 1",
      [id]
    );
    return result.rows[0] ? mapBillingCheckoutSessionRow(result.rows[0]) : undefined;
  }

  async getByExternalSessionId(externalSessionId: string): Promise<BillingCheckoutSessionRecord | undefined> {
    const result = await this.sql.query<BillingCheckoutSessionRow>(
      "select * from billing_checkout_sessions where external_session_id = $1 limit 1",
      [externalSessionId]
    );
    return result.rows[0] ? mapBillingCheckoutSessionRow(result.rows[0]) : undefined;
  }

  async listByOwner(ownerId: string, limit: number): Promise<BillingCheckoutSessionRecord[]> {
    const result = await this.sql.query<BillingCheckoutSessionRow>(
      `select * from billing_checkout_sessions
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapBillingCheckoutSessionRow);
  }
}

export class PostgresBillingEventRepository implements BillingEventRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: BillingEventRecord): Promise<BillingEventRecord> {
    const result = await this.sql.query<BillingEventRow>(
      `insert into billing_events (
        id, owner_id, provider, event_type, external_event_id, subscription_id,
        checkout_session_id, external_customer_id, external_subscription_id,
        external_invoice_id, external_charge_id, amount_due_cents, amount_paid_cents,
        amount_refunded_cents, amount_disputed_cents, currency, status,
        hosted_invoice_url, invoice_pdf_url, occurred_at, created_at, metadata
      ) values (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22::jsonb
      )
      on conflict (id) do update
      set owner_id = excluded.owner_id,
          provider = excluded.provider,
          event_type = excluded.event_type,
          external_event_id = excluded.external_event_id,
          subscription_id = excluded.subscription_id,
          checkout_session_id = excluded.checkout_session_id,
          external_customer_id = excluded.external_customer_id,
          external_subscription_id = excluded.external_subscription_id,
          external_invoice_id = excluded.external_invoice_id,
          external_charge_id = excluded.external_charge_id,
          amount_due_cents = excluded.amount_due_cents,
          amount_paid_cents = excluded.amount_paid_cents,
          amount_refunded_cents = excluded.amount_refunded_cents,
          amount_disputed_cents = excluded.amount_disputed_cents,
          currency = excluded.currency,
          status = excluded.status,
          hosted_invoice_url = excluded.hosted_invoice_url,
          invoice_pdf_url = excluded.invoice_pdf_url,
          occurred_at = excluded.occurred_at,
          created_at = excluded.created_at,
          metadata = excluded.metadata
      returning *`,
      billingEventParams(record)
    );
    return mapBillingEventRow(requireRow(result.rows));
  }

  async getByExternalEventId(provider: string, externalEventId: string): Promise<BillingEventRecord | undefined> {
    const result = await this.sql.query<BillingEventRow>(
      `select * from billing_events
      where provider = $1 and external_event_id = $2
      limit 1`,
      [provider, externalEventId]
    );
    return result.rows[0] ? mapBillingEventRow(result.rows[0]) : undefined;
  }

  async listByOwner(ownerId: string, limit: number): Promise<BillingEventRecord[]> {
    const result = await this.sql.query<BillingEventRow>(
      `select * from billing_events
      where owner_id = $1
      order by occurred_at desc, created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapBillingEventRow);
  }
}

export class PostgresAuditRepository implements AuditRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: AuditEventRecord): Promise<AuditEventRecord> {
    const result = await this.sql.query<AuditRow>(
      `insert into audit_events (
        id, owner_id, action, target_type, target_id, outcome, details, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
      returning *`,
      [
        record.id,
        record.ownerId ?? null,
        record.action,
        record.targetType,
        record.targetId ?? null,
        record.outcome,
        record.details ? JSON.stringify(record.details) : null,
        record.createdAt
      ]
    );
    return mapAuditRow(requireRow(result.rows));
  }

  async listByOwner(ownerId: string, limit: number): Promise<AuditEventRecord[]> {
    const result = await this.sql.query<AuditRow>(
      `select * from audit_events
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapAuditRow);
  }
}

export class PostgresContentSafetyRepository implements ContentSafetyRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: ContentSafetyReviewRecord): Promise<ContentSafetyReviewRecord> {
    const result = await this.sql.query<ContentSafetyRow>(
      `insert into content_safety_reviews (
        id, owner_id, source, decision, target_type, target_id, input_hash,
        input_length, matched_rules, metadata, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11)
      returning *`,
      [
        record.id,
        record.ownerId,
        record.source,
        record.decision,
        record.targetType,
        record.targetId ?? null,
        record.inputHash,
        record.inputLength,
        JSON.stringify(record.matchedRules),
        record.metadata ? JSON.stringify(record.metadata) : null,
        record.createdAt
      ]
    );
    return mapContentSafetyRow(requireRow(result.rows));
  }

  async listByOwner(ownerId: string, limit: number): Promise<ContentSafetyReviewRecord[]> {
    const result = await this.sql.query<ContentSafetyRow>(
      `select * from content_safety_reviews
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapContentSafetyRow);
  }
}

export class PostgresAccessTokenRepository implements AccessTokenRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: AccessTokenRecord): Promise<AccessTokenRecord> {
    const result = await this.sql.query<AccessTokenRow>(
      `insert into access_tokens (
        id, token_hash, token_prefix, role, owner_id, user_id, label,
        created_at, last_used_at, revoked_at, expires_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      returning *`,
      accessTokenParams(record)
    );
    return mapAccessTokenRow(requireRow(result.rows));
  }

  async update(record: AccessTokenRecord): Promise<AccessTokenRecord> {
    const result = await this.sql.query<AccessTokenRow>(
      `update access_tokens
      set token_hash = $2,
          token_prefix = $3,
          role = $4,
          owner_id = $5,
          user_id = $6,
          label = $7,
          created_at = $8,
          last_used_at = $9,
          revoked_at = $10,
          expires_at = $11
      where id = $1
      returning *`,
      accessTokenParams(record)
    );
    return mapAccessTokenRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<AccessTokenRecord | undefined> {
    const result = await this.sql.query<AccessTokenRow>("select * from access_tokens where id = $1 limit 1", [id]);
    return result.rows[0] ? mapAccessTokenRow(result.rows[0]) : undefined;
  }

  async getByHash(tokenHash: string): Promise<AccessTokenRecord | undefined> {
    const result = await this.sql.query<AccessTokenRow>("select * from access_tokens where token_hash = $1 limit 1", [tokenHash]);
    return result.rows[0] ? mapAccessTokenRow(result.rows[0]) : undefined;
  }

  async listByOwner(ownerId: string, limit: number): Promise<AccessTokenRecord[]> {
    const result = await this.sql.query<AccessTokenRow>(
      `select * from access_tokens
      where owner_id = $1
      order by created_at desc
      limit $2`,
      [ownerId, limit]
    );
    return result.rows.map(mapAccessTokenRow);
  }
}

export class PostgresUserAccountRepository implements UserAccountRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: UserAccountRecord): Promise<UserAccountRecord> {
    const result = await this.sql.query<UserAccountRow>(
      `insert into user_accounts (
        id, email, password_hash, name, created_at, updated_at,
        email_verified_at, last_login_at, last_failed_login_at, failed_login_count,
        locked_until, password_updated_at, mfa_totp_secret_encrypted,
        mfa_totp_enabled_at, mfa_totp_last_used_counter, mfa_recovery_code_hashes,
        mfa_recovery_codes_updated_at, mfa_trusted_devices, disabled_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      returning *`,
      userAccountParams(record)
    );
    return mapUserAccountRow(requireRow(result.rows));
  }

  async update(record: UserAccountRecord): Promise<UserAccountRecord> {
    const result = await this.sql.query<UserAccountRow>(
      `update user_accounts
      set email = $2,
          password_hash = $3,
          name = $4,
          created_at = $5,
          updated_at = $6,
          email_verified_at = $7,
          last_login_at = $8,
          last_failed_login_at = $9,
          failed_login_count = $10,
          locked_until = $11,
          password_updated_at = $12,
          mfa_totp_secret_encrypted = $13,
          mfa_totp_enabled_at = $14,
          mfa_totp_last_used_counter = $15,
          mfa_recovery_code_hashes = $16,
          mfa_recovery_codes_updated_at = $17,
          mfa_trusted_devices = $18,
          disabled_at = $19
      where id = $1
      returning *`,
      userAccountParams(record)
    );
    return mapUserAccountRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<UserAccountRecord | undefined> {
    const result = await this.sql.query<UserAccountRow>("select * from user_accounts where id = $1 limit 1", [id]);
    return result.rows[0] ? mapUserAccountRow(result.rows[0]) : undefined;
  }

  async getByEmail(email: string): Promise<UserAccountRecord | undefined> {
    const result = await this.sql.query<UserAccountRow>("select * from user_accounts where email = $1 limit 1", [email]);
    return result.rows[0] ? mapUserAccountRow(result.rows[0]) : undefined;
  }
}

export class PostgresUserAccountActionTokenRepository implements UserAccountActionTokenRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord> {
    const result = await this.sql.query<UserAccountActionTokenRow>(
      `insert into user_account_action_tokens (
        id, user_id, email, purpose, token_hash, token_prefix, status,
        created_at, updated_at, expires_at, used_at, revoked_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      userAccountActionTokenParams(record)
    );
    return mapUserAccountActionTokenRow(requireRow(result.rows));
  }

  async update(record: UserAccountActionTokenRecord): Promise<UserAccountActionTokenRecord> {
    const result = await this.sql.query<UserAccountActionTokenRow>(
      `update user_account_action_tokens
      set user_id = $2,
          email = $3,
          purpose = $4,
          token_hash = $5,
          token_prefix = $6,
          status = $7,
          created_at = $8,
          updated_at = $9,
          expires_at = $10,
          used_at = $11,
          revoked_at = $12
      where id = $1
      returning *`,
      userAccountActionTokenParams(record)
    );
    return mapUserAccountActionTokenRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<UserAccountActionTokenRecord | undefined> {
    const result = await this.sql.query<UserAccountActionTokenRow>(
      "select * from user_account_action_tokens where id = $1 limit 1",
      [id]
    );
    return result.rows[0] ? mapUserAccountActionTokenRow(result.rows[0]) : undefined;
  }

  async getByHash(tokenHash: string): Promise<UserAccountActionTokenRecord | undefined> {
    const result = await this.sql.query<UserAccountActionTokenRow>(
      "select * from user_account_action_tokens where token_hash = $1 limit 1",
      [tokenHash]
    );
    return result.rows[0] ? mapUserAccountActionTokenRow(result.rows[0]) : undefined;
  }

  async listByUser(userId: string, limit: number): Promise<UserAccountActionTokenRecord[]> {
    const result = await this.sql.query<UserAccountActionTokenRow>(
      `select * from user_account_action_tokens
      where user_id = $1
      order by updated_at desc
      limit $2`,
      [userId, limit]
    );
    return result.rows.map(mapUserAccountActionTokenRow);
  }
}

export class PostgresUserSessionRepository implements UserSessionRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: UserSessionRecord): Promise<UserSessionRecord> {
    const result = await this.sql.query<UserSessionRow>(
      `insert into user_sessions (
        id, user_id, token_hash, token_prefix, created_at, updated_at,
        last_used_at, revoked_at, expires_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      returning *`,
      userSessionParams(record)
    );
    return mapUserSessionRow(requireRow(result.rows));
  }

  async update(record: UserSessionRecord): Promise<UserSessionRecord> {
    const result = await this.sql.query<UserSessionRow>(
      `update user_sessions
      set user_id = $2,
          token_hash = $3,
          token_prefix = $4,
          created_at = $5,
          updated_at = $6,
          last_used_at = $7,
          revoked_at = $8,
          expires_at = $9
      where id = $1
      returning *`,
      userSessionParams(record)
    );
    return mapUserSessionRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<UserSessionRecord | undefined> {
    const result = await this.sql.query<UserSessionRow>("select * from user_sessions where id = $1 limit 1", [id]);
    return result.rows[0] ? mapUserSessionRow(result.rows[0]) : undefined;
  }

  async getByHash(tokenHash: string): Promise<UserSessionRecord | undefined> {
    const result = await this.sql.query<UserSessionRow>("select * from user_sessions where token_hash = $1 limit 1", [tokenHash]);
    return result.rows[0] ? mapUserSessionRow(result.rows[0]) : undefined;
  }

  async listByUser(userId: string, limit: number): Promise<UserSessionRecord[]> {
    const result = await this.sql.query<UserSessionRow>(
      `select * from user_sessions
      where user_id = $1
      order by updated_at desc
      limit $2`,
      [userId, limit]
    );
    return result.rows.map(mapUserSessionRow);
  }
}

export class PostgresOAuthStateRepository implements OAuthStateRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: OAuthStateRecord): Promise<OAuthStateRecord> {
    const result = await this.sql.query<OAuthStateRow>(
      `insert into oauth_states (
        id, provider, state_hash, code_verifier, return_url, status,
        created_at, updated_at, expires_at, used_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      returning *`,
      oauthStateParams(record)
    );
    return mapOAuthStateRow(requireRow(result.rows));
  }

  async update(record: OAuthStateRecord): Promise<OAuthStateRecord> {
    const result = await this.sql.query<OAuthStateRow>(
      `update oauth_states
      set provider = $2,
          state_hash = $3,
          code_verifier = $4,
          return_url = $5,
          status = $6,
          created_at = $7,
          updated_at = $8,
          expires_at = $9,
          used_at = $10
      where id = $1
      returning *`,
      oauthStateParams(record)
    );
    return mapOAuthStateRow(requireRow(result.rows));
  }

  async getByHash(stateHash: string): Promise<OAuthStateRecord | undefined> {
    const result = await this.sql.query<OAuthStateRow>(
      "select * from oauth_states where state_hash = $1 limit 1",
      [stateHash]
    );
    return result.rows[0] ? mapOAuthStateRow(result.rows[0]) : undefined;
  }
}

export class PostgresOAuthIdentityRepository implements OAuthIdentityRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async upsert(record: OAuthIdentityRecord): Promise<OAuthIdentityRecord> {
    const result = await this.sql.query<OAuthIdentityRow>(
      `insert into oauth_identities (
        id, provider, subject, user_id, email, name,
        created_at, updated_at, last_login_at, metadata
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (provider, subject) do update
      set user_id = excluded.user_id,
          email = excluded.email,
          name = excluded.name,
          updated_at = excluded.updated_at,
          last_login_at = excluded.last_login_at,
          metadata = excluded.metadata
      returning *`,
      oauthIdentityParams(record)
    );
    return mapOAuthIdentityRow(requireRow(result.rows));
  }

  async getByProviderSubject(provider: string, subject: string): Promise<OAuthIdentityRecord | undefined> {
    const result = await this.sql.query<OAuthIdentityRow>(
      "select * from oauth_identities where provider = $1 and subject = $2 limit 1",
      [provider, subject]
    );
    return result.rows[0] ? mapOAuthIdentityRow(result.rows[0]) : undefined;
  }

  async listByUser(userId: string, limit: number): Promise<OAuthIdentityRecord[]> {
    const result = await this.sql.query<OAuthIdentityRow>(
      `select * from oauth_identities
      where user_id = $1
      order by updated_at desc
      limit $2`,
      [userId, limit]
    );
    return result.rows.map(mapOAuthIdentityRow);
  }
}

export class PostgresTeamRepository implements TeamRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async createTeam(record: TeamRecord): Promise<TeamRecord> {
    const result = await this.sql.query<TeamRow>(
      `insert into teams (id, name, created_at, updated_at)
      values ($1, $2, $3, $4)
      on conflict (id) do update
      set name = excluded.name,
          updated_at = excluded.updated_at
      returning *`,
      [record.id, record.name, record.createdAt, record.updatedAt]
    );
    return mapTeamRow(requireRow(result.rows));
  }

  async getTeam(id: string): Promise<TeamRecord | undefined> {
    const result = await this.sql.query<TeamRow>("select * from teams where id = $1 limit 1", [id]);
    return result.rows[0] ? mapTeamRow(result.rows[0]) : undefined;
  }

  async listTeamsForUser(userId: string): Promise<TeamRecord[]> {
    const result = await this.sql.query<TeamRow>(
      `select teams.*
      from teams
      inner join team_members on team_members.team_id = teams.id
      where team_members.user_id = $1 and team_members.revoked_at is null
      order by teams.updated_at desc`,
      [userId]
    );
    return result.rows.map(mapTeamRow);
  }

  async upsertMember(record: TeamMemberRecord): Promise<TeamMemberRecord> {
    const result = await this.sql.query<TeamMemberRow>(
      `insert into team_members (
        id, team_id, user_id, role, created_at, updated_at, revoked_at
      ) values ($1, $2, $3, $4, $5, $6, $7)
      on conflict (team_id, user_id) do update
      set role = excluded.role,
          updated_at = excluded.updated_at,
          revoked_at = excluded.revoked_at
      returning *`,
      [
        record.id,
        record.teamId,
        record.userId,
        record.role,
        record.createdAt,
        record.updatedAt,
        record.revokedAt ?? null
      ]
    );
    return mapTeamMemberRow(requireRow(result.rows));
  }

  async getMember(teamId: string, userId: string): Promise<TeamMemberRecord | undefined> {
    const result = await this.sql.query<TeamMemberRow>(
      "select * from team_members where team_id = $1 and user_id = $2 limit 1",
      [teamId, userId]
    );
    return result.rows[0] ? mapTeamMemberRow(result.rows[0]) : undefined;
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    const result = await this.sql.query<TeamMemberRow>(
      `select * from team_members
      where team_id = $1 and revoked_at is null
      order by updated_at desc`,
      [teamId]
    );
    return result.rows.map(mapTeamMemberRow);
  }
}

export class PostgresTeamInvitationRepository implements TeamInvitationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async create(record: TeamInvitationRecord): Promise<TeamInvitationRecord> {
    const result = await this.sql.query<TeamInvitationRow>(
      `insert into team_invitations (
        id, team_id, email, role, token_hash, token_prefix, status,
        invited_by, invited_user_id, accepted_by_user_id,
        created_at, updated_at, expires_at, accepted_at, revoked_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      returning *`,
      teamInvitationParams(record)
    );
    return mapTeamInvitationRow(requireRow(result.rows));
  }

  async update(record: TeamInvitationRecord): Promise<TeamInvitationRecord> {
    const result = await this.sql.query<TeamInvitationRow>(
      `update team_invitations
      set team_id = $2,
          email = $3,
          role = $4,
          token_hash = $5,
          token_prefix = $6,
          status = $7,
          invited_by = $8,
          invited_user_id = $9,
          accepted_by_user_id = $10,
          created_at = $11,
          updated_at = $12,
          expires_at = $13,
          accepted_at = $14,
          revoked_at = $15
      where id = $1
      returning *`,
      teamInvitationParams(record)
    );
    return mapTeamInvitationRow(requireRow(result.rows));
  }

  async getById(id: string): Promise<TeamInvitationRecord | undefined> {
    const result = await this.sql.query<TeamInvitationRow>("select * from team_invitations where id = $1 limit 1", [id]);
    return result.rows[0] ? mapTeamInvitationRow(result.rows[0]) : undefined;
  }

  async getByTokenHash(tokenHash: string): Promise<TeamInvitationRecord | undefined> {
    const result = await this.sql.query<TeamInvitationRow>(
      "select * from team_invitations where token_hash = $1 limit 1",
      [tokenHash]
    );
    return result.rows[0] ? mapTeamInvitationRow(result.rows[0]) : undefined;
  }

  async listByTeam(teamId: string, limit: number): Promise<TeamInvitationRecord[]> {
    const result = await this.sql.query<TeamInvitationRow>(
      `select * from team_invitations
      where team_id = $1
      order by updated_at desc
      limit $2`,
      [teamId, limit]
    );
    return result.rows.map(mapTeamInvitationRow);
  }
}

function mapProjectRow(row: ProjectRow): StudioProjectRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    title: row.title,
    source: row.source,
    vnProject: parseJson(row.vn_project) as VNProject,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    publishedAt: row.published_at ? toIso(row.published_at) : undefined,
    currentReleaseId: row.current_release_id ?? undefined,
    publishedProjectUrl: row.published_project_url ?? undefined,
    publishedPlayableUrl: row.published_playable_url ?? undefined
  };
}

function mapJobRow(row: JobRow): GenerationJobRecord {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    projectId: row.project_id ?? undefined,
    ownerId: row.owner_id,
    input: parseJson(row.input) as Record<string, unknown>,
    output: row.output ? parseJson(row.output) as Record<string, unknown> : undefined,
    error: row.error ?? undefined,
    attempts: row.attempts,
    maxAttempts: row.max_attempts ?? 3,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    startedAt: row.started_at ? toIso(row.started_at) : undefined,
    finishedAt: row.finished_at ? toIso(row.finished_at) : undefined,
    nextRunAt: row.next_run_at ? toIso(row.next_run_at) : undefined
  };
}

function mapAssetRow(row: AssetRow): AssetRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    assetId: row.asset_id,
    provider: row.provider,
    contentType: row.content_type,
    byteLength: row.byte_length,
    storageKey: row.storage_key,
    publicUrl: row.public_url ?? undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapPublishedProjectReleaseRow(row: PublishedProjectReleaseRow): PublishedProjectReleaseRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    version: row.version,
    projectUrl: row.project_url,
    playableUrl: row.playable_url ?? undefined,
    projectJsonAssetId: row.project_json_asset_id,
    projectJsonAssetStorageKey: row.project_json_asset_storage_key,
    createdAt: toIso(row.created_at),
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapReleaseApprovalRow(row: ReleaseApprovalRow): ReleaseApprovalRecord {
  return {
    id: row.id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    status: row.status,
    requestedBy: row.requested_by,
    requestedAt: toIso(row.requested_at),
    updatedAt: toIso(row.updated_at),
    notes: row.notes ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ? toIso(row.reviewed_at) : undefined,
    reviewNotes: row.review_notes ?? undefined,
    publishedReleaseId: row.published_release_id ?? undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapReleaseApprovalCommentRow(row: ReleaseApprovalCommentRow): ReleaseApprovalCommentRecord {
  return {
    id: row.id,
    approvalId: row.approval_id,
    projectId: row.project_id,
    ownerId: row.owner_id,
    author: row.author,
    body: row.body,
    createdAt: toIso(row.created_at),
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapNotificationDeliveryRow(row: NotificationDeliveryRow): NotificationDeliveryRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    approvalId: row.approval_id,
    event: row.event,
    provider: row.provider,
    status: row.status,
    payload: parseJson(row.payload) as NotificationDeliveryRecord["payload"],
    attempts: row.attempts,
    maxAttempts: row.max_attempts,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    nextRunAt: row.next_run_at ? toIso(row.next_run_at) : undefined,
    lastAttemptAt: row.last_attempt_at ? toIso(row.last_attempt_at) : undefined,
    deliveredAt: row.delivered_at ? toIso(row.delivered_at) : undefined,
    error: row.error ?? undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapDeploymentInvalidationRow(row: DeploymentInvalidationRow): DeploymentInvalidationRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    projectId: row.project_id,
    releaseId: row.release_id ?? undefined,
    provider: row.provider,
    status: row.status,
    reason: row.reason,
    urls: parseJson(row.urls) as string[],
    createdAt: toIso(row.created_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : undefined,
    error: row.error ?? undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapUsageRow(row: UsageRow): UsageEventRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    metric: row.metric,
    quantity: Number(row.quantity),
    projectId: row.project_id ?? undefined,
    jobId: row.job_id ?? undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapBillingPlanRow(row: BillingPlanRow): BillingPlanRecord {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priceCents: Number(row.price_cents),
    currency: row.currency,
    interval: row.interval,
    dailyJobLimit: row.daily_job_limit,
    dailyTextJobLimit: row.daily_text_job_limit,
    dailyImageJobLimit: row.daily_image_job_limit,
    active: row.active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapBillingSubscriptionRow(row: BillingSubscriptionRow): BillingSubscriptionRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: toIso(row.current_period_start),
    currentPeriodEnd: toIso(row.current_period_end),
    cancelAtPeriodEnd: row.cancel_at_period_end,
    externalCustomerId: row.external_customer_id ?? undefined,
    externalSubscriptionId: row.external_subscription_id ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    cancelledAt: row.cancelled_at ? toIso(row.cancelled_at) : undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapBillingCheckoutSessionRow(row: BillingCheckoutSessionRow): BillingCheckoutSessionRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    planId: row.plan_id,
    status: row.status,
    checkoutUrl: row.checkout_url,
    successUrl: row.success_url ?? undefined,
    cancelUrl: row.cancel_url ?? undefined,
    externalSessionId: row.external_session_id ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : undefined,
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined,
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapBillingEventRow(row: BillingEventRow): BillingEventRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    provider: row.provider,
    eventType: row.event_type,
    externalEventId: row.external_event_id ?? undefined,
    subscriptionId: row.subscription_id ?? undefined,
    checkoutSessionId: row.checkout_session_id ?? undefined,
    externalCustomerId: row.external_customer_id ?? undefined,
    externalSubscriptionId: row.external_subscription_id ?? undefined,
    externalInvoiceId: row.external_invoice_id ?? undefined,
    externalChargeId: row.external_charge_id ?? undefined,
    amountDueCents: row.amount_due_cents == null ? undefined : Number(row.amount_due_cents),
    amountPaidCents: row.amount_paid_cents == null ? undefined : Number(row.amount_paid_cents),
    amountRefundedCents: row.amount_refunded_cents == null ? undefined : Number(row.amount_refunded_cents),
    amountDisputedCents: row.amount_disputed_cents == null ? undefined : Number(row.amount_disputed_cents),
    currency: row.currency ?? undefined,
    status: row.status ?? undefined,
    hostedInvoiceUrl: row.hosted_invoice_url ?? undefined,
    invoicePdfUrl: row.invoice_pdf_url ?? undefined,
    occurredAt: toIso(row.occurred_at),
    createdAt: toIso(row.created_at),
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined
  };
}

function mapAuditRow(row: AuditRow): AuditEventRecord {
  return {
    id: row.id,
    ownerId: row.owner_id ?? undefined,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    outcome: row.outcome,
    details: row.details ? parseJson(row.details) as Record<string, unknown> : undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapContentSafetyRow(row: ContentSafetyRow): ContentSafetyReviewRecord {
  return {
    id: row.id,
    ownerId: row.owner_id,
    source: row.source,
    decision: row.decision,
    targetType: row.target_type,
    targetId: row.target_id ?? undefined,
    inputHash: row.input_hash,
    inputLength: row.input_length,
    matchedRules: parseJson(row.matched_rules) as string[],
    metadata: row.metadata ? parseJson(row.metadata) as Record<string, unknown> : undefined,
    createdAt: toIso(row.created_at)
  };
}

function mapAccessTokenRow(row: AccessTokenRow): AccessTokenRecord {
  return {
    id: row.id,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    role: row.role,
    ownerId: row.owner_id ?? undefined,
    userId: row.user_id ?? undefined,
    label: row.label,
    createdAt: toIso(row.created_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : undefined,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined
  };
}

function mapUserAccountRow(row: UserAccountRow): UserAccountRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    name: row.name ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    emailVerifiedAt: row.email_verified_at ? toIso(row.email_verified_at) : undefined,
    lastLoginAt: row.last_login_at ? toIso(row.last_login_at) : undefined,
    lastFailedLoginAt: row.last_failed_login_at ? toIso(row.last_failed_login_at) : undefined,
    failedLoginCount: row.failed_login_count ?? undefined,
    lockedUntil: row.locked_until ? toIso(row.locked_until) : undefined,
    passwordUpdatedAt: row.password_updated_at ? toIso(row.password_updated_at) : undefined,
    mfaTotpSecretEncrypted: row.mfa_totp_secret_encrypted ?? undefined,
    mfaTotpEnabledAt: row.mfa_totp_enabled_at ? toIso(row.mfa_totp_enabled_at) : undefined,
    mfaTotpLastUsedCounter: row.mfa_totp_last_used_counter === null || row.mfa_totp_last_used_counter === undefined
      ? undefined
      : Number(row.mfa_totp_last_used_counter),
    mfaRecoveryCodeHashes: row.mfa_recovery_code_hashes
      ? parseJson(row.mfa_recovery_code_hashes) as string[]
      : undefined,
    mfaRecoveryCodesUpdatedAt: row.mfa_recovery_codes_updated_at
      ? toIso(row.mfa_recovery_codes_updated_at)
      : undefined,
    mfaTrustedDevices: row.mfa_trusted_devices
      ? parseJson(row.mfa_trusted_devices) as UserAccountRecord["mfaTrustedDevices"]
      : undefined,
    disabledAt: row.disabled_at ? toIso(row.disabled_at) : undefined
  };
}

function mapUserAccountActionTokenRow(row: UserAccountActionTokenRow): UserAccountActionTokenRecord {
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    purpose: row.purpose,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined,
    usedAt: row.used_at ? toIso(row.used_at) : undefined,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined
  };
}

function mapUserSessionRow(row: UserSessionRow): UserSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastUsedAt: row.last_used_at ? toIso(row.last_used_at) : undefined,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined,
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined
  };
}

function mapOAuthStateRow(row: OAuthStateRow): OAuthStateRecord {
  return {
    id: row.id,
    provider: row.provider,
    stateHash: row.state_hash,
    codeVerifier: row.code_verifier ?? undefined,
    returnUrl: row.return_url ?? undefined,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: toIso(row.expires_at),
    usedAt: row.used_at ? toIso(row.used_at) : undefined
  };
}

function mapOAuthIdentityRow(row: OAuthIdentityRow): OAuthIdentityRecord {
  return {
    id: row.id,
    provider: row.provider,
    subject: row.subject,
    userId: row.user_id,
    email: row.email,
    name: row.name ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    lastLoginAt: row.last_login_at ? toIso(row.last_login_at) : undefined,
    metadata: row.metadata
      ? parseJson(row.metadata) as Record<string, unknown>
      : undefined
  };
}

function mapTeamRow(row: TeamRow): TeamRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapTeamMemberRow(row: TeamMemberRow): TeamMemberRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    userId: row.user_id,
    role: row.role,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined
  };
}

function mapTeamInvitationRow(row: TeamInvitationRow): TeamInvitationRecord {
  return {
    id: row.id,
    teamId: row.team_id,
    email: row.email,
    role: row.role,
    tokenHash: row.token_hash,
    tokenPrefix: row.token_prefix,
    status: row.status,
    invitedBy: row.invited_by,
    invitedUserId: row.invited_user_id ?? undefined,
    acceptedByUserId: row.accepted_by_user_id ?? undefined,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    expiresAt: row.expires_at ? toIso(row.expires_at) : undefined,
    acceptedAt: row.accepted_at ? toIso(row.accepted_at) : undefined,
    revokedAt: row.revoked_at ? toIso(row.revoked_at) : undefined
  };
}

function jobParams(record: GenerationJobRecord): unknown[] {
  return [
    record.id,
    record.kind,
    record.status,
    record.projectId ?? null,
    record.ownerId,
    JSON.stringify(record.input),
    record.output ? JSON.stringify(record.output) : null,
    record.error ?? null,
    record.attempts,
    record.maxAttempts,
    record.createdAt,
    record.updatedAt,
    record.startedAt ?? null,
    record.finishedAt ?? null,
    record.nextRunAt ?? null
  ];
}

function accessTokenParams(record: AccessTokenRecord): unknown[] {
  return [
    record.id,
    record.tokenHash,
    record.tokenPrefix,
    record.role,
    record.ownerId ?? null,
    record.userId ?? null,
    record.label,
    record.createdAt,
    record.lastUsedAt ?? null,
    record.revokedAt ?? null,
    record.expiresAt ?? null
  ];
}

function billingPlanParams(record: BillingPlanRecord): unknown[] {
  return [
    record.id,
    record.name,
    record.description,
    record.priceCents,
    record.currency,
    record.interval,
    record.dailyJobLimit,
    record.dailyTextJobLimit,
    record.dailyImageJobLimit,
    record.active,
    record.createdAt,
    record.updatedAt,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function billingSubscriptionParams(record: BillingSubscriptionRecord): unknown[] {
  return [
    record.id,
    record.ownerId,
    record.planId,
    record.status,
    record.currentPeriodStart,
    record.currentPeriodEnd,
    record.cancelAtPeriodEnd,
    record.externalCustomerId ?? null,
    record.externalSubscriptionId ?? null,
    record.createdAt,
    record.updatedAt,
    record.cancelledAt ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function billingCheckoutSessionParams(record: BillingCheckoutSessionRecord): unknown[] {
  return [
    record.id,
    record.ownerId,
    record.planId,
    record.status,
    record.checkoutUrl,
    record.successUrl ?? null,
    record.cancelUrl ?? null,
    record.externalSessionId ?? null,
    record.createdAt,
    record.updatedAt,
    record.completedAt ?? null,
    record.expiresAt ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function billingEventParams(record: BillingEventRecord): unknown[] {
  return [
    record.id,
    record.ownerId,
    record.provider,
    record.eventType,
    record.externalEventId ?? null,
    record.subscriptionId ?? null,
    record.checkoutSessionId ?? null,
    record.externalCustomerId ?? null,
    record.externalSubscriptionId ?? null,
    record.externalInvoiceId ?? null,
    record.externalChargeId ?? null,
    record.amountDueCents ?? null,
    record.amountPaidCents ?? null,
    record.amountRefundedCents ?? null,
    record.amountDisputedCents ?? null,
    record.currency ?? null,
    record.status ?? null,
    record.hostedInvoiceUrl ?? null,
    record.invoicePdfUrl ?? null,
    record.occurredAt,
    record.createdAt,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function userAccountParams(record: UserAccountRecord): unknown[] {
  return [
    record.id,
    record.email,
    record.passwordHash,
    record.name ?? null,
    record.createdAt,
    record.updatedAt,
    record.emailVerifiedAt ?? null,
    record.lastLoginAt ?? null,
    record.lastFailedLoginAt ?? null,
    record.failedLoginCount ?? 0,
    record.lockedUntil ?? null,
    record.passwordUpdatedAt ?? null,
    record.mfaTotpSecretEncrypted ?? null,
    record.mfaTotpEnabledAt ?? null,
    record.mfaTotpLastUsedCounter ?? null,
    record.mfaRecoveryCodeHashes ? JSON.stringify(record.mfaRecoveryCodeHashes) : null,
    record.mfaRecoveryCodesUpdatedAt ?? null,
    record.mfaTrustedDevices ? JSON.stringify(record.mfaTrustedDevices) : null,
    record.disabledAt ?? null
  ];
}

function userAccountActionTokenParams(record: UserAccountActionTokenRecord): unknown[] {
  return [
    record.id,
    record.userId,
    record.email,
    record.purpose,
    record.tokenHash,
    record.tokenPrefix,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.expiresAt ?? null,
    record.usedAt ?? null,
    record.revokedAt ?? null
  ];
}

function userSessionParams(record: UserSessionRecord): unknown[] {
  return [
    record.id,
    record.userId,
    record.tokenHash,
    record.tokenPrefix,
    record.createdAt,
    record.updatedAt,
    record.lastUsedAt ?? null,
    record.revokedAt ?? null,
    record.expiresAt ?? null
  ];
}

function oauthStateParams(record: OAuthStateRecord): unknown[] {
  return [
    record.id,
    record.provider,
    record.stateHash,
    record.codeVerifier ?? null,
    record.returnUrl ?? null,
    record.status,
    record.createdAt,
    record.updatedAt,
    record.expiresAt,
    record.usedAt ?? null
  ];
}

function oauthIdentityParams(record: OAuthIdentityRecord): unknown[] {
  return [
    record.id,
    record.provider,
    record.subject,
    record.userId,
    record.email,
    record.name ?? null,
    record.createdAt,
    record.updatedAt,
    record.lastLoginAt ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function releaseApprovalParams(record: ReleaseApprovalRecord): unknown[] {
  return [
    record.id,
    record.projectId,
    record.ownerId,
    record.status,
    record.requestedBy,
    record.requestedAt,
    record.updatedAt,
    record.notes ?? null,
    record.reviewedBy ?? null,
    record.reviewedAt ?? null,
    record.reviewNotes ?? null,
    record.publishedReleaseId ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function teamInvitationParams(record: TeamInvitationRecord): unknown[] {
  return [
    record.id,
    record.teamId,
    record.email,
    record.role,
    record.tokenHash,
    record.tokenPrefix,
    record.status,
    record.invitedBy,
    record.invitedUserId ?? null,
    record.acceptedByUserId ?? null,
    record.createdAt,
    record.updatedAt,
    record.expiresAt ?? null,
    record.acceptedAt ?? null,
    record.revokedAt ?? null
  ];
}

function releaseApprovalCommentParams(record: ReleaseApprovalCommentRecord): unknown[] {
  return [
    record.id,
    record.approvalId,
    record.projectId,
    record.ownerId,
    record.author,
    record.body,
    record.createdAt,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function notificationDeliveryParams(record: NotificationDeliveryRecord): unknown[] {
  return [
    record.id,
    record.ownerId,
    record.projectId,
    record.approvalId,
    record.event,
    record.provider,
    record.status,
    JSON.stringify(record.payload),
    record.attempts,
    record.maxAttempts,
    record.createdAt,
    record.updatedAt,
    record.nextRunAt ?? null,
    record.lastAttemptAt ?? null,
    record.deliveredAt ?? null,
    record.error ?? null,
    record.metadata ? JSON.stringify(record.metadata) : null
  ];
}

function parseJson(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
}

function requireRow<T>(rows: T[]): T {
  const row = rows[0];
  if (!row) {
    throw new Error("Postgres query returned no rows.");
  }
  return row;
}
