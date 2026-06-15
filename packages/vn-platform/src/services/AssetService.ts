import type { AssetRecord, AssetRepository, AssetStorage, StoredAssetInput } from "../types.js";
import { AuditService } from "./AuditService.js";
import { UsageService } from "./UsageService.js";

export class AssetService {
  constructor(
    private readonly storage: AssetStorage,
    private readonly assets: AssetRepository,
    private readonly usageService?: UsageService,
    private readonly auditService?: AuditService
  ) {}

  async store(input: StoredAssetInput): Promise<AssetRecord> {
    const stored = await this.storage.store(input);
    await this.usageService?.record({
      ownerId: stored.ownerId,
      projectId: stored.projectId,
      metric: "asset_bytes",
      quantity: stored.byteLength,
      metadata: {
        assetId: stored.assetId,
        contentType: stored.contentType,
        provider: stored.provider
      }
    });
    await this.auditService?.record({
      ownerId: stored.ownerId,
      action: "asset_stored",
      targetType: "asset",
      targetId: stored.id,
      details: {
        projectId: stored.projectId,
        assetId: stored.assetId,
        byteLength: stored.byteLength,
        provider: stored.provider
      }
    });
    return stored;
  }

  async listByProject(projectId: string): Promise<AssetRecord[]> {
    return this.assets.listByProject(projectId);
  }
}
