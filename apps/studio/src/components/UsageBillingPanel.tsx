import type { ProductionUsageEventRecord, ProductionUsageSummary } from "../studio/productionApi";

interface UsageBillingPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  usage?: ProductionUsageSummary;
  events: ProductionUsageEventRecord[];
  isLoading: boolean;
  onRefresh(): void;
}

export function UsageBillingPanel({
  apiEnabled,
  ownerId,
  usage,
  events,
  isLoading,
  onRefresh
}: UsageBillingPanelProps) {
  return (
    <section className="usage-billing-panel" aria-label="Usage and Billing">
      <div className="usage-billing-header">
        <div>
          <div className="panel-title">Usage & Billing</div>
          <div className="usage-billing-readout">
            {usage
              ? `${usage.jobEnqueued} jobs / ${formatCents(usage.estimatedCostCents)} estimated`
              : apiEnabled
                ? "No usage loaded"
                : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
          {isLoading ? "Loading Usage" : "Refresh Usage"}
        </button>
      </div>

      {usage ? (
        <div className="usage-billing-body">
          <div className="usage-billing-grid">
            <span>{usage.textJobEnqueued} text jobs</span>
            <span>{usage.imageJobEnqueued} image jobs</span>
            <span>{usage.jobSucceeded} succeeded</span>
            <span>{usage.jobFailed} failed</span>
            <span>{usage.jobBlocked} blocked</span>
            <span>{formatBytes(usage.assetBytes)} assets</span>
          </div>
          <div className="usage-billing-window">
            {formatTime(usage.windowStart)} to {formatTime(usage.windowEnd)}
          </div>
        </div>
      ) : null}

      {events.length > 0 ? (
        <ul className="usage-billing-events">
          {events.slice(0, 10).map((event) => (
            <li key={event.id}>
              <div className="usage-billing-event-main">
                <strong>{event.metric}</strong>
                <span>{event.quantity}</span>
              </div>
              <div className="usage-billing-event-meta">
                {event.projectId ? <span>project:{event.projectId}</span> : null}
                {event.jobId ? <span>job:{event.jobId}</span> : null}
                <span>{formatTime(event.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatCents(value: number): string {
  return `$${(value / 100).toFixed(2)}`;
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function formatTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().replace(".000Z", "Z");
}
