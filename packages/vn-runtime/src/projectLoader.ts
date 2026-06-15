import { validateProject, type VNProject } from "@novel-game-maker/vn-core";

export function loadProjectFromJson(input: string | VNProject): VNProject {
  const project = typeof input === "string" ? (JSON.parse(input) as VNProject) : input;
  const validation = validateProject(project);
  if (!validation.valid) {
    throw new Error(`Invalid VNProject: ${validation.errors.join("; ")}`);
  }
  return project;
}

export async function loadProjectFromUrl(url: string): Promise<VNProject> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load VNProject from ${url}: ${response.status}`);
  }
  return loadProjectFromJson(await response.text());
}
