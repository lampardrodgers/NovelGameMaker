import type {
  ContentSafetyDecision,
  DeploymentInvalidationStatus,
  GenerationJobRecord,
  JobStatus,
  NotificationDeliveryRecord,
  NotificationDeliveryStatus,
  OperationsIncidentSeverity,
  OperationsStatus,
  OwnerOperationsIncident,
  OwnerOperationsSummary,
  ReleaseApprovalStatus
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { ContentSafetyService } from "./ContentSafetyService.js";
import { DeploymentService } from "./DeploymentService.js";
import { GenerationJobService } from "./GenerationJobService.js";
import { NotificationDeliveryService } from "./NotificationDeliveryService.js";
import { ProjectService } from "./ProjectService.js";
import { ReleaseApprovalService } from "./ReleaseApprovalService.js";
import { UsageService } from "./UsageService.js";

export class OperationsService {
  constructor(
    private readonly projects: ProjectService,
    private readonly jobs: GenerationJobService,
    private readonly releaseApprovals: ReleaseApprovalService,
    private readonly notifications: NotificationDeliveryService,
    private readonly contentSafety: ContentSafetyService,
    private readonly deployments: DeploymentService,
    private readonly usage: UsageService,
    private readonly audit: AuditService
  ) {}

  async getOwnerSummary(ownerId: string, now = new Date()): Promise<OwnerOperationsSummary> {
    const [
      projects,
      jobs,
      approvals,
      notifications,
      reviews,
      invalidations,
      usage,
      auditEvents
    ] = await Promise.all([
      this.projects.listProjects(ownerId),
      this.jobs.listJobs(ownerId),
      this.releaseApprovals.listByOwner(ownerId, 100),
      this.notifications.listByOwner(ownerId, 100),
      this.contentSafety.listByOwner(ownerId, 100),
      this.deployments.listByOwner(ownerId, 100),
      this.usage.getDailySummary(ownerId, now),
      this.audit.listByOwner(ownerId, 20)
    ]);

    const failedJobs = jobs.filter((job) => job.status === "failed").slice(0, 10);
    const failedNotifications = notifications.filter((delivery) => delivery.status === "failed").slice(0, 10);
    const blockedReviews = reviews.filter((review) => review.decision === "blocked").slice(0, 10);
    const failedDeployments = invalidations.filter((invalidation) => invalidation.status === "failed").slice(0, 10);
    const incidents = [
      ...failedJobs.map(jobIncident),
      ...failedNotifications.map(notificationIncident),
      ...blockedReviews.map((review) => ({
        id: `content_safety:${review.id}`,
        severity: "critical" as OperationsIncidentSeverity,
        source: "content_safety" as const,
        message: `Content safety blocked ${review.targetType}.`,
        targetId: review.targetId ?? review.id,
        createdAt: review.createdAt
      })),
      ...failedDeployments.map((invalidation) => ({
        id: `deployment:${invalidation.id}`,
        severity: "warning" as OperationsIncidentSeverity,
        source: "deployment" as const,
        message: `Deployment cache invalidation failed for ${invalidation.provider}.`,
        targetId: invalidation.projectId,
        createdAt: invalidation.completedAt ?? invalidation.createdAt
      })),
      ...approvals
        .filter((approval) => approval.status === "pending")
        .slice(0, 10)
        .map((approval) => ({
          id: `release_approval:${approval.id}`,
          severity: "warning" as OperationsIncidentSeverity,
          source: "release_approval" as const,
          message: "Release approval is pending.",
          targetId: approval.projectId,
          createdAt: approval.updatedAt
        }))
    ];

    return {
      ownerId,
      generatedAt: now.toISOString(),
      status: summaryStatus(incidents),
      usage,
      counts: {
        projects: projects.length,
        jobs: {
          total: jobs.length,
          queued: countByStatus(jobs, "queued"),
          running: countByStatus(jobs, "running"),
          succeeded: countByStatus(jobs, "succeeded"),
          failed: countByStatus(jobs, "failed"),
          blocked: countByStatus(jobs, "blocked"),
          waitingForCredentials: countByStatus(jobs, "waiting_for_credentials"),
          retryScheduled: jobs.filter((job) => job.status === "queued" && Boolean(job.nextRunAt)).length
        },
        releaseApprovals: {
          pending: countByStatus(approvals, "pending"),
          published: countByStatus(approvals, "published"),
          rejected: countByStatus(approvals, "rejected"),
          cancelled: countByStatus(approvals, "cancelled")
        },
        notificationDeliveries: {
          pending: countByStatus(notifications, "pending"),
          running: countByStatus(notifications, "running"),
          succeeded: countByStatus(notifications, "succeeded"),
          failed: countByStatus(notifications, "failed")
        },
        contentSafety: {
          approved: countByStatus(reviews, "approved"),
          reviewRequired: countByStatus(reviews, "review_required"),
          blocked: countByStatus(reviews, "blocked")
        },
        deploymentInvalidations: {
          skipped: countByStatus(invalidations, "skipped"),
          succeeded: countByStatus(invalidations, "succeeded"),
          failed: countByStatus(invalidations, "failed")
        }
      },
      incidents: incidents.slice(0, 25),
      recent: {
        failedJobs,
        failedNotifications,
        blockedReviews,
        failedDeployments,
        auditEvents
      }
    };
  }
}

function countByStatus<T extends { status?: string; decision?: string }>(
  records: T[],
  status: JobStatus | ReleaseApprovalStatus | NotificationDeliveryStatus | ContentSafetyDecision | DeploymentInvalidationStatus
): number {
  return records.filter((record) => record.status === status || record.decision === status).length;
}

function jobIncident(job: GenerationJobRecord): OwnerOperationsIncident {
  return {
    id: `job:${job.id}`,
    severity: "critical",
    source: "job",
    message: `Generation job failed: ${job.kind}.`,
    targetId: job.id,
    createdAt: job.finishedAt ?? job.updatedAt
  };
}

function notificationIncident(delivery: NotificationDeliveryRecord): OwnerOperationsIncident {
  return {
    id: `notification:${delivery.id}`,
    severity: "warning",
    source: "notification",
    message: `Notification delivery failed: ${delivery.event}.`,
    targetId: delivery.id,
    createdAt: delivery.updatedAt
  };
}

function summaryStatus(incidents: OwnerOperationsIncident[]): OperationsStatus {
  if (incidents.some((incident) => incident.severity === "critical")) {
    return "critical";
  }
  return incidents.length > 0 ? "degraded" : "healthy";
}
