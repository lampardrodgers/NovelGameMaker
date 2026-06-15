import type { VNProject } from "@agentic-galgame/vn-core";
import type { VNAgentWorkflow } from "../providers/interfaces.js";
import { createProjectFromNovel, type CreateProjectFromNovelInput } from "./createProjectFromNovel.js";

export class LocalHeuristicVNAgentWorkflow implements VNAgentWorkflow {
  readonly id = "local-heuristic-vn-agent";

  async run(input: unknown): Promise<VNProject> {
    return this.createProject(assertCreateProjectInput(input));
  }

  createProject(input: CreateProjectFromNovelInput): VNProject {
    return createProjectFromNovel(input);
  }
}

function assertCreateProjectInput(input: unknown): CreateProjectFromNovelInput {
  if (!input || typeof input !== "object") {
    throw new Error("VNAgentWorkflow input must be an object.");
  }

  const candidate = input as Partial<CreateProjectFromNovelInput>;
  if (typeof candidate.title !== "string" || typeof candidate.novelText !== "string") {
    throw new Error("VNAgentWorkflow input requires string title and novelText.");
  }

  return {
    title: candidate.title,
    novelText: candidate.novelText,
    style: candidate.style
  };
}
