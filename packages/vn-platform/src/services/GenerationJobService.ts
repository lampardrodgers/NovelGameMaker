import type {
  BillingEntitlementPolicy,
  BillingPlanRecord,
  BillingSubscriptionRecord,
  CostPolicy,
  CreateGenerationJobRequest,
  GeneratedImageAssetKind,
  GenerationJobRecord,
  ImageAssetGenerator,
  JobRepository,
  QuotaPolicy,
  RetryPolicy,
  UsageMetric
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { AssetService } from "./AssetService.js";
import { BillingService } from "./BillingService.js";
import { ContentSafetyBlockedError, ContentSafetyService } from "./ContentSafetyService.js";
import { ProjectService } from "./ProjectService.js";
import { UsageService } from "./UsageService.js";

export interface GenerationJobServiceOptions {
  jobs: JobRepository;
  projectService: ProjectService;
  assetService?: AssetService;
  usageService?: UsageService;
  billingService?: BillingService;
  auditService?: AuditService;
  contentSafetyService?: ContentSafetyService;
  imageGenerator?: ImageAssetGenerator;
  fetchAsset?: typeof fetch;
  aiEnabled?: boolean;
  quotaPolicy?: QuotaPolicy;
  billingEntitlementPolicy?: BillingEntitlementPolicy;
  costPolicy?: CostPolicy;
  retryPolicy?: RetryPolicy;
}

export class BillingEntitlementError extends Error {
  constructor(
    message: string,
    readonly details: {
      ownerId: string;
      subscriptionId: string;
      status: BillingSubscriptionRecord["status"];
      graceEndsAt?: string;
    }
  ) {
    super(message);
    this.name = "BillingEntitlementError";
  }
}

export class GenerationJobService {
  private readonly jobs: JobRepository;
  private readonly projectService: ProjectService;
  private readonly assetService?: AssetService;
  private readonly usageService?: UsageService;
  private readonly billingService?: BillingService;
  private readonly auditService?: AuditService;
  private readonly contentSafetyService?: ContentSafetyService;
  private readonly imageGenerator?: ImageAssetGenerator;
  private readonly fetchAsset?: typeof fetch;
  private readonly aiEnabled: boolean;
  private readonly quotaPolicy: QuotaPolicy;
  private readonly billingEntitlementPolicy: BillingEntitlementPolicy;
  private readonly costPolicy: CostPolicy;
  private readonly retryPolicy: RetryPolicy;

  constructor(options: GenerationJobServiceOptions) {
    this.jobs = options.jobs;
    this.projectService = options.projectService;
    this.assetService = options.assetService;
    this.usageService = options.usageService;
    this.billingService = options.billingService;
    this.auditService = options.auditService;
    this.contentSafetyService = options.contentSafetyService;
    this.imageGenerator = options.imageGenerator;
    this.fetchAsset = options.fetchAsset ?? globalThis.fetch;
    this.aiEnabled = options.aiEnabled ?? false;
    this.quotaPolicy = options.quotaPolicy ?? {
      dailyJobLimit: 1_000,
      dailyTextJobLimit: 500,
      dailyImageJobLimit: 100
    };
    this.billingEntitlementPolicy = options.billingEntitlementPolicy ?? {
      blockPastDue: true,
      pastDueGracePeriodMs: 3 * 24 * 60 * 60 * 1000
    };
    this.costPolicy = options.costPolicy ?? {
      textJobCostCents: 2,
      imageJobCostCents: 8
    };
    this.retryPolicy = options.retryPolicy ?? {
      maxAttempts: 3,
      retryDelayMs: 30_000
    };
  }

  async enqueue(input: CreateGenerationJobRequest): Promise<GenerationJobRecord> {
    await this.assertJobInputApproved({
      ownerId: input.ownerId,
      kind: input.kind,
      input: input.input,
      projectId: input.projectId
    });
    await this.assertBillingEntitlement(input.ownerId);
    await this.usageService?.assertCanEnqueue(
      input.ownerId,
      input.kind,
      await this.resolveQuotaPolicy(input.ownerId)
    );
    const now = new Date().toISOString();
    const job = await this.jobs.create({
      id: createRecordId("job"),
      kind: input.kind,
      status: "queued",
      projectId: input.projectId,
      ownerId: input.ownerId,
      input: input.input,
      attempts: 0,
      maxAttempts: this.retryPolicy.maxAttempts,
      createdAt: now,
      updatedAt: now
    });
    await this.recordJobEnqueued(job);
    await this.auditService?.record({
      ownerId: job.ownerId,
      action: "job_enqueued",
      targetType: "job",
      targetId: job.id,
      details: {
        kind: job.kind,
        projectId: job.projectId
      }
    });
    return job;
  }

  async getJob(id: string): Promise<GenerationJobRecord | undefined> {
    return this.jobs.getById(id);
  }

  async listJobs(ownerId: string): Promise<GenerationJobRecord[]> {
    return this.jobs.listByOwner(ownerId);
  }

  async runNext(): Promise<GenerationJobRecord | undefined> {
    const [job] = await this.jobs.listQueued(1, new Date().toISOString());
    if (!job) {
      return undefined;
    }
    return this.runJob(job);
  }

  async runJob(job: GenerationJobRecord): Promise<GenerationJobRecord> {
    if (
      job.status === "succeeded" ||
      job.status === "blocked" ||
      job.status === "waiting_for_credentials" ||
      (job.status === "failed" && job.attempts >= job.maxAttempts)
    ) {
      return job;
    }
    try {
      await this.assertBillingEntitlement(job.ownerId);
    } catch (error) {
      if (error instanceof BillingEntitlementError) {
        return this.blockJobForBillingEntitlement(job, error);
      }
      throw error;
    }

    const started = await this.jobs.update({
      ...job,
      status: "running",
      attempts: job.attempts + 1,
      nextRunAt: undefined,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.auditService?.record({
      ownerId: started.ownerId,
      action: "job_started",
      targetType: "job",
      targetId: started.id,
      details: {
        kind: started.kind,
        attempt: started.attempts
      }
    });

    try {
      await this.assertJobInputApproved(job);
      if (started.kind === "novel_to_project") {
        return await this.runNovelToProject(started);
      }
      if (started.kind === "asset_generation") {
        return await this.runAssetGeneration(started);
      }
      throw new Error(`Unsupported job kind: ${started.kind}`);
    } catch (error) {
      return this.handleRunError(started, error);
    }
  }

  private async handleRunError(job: GenerationJobRecord, error: unknown): Promise<GenerationJobRecord> {
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof BillingEntitlementError) {
      return this.blockJobForBillingEntitlement(job, error);
    }
    if (error instanceof ContentSafetyBlockedError) {
      const blocked = await this.jobs.update({
        ...job,
        status: "blocked",
        error: message,
        output: {
          reviewId: error.review.id,
          decision: error.review.decision,
          matchedRules: error.review.matchedRules
        },
        finishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      await this.recordJobFinished(blocked, "job_blocked");
      await this.auditService?.record({
        ownerId: blocked.ownerId,
        action: "job_blocked_content_safety",
        targetType: "job",
        targetId: blocked.id,
        outcome: "blocked",
        details: {
          kind: blocked.kind,
          reviewId: error.review.id,
          decision: error.review.decision
        }
      });
      return blocked;
    }
    if (job.attempts < job.maxAttempts) {
      const nextRunAt = new Date(Date.now() + retryDelayMs(job.attempts, this.retryPolicy.retryDelayMs)).toISOString();
      const retry = await this.jobs.update({
        ...job,
        status: "queued",
        error: message,
        nextRunAt,
        updatedAt: new Date().toISOString()
      });
      await this.auditService?.record({
        ownerId: retry.ownerId,
        action: "job_retry_scheduled",
        targetType: "job",
        targetId: retry.id,
        outcome: "failed",
        details: {
          kind: retry.kind,
          attempt: retry.attempts,
          maxAttempts: retry.maxAttempts,
          nextRunAt,
          error: message
        }
      });
      return retry;
    }

    const failed = await this.jobs.update({
      ...job,
      status: "failed",
      error: message,
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.recordJobFinished(failed, "job_failed");
    await this.auditService?.record({
      ownerId: failed.ownerId,
      action: "job_failed",
      targetType: "job",
      targetId: failed.id,
      outcome: "failed",
      details: {
        kind: failed.kind,
        attempts: failed.attempts,
        error: message
      }
    });
    return failed;
  }

  private async blockJobForBillingEntitlement(
    job: GenerationJobRecord,
    error: BillingEntitlementError
  ): Promise<GenerationJobRecord> {
    const blocked = await this.jobs.update({
      ...job,
      status: "blocked",
      error: error.message,
      output: {
        billingEntitlement: error.details
      },
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.recordJobFinished(blocked, "job_blocked");
    await this.auditService?.record({
      ownerId: blocked.ownerId,
      action: "job_blocked_billing_entitlement",
      targetType: "job",
      targetId: blocked.id,
      outcome: "blocked",
      details: {
        kind: blocked.kind,
        subscriptionId: error.details.subscriptionId,
        status: error.details.status,
        graceEndsAt: error.details.graceEndsAt
      }
    });
    return blocked;
  }

  private async runNovelToProject(job: GenerationJobRecord): Promise<GenerationJobRecord> {
    const title = readString(job.input, "title");
    const novelText = readString(job.input, "novelText");
    const project = await this.projectService.createFromNovel({
      title,
      novelText,
      ownerId: job.ownerId
    });

    const completed = await this.jobs.update({
      ...job,
      status: "succeeded",
      projectId: project.id,
      output: {
        projectId: project.id,
        title: project.title,
        beatCount: project.vnProject.chapters.flatMap((chapter) =>
          chapter.scenes.flatMap((scene) => scene.shots.flatMap((shot) => shot.beats))
        ).length
      },
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.recordJobFinished(completed, "job_succeeded");
    await this.auditService?.record({
      ownerId: completed.ownerId,
      action: "job_succeeded",
      targetType: "job",
      targetId: completed.id,
      details: {
        kind: completed.kind,
        projectId: project.id
      }
    });
    return completed;
  }

  private async resolveQuotaPolicy(ownerId: string): Promise<QuotaPolicy> {
    if (!this.billingService) {
      return this.quotaPolicy;
    }
    const subscription = await this.billingService.getSubscription(ownerId);
    if (subscription && (subscription.status === "active" || subscription.status === "trialing")) {
      const plan = await this.billingService.getPlan(subscription.planId);
      if (plan) {
        return quotaFromPlan(plan);
      }
    }
    const freePlan = await this.billingService.getPlan("free");
    return freePlan
      ? minQuotaPolicy(this.quotaPolicy, quotaFromPlan(freePlan))
      : this.quotaPolicy;
  }

  private async assertBillingEntitlement(ownerId: string): Promise<void> {
    if (!this.billingService || !this.billingEntitlementPolicy.blockPastDue) {
      return;
    }
    const subscription = await this.billingService.getSubscription(ownerId);
    if (!subscription || subscription.status !== "past_due") {
      return;
    }
    const graceEndsAt = graceEndsAtForPastDue(subscription, this.billingEntitlementPolicy);
    if (graceEndsAt && Date.now() < graceEndsAt.getTime()) {
      return;
    }
    throw new BillingEntitlementError(
      "Billing subscription is past due. Update payment method before starting new generation jobs.",
      {
        ownerId,
        subscriptionId: subscription.id,
        status: subscription.status,
        graceEndsAt: graceEndsAt?.toISOString()
      }
    );
  }

  private async assertJobInputApproved(input: {
    ownerId: string;
    kind: GenerationJobRecord["kind"];
    input: Record<string, unknown>;
    id?: string;
    projectId?: string;
  }): Promise<void> {
    if (input.kind === "novel_to_project") {
      await this.contentSafetyService?.assertApproved({
        ownerId: input.ownerId,
        source: "novel_text",
        text: `${readOptionalString(input.input, "title") ?? ""}\n${readOptionalString(input.input, "novelText") ?? ""}`,
        targetType: "job",
        targetId: input.id,
        metadata: {
          kind: input.kind,
          projectId: input.projectId
        }
      });
      return;
    }
    await this.contentSafetyService?.assertApproved({
      ownerId: input.ownerId,
      source: "asset_prompt",
      text: [
        readOptionalString(input.input, "assetId") ?? "",
        readOptionalString(input.input, "title") ?? "",
        readOptionalString(input.input, "prompt") ?? ""
      ].join("\n"),
      targetType: "job",
      targetId: input.id,
      metadata: {
        kind: input.kind,
        projectId: input.projectId
      }
    });
  }

  private async runAssetGeneration(job: GenerationJobRecord): Promise<GenerationJobRecord> {
    if (!this.aiEnabled || !this.imageGenerator || !this.assetService) {
      const waiting = await this.jobs.update({
        ...job,
        status: "waiting_for_credentials",
        error: "AI image provider is disabled or not configured. Configure credentials before running asset generation.",
        updatedAt: new Date().toISOString()
      });
      await this.auditService?.record({
        ownerId: waiting.ownerId,
        action: "job_waiting_for_credentials",
        targetType: "job",
        targetId: waiting.id,
        outcome: "blocked",
        details: {
          kind: waiting.kind
        }
      });
      return waiting;
    }

    const projectId = job.projectId ?? readString(job.input, "projectId");
    const assetId = readString(job.input, "assetId");
    const kind = readAssetKind(job.input, "kind");
    const generated = await this.imageGenerator.generateAsset({
      id: assetId,
      title: readOptionalString(job.input, "title") ?? assetId,
      kind,
      prompt: readOptionalString(job.input, "prompt")
    });
    const assetContent = await resolveGeneratedAssetContent(generated, this.fetchAsset);
    const stored = await this.assetService.store({
      projectId,
      ownerId: job.ownerId,
      assetId,
      fileName: readOptionalString(job.input, "fileName") ?? `${assetId}.${extensionFromContentType(assetContent.contentType)}`,
      contentType: assetContent.contentType,
      bytes: assetContent.bytes
    });

    const completed = await this.jobs.update({
      ...job,
      status: "succeeded",
      output: {
        assetId,
        projectId,
        provider: generated.provider,
        storageKey: stored.storageKey,
        publicUrl: stored.publicUrl,
        contentType: stored.contentType,
        byteLength: stored.byteLength,
        revisedPrompt: generated.revisedPrompt
      },
      finishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await this.recordJobFinished(completed, "job_succeeded");
    await this.auditService?.record({
      ownerId: completed.ownerId,
      action: "job_succeeded",
      targetType: "job",
      targetId: completed.id,
      details: {
        kind: completed.kind,
        projectId,
        assetId,
        provider: generated.provider
      }
    });
    return completed;
  }

  private async recordJobEnqueued(job: GenerationJobRecord): Promise<void> {
    await this.usageService?.record({
      ownerId: job.ownerId,
      projectId: job.projectId,
      jobId: job.id,
      metric: "job_enqueued",
      metadata: {
        kind: job.kind
      }
    });
    await this.usageService?.record({
      ownerId: job.ownerId,
      projectId: job.projectId,
      jobId: job.id,
      metric: metricForJobKind(job.kind),
      metadata: {
        kind: job.kind
      }
    });
  }

  private async recordJobFinished(job: GenerationJobRecord, metric: "job_succeeded" | "job_failed" | "job_blocked"): Promise<void> {
    await this.usageService?.record({
      ownerId: job.ownerId,
      projectId: job.projectId,
      jobId: job.id,
      metric,
      metadata: {
        kind: job.kind,
        attempts: job.attempts
      }
    });
    const costCents = estimatedCostCents(job.kind, this.costPolicy);
    if (metric === "job_succeeded" && costCents > 0) {
      await this.usageService?.record({
        ownerId: job.ownerId,
        projectId: job.projectId,
        jobId: job.id,
        metric: "estimated_cost_cents",
        quantity: costCents,
        metadata: {
          kind: job.kind
        }
      });
    }
  }
}

function quotaFromPlan(plan: BillingPlanRecord): QuotaPolicy {
  return {
    dailyJobLimit: plan.dailyJobLimit,
    dailyTextJobLimit: plan.dailyTextJobLimit,
    dailyImageJobLimit: plan.dailyImageJobLimit
  };
}

function minQuotaPolicy(left: QuotaPolicy, right: QuotaPolicy): QuotaPolicy {
  return {
    dailyJobLimit: minQuota(left.dailyJobLimit, right.dailyJobLimit),
    dailyTextJobLimit: minQuota(left.dailyTextJobLimit, right.dailyTextJobLimit),
    dailyImageJobLimit: minQuota(left.dailyImageJobLimit, right.dailyImageJobLimit)
  };
}

function minQuota(left: number, right: number): number {
  if (left === 0) {
    return right;
  }
  if (right === 0) {
    return left;
  }
  return Math.min(left, right);
}

function graceEndsAtForPastDue(
  subscription: BillingSubscriptionRecord,
  policy: BillingEntitlementPolicy
): Date | undefined {
  if (policy.pastDueGracePeriodMs < 0) {
    return undefined;
  }
  const since = new Date(subscription.updatedAt);
  if (Number.isNaN(since.valueOf())) {
    return undefined;
  }
  return new Date(since.getTime() + policy.pastDueGracePeriodMs);
}

function metricForJobKind(kind: GenerationJobRecord["kind"]): UsageMetric {
  return kind === "novel_to_project" ? "text_job_enqueued" : "image_job_enqueued";
}

function estimatedCostCents(kind: GenerationJobRecord["kind"], policy: CostPolicy): number {
  return kind === "novel_to_project" ? policy.textJobCostCents : policy.imageJobCostCents;
}

function retryDelayMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * (2 ** Math.max(0, attempt - 1));
}

function readString(input: Record<string, unknown>, key: string): string {
  const value = input[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Job input requires non-empty string field: ${key}`);
  }
  return value;
}

function readOptionalString(input: Record<string, unknown>, key: string): string | undefined {
  const value = input[key];
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readAssetKind(input: Record<string, unknown>, key: string): GeneratedImageAssetKind {
  const value = input[key];
  if (value === "background" || value === "characterSprite" || value === "cg") {
    return value;
  }
  return "cg";
}

async function resolveGeneratedAssetContent(
  generated: { src: string; mimeType?: string },
  fetchAsset?: typeof fetch
): Promise<{ contentType: string; bytes: Uint8Array }> {
  const dataUrl = parseDataUrl(generated.src);
  if (dataUrl) {
    return dataUrl;
  }

  if (!/^https?:\/\//.test(generated.src)) {
    throw new Error("Generated image provider returned unsupported asset src.");
  }
  if (!fetchAsset) {
    throw new Error("Fetching generated image URLs requires fetch.");
  }

  const response = await fetchAsset(generated.src);
  if (!response.ok) {
    throw new Error(`Generated image download failed with status ${response.status}.`);
  }
  const contentType = generated.mimeType ?? response.headers.get("content-type") ?? "application/octet-stream";
  return {
    contentType,
    bytes: new Uint8Array(await response.arrayBuffer())
  };
}

function parseDataUrl(src: string): { contentType: string; bytes: Uint8Array } | undefined {
  const match = src.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }
  return {
    contentType: match[1],
    bytes: Buffer.from(match[2], "base64")
  };
}

function extensionFromContentType(contentType: string): string {
  if (contentType === "image/jpeg") {
    return "jpg";
  }
  if (contentType === "image/svg+xml") {
    return "svg";
  }
  const match = contentType.match(/^image\/([a-z0-9.+-]+)$/);
  return match?.[1]?.replace("+xml", "") ?? "bin";
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
