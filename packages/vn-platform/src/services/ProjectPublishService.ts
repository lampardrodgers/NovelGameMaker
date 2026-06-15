import type { VNAsset, VNProject } from "@novel-game-maker/vn-core";
import type {
  AssetRecord,
  DeploymentInvalidationRecord,
  PublishedProjectReleaseRecord,
  PublishedProjectReleaseRepository,
  PublishedProjectResult,
  PublishedProjectRollbackResult
} from "../types.js";
import { AssetService } from "./AssetService.js";
import { DeploymentService } from "./DeploymentService.js";
import { createProjectReleaseSummary, releaseMetadataWithSummary } from "./ProjectDiffService.js";
import { ProjectService } from "./ProjectService.js";

export class ProjectPublishService {
  constructor(
    private readonly projects: ProjectService,
    private readonly assets: AssetService,
    private readonly releases: PublishedProjectReleaseRepository,
    private readonly playerBaseUrl?: string,
    private readonly publicProjectBaseUrl?: string,
    private readonly deployments?: DeploymentService
  ) {}

  async publishProject(projectId: string): Promise<PublishedProjectResult> {
    const project = await this.projects.getProject(projectId);
    if (!project) {
      throw new Error(`Project not found: ${projectId}`);
    }

    const existingAssets = await this.assets.listByProject(project.id);
    const latestAssets = latestAssetsById(existingAssets);
    const publishedAt = new Date().toISOString();
    const assetRecords: AssetRecord[] = [];
    const publishedAssetItems: VNAsset[] = [];

    for (const asset of project.vnProject.assets.items) {
      const existing = latestAssets.get(asset.id);
      if (existing?.publicUrl) {
        publishedAssetItems.push({
          ...asset,
          src: existing.publicUrl
        });
        assetRecords.push(existing);
        continue;
      }
      if (isAbsoluteAssetSrc(asset.src)) {
        publishedAssetItems.push(asset);
        continue;
      }
      const stored = await this.assets.store({
        projectId: project.id,
        ownerId: project.ownerId,
        assetId: asset.id,
        fileName: `${asset.id}.svg`,
        contentType: "image/svg+xml",
        bytes: new TextEncoder().encode(createPublishPlaceholderSvg(asset, project.vnProject))
      });
      publishedAssetItems.push({
        ...asset,
        src: requirePublicUrl(stored)
      });
      assetRecords.push(stored);
    }

    const publishedProject: VNProject = {
      ...project.vnProject,
      assets: {
        items: publishedAssetItems
      },
      metadata: {
        ...(project.vnProject.metadata ?? {}),
        sourceProjectId: project.id,
        publishedAt
      },
      updatedAt: publishedAt
    };

    const projectJsonAsset = await this.assets.store({
      projectId: project.id,
      ownerId: project.ownerId,
      assetId: "published_project_json",
      fileName: "project.vn.json",
      contentType: "application/json",
      bytes: new TextEncoder().encode(JSON.stringify(publishedProject, null, 2))
    });
    const projectUrl = requirePublicUrl(projectJsonAsset);
    const playableUrl = this.playerBaseUrl
      ? `${trimTrailingSlash(this.playerBaseUrl)}/?projectUrl=${encodeURIComponent(projectUrl)}`
      : undefined;
    const currentProjectUrl = this.currentProjectUrl(project.id);
    const currentPlayableUrl = currentProjectUrl ? this.playableUrlFor(currentProjectUrl) : undefined;
    const latestRelease = await this.releases.getLatestByProject(project.id);
    const releaseSummary = createProjectReleaseSummary(project.vnProject);
    const release = await this.releases.create({
      id: createRecordId("release"),
      projectId: project.id,
      ownerId: project.ownerId,
      version: (latestRelease?.version ?? 0) + 1,
      projectUrl,
      playableUrl,
      projectJsonAssetId: projectJsonAsset.id,
      projectJsonAssetStorageKey: projectJsonAsset.storageKey,
      createdAt: publishedAt,
      metadata: releaseMetadataWithSummary({
        title: project.title,
        assetCount: publishedAssetItems.length
      }, releaseSummary)
    });
    const updatedProject = await this.projects.markPublished({
      id: project.id,
      releaseId: release.id,
      publishedAt,
      projectUrl,
      playableUrl
    });
    const deploymentInvalidation = await this.invalidateCurrentProject({
      ownerId: project.ownerId,
      projectId: project.id,
      releaseId: release.id,
      reason: "publish",
      currentProjectUrl,
      currentPlayableUrl
    });

    return {
      project: updatedProject,
      projectUrl,
      playableUrl,
      currentProjectUrl,
      currentPlayableUrl,
      publishedProject,
      projectJsonAsset,
      assetRecords,
      release,
      deploymentInvalidation,
      publishedAt
    };
  }

