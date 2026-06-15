import type { AuditEventRecord, AuditOutcome, AuditRepository } from "../types.js";

export class AuditService {
  constructor(private readonly audit: AuditRepository) {}

  async record(input: {
    ownerId?: string;
    action: string;
    targetType: string;
    targetId?: string;
    outcome?: AuditOutcome;
    details?: Record<string, unknown>;
    createdAt?: string;
  }): Promise<AuditEventRecord> {
    return this.audit.create({
      id: createRecordId("audit"),
      ownerId: input.ownerId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      outcome: input.outcome ?? "succeeded",
      details: input.details,
      createdAt: input.createdAt ?? new Date().toISOString()
    });
  }

  async listByOwner(ownerId: string, limit = 50): Promise<AuditEventRecord[]> {
    return this.audit.listByOwner(ownerId, limit);
  }
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
