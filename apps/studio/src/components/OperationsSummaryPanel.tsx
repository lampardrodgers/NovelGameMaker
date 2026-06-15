import type { ProductionOperationsSummary } from "../studio/productionApi";

interface OperationsSummaryPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  summary?: ProductionOperationsSummary;
  isLoading: boolean;
  onRefresh(): void;
}

export function OperationsSummaryPanel({
  apiEnabled,
  ownerId,
  summary,
  isLoading,
  onRefresh
}: OperationsSummaryPanelProps) {
  return (
    <section className="operations-summary-panel" aria-label="Operations Summary">
      <div className="operations-summary-header">
        <div>
          <div className="panel-title">Operations Summary</div>
          <div className="operations-summary-readout">
            {summary ? `${summary.status} / ${summary.incidents.length} incidents` : apiEnabled ? "No operations summary loaded" : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
          {isLoading ? "Loading Operations" : "Refresh Operations"}
        </button>
      </div>

      {summary ? (
        <div className="operations-summary-body">
          <div className={`operations-summary-status is-${summary.status}`}>{summary.status}</div>
          <div className="operations-summary-grid">
            <span>{summary.counts.projects} projects</span>
            <span>{summary.counts.jobs.queued} queued jobs</span>
            <span>{summary.counts.jobs.failed} failed jobs</span>
            <span>{summary.counts.notificationDeliveries.failed} failed notifications</span>
            <span>{summary.counts.releaseApprovals.pending} pending approvals</span>
            <span>{summary.counts.contentSafety.blocked} blocked reviews</span>
            <span>{summary.counts.deploymentInvalidations.failed} failed deploys</span>
            <span>{summary.usage.estimatedCostCents} cents estimated</span>
          </div>
          {summary.incidents.length > 0 ? (
            <ul className="operations-incident-list">
              {summary.incidents.slice(0, 5).map((incident) => (
                <li key={incident.id} className={`operations-incident is-${incident.severity}`}>
                  <strong>{incident.source}</strong>
                  <span>{incident.message}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