  async listReleases(projectId: string, limit = 20): Promise<PublishedProjectReleaseRecord[]> {
    return this.releases.listByProject(projectId, limit);
  }

  async rollbackToRelease(input: {
    projectId: string;
    releaseId: string;
  }): Promise<PublishedProjectRollbackResult> {
    const project = await this.projects.getProject(input.projectId);
    if (!project) {
      throw new Error(`Project not found: ${input.projectId}`);
    }
    const release = await this.releases.getById(input.releaseId);
    if (!release || release.projectId !== input.projectId) {
      throw new Error(`Release not found for project: ${input.releaseId}`);
    }
    const rolledBackAt = new Date().toISOString();
    const updatedProject = await this.projects.markRolledBack({
      id: project.id,
      releaseId: release.id,
      rolledBackAt,
      projectUrl: release.projectUrl,
      playableUrl: release.playableUrl
    });
    const currentProjectUrl = this.currentProjectUrl(project.id);
    const currentPlayableUrl = currentProjectUrl ? this.playableUrlFor(currentProjectUrl) : undefined;
    const deploymentInvalidation = await this.invalidateCurrentProject({
      ownerId: project.ownerId,
      projectId: project.id,
      releaseId: release.id,
      reason: "rollback",
      currentProjectUrl,
      currentPlayableUrl
    });
    return {
      project: updatedProject,
      release,
      rolledBackAt,
      currentProjectUrl,
      currentPlayableUrl,
      deploymentInvalidation
    };
  }

  private currentProjectUrl(projectId: string): string | undefined {
    if (!this.publicProjectBaseUrl) {
      return undefined;
    }
    return `${trimTrailingSlash(this.publicProjectBaseUrl)}/v1/public/projects/${encodeURIComponent(projectId)}/project.vn.json`;
  }

  private playableUrlFor(projectUrl: string): string | undefined {
    return this.playerBaseUrl
      ? `${trimTrailingSlash(this.playerBaseUrl)}/?projectUrl=${encodeURIComponent(projectUrl)}`
      : undefined;
  }

  private async invalidateCurrentProject(input: {
    ownerId: string;
    projectId: string;
    releaseId: string;
    reason: "publish" | "rollback";
    currentProjectUrl?: string;
    currentPlayableUrl?: string;
  }): Promise<DeploymentInvalidationRecord | undefined> {
    if (!this.deployments) {
      return undefined;
    }
    return this.deployments.invalidate({
      ownerId: input.ownerId,
      projectId: input.projectId,
      releaseId: input.releaseId,
      reason: input.reason,
      urls: [input.currentProjectUrl, input.currentPlayableUrl].filter((url): url is string => Boolean(url))
    });
  }
}

function latestAssetsById(records: AssetRecord[]): Map<string, AssetRecord> {
  const latest = new Map<string, AssetRecord>();
  for (const record of records) {
    if (!latest.has(record.assetId)) {
      latest.set(record.assetId, record);
    }
  }
  return latest;
}

function isAbsoluteAssetSrc(src: string): boolean {
  return /^(data:|https?:)/.test(src);
}

function requirePublicUrl(record: AssetRecord): string {
  if (!record.publicUrl) {
    throw new Error(`Published asset has no public URL: ${record.assetId}`);
  }
  return record.publicUrl;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/g, "");
}

function createPublishPlaceholderSvg(asset: VNAsset, project: VNProject): string {
  const colors = colorsForAsset(asset);
  const label = escapeXml(asset.name || asset.id);
  const subtitle = escapeXml(project.title);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">`,
    `<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="${colors[0]}"/><stop offset="1" stop-color="${colors[1]}"/></linearGradient></defs>`,
    `<rect width="1280" height="720" fill="url(#g)"/>`,
    `<rect x="72" y="72" width="1136" height="576" rx="24" fill="rgba(5,8,14,0.38)" stroke="rgba(255,255,255,0.28)" stroke-width="3"/>`,
    `<text x="640" y="330" text-anchor="middle" fill="#f8fbff" font-family="Arial, sans-serif" font-size="54" font-weight="700">${label}</text>`,
    `<text x="640" y="398" text-anchor="middle" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="24">${subtitle}</text>`,
    `</svg>`
  ].join("");
}

function colorsForAsset(asset: VNAsset): readonly [string, string] {
  if (asset.type === "cg") {
    return ["#16213f", "#9d174d"];
  }
  if (asset.type === "characterSprite") {
    return ["#1f2937", "#475569"];
  }
  return ["#0f2a3f", "#256d85"];
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
