import { createHash, createHmac } from "node:crypto";
import { basename, posix } from "node:path";
import type { AssetRecord, AssetRepository, AssetStorage, StoredAssetInput } from "../types.js";

export interface S3CompatibleAssetStorageOptions {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  repository: AssetRepository;
  publicBaseUrl?: string;
  forcePathStyle?: boolean;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

export class S3CompatibleAssetStorage implements AssetStorage {
  private readonly fetchImpl: typeof fetch;
  private readonly forcePathStyle: boolean;
  private readonly now: () => Date;

  constructor(private readonly options: S3CompatibleAssetStorageOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.forcePathStyle = options.forcePathStyle ?? true;
    this.now = options.now ?? (() => new Date());
  }

  async store(input: StoredAssetInput): Promise<AssetRecord> {
    const safeProjectId = safeSegment(input.projectId);
    const safeAssetId = safeSegment(input.assetId);
    const safeFileName = safeFile(input.fileName);
    const now = this.now();
    const storageKey = posix.join(safeProjectId, `${safeAssetId}-${now.getTime()}-${safeFileName}`);
    const url = this.objectUrl(storageKey);
    const payloadHash = sha256Hex(input.bytes);
    const headers = this.signRequest({
      method: "PUT",
      url,
      payloadHash,
      contentType: input.contentType,
      date: now
    });

    const response = await this.fetchImpl(url, {
      method: "PUT",
      headers,
      body: Buffer.from(input.bytes)
    });
    if (!response.ok) {
      throw new Error(`S3-compatible upload failed: ${response.status}`);
    }

    return this.options.repository.create({
      id: createRecordId("asset"),
      projectId: input.projectId,
      ownerId: input.ownerId,
      assetId: input.assetId,
      provider: "s3_compatible",
      contentType: input.contentType,
      byteLength: input.bytes.byteLength,
      storageKey,
      publicUrl: this.publicUrl(storageKey),
      createdAt: now.toISOString()
    });
  }

  private objectUrl(storageKey: string): URL {
    const endpoint = new URL(this.options.endpoint);
    const encodedKey = storageKey.split("/").map(encodeURIComponent).join("/");
    if (this.forcePathStyle) {
      endpoint.pathname = `${trimSlashes(endpoint.pathname)}/${this.options.bucket}/${encodedKey}`.replace(/\/+/g, "/");
      return endpoint;
    }
    endpoint.hostname = `${this.options.bucket}.${endpoint.hostname}`;
    endpoint.pathname = `${trimSlashes(endpoint.pathname)}/${encodedKey}`.replace(/\/+/g, "/");
    return endpoint;
  }

  private publicUrl(storageKey: string): string | undefined {
    if (!this.options.publicBaseUrl) {
      return undefined;
    }
    return `${this.options.publicBaseUrl.replace(/\/+$/, "")}/${storageKey}`;
  }

  private signRequest(input: {
    method: string;
    url: URL;
    payloadHash: string;
    contentType: string;
    date: Date;
  }): Record<string, string> {
    const amzDate = formatAmzDate(input.date);
    const dateStamp = amzDate.slice(0, 8);
    const host = input.url.host;
    const canonicalUri = input.url.pathname;
    const canonicalQuery = input.url.searchParams.toString();
    const canonicalHeaders =
      `content-type:${input.contentType}\n` +
      `host:${host}\n` +
      `x-amz-content-sha256:${input.payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      input.method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      signedHeaders,
      input.payloadHash
    ].join("\n");
    const credentialScope = `${dateStamp}/${this.options.region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      credentialScope,
      sha256Hex(canonicalRequest)
    ].join("\n");
    const signature = hmacHex(signingKey(this.options.secretAccessKey, dateStamp, this.options.region), stringToSign);

    return {
      authorization:
        `AWS4-HMAC-SHA256 Credential=${this.options.accessKeyId}/${credentialScope}, ` +
        `SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "content-type": input.contentType,
      host,
      "x-amz-content-sha256": input.payloadHash,
      "x-amz-date": amzDate
    };
  }
}

function signingKey(secretAccessKey: string, dateStamp: string, region: string): Buffer {
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, "s3");
  return hmac(dateRegionServiceKey, "aws4_request");
}

function hmac(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

function hmacHex(key: string | Buffer, value: string): string {
  return createHmac("sha256", key).update(value).digest("hex");
}

function sha256Hex(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function formatAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, "");
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
