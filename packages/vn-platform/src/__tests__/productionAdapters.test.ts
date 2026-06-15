import { createHmac } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createProjectFromNovel } from "@agentic-galgame/vn-agent";
import { sampleNovelText } from "@agentic-galgame/vn-core";
import {
  CloudflareCachePurgeProvider,
  PostgresAccessTokenRepository,
  PostgresAssetRepository,
  PostgresAuditRepository,
  PostgresBillingEventRepository,
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
  WebhookReleaseApprovalNotifier,
  WebhookTeamInvitationNotifier,
  WebhookUserAccountNotifier,
  runPostgresMigrations,
  type AssetRecord,
  type AssetRepository,
  type ReleaseApprovalNotificationPayload,
  type SqlExecutor,
  type TeamInvitationNotificationPayload,
  type UserAccountNotificationPayload
} from "../index";

describe("Postgres repositories", () => {
  it("maps project rows and writes VNProject as jsonb", async () => {
    const project = createProjectFromNovel({
      title: "实验室里的蓝光",
      novelText: sampleNovelText
    });
    const sql = new RecordingSqlExecutor([
      {
        id: "project_1",
        owner_id: "owner_1",
        title: "实验室里的蓝光",
        source: "api",
        vn_project: project,
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        published_at: null,
        current_release_id: null,
        published_project_url: null,
        published_playable_url: null
      }
    ]);
    const repository = new PostgresProjectRepository(sql);

    const record = await repository.create({
      id: "project_1",
      ownerId: "owner_1",
      title: "实验室里的蓝光",
      source: "api",
      vnProject: project,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z"
    });

    expect(sql.calls[0]?.sql).toContain("insert into studio_projects");
    expect(sql.calls[0]?.params?.[4]).toBe(JSON.stringify(project));
    expect(record.ownerId).toBe("owner_1");
    expect(record.vnProject.title).toBe("实验室里的蓝光");
  });

  it("queries queued jobs in FIFO order", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "job_1",
        kind: "novel_to_project",
        status: "queued",
        project_id: null,
        owner_id: "owner_1",
        input: { title: "测试", novelText: "第一章 测试" },
        output: null,
        error: null,
        attempts: 0,
        max_attempts: 3,
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        started_at: null,
        finished_at: null,
        next_run_at: null
      }
    ]);
    const repository = new PostgresJobRepository(sql);

    const jobs = await repository.listQueued(5, "2026-06-07T00:00:01.000Z");

    expect(sql.calls[0]?.sql).toContain("where status = 'queued'");
    expect(sql.calls[0]?.params).toEqual(["2026-06-07T00:00:01.000Z", 5]);
    expect(jobs[0]?.id).toBe("job_1");
    expect(jobs[0]?.maxAttempts).toBe(3);
  });

  it("maps asset rows from project_assets", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "asset_1",
        project_id: "project_1",
        owner_id: "owner_1",
        asset_id: "cg_phone_screen",
        provider: "s3_compatible",
        content_type: "image/webp",
        byte_length: 12,
        storage_key: "project_1/cg_phone_screen.webp",
        public_url: "https://cdn.example.com/project_1/cg_phone_screen.webp",
        created_at: "2026-06-07T00:00:00.000Z"
      }
    ]);
    const repository = new PostgresAssetRepository(sql);

    const assets = await repository.listByProject("project_1");

    expect(sql.calls[0]?.sql).toContain("from project_assets");
    expect(assets[0]?.provider).toBe("s3_compatible");
    expect(assets[0]?.publicUrl).toBe("https://cdn.example.com/project_1/cg_phone_screen.webp");
  });

  it("maps published project releases and increments by project version", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "release_1",
        project_id: "project_1",
        owner_id: "owner_1",
        version: 2,
        project_url: "https://api.example.com/assets/project.vn.json",
        playable_url: "https://play.example.com/?projectUrl=x",
        project_json_asset_id: "asset_project_json",
        project_json_asset_storage_key: "project_1/project.vn.json",
        created_at: "2026-06-07T00:00:00.000Z",
        metadata: { title: "发布项目" }
      }
    ]);
    const repository = new PostgresPublishedProjectReleaseRepository(sql);

    const release = await repository.create({
      id: "release_1",
      projectId: "project_1",
      ownerId: "owner_1",
      version: 2,
      projectUrl: "https://api.example.com/assets/project.vn.json",
      playableUrl: "https://play.example.com/?projectUrl=x",
      projectJsonAssetId: "asset_project_json",
      projectJsonAssetStorageKey: "project_1/project.vn.json",
      createdAt: "2026-06-07T00:00:00.000Z",
      metadata: { title: "发布项目" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into published_project_releases");
    expect(sql.calls[0]?.params?.[3]).toBe(2);
    expect(release.projectId).toBe("project_1");
    expect(release.version).toBe(2);
    expect(release.metadata?.title).toBe("发布项目");
  });

  it("maps deployment invalidation records", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "deploy_invalidation_1",
        owner_id: "owner_1",
        project_id: "project_1",
        release_id: "release_1",
        provider: "cloudflare",
        status: "succeeded",
        reason: "publish",
        urls: ["https://api.example.com/v1/public/projects/project_1/project.vn.json"],
        created_at: "2026-06-07T00:00:00.000Z",
        completed_at: "2026-06-07T00:00:01.000Z",
        error: null,
        metadata: { requestId: "purge_1" }
      }
    ]);
    const repository = new PostgresDeploymentInvalidationRepository(sql);

    const record = await repository.create({
      id: "deploy_invalidation_1",
      ownerId: "owner_1",
      projectId: "project_1",
      releaseId: "release_1",
      provider: "cloudflare",
      status: "succeeded",
      reason: "publish",
      urls: ["https://api.example.com/v1/public/projects/project_1/project.vn.json"],
      createdAt: "2026-06-07T00:00:00.000Z",
      completedAt: "2026-06-07T00:00:01.000Z",
      metadata: { requestId: "purge_1" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into deployment_invalidations");
    expect(sql.calls[0]?.params?.[7]).toBe(JSON.stringify(["https://api.example.com/v1/public/projects/project_1/project.vn.json"]));
    expect(record.provider).toBe("cloudflare");
    expect(record.status).toBe("succeeded");
    expect(record.metadata?.requestId).toBe("purge_1");
  });

  it("maps release approval records", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "release_approval_1",
        project_id: "project_1",
        owner_id: "owner_1",
        status: "pending",
        requested_by: "user:editor",
        requested_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        notes: "Ready",
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null,
        published_release_id: null,
        metadata: { source: "studio" }
      }
    ]);
    const repository = new PostgresReleaseApprovalRepository(sql);

    const approval = await repository.create({
      id: "release_approval_1",
      projectId: "project_1",
      ownerId: "owner_1",
      status: "pending",
      requestedBy: "user:editor",
      requestedAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      notes: "Ready",
      metadata: { source: "studio" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into release_approvals");
    expect(sql.calls[0]?.params?.[3]).toBe("pending");
    expect(approval.projectId).toBe("project_1");
    expect(approval.status).toBe("pending");
    expect(approval.metadata?.source).toBe("studio");
  });

  it("maps release approval comment records", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "release_approval_comment_1",
        approval_id: "release_approval_1",
        project_id: "project_1",
        owner_id: "owner_1",
        author: "user:editor",
        body: "请调整第一幕台词。",
        created_at: "2026-06-07T00:00:00.000Z",
        metadata: { source: "studio" }
      }
    ]);
    const repository = new PostgresReleaseApprovalCommentRepository(sql);

    const comment = await repository.create({
      id: "release_approval_comment_1",
      approvalId: "release_approval_1",
      projectId: "project_1",
      ownerId: "owner_1",
      author: "user:editor",
      body: "请调整第一幕台词。",
      createdAt: "2026-06-07T00:00:00.000Z",
      metadata: { source: "studio" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into release_approval_comments");
    expect(sql.calls[0]?.params?.[1]).toBe("release_approval_1");
    expect(comment.approvalId).toBe("release_approval_1");
    expect(comment.body).toBe("请调整第一幕台词。");
    expect(comment.metadata?.source).toBe("studio");
  });

  it("sends signed release approval webhook notifications", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const notifier = new WebhookReleaseApprovalNotifier({
      url: "https://hooks.example.com/release-approvals",
      secret: "webhook-secret",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status: 204 });
      }
    });
    const payload: ReleaseApprovalNotificationPayload = {
      event: "release_approval_requested",
      approvalId: "release_approval_1",
      projectId: "project_1",
      ownerId: "owner_1",
      approvalStatus: "pending",
      actor: "user:editor",
      createdAt: "2026-06-07T00:00:00.000Z"
    };

    await notifier.notify(payload);

    const call = calls[0]!;
    const headers = call.init.headers as Record<string, string>;
    const body = call.init.body as string;
    const timestamp = headers["x-agentic-galgame-timestamp"]!;
    const expectedSignature = createHmac("sha256", "webhook-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(call.url).toBe("https://hooks.example.com/release-approvals");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(body)).toEqual(payload);
    expect(headers["x-agentic-galgame-event"]).toBe("release_approval_requested");
    expect(headers["x-agentic-galgame-signature"]).toBe(`sha256=${expectedSignature}`);
  });

  it("maps notification delivery records", async () => {
    const payload: ReleaseApprovalNotificationPayload = {
      event: "release_approval_requested",
      approvalId: "release_approval_1",
      projectId: "project_1",
      ownerId: "owner_1",
      approvalStatus: "pending",
      createdAt: "2026-06-07T00:00:00.000Z"
    };
    const sql = new RecordingSqlExecutor([
      {
        id: "notification_delivery_1",
        owner_id: "owner_1",
        project_id: "project_1",
        approval_id: "release_approval_1",
        event: "release_approval_requested",
        provider: "webhook",
        status: "pending",
        payload,
        attempts: 0,
        max_attempts: 3,
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        next_run_at: "2026-06-07T00:00:00.000Z",
        last_attempt_at: null,
        delivered_at: null,
        error: null,
        metadata: { source: "approval" }
      }
    ]);
    const repository = new PostgresNotificationDeliveryRepository(sql);

    const delivery = await repository.create({
      id: "notification_delivery_1",
      ownerId: "owner_1",
      projectId: "project_1",
      approvalId: "release_approval_1",
      event: "release_approval_requested",
      provider: "webhook",
      status: "pending",
      payload,
      attempts: 0,
      maxAttempts: 3,
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z",
      nextRunAt: "2026-06-07T00:00:00.000Z",
      metadata: { source: "approval" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into notification_deliveries");
    expect(sql.calls[0]?.params?.[7]).toBe(JSON.stringify(payload));
    expect(delivery.payload.event).toBe("release_approval_requested");
    expect(delivery.status).toBe("pending");
    expect(delivery.metadata?.source).toBe("approval");
  });

  it("throws when release approval webhook returns an error response", async () => {
    const notifier = new WebhookReleaseApprovalNotifier({
      url: "https://hooks.example.com/release-approvals",
      fetchImpl: async () => new Response(null, { status: 500 })
    });

    await expect(notifier.notify({
      event: "release_approval_rejected",
      approvalId: "release_approval_1",
      projectId: "project_1",
      ownerId: "owner_1",
      approvalStatus: "rejected",
      createdAt: "2026-06-07T00:00:00.000Z"
    })).rejects.toThrow("Release approval webhook failed with HTTP 500");
  });

  it("sends signed team invitation webhook notifications with an accept URL", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const notifier = new WebhookTeamInvitationNotifier({
      url: "https://hooks.example.com/team-invitations",
      secret: "team-webhook-secret",
      acceptBaseUrl: "https://studio.example.com/invitations/accept",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status: 204 });
      }
    });
    const payload: TeamInvitationNotificationPayload = {
      event: "team_invitation_created",
      invitationId: "invite_1",
      teamId: "team_alpha",
      email: "editor@example.com",
      role: "editor",
      invitedBy: "user:user_owner",
      invitationToken: "vni_plain_token",
      createdAt: "2026-06-07T00:00:00.000Z",
      expiresAt: "2026-06-14T00:00:00.000Z"
    };

    await notifier.notify(payload);

    const call = calls[0]!;
    const headers = call.init.headers as Record<string, string>;
    const body = call.init.body as string;
    const parsed = JSON.parse(body) as TeamInvitationNotificationPayload;
    const timestamp = headers["x-agentic-galgame-timestamp"]!;
    const expectedSignature = createHmac("sha256", "team-webhook-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(call.url).toBe("https://hooks.example.com/team-invitations");
    expect(call.init.method).toBe("POST");
    expect(parsed).toEqual({
      ...payload,
      invitationAcceptUrl: "https://studio.example.com/invitations/accept?invitationToken=vni_plain_token"
    });
    expect(headers["x-agentic-galgame-event"]).toBe("team_invitation_created");
    expect(headers["x-agentic-galgame-signature"]).toBe(`sha256=${expectedSignature}`);
  });

  it("throws when team invitation webhook returns an error response", async () => {
    const notifier = new WebhookTeamInvitationNotifier({
      url: "https://hooks.example.com/team-invitations",
      fetchImpl: async () => new Response(null, { status: 500 })
    });

    await expect(notifier.notify({
      event: "team_invitation_revoked",
      invitationId: "invite_1",
      teamId: "team_alpha",
      email: "editor@example.com",
      role: "viewer",
      invitedBy: "user:user_owner",
      createdAt: "2026-06-07T00:00:00.000Z"
    })).rejects.toThrow("Team invitation webhook failed with HTTP 500");
  });

  it("sends signed user account webhook notifications with action URLs", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const notifier = new WebhookUserAccountNotifier({
      url: "https://hooks.example.com/user-accounts",
      secret: "account-webhook-secret",
      emailVerificationBaseUrl: "https://studio.example.com/auth/verify-email",
      passwordResetBaseUrl: "https://studio.example.com/auth/reset-password",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status: 204 });
      }
    });
    const payload: UserAccountNotificationPayload = {
      event: "user_email_verification_requested",
      userId: "user_1",
      email: "editor@example.com",
      actionTokenId: "user_action_token_1",
      actionTokenPurpose: "email_verification",
      actionToken: "vne_plain_token",
      createdAt: "2026-06-07T00:00:00.000Z",
      expiresAt: "2026-06-08T00:00:00.000Z"
    };

    await notifier.notify(payload);

    const call = calls[0]!;
    const headers = call.init.headers as Record<string, string>;
    const body = call.init.body as string;
    const parsed = JSON.parse(body) as UserAccountNotificationPayload;
    const timestamp = headers["x-agentic-galgame-timestamp"]!;
    const expectedSignature = createHmac("sha256", "account-webhook-secret")
      .update(`${timestamp}.${body}`)
      .digest("hex");

    expect(call.url).toBe("https://hooks.example.com/user-accounts");
    expect(parsed.actionUrl).toBe("https://studio.example.com/auth/verify-email?verificationToken=vne_plain_token");
    expect(headers["x-agentic-galgame-event"]).toBe("user_email_verification_requested");
    expect(headers["x-agentic-galgame-signature"]).toBe(`sha256=${expectedSignature}`);
  });

  it("throws when user account webhook returns an error response", async () => {
    const notifier = new WebhookUserAccountNotifier({
      url: "https://hooks.example.com/user-accounts",
      fetchImpl: async () => new Response(null, { status: 500 })
    });

    await expect(notifier.notify({
      event: "user_password_reset_requested",
      userId: "user_1",
      email: "editor@example.com",
      actionTokenPurpose: "password_reset",
      actionToken: "vnr_plain_token",
      createdAt: "2026-06-07T00:00:00.000Z"
    })).rejects.toThrow("User account webhook failed with HTTP 500");
  });

  it("records and sums usage events", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "usage_1",
        owner_id: "owner_1",
        metric: "estimated_cost_cents",
        quantity: "8",
        project_id: "project_1",
        job_id: "job_1",
        metadata: { kind: "asset_generation" },
        created_at: "2026-06-07T00:00:00.000Z"
      }
    ]);
    const repository = new PostgresUsageRepository(sql);

    const event = await repository.create({
      id: "usage_1",
      ownerId: "owner_1",
      metric: "estimated_cost_cents",
      quantity: 8,
      projectId: "project_1",
      jobId: "job_1",
      metadata: { kind: "asset_generation" },
      createdAt: "2026-06-07T00:00:00.000Z"
    });

    expect(sql.calls[0]?.sql).toContain("insert into usage_events");
    expect(sql.calls[0]?.params?.[6]).toBe(JSON.stringify({ kind: "asset_generation" }));
    expect(event.quantity).toBe(8);
  });

  it("maps billing provider events", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "billing_event_1",
        owner_id: "owner_1",
        provider: "stripe",
        event_type: "refund_created",
        external_event_id: "evt_refund_created",
        subscription_id: "subscription_1",
        checkout_session_id: null,
        external_customer_id: "cus_test_123",
        external_subscription_id: "sub_test_123",
        external_invoice_id: null,
        external_charge_id: "ch_test_123",
        amount_due_cents: null,
        amount_paid_cents: null,
        amount_refunded_cents: "900",
        amount_disputed_cents: null,
        currency: "usd",
        status: "succeeded",
        hosted_invoice_url: null,
        invoice_pdf_url: null,
        occurred_at: "2026-06-07T00:00:00.000Z",
        created_at: "2026-06-07T00:00:01.000Z",
        metadata: { chargeId: "ch_test_123" }
      }
    ]);
    const repository = new PostgresBillingEventRepository(sql);

    const event = await repository.create({
      id: "billing_event_1",
      ownerId: "owner_1",
      provider: "stripe",
      eventType: "refund_created",
      externalEventId: "evt_refund_created",
      subscriptionId: "subscription_1",
      externalCustomerId: "cus_test_123",
      externalSubscriptionId: "sub_test_123",
      externalChargeId: "ch_test_123",
      amountRefundedCents: 900,
      currency: "usd",
      status: "succeeded",
      occurredAt: "2026-06-07T00:00:00.000Z",
      createdAt: "2026-06-07T00:00:01.000Z",
      metadata: { chargeId: "ch_test_123" }
    });

    expect(sql.calls[0]?.sql).toContain("insert into billing_events");
    expect(sql.calls[0]?.params?.[10]).toBe("ch_test_123");
    expect(sql.calls[0]?.params?.[13]).toBe(900);
    expect(sql.calls[0]?.params?.[21]).toBe(JSON.stringify({ chargeId: "ch_test_123" }));
    expect(event.eventType).toBe("refund_created");
    expect(event.externalChargeId).toBe("ch_test_123");
    expect(event.amountRefundedCents).toBe(900);
    expect(event.metadata?.chargeId).toBe("ch_test_123");
  });

  it("looks up billing subscriptions by external customer id", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "subscription_1",
        owner_id: "owner_1",
        plan_id: "pro",
        status: "active",
        current_period_start: "2026-06-07T00:00:00.000Z",
        current_period_end: "2026-07-07T00:00:00.000Z",
        cancel_at_period_end: false,
        external_customer_id: "cus_test_123",
        external_subscription_id: "sub_test_123",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:01.000Z",
        cancelled_at: null,
        metadata: { provider: "stripe" }
      }
    ]);
    const repository = new PostgresBillingSubscriptionRepository(sql);

    const subscription = await repository.getByExternalCustomerId("cus_test_123");

    expect(sql.calls[0]?.sql).toContain("external_customer_id = $1");
    expect(sql.calls[0]?.params).toEqual(["cus_test_123"]);
    expect(subscription?.ownerId).toBe("owner_1");
    expect(subscription?.externalCustomerId).toBe("cus_test_123");
  });

  it("lists audit events by owner", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "audit_1",
        owner_id: "owner_1",
        action: "job_succeeded",
        target_type: "job",
        target_id: "job_1",
        outcome: "succeeded",
        details: { kind: "asset_generation" },
        created_at: "2026-06-07T00:00:00.000Z"
      }
    ]);
    const repository = new PostgresAuditRepository(sql);

    const events = await repository.listByOwner("owner_1", 10);

    expect(sql.calls[0]?.sql).toContain("from audit_events");
    expect(sql.calls[0]?.params).toEqual(["owner_1", 10]);
    expect(events[0]?.action).toBe("job_succeeded");
    expect(events[0]?.details?.kind).toBe("asset_generation");
  });

  it("records content safety reviews without storing raw text", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "safety_1",
        owner_id: "owner_1",
        source: "asset_prompt",
        decision: "blocked",
        target_type: "job",
        target_id: "job_1",
        input_hash: "a".repeat(64),
        input_length: 24,
        matched_rules: ["blocked:BLOCKED_CONTENT"],
        metadata: { kind: "asset_generation" },
        created_at: "2026-06-07T00:00:00.000Z"
      }
    ]);
    const repository = new PostgresContentSafetyRepository(sql);

    const review = await repository.create({
      id: "safety_1",
      ownerId: "owner_1",
      source: "asset_prompt",
      decision: "blocked",
      targetType: "job",
      targetId: "job_1",
      inputHash: "a".repeat(64),
      inputLength: 24,
      matchedRules: ["blocked:BLOCKED_CONTENT"],
      metadata: { kind: "asset_generation" },
      createdAt: "2026-06-07T00:00:00.000Z"
    });

    expect(sql.calls[0]?.sql).toContain("insert into content_safety_reviews");
    expect(sql.calls[0]?.params).not.toContain("BLOCKED_CONTENT raw text");
    expect(sql.calls[0]?.params?.[8]).toBe(JSON.stringify(["blocked:BLOCKED_CONTENT"]));
    expect(review.decision).toBe("blocked");
    expect(review.inputHash).toBe("a".repeat(64));
  });

  it("maps access tokens and queries by hash", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "token_1",
        token_hash: "b".repeat(64),
        token_prefix: "vn_prefix_1",
        role: "owner",
        owner_id: "owner_1",
        user_id: null,
        label: "Studio token",
        created_at: "2026-06-07T00:00:00.000Z",
        last_used_at: null,
        revoked_at: null,
        expires_at: null
      }
    ]);
    const repository = new PostgresAccessTokenRepository(sql);

    const record = await repository.getByHash("b".repeat(64));

    expect(sql.calls[0]?.sql).toContain("where token_hash = $1");
    expect(sql.calls[0]?.params).toEqual(["b".repeat(64)]);
    expect(record?.role).toBe("owner");
    expect(record?.ownerId).toBe("owner_1");
    expect(record?.tokenHash).toBe("b".repeat(64));
  });

  it("maps user accounts and queries by email", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "user_1",
        email: "editor@example.com",
        password_hash: "scrypt$salt$hash",
        name: "Editor",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
	        email_verified_at: "2026-06-07T00:00:01.000Z",
	        last_login_at: null,
	        password_updated_at: null,
	        mfa_recovery_code_hashes: ["hash_1", "hash_2"],
	        mfa_recovery_codes_updated_at: "2026-06-07T00:00:02.000Z",
	        mfa_trusted_devices: [{
	          id: "mfa_device_1",
	          tokenHash: "trusted_hash",
	          tokenPrefix: "vnd_prefix",
	          createdAt: "2026-06-07T00:00:03.000Z",
	          expiresAt: "2026-07-07T00:00:03.000Z"
	        }],
	        disabled_at: null
	      }
    ]);
    const repository = new PostgresUserAccountRepository(sql);

    const record = await repository.getByEmail("editor@example.com");

    expect(sql.calls[0]?.sql).toContain("where email = $1");
    expect(sql.calls[0]?.params).toEqual(["editor@example.com"]);
    expect(record?.email).toBe("editor@example.com");
    expect(record?.passwordHash).toBe("scrypt$salt$hash");
	    expect(record?.name).toBe("Editor");
	    expect(record?.emailVerifiedAt).toBe("2026-06-07T00:00:01.000Z");
	    expect(record?.mfaRecoveryCodeHashes).toEqual(["hash_1", "hash_2"]);
	    expect(record?.mfaRecoveryCodesUpdatedAt).toBe("2026-06-07T00:00:02.000Z");
	    expect(record?.mfaTrustedDevices?.[0]?.tokenHash).toBe("trusted_hash");
	  });

  it("maps user account action tokens and queries by token hash", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "user_action_token_1",
        user_id: "user_1",
        email: "editor@example.com",
        purpose: "email_verification",
        token_hash: "d".repeat(64),
        token_prefix: "vne_prefix",
        status: "pending",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        expires_at: "2026-06-08T00:00:00.000Z",
        used_at: null,
        revoked_at: null
      }
    ]);
    const repository = new PostgresUserAccountActionTokenRepository(sql);

    const record = await repository.getByHash("d".repeat(64));

    expect(sql.calls[0]?.sql).toContain("where token_hash = $1");
    expect(sql.calls[0]?.params).toEqual(["d".repeat(64)]);
    expect(record?.userId).toBe("user_1");
    expect(record?.purpose).toBe("email_verification");
    expect(record?.tokenHash).toBe("d".repeat(64));
    expect(record?.expiresAt).toBe("2026-06-08T00:00:00.000Z");
  });

  it("maps user sessions and queries by token hash", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "session_1",
        user_id: "user_1",
        token_hash: "c".repeat(64),
        token_prefix: "vns_prefix",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        last_used_at: null,
        revoked_at: null,
        expires_at: "2026-07-07T00:00:00.000Z"
      }
    ]);
    const repository = new PostgresUserSessionRepository(sql);

    const record = await repository.getByHash("c".repeat(64));

    expect(sql.calls[0]?.sql).toContain("where token_hash = $1");
    expect(sql.calls[0]?.params).toEqual(["c".repeat(64)]);
    expect(record?.userId).toBe("user_1");
    expect(record?.tokenHash).toBe("c".repeat(64));
    expect(record?.expiresAt).toBe("2026-07-07T00:00:00.000Z");
  });

  it("maps OAuth states and identities", async () => {
    const stateSql = new RecordingSqlExecutor([
      {
        id: "oauth_state_1",
        provider: "oidc",
        state_hash: "e".repeat(64),
        code_verifier: "verifier_1",
        return_url: "/studio",
        status: "pending",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        expires_at: "2026-06-07T00:10:00.000Z",
        used_at: null
      }
    ]);
    const stateRepository = new PostgresOAuthStateRepository(stateSql);

    const state = await stateRepository.getByHash("e".repeat(64));

    expect(stateSql.calls[0]?.sql).toContain("where state_hash = $1");
    expect(state?.provider).toBe("oidc");
    expect(state?.codeVerifier).toBe("verifier_1");
    expect(state?.returnUrl).toBe("/studio");

    const identitySql = new RecordingSqlExecutor([
      {
        id: "oauth_identity_1",
        provider: "oidc",
        subject: "sub_123",
        user_id: "user_1",
        email: "editor@example.com",
        name: "Editor",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:01.000Z",
        last_login_at: "2026-06-07T00:00:01.000Z",
        metadata: { issuer: "https://idp.example.com" }
      }
    ]);
    const identityRepository = new PostgresOAuthIdentityRepository(identitySql);

    const identity = await identityRepository.upsert({
      id: "oauth_identity_1",
      provider: "oidc",
      subject: "sub_123",
      userId: "user_1",
      email: "editor@example.com",
      name: "Editor",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:01.000Z",
      lastLoginAt: "2026-06-07T00:00:01.000Z",
      metadata: { issuer: "https://idp.example.com" }
    });

    expect(identitySql.calls[0]?.sql).toContain("on conflict (provider, subject)");
    expect(identitySql.calls[0]?.params?.[2]).toBe("sub_123");
    expect(identitySql.calls[0]?.params?.[9]).toBe(JSON.stringify({ issuer: "https://idp.example.com" }));
    expect(identity?.userId).toBe("user_1");
    expect(identity?.metadata?.issuer).toBe("https://idp.example.com");
  });

  it("maps team memberships and checks user team access queries", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "member_1",
        team_id: "team_alpha",
        user_id: "user_editor",
        role: "editor",
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        revoked_at: null
      }
    ]);
    const repository = new PostgresTeamRepository(sql);

    const member = await repository.upsertMember({
      id: "member_1",
      teamId: "team_alpha",
      userId: "user_editor",
      role: "editor",
      createdAt: "2026-06-07T00:00:00.000Z",
      updatedAt: "2026-06-07T00:00:00.000Z"
    });

    expect(sql.calls[0]?.sql).toContain("insert into team_members");
    expect(sql.calls[0]?.sql).toContain("on conflict (team_id, user_id)");
    expect(member.teamId).toBe("team_alpha");
    expect(member.userId).toBe("user_editor");
    expect(member.role).toBe("editor");
  });

  it("maps team invitations and queries by hashed invitation token", async () => {
    const sql = new RecordingSqlExecutor([
      {
        id: "invite_1",
        team_id: "team_alpha",
        email: "editor@example.com",
        role: "editor",
        token_hash: "c".repeat(64),
        token_prefix: "vni_prefix_",
        status: "pending",
        invited_by: "user:user_owner",
        invited_user_id: "user_editor",
        accepted_by_user_id: null,
        created_at: "2026-06-07T00:00:00.000Z",
        updated_at: "2026-06-07T00:00:00.000Z",
        expires_at: "2026-06-14T00:00:00.000Z",
        accepted_at: null,
        revoked_at: null
      }
    ]);
    const repository = new PostgresTeamInvitationRepository(sql);

    const invitation = await repository.getByTokenHash("c".repeat(64));

    expect(sql.calls[0]?.sql).toContain("where token_hash = $1");
    expect(sql.calls[0]?.params).toEqual(["c".repeat(64)]);
    expect(invitation?.teamId).toBe("team_alpha");
    expect(invitation?.email).toBe("editor@example.com");
    expect(invitation?.role).toBe("editor");
    expect(invitation?.status).toBe("pending");
    expect(invitation?.tokenHash).toBe("c".repeat(64));
  });
});

