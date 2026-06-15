import type {
  ProductionBillingCheckoutSessionRecord,
  ProductionBillingEventRecord,
  ProductionBillingPlanRecord,
  ProductionBillingSubscriptionRecord
} from "../studio/productionApi";

interface BillingPanelProps {
  apiEnabled: boolean;
  ownerId: string;
  plans: ProductionBillingPlanRecord[];
  subscription?: ProductionBillingSubscriptionRecord;
  checkoutSessions: ProductionBillingCheckoutSessionRecord[];
  events: ProductionBillingEventRecord[];
  selectedPlanId: string;
  lastCheckoutUrl?: string;
  lastPortalUrl?: string;
  isLoading: boolean;
  isStartingCheckout: boolean;
  isStartingPortal: boolean;
  isCancelling: boolean;
  onSelectedPlanChange(planId: string): void;
  onRefresh(): void;
  onStartCheckout(): void;
  onStartPaymentMethodSession(): void;
  onCancelSubscription(): void;
}

export function BillingPanel({
  apiEnabled,
  ownerId,
  plans,
  subscription,
  checkoutSessions,
  events,
  selectedPlanId,
  lastCheckoutUrl,
  lastPortalUrl,
  isLoading,
  isStartingCheckout,
  isStartingPortal,
  isCancelling,
  onSelectedPlanChange,
  onRefresh,
  onStartCheckout,
  onStartPaymentMethodSession,
  onCancelSubscription
}: BillingPanelProps) {
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[0];
  const currentPlan = plans.find((plan) => plan.id === subscription?.planId);

  return (
    <section className="billing-panel" aria-label="Billing">
      <div className="billing-header">
        <div>
          <div className="panel-title">Billing</div>
          <div className="billing-readout">
            {subscription
              ? `${currentPlan?.name ?? subscription.planId} / ${subscription.status}`
              : apiEnabled
                ? "No active subscription"
                : "Production API is offline"}
          </div>
        </div>
        <button type="button" onClick={onRefresh} disabled={!apiEnabled || !ownerId || isLoading}>
          {isLoading ? "Loading Billing" : "Refresh Billing"}
        </button>
      </div>

      <div className="billing-subscription">
        <div>
          <strong>{currentPlan?.name ?? subscription?.planId ?? "No plan"}</strong>
          <span>{subscription ? `Renews ${formatDate(subscription.currentPeriodEnd)}` : "Select a plan to start checkout"}</span>
        </div>
        <div className="billing-subscription-actions">
          <button
            type="button"
            onClick={onStartPaymentMethodSession}
            disabled={!apiEnabled || !subscription || subscription.status === "cancelled" || isStartingPortal}
          >
            {isStartingPortal ? "Creating Link" : "Update Payment Method"}
          </button>
          <button
            type="button"
            onClick={onCancelSubscription}
            disabled={!apiEnabled || !subscription || subscription.status === "cancelled" || isCancelling}
          >
            {isCancelling ? "Cancelling" : "Cancel Subscription"}
          </button>
        </div>
      </div>

      <div className="billing-checkout">
        <label>
          Plan
          <select
            value={selectedPlan?.id ?? ""}
            onChange={(event) => onSelectedPlanChange(event.target.value)}
            disabled={!apiEnabled || plans.length === 0 || isStartingCheckout}
          >
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.name} · {formatCents(plan.priceCents, plan.currency)}/{plan.interval}
              </option>
            ))}
          </select>
        </label>
        {selectedPlan ? (
          <div className="billing-plan-detail">
            <span>{selectedPlan.description}</span>
            <span>{selectedPlan.dailyJobLimit} jobs/day · {selectedPlan.dailyImageJobLimit} image jobs/day</span>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onStartCheckout}
          disabled={!apiEnabled || !ownerId || !selectedPlan || isStartingCheckout}
        >
          {isStartingCheckout ? "Starting Checkout" : "Start Checkout"}
        </button>
      </div>

      {lastCheckoutUrl ? (
        <div className="billing-checkout-url">
          <span>Checkout URL</span>
          <a href={lastCheckoutUrl} target="_blank" rel="noreferrer">{lastCheckoutUrl}</a>
        </div>
      ) : null}

      {lastPortalUrl ? (
        <div className="billing-checkout-url">
          <span>Payment Method URL</span>
          <a href={lastPortalUrl} target="_blank" rel="noreferrer">{lastPortalUrl}</a>
        </div>
      ) : null}

      {checkoutSessions.length > 0 ? (
        <ul className="billing-session-list">
          {checkoutSessions.slice(0, 5).map((session) => (
            <li key={session.id}>
              <div className="billing-session-main">
                <strong>{session.planId}</strong>
                <span>{session.status}</span>
              </div>
              <div className="billing-session-meta">
                <span>{formatDate(session.createdAt)}</span>
                {session.expiresAt ? <span>expires {formatDate(session.expiresAt)}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {events.length > 0 ? (
        <ul className="billing-event-list" aria-label="Billing events">
          {events.slice(0, 5).map((event) => (
            <li key={event.id}>
              <div className="billing-session-main">
                <strong>{formatEventType(event.eventType)}</strong>
                <span>{event.status ?? event.provider}</span>
              </div>
              <div className="billing-session-meta">
                <span>{formatDate(event.occurredAt)}</span>
                {event.externalInvoiceId ? <span>{event.externalInvoiceId}</span> : null}
                {event.externalChargeId ? <span>{event.externalChargeId}</span> : null}
                {event.amountDueCents !== undefined ? (
                  <span>{formatCents(event.amountDueCents, event.currency ?? "USD")} due</span>
                ) : null}
                {event.amountPaidCents !== undefined ? (
                  <span>{formatCents(event.amountPaidCents, event.currency ?? "USD")} paid</span>
                ) : null}
                {event.amountRefundedCents !== undefined ? (
                  <span>{formatCents(event.amountRefundedCents, event.currency ?? "USD")} refunded</span>
                ) : null}
                {event.amountDisputedCents !== undefined ? (
                  <span>{formatCents(event.amountDisputedCents, event.currency ?? "USD")} disputed</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function formatCents(value: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(value / 100);
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toISOString().slice(0, 10);
}

function formatEventType(value: ProductionBillingEventRecord["eventType"]): string {
  return value.replace(/_/g, " ");
}
