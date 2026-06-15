import { createHash, randomBytes } from "node:crypto";
import type {
  CreatedTeamInvitation,
  TeamInvitationNotificationEvent,
  TeamInvitationNotifier,
  TeamInvitationRecord,
  TeamInvitationRepository,
  TeamMemberRecord,
  TeamMemberRole
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { TeamService } from "./TeamService.js";

const DEFAULT_INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class TeamInvitationExpiredError extends Error {
  constructor(readonly invitationId: string) {
    super("Team invitation is expired.");
  }
}

export class TeamInvitationUnavailableError extends Error {
  constructor(readonly invitationId: string) {
    super("Team invitation is not pending.");
  }
}

export class TeamInvitationValidationError extends Error {}

export class TeamInvitationService {
  constructor(
    private readonly invitations: TeamInvitationRepository,
    private readonly teams: TeamService,
    private readonly auditService?: AuditService,
    private readonly notifier?: TeamInvitationNotifier
  ) {}

  async createInvitation(input: {
    teamId: string;
    email: string;
    role: TeamMemberRole;
    invitedBy: string;
    invitedUserId?: string;
    expiresAt?: string;
  }): Promise<CreatedTeamInvitation> {
    const invitationToken = createPlainInvitationToken();
    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = input.expiresAt ?? new Date(now.getTime() + DEFAULT_INVITATION_TTL_MS).toISOString();
    const invitation = await this.invitations.create({
      id: createRecordId("invite"),
      teamId: input.teamId,
      email: normalizeEmail(input.email),
      role: input.role,
      tokenHash: hashToken(invitationToken),
      tokenPrefix: invitationToken.slice(0, 12),
      status: "pending",
      invitedBy: input.invitedBy,
      invitedUserId: input.invitedUserId?.trim() || undefined,
      createdAt: nowIso,
      updatedAt: nowIso,
      expiresAt
    });
    await this.auditService?.record({
      ownerId: invitation.teamId,
      action: "team_invitation_created",
      targetType: "team_invitation",
      targetId: invitation.id,
      details: {
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        invitedUserId: invitation.invitedUserId,
        expiresAt: invitation.expiresAt
      }
    });
    await this.notifyTeamInvitation("team_invitation_created", invitation, nowIso, {
      invitationToken
    });
    return { invitationToken, invitation };
  }

  async listByTeam(teamId: string, limit = 50): Promise<TeamInvitationRecord[]> {
    const invitations = await this.invitations.listByTeam(teamId, limit);
    const nowIso = new Date().toISOString();
    return Promise.all(invitations.map((invitation) => this.expireIfNeeded(invitation, nowIso)));
  }

  async getInvitation(id: string): Promise<TeamInvitationRecord | undefined> {
    const invitation = await this.invitations.getById(id);
    return invitation ? this.expireIfNeeded(invitation) : undefined;
  }

  async revokeInvitation(id: string, revokedBy: string): Promise<TeamInvitationRecord | undefined> {
    const invitation = await this.invitations.getById(id);
    if (!invitation) {
      return undefined;
    }
    const nowIso = new Date().toISOString();
    const revoked = await this.invitations.update({
      ...invitation,
      status: invitation.status === "pending" ? "revoked" : invitation.status,
      revokedAt: invitation.revokedAt ?? nowIso,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      ownerId: revoked.teamId,
      action: "team_invitation_revoked",
      targetType: "team_invitation",
      targetId: revoked.id,
      details: {
        email: revoked.email,
        role: revoked.role,
        revokedBy
      }
    });
    await this.notifyTeamInvitation("team_invitation_revoked", revoked, nowIso, {
      actor: revokedBy
    });
    return revoked;
  }

  async acceptInvitation(input: {
    invitationToken: string;
    userId: string;
    userEmail?: string;
  }): Promise<{ invitation: TeamInvitationRecord; member: TeamMemberRecord }> {
    const invitation = await this.invitations.getByTokenHash(hashToken(input.invitationToken));
    if (!invitation) {
      throw new TeamInvitationUnavailableError("unknown");
    }
    const current = await this.expireIfNeeded(invitation);
    if (current.status === "expired") {
      throw new TeamInvitationExpiredError(current.id);
    }
    if (current.status !== "pending") {
      throw new TeamInvitationUnavailableError(current.id);
    }
    if (current.invitedUserId && current.invitedUserId !== input.userId) {
      throw new TeamInvitationUnavailableError(current.id);
    }
    if (!current.invitedUserId && input.userEmail && normalizeEmail(input.userEmail) !== current.email) {
      throw new TeamInvitationUnavailableError(current.id);
    }
    const nowIso = new Date().toISOString();
    const member = await this.teams.upsertMember({
      teamId: current.teamId,
      userId: input.userId,
      role: current.role
    });
    const accepted = await this.invitations.update({
      ...current,
      status: "accepted",
      acceptedByUserId: input.userId,
      acceptedAt: nowIso,
      updatedAt: nowIso
    });
    await this.auditService?.record({
      ownerId: accepted.teamId,
      action: "team_invitation_accepted",
      targetType: "team_invitation",
      targetId: accepted.id,
      details: {
        email: accepted.email,
        role: accepted.role,
        userId: input.userId
      }
    });
    await this.notifyTeamInvitation("team_invitation_accepted", accepted, nowIso, {
      acceptedByUserId: input.userId,
      actor: `user:${input.userId}`
    });
    return { invitation: accepted, member };
  }

  private async expireIfNeeded(invitation: TeamInvitationRecord, nowIso = new Date().toISOString()): Promise<TeamInvitationRecord> {
    if (invitation.status !== "pending" || !invitation.expiresAt || invitation.expiresAt > nowIso) {
      return invitation;
    }
    const expired = await this.invitations.update({
      ...invitation,
      status: "expired",
      updatedAt: nowIso
    });
    await this.auditService?.record({
      ownerId: expired.teamId,
      action: "team_invitation_expired",
      targetType: "team_invitation",
      targetId: expired.id,
      details: {
        email: expired.email,
        role: expired.role
      }
    });
    await this.notifyTeamInvitation("team_invitation_expired", expired, nowIso);
    return expired;
  }

  private async notifyTeamInvitation(
    event: TeamInvitationNotificationEvent,
    invitation: TeamInvitationRecord,
    createdAt: string,
    extras: {
      invitationToken?: string;
      acceptedByUserId?: string;
      actor?: string;
    } = {}
  ): Promise<void> {
    if (!this.notifier) {
      return;
    }
    try {
      await this.notifier.notify({
        event,
        invitationId: invitation.id,
        teamId: invitation.teamId,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        invitedUserId: invitation.invitedUserId,
        acceptedByUserId: extras.acceptedByUserId ?? invitation.acceptedByUserId,
        actor: extras.actor,
        invitationToken: extras.invitationToken,
        createdAt,
        expiresAt: invitation.expiresAt,
        metadata: {
          tokenPrefix: invitation.tokenPrefix,
          status: invitation.status
        }
      });
    } catch (error) {
      await this.auditService?.record({
        ownerId: invitation.teamId,
        action: "team_invitation_notification_failed",
        targetType: "team_invitation",
        targetId: invitation.id,
        outcome: "failed",
        details: {
          event,
          provider: this.notifier.id,
          error: error instanceof Error ? error.message : String(error)
        },
        createdAt
      });
    }
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    throw new TeamInvitationValidationError("Team invitations require a valid email.");
  }
  return normalized;
}

function createPlainInvitationToken(): string {
  return `vni_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
