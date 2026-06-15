import type {
  DeploymentCacheProvider,
  DeploymentInvalidationReason,
  DeploymentInvalidationRecord,
  DeploymentInvalidationRepository
} from "../types.js";
import { AuditService } from "./AuditService.js";

export class DeploymentService {
  constructor(
    private readonly invalidations: DeploymentInvalidationRepository,
    private readonly audit: AuditService,
    private readonly cacheProvider?: DeploymentCacheProvider
  ) {}

  async invalidate(input: {
    ownerId: string;
    projectId: string;
    releaseId?: string;
    reason: DeploymentInvalidationReason;
    urls: string[];
    metadata?: Record<string, unknown>;
  }): Promise<DeploymentInvalidationRecord> {
    const urls = uniqueUrls(input.urls);
    const createdAt = new Date().toISOString();

    if (urls.length === 0 || !this.cacheProvider) {
      const record = await this.invalidations.create({
        id: createRecordId("deploy_invalidation"),
        ownerId: input.ownerId,
        projectId: input.projectId,
        releaseId: input.releaseId,
        provider: this.cacheProvider?.id ?? "none",
        status: "skipped",
        reason: input.reason,
        urls,
        createdAt,
        completedAt: createdAt,
        metadata: input.metadata
      });
      await this.audit.record({
        ownerId: input.ownerId,
        action: "deployment_cache_invalidation_skipped",
        targetType: "project",
        targetId: input.projectId,
        details: {
          releaseId: input.releaseId,
          reason: input.reason,
          urls,
          provider: record.provider
        },
        createdAt
      });
      return record;
    }

    try {
      const result = await this.cacheProvider.purge({
        ownerId: input.ownerId,
        projectId: input.projectId,
        releaseId: input.releaseId,
        reason: input.reason,
        urls
      });
      const completedAt = new Date().toISOString();
      const record = await this.invalidations.create({
        id: createRecordId("deploy_invalidation"),
        ownerId: input.ownerId,
        projectId: input.projectId,
        releaseId: input.releaseId,
        provider: this.cacheProvider.id,
        status: "succeeded",
        reason: input.reason,
        urls,
        createdAt,
        completedAt,
        metadata: {
          ...(input.metadata ?? {}),
          ...(result.requestId ? { requestId: result.requestId } : {}),
          ...(result.metadata ?? {})
        }
      });
      await this.audit.record({
        ownerId: input.ownerId,
        action: "deployment_cache_invalidated",
        targetType: "project",
        targetId: input.projectId,
        details: {
          releaseId: input.releaseId,
          reason: input.reason,
          urls,
          provider: this.cacheProvider.id,
          requestId: result.requestId
        },
        createdAt: completedAt
      });
      return record;
    } catch (error) {
      const completedAt = new Date().toISOString();
      const message = error instanceof Error ? error.message : String(error);
      const record = await this.invalidations.create({
        id: createRecordId("deploy_invalidation"),
        ownerId: input.ownerId,
        projectId: input.projectId,
        releaseId: input.releaseId,
        provider: this.cacheProvider.id,
        status: "failed",
        reason: input.reason,
        urls,
        createdAt,
        completedAt,
        error: message,
        metadata: input.metadata
      });
      await this.audit.record({
        ownerId: input.ownerId,
        action: "deployment_cache_invalidation_failed",
        targetType: "project",
        targetId: input.projectId,
        outcome: "failed",
        details: {
          releaseId: input.releaseId,
          reason: input.reason,
          urls,
          provider: this.cacheProvider.id,
          error: message
        },
        createdAt: completedAt
      });
      return record;
    }
  }

  async listByProject(projectId: string, limit = 20): Promise<DeploymentInvalidationRecord[]> {
    return this.invalidations.listByProject(projectId, limit);
  }

  async listByOwner(ownerId: string, limit = 50): Promise<DeploymentInvalidationRecord[]> {
    return this.invalidations.listByOwner(ownerId, limit);
  }
}

function uniqueUrls(urls: string[]): string[] {
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
