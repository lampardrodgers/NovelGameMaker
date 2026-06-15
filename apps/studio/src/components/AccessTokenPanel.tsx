import type { ProductionAccessTokenRecord } from "../studio/productionApi";

interface AccessTokenPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  tokens: ProductionAccessTokenRecord[];
  lastCreatedToken?: string;
  isLoading: boolean;
  isCreating: boolean;
  label: string;
  expiresAt: string;
  onLabelChange(value: string): void;
  onExpiresAtChange(value: string): void;
  onRefresh(): void;
  onCreate(): void;
  onRevoke(tokenId: string): void;
}

export function AccessTokenPanel({
  apiEnabled,
  ownerId,
  tokens,
  lastCreatedToken,
  isLoading,
  isCreating,
  label,
  expiresAt,
  onLabelChange,
  onExpiresAtChange,
  onRefresh,
  onCreate,
  onRevoke
}: AccessTokenPanelProps) {
  const activeCount = tokens.filter((token) => !token.revokedAt).length;

  return (
    <section className="access-token-panel" aria-label="Access Tokens">
      <div className="access-token-header">
        <div>
          <div className="panel-title">Access Tokens</div>
          <div className="access-token-readout">
            {tokens.length > 0
              ? `${activeCount} active / ${tokens.length} total`
              : apiEnabled
                ? "No access tokens loaded"
                : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
          {isLoading ? "Loading Tokens" : "Refresh Tokens"}
        </button>
      </div>

      <div className="access-token-create">
        <label>
          <span>Label</span>
          <input value={label} onChange={(event) => onLabelChange(event.target.value)} />
        </label>
        <label>
          <span>Expires At</span>
          <input
            value={expiresAt}
            onChange={(event) => onExpiresAtChange(event.target.value)}
            placeholder="2026-12-31T00:00:00.000Z"
          />
        </label>
        <button type="button" onClick={onCreate} disabled={!apiEnabled || !ownerId || isCreating}>
          {isCreating ? "Creating Token" : "Create Owner Token"}
        </button>
      </div>

      {lastCreatedToken ? (
        <div className="access-token-secret">
          <span>New token</span>
          <code>{lastCreatedToken}</code>
        </div>
      ) : null}

      {tokens.length > 0 ? (
        <ul className="access-token-list">
          {tokens.slice(0, 10).map((token) => (
            <li key={token.id} className={token.revokedAt ? "is-revoked" : undefined}>
              <div className="access-token-main">
                <strong>{token.label}</strong>
                <span>{token.role}</span>
                <code>{token.tokenPrefix}</code>
              </div>
              <div className="access-token-meta">
                <span>{token.revokedAt ? "revoked" : "active"}</span>
                <span>created {formatTime(token.createdAt)}</span>
                {token.lastUsedAt ? <span>used {formatTime(token.lastUsedAt)}</span> : null}
                {token.expiresAt ? <span>expires {formatTime(token.expiresAt)}</span> : null}
              </div>
              <button type="button" onClick={() => onRevoke(token.id)} disabled={Boolean(token.revokedAt)}>
                Revoke Token
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace(".000Z", "Z");
}
