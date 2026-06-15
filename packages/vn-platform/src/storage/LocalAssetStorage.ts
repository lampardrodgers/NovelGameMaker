import { mkdir, writeFile } from "node:fs/promises";
import { basename, join, relative } from "node:path";
import type { AssetRecord, AssetRepository, AssetStorage, StoredAssetInput } from "../types.js";

export class LocalAssetStorage implements AssetStorage {
  constructor(
    private readonly rootDir: string,
    private readonly repository: AssetRepository,
    private readonly publicBasePath = "/assets"
  ) {}

  async store(input: StoredAssetInput): Promise<AssetRecord> {
    const safeProjectId = safeSegment(input.projectId);
    const safeAssetId = safeSegment(input.assetId);
    const safeFileName = safeFile(input.fileName);
    const projectDir = join(this.rootDir, safeProjectId);
    const storageKey = join(safeProjectId, `${safeAssetId}-${Date.now()}-${safeFileName}`);
    const target = join(this.rootDir, storageKey);
    const relativeTarget = relative(this.rootDir, target);

    if (relativeTarget.startsWith("..")) {
      throw new Error("Asset storage target escapes root directory.");
    }

    await mkdir(projectDir, { recursive: true });
    await writeFile(target, input.bytes);

    return this.repository.create({
      id: createRecordId("asset"),
      projectId: input.projectId,
      ownerId: input.ownerId,
      assetId: input.assetId,
      provider: "local_fs",
      contentType: input.contentType,
      byteLength: input.bytes.byteLength,
      storageKey,
      publicUrl: `${this.publicBasePath}/${storageKey}`,
      createdAt: new Date().toISOString()
    });
  }
}

function safeSegment(value: string): string {
  if (value === "." || value === ".." || value.includes("/") || value.includes("\\")) {
    throw new Error(`Invalid storage segment: ${value}`);
  }
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-");
  if (!normalized || normalized === "-") {
    throw new Error(`Invalid storage segment: ${value}`);
  }
  return normalized;
}

function safeFile(value: string): string {
  const file = basename(value).replace(/[^a-zA-Z0-9._-]/g, "-");
  if (!file || file === "." || file === "..") {
    throw new Error(`Invalid asset file name: ${value}`);
  }
  return file;
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
