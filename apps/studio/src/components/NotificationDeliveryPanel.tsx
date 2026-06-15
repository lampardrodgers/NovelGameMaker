import type { ProductionNotificationDeliveryRecord } from "../studio/productionApi";

interface NotificationDeliveryPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  deliveries: ProductionNotificationDeliveryRecord[];
  isLoading: boolean;
  isRunning: boolean;
  onRefresh(): void;
  onRunNext(): void;
}

export function NotificationDeliveryPanel({
  apiEnabled,
  ownerId,
  deliveries,
  isLoading,
  isRunning,
  onRefresh,
  onRunNext
}: NotificationDeliveryPanelProps) {
  const pendingCount = deliveries.filter((delivery) => delivery.status === "pending").length;
  const failedCount = deliveries.filter((delivery) => delivery.status === "failed").length;
  const disabled = !apiEnabled || !ownerId || isLoading;

  return (
    <section className="notification-delivery-panel" aria-label="Notification Delivery Monitor">
      <div className="notification-delivery-header">
        <div>
          <div className="panel-title">Notification Delivery Monitor</div>
          <div className="notification-delivery-readout">
            {apiEnabled
              ? `${pendingCount} pending / ${failedCount} failed / ${deliveries.length} total`
              : "Production API is offline"}
          </div>
        </div>
        <div className="notification-delivery-actions">
          <button type="button" onClick={onRefresh} disabled={disabled}>
            {isLoading ? "Loading Notifications" : "Refresh Notifications"}
          </button>
          <button type="button" onClick={onRunNext} disabled={!apiEnabled || isRunning}>
            {isRunning ? "Running Notification" : "Run Next Notification"}
          </button>
        </div>
      </div>

      {deliveries.length === 0 ? (
        <div className="notification-delivery-empty">
          {apiEnabled ? "No notification deliveries loaded" : "Production API is offline"}
        </div>
      ) : (
        <ul className="notification-delivery-list">
          {deliveries.map((delivery) => (
            <li key={delivery.id} className="notification-delivery-item">
              <div className="notification-delivery-meta">
                <strong>{delivery.event}</strong>
                <span className={`notification-delivery-status is-${delivery.status}`}>{delivery.status}</span>
              </div>
              <div className="notification-delivery-detail">
                <span>{delivery.id}</span>
                <span>{delivery.provider}</span>
                <span>{delivery.attempts} / {delivery.maxAttempts} attempts</span>
                <span>{delivery.updatedAt}</span>
              </div>
              {delivery.nextRunAt ? (
                <div className="notification-delivery-note">Next run: {delivery.nextRunAt}</div>
              ) : null}
              {delivery.error ? (
                <div className="notification-delivery-error">{delivery.error}</div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
