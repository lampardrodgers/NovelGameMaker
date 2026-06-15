import type {
  NotificationDeliveryRecord,
  NotificationDeliveryRepository,
  NotificationRetryPolicy,
  ReleaseApprovalNotificationPayload,
  ReleaseApprovalNotifier
} from "../types.js";
import { AuditService } from "./AuditService.js";

export class NotificationDeliveryService implements ReleaseApprovalNotifier {
  readonly id = "notification_outbox";

  constructor(
    private readonly deliveries: NotificationDeliveryRepository,
    private readonly audit: AuditService,
    private readonly transport: ReleaseApprovalNotifier | undefined,
    private readonly retryPolicy: NotificationRetryPolicy
  ) {}

  async notify(input: ReleaseApprovalNotificationPayload): Promise<void> {
    if (!this.transport) {
      return;
    }
    const now = new Date().toISOString();
    const delivery = await this.deliveries.create({
      id: createRecordId("notification_delivery"),
      ownerId: input.ownerId,
      projectId: input.projectId,
      approvalId: input.approvalId,
      event: input.event,
      provider: this.transport.id,
      status: "pending",
      payload: input,
      attempts: 0,
      maxAttempts: this.retryPolicy.maxAttempts,
      createdAt: now,
      updatedAt: now,
      nextRunAt: now
    });
    await this.audit.record({
      ownerId: input.ownerId,
      action: "notification_delivery_enqueued",
      targetType: "notification_delivery",
      targetId: delivery.id,
      details: {
        approvalId: input.approvalId,
        projectId: input.projectId,
        event: input.event,
        provider: this.transport.id
      },
      createdAt: now
    });
  }

  async runNext(): Promise<NotificationDeliveryRecord | undefined> {
    if (!this.transport) {
      return undefined;
    }
    const [delivery] = await this.deliveries.listRunnable(1);
    if (!delivery) {
      return undefined;
    }
    return this.runDelivery(delivery);
  }

  async listByOwner(ownerId: string, limit = 50): Promise<NotificationDeliveryRecord[]> {
    return this.deliveries.listByOwner(ownerId, limit);
  }

  private async runDelivery(delivery: NotificationDeliveryRecord): Promise<NotificationDeliveryRecord> {
    const now = new Date().toISOString();
    const attempts = delivery.attempts + 1;
    const running = await this.deliveries.update({
      ...delivery,
      status: "running",
      attempts,
      lastAttemptAt: now,
      updatedAt: now,
      error: undefined
    });

    try {
      await this.transport!.notify(running.payload);
      const deliveredAt = new Date().toISOString();
      const succeeded = await this.deliveries.update({
        ...running,
        status: "succeeded",
        deliveredAt,
        updatedAt: deliveredAt,
        nextRunAt: undefined,
        error: undefined
      });
      await this.audit.record({
        ownerId: succeeded.ownerId,
        action: "notification_delivery_succeeded",
        targetType: "notification_delivery",
        targetId: succeeded.id,
        details: {
          approvalId: succeeded.approvalId,
          projectId: succeeded.projectId,
          event: succeeded.event,
          provider: succeeded.provider
        },
        createdAt: deliveredAt
      });
      return succeeded;
    } catch (error) {
      return this.handleFailure(running, error);
    }
  }

  private async handleFailure(
    delivery: NotificationDeliveryRecord,
    error: unknown
  ): Promise<NotificationDeliveryRecord> {
    const now = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const shouldRetry = delivery.attempts < delivery.maxAttempts;
    const updated = await this.deliveries.update({
      ...delivery,
      status: shouldRetry ? "pending" : "failed",
      error: errorMessage,
      updatedAt: now,
      nextRunAt: shouldRetry ? nextRetryTime(now, this.retryPolicy.retryDelayMs, delivery.attempts) : undefined
    });
    await this.audit.record({
      ownerId: delivery.ownerId,
      action: shouldRetry ? "notification_delivery_retry_scheduled" : "notification_delivery_failed",
      targetType: "notification_delivery",
      targetId: delivery.id,
      outcome: shouldRetry ? "blocked" : "failed",
      details: {
        approvalId: delivery.approvalId,
        projectId: delivery.projectId,
        event: delivery.event,
        provider: delivery.provider,
        attempts: delivery.attempts,
        error: errorMessage
      },
      createdAt: now
    });
    return updated;
  }
}

function nextRetryTime(nowIso: string, retryDelayMs: number, attempts: number): string {
  const delay = retryDelayMs * Math.max(1, 2 ** Math.max(0, attempts - 1));
  return new Date(Date.parse(nowIso) + delay).toISOString();
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
