import { createProjectFromNovel } from "@novel-game-maker/vn-agent";
import { validateProject, type VNProject } from "@novel-game-maker/vn-core";
import type {
  CreateProjectFromNovelRequest,
  NovelProjectGenerator,
  ProjectRepository,
  StudioProjectRecord
} from "../types.js";
import { AuditService } from "./AuditService.js";
import { ContentSafetyService } from "./ContentSafetyService.js";

export class ProjectService {
  constructor(
    private readonly projects: ProjectRepository,
    private readonly projectGenerator?: NovelProjectGenerator,
    private readonly auditService?: AuditService,
    private readonly contentSafetyService?: ContentSafetyService
  ) {}

  async createFromNovel(input: CreateProjectFromNovelRequest): Promise<StudioProjectRecord> {
    await this.contentSafetyService?.assertApproved({
      ownerId: input.ownerId,
      source: "novel_text",
      text: `${input.title}\n${input.novelText}`,
      targetType: "project",
      metadata: {
        title: input.title,
        mode: "create_from_novel"
      }
    });
    const vnProject = this.projectGenerator
      ? await this.projectGenerator.createProject(input)
      : createProjectFromNovel({
          title: input.title,
          novelText: input.novelText,
          style: input.style
        });
    return this.saveProject({
      title: vnProject.title,
      ownerId: input.ownerId,
      source: "imported_novel",
      vnProject
    });
  }

  async saveProject(input: {
    id?: string;
    title: string;
    ownerId: string;
    source: StudioProjectRecord["source"];
    vnProject: VNProject;
  }): Promise<StudioProjectRecord> {
    const validation = validateProject(input.vnProject);
    if (!validation.valid) {
      throw new Error(`VNProject validation failed: ${validation.errors.join("; ")}`);
    }

    const now = new Date().toISOString();
    const existing = input.id ? await this.projects.getById(input.id) : undefined;
    await this.contentSafetyService?.assertApproved({
      ownerId: input.ownerId,
      source: "project_json",
      text: projectReviewText(input.vnProject),
      targetType: "project",
      targetId: existing?.id ?? input.id,
      metadata: {
        title: input.title,
        source: input.source
      }
    });
    const record: StudioProjectRecord = {
      id: existing?.id ?? input.id ?? createRecordId("project"),
      title: input.title.trim() || input.vnProject.title,
      ownerId: input.ownerId,
      source: input.source,
      vnProject: input.vnProject,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      publishedAt: existing?.publishedAt,
      currentReleaseId: existing?.currentReleaseId,
      publishedProjectUrl: existing?.publishedProjectUrl,
      publishedPlayableUrl: existing?.publishedPlayableUrl
    };

    const saved = existing ? await this.projects.update(record) : await this.projects.create(record);
    await this.auditService?.record({
      ownerId: saved.ownerId,
      action: existing ? "project_updated" : "project_created",
      targetType: "project",
      targetId: saved.id,
      details: {
        source: saved.source,
        title: saved.title
      }
    });
    return saved;
  }

  async getProject(id: string): Promise<StudioProjectRecord | undefined> {
    return this.projects.getById(id);
  }

  async listProjects(ownerId: string): Promise<StudioProjectRecord[]> {
    return this.projects.listByOwner(ownerId);
  }

  async markPublished(input: {
    id: string;
    releaseId: string;
    publishedAt: string;
    projectUrl: string;
    playableUrl?: string;
  }): Promise<StudioProjectRecord> {
    const existing = await this.projects.getById(input.id);
    if (!existing) {
      throw new Error(`Project not found: ${input.id}`);
    }
    const updated = await this.projects.update({
      ...existing,
      updatedAt: input.publishedAt,
      publishedAt: input.publishedAt,
      currentReleaseId: input.releaseId,
      publishedProjectUrl: input.projectUrl,
      publishedPlayableUrl: input.playableUrl
    });
    await this.auditService?.record({
      ownerId: updated.ownerId,
      action: "project_published",
      targetType: "project",
      targetId: updated.id,
      details: {
        title: updated.title,
        releaseId: input.releaseId,
        projectUrl: input.projectUrl,
        playableUrl: input.playableUrl
      }
    });
    return updated;
  }

  async markRolledBack(input: {
    id: string;
    releaseId: string;
    rolledBackAt: string;
    projectUrl: string;
    playableUrl?: string;
  }): Promise<StudioProjectRecord> {
    const existing = await this.projects.getById(input.id);
    if (!existing) {
      throw new Error(`Project not found: ${input.id}`);
    }
    const updated = await this.projects.update({
      ...existing,
      updatedAt: input.rolledBackAt,
      publishedAt: input.rolledBackAt,
      currentReleaseId: input.releaseId,
      publishedProjectUrl: input.projectUrl,
      publishedPlayableUrl: input.playableUrl
    });
    await this.auditService?.record({
      ownerId: updated.ownerId,
      action: "project_release_rolled_back",
      targetType: "project",
      targetId: updated.id,
      details: {
        title: updated.title,
        releaseId: input.releaseId,
        projectUrl: input.projectUrl,
        playableUrl: input.playableUrl
      }
    });
    return updated;
  }
}

function projectReviewText(project: VNProject): string {
  const lines = project.chapters.flatMap((chapter) =>
    chapter.scenes.flatMap((scene) =>
      scene.shots.flatMap((shot) =>
        shot.beats.map((beat) => beat.line.text)
      )
    )
  );
  const characterNames = project.characters.map((character) => character.name);
  return [
    project.title,
    ...characterNames,
    ...lines
  ].join("\n");
}

function createRecordId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
