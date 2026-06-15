import type { ProductionTeamInvitationRecord } from "../studio/productionApi";

interface TeamInvitationPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  invitations: ProductionTeamInvitationRecord[];
  isLoading: boolean;
  isCreating: boolean;
  inviteEmail: string;
  inviteRole: ProductionTeamInvitationRecord["role"];
  inviteUserId: string;
  acceptToken: string;
  acceptUserId: string;
  lastInvitationToken?: string;
  onInviteEmailChange(value: string): void;
  onInviteRoleChange(value: ProductionTeamInvitationRecord["role"]): void;
  onInviteUserIdChange(value: string): void;
  onAcceptTokenChange(value: string): void;
  onAcceptUserIdChange(value: string): void;
  onCreate(): void;
  onRefresh(): void;
  onAccept(): void;
  onRevoke(invitationId: string): void;
}

const roleOptions: ProductionTeamInvitationRecord["role"][] = ["editor", "viewer", "admin", "owner"];

export function TeamInvitationPanel({
  apiEnabled,
  ownerId,
  invitations,
  isLoading,
  isCreating,
  inviteEmail,
  inviteRole,
  inviteUserId,
  acceptToken,
  acceptUserId,
  lastInvitationToken,
  onInviteEmailChange,
  onInviteRoleChange,
  onInviteUserIdChange,
  onAcceptTokenChange,
  onAcceptUserIdChange,
  onCreate,
  onRefresh,
  onAccept,
  onRevoke
}: TeamInvitationPanelProps) {
  const pendingCount = invitations.filter((invitation) => invitation.status === "pending").length;
  const disabled = !apiEnabled || !ownerId.trim();

  return (
    <section className="team-invitation-panel" aria-label="Team Invitations">
      <div className="team-invitation-header">
        <div>
          <div className="panel-title">Team Invitations</div>
          <div className="team-invitation-readout">
            {apiEnabled ? `${pendingCount} pending / ${invitations.length} total` : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={disabled || isLoading}>
          {isLoading ? "Loading Invitations" : "Refresh Invitations"}
        </button>
      </div>
      <div className="team-invitation-grid">
        <label>
          <span>Email</span>
          <input
            value={inviteEmail}
            onChange={(event) => onInviteEmailChange(event.target.value)}
            placeholder="editor@example.com"
          />
        </label>
        <label>
          <span>Role</span>
          <select
            value={inviteRole}
            onChange={(event) => onInviteRoleChange(event.target.value as ProductionTeamInvitationRecord["role"])}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </label>
        <label>
          <span>User ID</span>
          <input
            value={inviteUserId}
            onChange={(event) => onInviteUserIdChange(event.target.value)}
            placeholder="optional known user id"
          />
        </label>
        <button type="button" onClick={onCreate} disabled={disabled || isCreating || !inviteEmail.trim()}>
          {isCreating ? "Creating Invite" : "Create Invite"}
        </button>
      </div>
      {lastInvitationToken ? (
        <div className="team-invitation-token">
          <span>One-time invite token</span>
          <code>{lastInvitationToken}</code>
        </div>
      ) : null}
      <div className="team-invitation-accept">
        <input
          value={acceptToken}
          onChange={(event) => onAcceptTokenChange(event.target.value)}
          placeholder="vni_ invite token"
          aria-label="Invitation token"
        />
        <input
          value={acceptUserId}
          onChange={(event) => onAcceptUserIdChange(event.target.value)}
          placeholder="user id for admin token"
          aria-label="Invitation accept user id"
        />
        <button type="button" onClick={onAccept} disabled={!apiEnabled || !acceptToken.trim()}>
          Accept Invite
        </button>
      </div>
      <div className="team-invitation-list">
        {invitations.length === 0 ? (
          <div className="team-invitation-empty">No team invitations loaded</div>
        ) : invitations.slice(0, 6).map((invitation) => (
          <div className="team-invitation-item" key={invitation.id}>
            <div>
              <strong>{invitation.email}</strong>
              <span>{invitation.role} / {invitation.status}</span>
              <small>{invitation.tokenPrefix} / {invitation.updatedAt.slice(0, 10)}</small>
            </div>
            <button
              type="button"
              onClick={() => onRevoke(invitation.id)}
              disabled={!apiEnabled || invitation.status !== "pending"}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
