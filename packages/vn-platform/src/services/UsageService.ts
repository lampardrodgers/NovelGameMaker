import type {
  JobKind,
  QuotaPolicy,
  UsageEventRecord,
  UsageMetric,
  UsageRepository,
  UsageSummary
} from "../types.js";

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QuotaExceededError";
  }
}

export class UsageService {
  constructor(private readonly usage: UsageRepository) {}

  async record(input: {
    ownerId: string;
    metric: UsageMetric;
    quantity?: number;
    projectId?: string;
    jobId?: string;
    metadata?: Record<string, unknown>;
    createdAt?: string;
  }): Promise<UsageEventRecord> {
    return this.usage.create({
      id: createRecordId("usage"),
      ownerId: input.ownerId,
      metric: input.metric,
      quantity: input.quantity ?? 1,
      projectId: input.projectId,
      jobId: input.jobId,
      metadata: input.metadata,
      createdAt: input.createdAt ?? new Date().toISOString()
    });
  }

  async assertCanEnqueue(ownerId: string, kind: JobKind, policy: QuotaPolicy, now = new Date()): Promise<void> {
    const windowStart = startOfUtcDay(now).toISOString();
    await assertLimit(
      this.usage,
      ownerId,
      "job_enqueued",
      policy.dailyJobLimit,
      windowStart,
      "Daily job quota exceeded."
    );
    if (kind === "novel_to_project") {
      await assertLimit(
        this.usage,
        ownerId,
        "text_job_enqueued",
        policy.dailyTextJobLimit,
        windowStart,
        "Daily text generation quota exceeded."
      );
    }
    if (kind === "asset_generation") {
      await assertLimit(
        this.usage,
        ownerId,
        "image_job_enqueued",
        policy.dailyImageJobLimit,
        windowStart,
        "Daily image generation quota exceeded."
      );
    }
  }

  async getDailySummary(ownerId: string, now = new Date()): Promise<UsageSummary> {
    const windowStart = startOfUtcDay(now).toISOString();
    const windowEnd = now.toISOString();
    const [
      jobEnqueued,
      textJobEnqueued,
      imageJobEnqueued,
      jobSucceeded,
      jobFailed,
      jobBlocked,
      assetBytes,
      estimatedCostCents
    ] = await Promise.all([
      this.usage.sumByOwnerSince(ownerId, "job_enqueued", windowStart),
      this.usage.sumByOwnerSince(ownerId, "text_job_enqueued", windowStart),
      this.usage.sumByOwnerSince(ownerId, "image_job_enqueued", windowStart),
      this.usage.sumByOwnerSince(ownerId, "job_succeeded", windowStart),
      this.usage.sumByOwnerSince(ownerId, "job_failed", windowStart),
      this.usage.sumByOwnerSince(ownerId, "job_blocked", windowStart),
      this.usage.sumByOwnerSince(ownerId, "asset_bytes", windowStart),
      this.usage.sumByOwnerSince(ownerId, "estimated_cost_cents", windowStart)
    ]);
    return {
      ownerId,
      windowStart,
      windowEnd,
      jobEnqueued,
      textJobEnqueued,
      imageJobEnqueued,
      jobSucceeded,
      jobFailed,
      jobBlocked,
      assetBytes,
      estimatedCostCents
    };
  }

  async listRecent(ownerId: string, limit = 50, now = new Date()): Promise<UsageEventRecord[]> {
    return this.usage.listByOwnerSince(ownerId, startOfUtcDay(now).toISOString(), limit);
  }
}

async function assertLimit(
  usage: UsageRepository,
  ownerId: string,
  metric: UsageMetric,
  limit: number,
  windowStart: string,
  message: string
): Promise<void> {
  if (limit === 0) {
    return;
  }
  const used = await usage.sumByOwnerSince(ownerId, metric, windowStart);
  if (used >= limit) {
    throw new QuotaExceededError(message);
  }
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
