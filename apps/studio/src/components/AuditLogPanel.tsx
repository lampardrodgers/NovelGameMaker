import type { ProductionAuditEventRecord } from "../studio/productionApi";

interface AuditLogPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  events: ProductionAuditEventRecord[];
  isLoading: boolean;
  onRefresh(): void;
}

export function AuditLogPanel({
  apiEnabled,
  ownerId,
  events,
  isLoading,
  onRefresh
}: AuditLogPanelProps) {
  const securityCount = events.filter((event) => classifyAuditEvent(event.action) === "security").length;

  return (
    <section className="audit-log-panel" aria-label="Audit Log">
      <div className="audit-log-header">
        <div>
          <div className="panel-title">Audit Log</div>
          <div className="audit-log-readout">
            {events.length > 0
              ? `${events.length} events / ${securityCount} security`
              : apiEnabled
                ? "No audit events loaded"
                : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
          {isLoading ? "Loading Audit" : "Refresh Audit"}
        </button>
      </div>

      {events.length > 0 ? (
        <ul className="audit-log-list">
          {events.slice(0, 10).map((event) => {
            const category = classifyAuditEvent(event.action);
            return (
              <li key={event.id} className={`audit-log-item is-${event.outcome}`}>
                <div className="audit-log-row">
                  <strong>{event.action}</strong>
                  <span className={`audit-log-category is-${category}`}>{category}</span>
                </div>
                <div className="audit-log-meta">
                  <span>{event.outcome}</span>
                  <span>{event.targetType}{event.targetId ? `:${event.targetId}` : ""}</span>
                  <span>{formatTime(event.createdAt)}</span>
                </div>
                {event.details ? (
                  <code>{formatDetails(event.details)}</code>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

function classifyAuditEvent(action: string): "security" | "release" | "generation" | "platform" {
  if (
    action.startsWith("user_")
    || action.startsWith("access_token_")
    || action.startsWith("team_invitation_")
    || action.includes("mfa")
    || action.includes("login")
  ) {
    return "security";
  }
  if (action.startsWith("release_") || action.startsWith("project_release") || action === "project_published") {
    return "release";
  }
  if (action.startsWith("job_") || action.startsWith("asset_")) {
    return "generation";
  }
  return "platform";
}

function formatDetails(details: Record<string, unknown>): string {
  const entries = Object.entries(details).slice(0, 4);
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" / ");
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace(".000Z", "Z");
}
