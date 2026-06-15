import type {
  ProjectReleaseDiff,
  ReleaseApprovalCommentRecord,
  ReleaseApprovalCommentRepository,
  ReleaseApprovalNotificationEvent,
  ReleaseApprovalNotifier,
  ReleaseApprovalPublishResult,
  ReleaseApprovalRecord,
  ReleaseApprovalRepository
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { ProjectDiffService } from "./ProjectDiffService.js";
import { ProjectPublishService } from "./ProjectPublishService.js";
import { ProjectService } from "./ProjectService.js";

export class ReleaseApprovalStaleError extends Error {
  constructor(readonly approvalId: string) {
    super(`Release approval is stale because the project changed after request: ${approvalId}`);
    this.name = "ReleaseApprovalStaleError";
  }
}

export class ReleaseApprovalService {
  constructor(
    private readonly approvals: ReleaseApprovalRepository,
    private readonly comments: ReleaseApprovalCommentRepository,
    private readonly projects: ProjectService,
    private readonly publishing: ProjectPublishService,
    private readonly projectDiffs: ProjectDiffService,
    private readonly audit: AuditService,
    private readonly notifier?: ReleaseApprovalNotifier
  ) {}

  async requestApproval(input: {
    projectId: string;
    requestedBy: string;
    notes?: string;
  }): Promise<ReleaseApprovalRecord> {
    const project = await this.projects.getProject(input.projectId);
    if (!project) {
      throw new Error(`Project not found: ${input.projectId}`);
    }
    const diff = await this.projectDiffs.diffCurrentDraft(project.id);
    const metadata = approvalMetadata(diff);
    const existing = await this.approvals.getPendingByProject(project.id);
    if (existing) {
      const now = new Date().toISOString();
      const updated = await this.approvals.update({
        ...existing,
        updatedAt: now,
        notes: input.notes ?? existing.notes,
        metadata
      });
      await this.audit.record({
        ownerId: project.ownerId,
        action: "release_approval_updated",
        targetType: "release_approval",
        targetId: updated.id,
        details: {
          projectId: project.id,
          requestedBy: input.requestedBy,
          changed: diff.changed
        },
        createdAt: now
      });
      await this.notifyReleaseApproval({
        event: "release_approval_updated",
        approval: updated,
        actor: input.requestedBy,
        createdAt: now,
        metadata: notificationDiffMetadata(diff)
      });
      return updated;
    }
    const now = new Date().toISOString();
    const approval = await this.approvals.create({
      id: createRecordId("release_approval"),
      projectId: project.id,
      ownerId: project.ownerId,
      status: "pending",
      requestedBy: input.requestedBy,
      requestedAt: now,
      updatedAt: now,
      notes: input.notes,
      metadata
    });
    await this.audit.record({
      ownerId: project.ownerId,
      action: "release_approval_requested",
      targetType: "project",
      targetId: project.id,
      details: {
        approvalId: approval.id,
        requestedBy: input.requestedBy
      },
      createdAt: now
    });
    await this.notifyReleaseApproval({
      event: "release_approval_requested",
      approval,
      actor: input.requestedBy,
      createdAt: now,
      metadata: notificationDiffMetadata(diff)
    });
    return approval;
  }

  async approveAndPublish(input: {
    approvalId: string;
    reviewedBy: string;
    reviewNotes?: string;
  }): Promise<ReleaseApprovalPublishResult> {
    const approval = await this.requirePendingApproval(input.approvalId);
    await this.assertApprovalStillMatchesProject(approval);
    const published = await this.publishing.publishProject(approval.projectId);
    const now = new Date().toISOString();
    const updated = await this.approvals.update({
      ...approval,
      status: "published",
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      reviewNotes: input.reviewNotes,
      publishedReleaseId: published.release.id,
      updatedAt: now
    });
    await this.audit.record({
      ownerId: approval.ownerId,
      action: "release_approval_published",
      targetType: "release_approval",
      targetId: approval.id,
      details: {
        projectId: approval.projectId,
        releaseId: published.release.id,
        reviewedBy: input.reviewedBy
      },
      createdAt: now
    });
    await this.notifyReleaseApproval({
      event: "release_approval_published",
      approval: updated,
      actor: input.reviewedBy,
      releaseId: published.release.id,
      createdAt: now
    });
    return {
      approval: updated,
      published
    };
  }

  async reject(input: {
    approvalId: string;
    reviewedBy: string;
    reviewNotes?: string;
  }): Promise<ReleaseApprovalRecord> {
    const approval = await this.requirePendingApproval(input.approvalId);
    const now = new Date().toISOString();
    const updated = await this.approvals.update({
      ...approval,
      status: "rejected",
      reviewedBy: input.reviewedBy,
      reviewedAt: now,
      reviewNotes: input.reviewNotes,
      updatedAt: now
    });
    await this.audit.record({
      ownerId: approval.ownerId,
      action: "release_approval_rejected",
      targetType: "release_approval",
      targetId: approval.id,
      outcome: "blocked",
      details: {
        projectId: approval.projectId,
        reviewedBy: input.reviewedBy
      },
      createdAt: now
    });
    await this.notifyReleaseApproval({
      event: "release_approval_rejected",
      approval: updated,
      actor: input.reviewedBy,
      createdAt: now
    });
    return updated;
  }

  async addComment(input: {
    approvalId: string;
    author: string;
    body: string;
  }): Promise<ReleaseApprovalCommentRecord> {
    const approval = await this.approvals.getById(input.approvalId);
    if (!approval) {
      throw new Error(`Release approval not found: ${input.approvalId}`);
    }
    const body = input.body.trim();
    if (!body) {
      throw new Error("Release approval comment body is required.");
    }
    const now = new Date().toISOString();
    const comment = await this.comments.create({
      id: createRecordId("release_approval_comment"),
      approvalId: approval.id,
      projectId: approval.projectId,
      ownerId: approval.ownerId,
      author: input.author,
      body,
      createdAt: now
    });
    await this.audit.record({
      ownerId: approval.ownerId,
      action: "release_approval_commented",
      targetType: "release_approval",
      targetId: approval.id,
      details: {
        projectId: approval.projectId,
        commentId: comment.id,
        author: input.author
      },
      createdAt: now
    });
    await this.notifyReleaseApproval({
      event: "release_approval_commented",
      approval,
      actor: input.author,
      commentId: comment.id,
      createdAt: now
    });
    return comment;
  }

  async listComments(approvalId: string, limit = 50): Promise<ReleaseApprovalCommentRecord[]> {
    return this.comments.listByApproval(approvalId, limit);
  }

  async listByProject(projectId: string, limit = 20): Promise<ReleaseApprovalRecord[]> {
    return this.approvals.listByProject(projectId, limit);
  }

  async listByOwner(ownerId: string, limit = 50): Promise<ReleaseApprovalRecord[]> {
    return this.approvals.listByOwner(ownerId, limit);
  }

  async getById(id: string): Promise<ReleaseApprovalRecord | undefined> {
    return this.approvals.getById(id);
  }

  private async requirePendingApproval(id: string): Promise<ReleaseApprovalRecord> {
    const approval = await this.approvals.getById(id);
    if (!approval) {
      throw new Error(`Release approval not found: ${id}`);
    }
    if (approval.status !== "pending") {
      throw new Error(`Release approval is not pending: ${id}`);
    }
    return approval;
  }

  private async assertApprovalStillMatchesProject(approval: ReleaseApprovalRecord): Promise<void> {
    const expected = readMetadataString(approval.metadata, "projectFingerprint");
    if (!expected) {
      return;
    }
    const current = await this.projectDiffs.currentSummary(approval.projectId);
    if (current.fingerprint !== expected) {
      const now = new Date().toISOString();
      await this.audit.record({
        ownerId: approval.ownerId,
        action: "release_approval_stale",
        targetType: "release_approval",
        targetId: approval.id,
        outcome: "blocked",
        details: {
          projectId: approval.projectId,
          expectedFingerprint: expected,
          currentFingerprint: current.fingerprint
        },
        createdAt: now
      });
      await this.notifyReleaseApproval({
        event: "release_approval_stale",
        approval,
        createdAt: now,
        metadata: {
          expectedFingerprint: expected,
          currentFingerprint: current.fingerprint
        }
      });
      throw new ReleaseApprovalStaleError(approval.id);
    }
  }

  private async notifyReleaseApproval(input: {
    event: ReleaseApprovalNotificationEvent;
    approval: ReleaseApprovalRecord;
    actor?: string;
    commentId?: string;
    releaseId?: string;
    createdAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    if (!this.notifier) {
      return;
    }
    try {
      await this.notifier.notify({
        event: input.event,
        approvalId: input.approval.id,
        projectId: input.approval.projectId,
        ownerId: input.approval.ownerId,
        approvalStatus: input.approval.status,
        actor: input.actor,
        commentId: input.commentId,
        releaseId: input.releaseId,
        createdAt: input.createdAt,
        metadata: input.metadata
      });
    } catch (error) {
      await this.audit.record({
        ownerId: input.approval.ownerId,
        action: "release_approval_notification_failed",
        targetType: "release_approval",
        targetId: input.approval.id,
        outcome: "failed",
        details: {
          projectId: input.approval.projectId,
          event: input.event,
          provider: this.notifier.id,
          error: error instanceof Error ? error.message : String(error)
        },
        createdAt: new Date().toISOString()
      });
    }
  }
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function approvalMetadata(diff: ProjectReleaseDiff): Record<string, unknown> {
  return {
    projectFingerprint: diff.current.fingerprint,
    releaseDiff: diff
  };
}

function notificationDiffMetadata(diff: ProjectReleaseDiff): Record<string, unknown> {
  return {
    changed: diff.changed,
    baseUnavailable: diff.baseUnavailable,
    baseReleaseVersion: diff.baseRelease?.version,
    totals: diff.totals
  };
}

function readMetadataString(metadata: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = metadata?.[key];
  return typeof value === "string" ? value : undefined;
}
