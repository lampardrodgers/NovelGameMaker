import type { TeamMemberRecord, TeamMemberRole, TeamRecord, TeamRepository } from "../types.js";
import { AuditService } from "./AuditService.js";

const roleRank: Record<TeamMemberRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
  owner: 4
};

export class TeamService {
  constructor(
    private readonly teams: TeamRepository,
    private readonly auditService?: AuditService
  ) {}

  async createTeam(input: {
    id?: string;
    name: string;
    ownerUserId?: string;
  }): Promise<{ team: TeamRecord; ownerMember?: TeamMemberRecord }> {
    const now = new Date().toISOString();
    const team = await this.teams.createTeam({
      id: input.id?.trim() || createRecordId("team"),
      name: input.name.trim(),
      createdAt: now,
      updatedAt: now
    });
    let ownerMember: TeamMemberRecord | undefined;
    if (input.ownerUserId?.trim()) {
      ownerMember = await this.upsertMember({
        teamId: team.id,
        userId: input.ownerUserId,
        role: "owner"
      });
    }
    await this.auditService?.record({
      ownerId: team.id,
      action: "team_created",
      targetType: "team",
      targetId: team.id,
      details: {
        name: team.name,
        ownerUserId: input.ownerUserId
      }
    });
    return { team, ownerMember };
  }

  async getTeam(id: string): Promise<TeamRecord | undefined> {
    return this.teams.getTeam(id);
  }

  async listTeamsForUser(userId: string): Promise<TeamRecord[]> {
    return this.teams.listTeamsForUser(userId);
  }

  async upsertMember(input: {
    teamId: string;
    userId: string;
    role: TeamMemberRole;
  }): Promise<TeamMemberRecord> {
    const now = new Date().toISOString();
    const existing = await this.teams.getMember(input.teamId, input.userId);
    const member = await this.teams.upsertMember({
      id: existing?.id ?? createRecordId("member"),
      teamId: input.teamId,
      userId: input.userId,
      role: input.role,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    });
    await this.auditService?.record({
      ownerId: input.teamId,
      action: existing ? "team_member_updated" : "team_member_added",
      targetType: "team_member",
      targetId: member.id,
      details: {
        userId: member.userId,
        role: member.role
      }
    });
    return member;
  }

  async listMembers(teamId: string): Promise<TeamMemberRecord[]> {
    return this.teams.listMembers(teamId);
  }

  async getMember(teamId: string, userId: string): Promise<TeamMemberRecord | undefined> {
    return this.teams.getMember(teamId, userId);
  }

  async authorize(input: {
    teamId: string;
    userId: string;
    requiredRole: TeamMemberRole;
  }): Promise<boolean> {
    const member = await this.teams.getMember(input.teamId, input.userId);
    if (!member || member.revokedAt) {
      return false;
    }
    return roleRank[member.role] >= roleRank[input.requiredRole];
  }
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
