import { getHub } from "./hub";
import { ensureRegistry, getProject } from "./registry";
import { scanProject, toSummary } from "./scan";
import type { ProjectDetail, ProjectSummary } from "./types";

export async function loadSummaries(): Promise<ProjectSummary[]> {
  await getHub().sync();
  const projects = await ensureRegistry();
  const details = await Promise.all(projects.map((project) => scanProject(project)));
  return details.map(toSummary);
}

export async function loadDetail(id: string): Promise<ProjectDetail | null> {
  await getHub().sync();
  const project = await getProject(id);
  if (!project) return null;
  return scanProject(project);
}