describe("S3CompatibleAssetStorage", () => {
  it("uploads with SigV4 authorization and records the stored asset", async () => {
    const repository = new MemoryAssetRepository();
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const storage = new S3CompatibleAssetStorage({
      endpoint: "https://s3.example.com",
      region: "auto",
      bucket: "vn-assets",
      accessKeyId: "test-access",
      secretAccessKey: "test-secret",
      publicBaseUrl: "https://cdn.example.com",
      repository,
      now: () => new Date("2026-06-07T00:00:00.000Z"),
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(null, { status: 200 });
      }
    });

    const record = await storage.store({
      projectId: "project_1",
      ownerId: "owner_1",
      assetId: "cg_phone_screen",
      fileName: "phone.webp",
      contentType: "image/webp",
      bytes: new Uint8Array([1, 2, 3])
    });

    expect(requests[0]?.url).toBe("https://s3.example.com/vn-assets/project_1/cg_phone_screen-1780790400000-phone.webp");
    expect((requests[0]?.init.headers as Record<string, string>).authorization).toContain("AWS4-HMAC-SHA256 Credential=test-access/");
    expect((requests[0]?.init.headers as Record<string, string>)["x-amz-date"]).toBe("20260607T000000Z");
    expect(record.provider).toBe("s3_compatible");
    expect(record.publicUrl).toBe("https://cdn.example.com/project_1/cg_phone_screen-1780790400000-phone.webp");
  });
});

