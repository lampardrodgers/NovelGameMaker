import { createHash, randomBytes } from "node:crypto";
import type {
  AccessTokenRecord,
  AccessTokenRepository,
  AccessTokenRole,
  CreatedAccessToken
} from "../types.js";
import { AuditService } from "./AuditService.js";

export class AccessTokenService {
  constructor(
    private readonly tokens: AccessTokenRepository,
    private readonly auditService?: AuditService
  ) {}

  async createToken(input: {
    role: AccessTokenRole;
    ownerId?: string;
    userId?: string;
    label?: string;
    expiresAt?: string;
  }): Promise<CreatedAccessToken> {
    if (input.role === "owner" && !input.ownerId) {
      throw new Error("Owner access tokens require ownerId.");
    }
    if (input.role === "user" && !input.userId) {
      throw new Error("User access tokens require userId.");
    }
    const token = createPlainToken();
    const now = new Date().toISOString();
    const record = await this.tokens.create({
      id: createRecordId("token"),
      tokenHash: hashToken(token),
      tokenPrefix: token.slice(0, 12),
      role: input.role,
      ownerId: input.role === "owner" ? input.ownerId : undefined,
      userId: input.role === "user" ? input.userId : undefined,
      label: input.label?.trim() || `${input.role} token`,
      createdAt: now,
      expiresAt: input.expiresAt
    });
    await this.auditService?.record({
      ownerId: record.ownerId,
      action: "access_token_created",
      targetType: "access_token",
      targetId: record.id,
      details: {
        role: record.role,
        label: record.label,
        userId: record.userId,
        expiresAt: record.expiresAt
      }
    });
    return { token, record };
  }

  async authenticate(rawToken: string): Promise<AccessTokenRecord | undefined> {
    const record = await this.tokens.getByHash(hashToken(rawToken));
    if (!record || record.revokedAt || isExpired(record)) {
      return undefined;
    }
    return this.tokens.update({
      ...record,
      lastUsedAt: new Date().toISOString()
    });
  }

  async getToken(id: string): Promise<AccessTokenRecord | undefined> {
    return this.tokens.getById(id);
  }

  async listByOwner(ownerId: string, limit = 50): Promise<AccessTokenRecord[]> {
    return this.tokens.listByOwner(ownerId, limit);
  }

  async revokeToken(id: string): Promise<AccessTokenRecord | undefined> {
    const existing = await this.tokens.getById(id);
    if (!existing) {
      return undefined;
    }
    const revoked = await this.tokens.update({
      ...existing,
      revokedAt: existing.revokedAt ?? new Date().toISOString()
    });
    await this.auditService?.record({
      ownerId: revoked.ownerId,
      action: "access_token_revoked",
      targetType: "access_token",
      targetId: revoked.id,
      details: {
        role: revoked.role,
        label: revoked.label,
        userId: revoked.userId
      }
    });
    return revoked;
  }
}

function isExpired(record: AccessTokenRecord): boolean {
  return Boolean(record.expiresAt && record.expiresAt <= new Date().toISOString());
}

function createPlainToken(): string {
  return `vn_${randomBytes(32).toString("base64url")}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