describe("CloudflareCachePurgeProvider", () => {
  it("purges URLs through Cloudflare without exposing the API token in metadata", async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    const provider = new CloudflareCachePurgeProvider({
      zoneId: "zone_123",
      apiToken: "secret-token",
      apiBaseUrl: "https://cloudflare.test/client/v4",
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init: init ?? {} });
        return new Response(JSON.stringify({
          success: true,
          result: { id: "purge_123" },
          errors: []
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }
    });

    const result = await provider.purge({
      ownerId: "owner_1",
      projectId: "project_1",
      reason: "publish",
      urls: ["https://api.example.com/v1/public/projects/project_1/project.vn.json"]
    });

    expect(requests[0]?.url).toBe("https://cloudflare.test/client/v4/zones/zone_123/purge_cache");
    expect((requests[0]?.init.headers as Record<string, string>).authorization).toBe("Bearer secret-token");
    expect(JSON.parse(String(requests[0]?.init.body))).toEqual({
      files: ["https://api.example.com/v1/public/projects/project_1/project.vn.json"]
    });
    expect(result.requestId).toBe("purge_123");
    expect(JSON.stringify(result.metadata)).not.toContain("secret-token");
  });
});

describe("runPostgresMigrations", () => {
  it("applies sorted unapplied SQL files and records schema migrations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vn-platform-migrations-"));
    try {
      await writeFile(join(dir, "002_second.sql"), "create table second(id text);");
      await writeFile(join(dir, "001_first.sql"), "create table first(id text);");
      const sql = new MigrationSqlExecutor([]);

      const results = await runPostgresMigrations({
        executor: sql,
        migrationsDir: dir,
        now: new Date("2026-06-08T00:00:00.000Z")
      });

      expect(results).toEqual([
        { name: "001_first.sql", status: "applied" },
        { name: "002_second.sql", status: "applied" }
      ]);
      expect(sql.calls.map((call) => call.sql.trim())).toEqual([
        expect.stringContaining("create table if not exists schema_migrations"),
        "select name from schema_migrations",
        "begin",
        "create table first(id text);",
        "insert into schema_migrations (name, applied_at) values ($1, $2)",
        "commit",
        "begin",
        "create table second(id text);",
        "insert into schema_migrations (name, applied_at) values ($1, $2)",
        "commit"
      ]);
      expect(sql.calls[4]?.params).toEqual(["001_first.sql", "2026-06-08T00:00:00.000Z"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("skips already applied migrations and rolls back failed SQL", async () => {
    const dir = await mkdtemp(join(tmpdir(), "vn-platform-migrations-"));
    try {
      await writeFile(join(dir, "001_applied.sql"), "select 1;");
      await writeFile(join(dir, "002_fails.sql"), "select broken;");
      const sql = new MigrationSqlExecutor([{ name: "001_applied.sql" }], "select broken;");

      await expect(runPostgresMigrations({
        executor: sql,
        migrationsDir: dir
      })).rejects.toThrow("migration failed");

      expect(sql.calls.some((call) => call.sql.trim() === "select 1;")).toBe(false);
      expect(sql.calls.map((call) => call.sql.trim())).toContain("rollback");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

class RecordingSqlExecutor implements SqlExecutor {
  readonly calls: Array<{ sql: string; params?: unknown[] }> = [];

  constructor(private readonly rows: Record<string, unknown>[]) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
    this.calls.push({ sql, params });
    return {
      rows: this.rows as T[],
      rowCount: this.rows.length
    };
  }
}

class MigrationSqlExecutor implements SqlExecutor {
  readonly calls: Array<{ sql: string; params?: unknown[] }> = [];

  constructor(
    private readonly appliedRows: Array<{ name: string }>,
    private readonly failOnSql?: string
  ) {}

  async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[]; rowCount?: number }> {
    this.calls.push({ sql, params });
    if (this.failOnSql && sql.includes(this.failOnSql)) {
      throw new Error("migration failed");
    }
    if (sql.includes("select name from schema_migrations")) {
      return {
        rows: this.appliedRows as T[],
        rowCount: this.appliedRows.length
      };
    }
    return {
      rows: [],
      rowCount: 0
    };
  }
}

class MemoryAssetRepository implements AssetRepository {
  readonly records: AssetRecord[] = [];

  async create(record: AssetRecord): Promise<AssetRecord> {
    this.records.push(record);
    return record;
  }

  async listByProject(projectId: string): Promise<AssetRecord[]> {
    return this.records.filter((record) => record.projectId === projectId);
  }
}
