import { fetchGithubIssues } from "./github";
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

export async function loadDetail(id: string, refresh = false): Promise<ProjectDetail | null> {
  await getHub().sync();
  const project = await getProject(id);
  if (!project) return null;
  const detail = await scanProject(project);
  if (detail.github) {
    const github = await fetchGithubIssues(detail.github, refresh);
    detail.githubTasks = github.tasks;
    detail.githubError = github.error;
    detail.githubTruncated = github.truncated;
  }
  return detail;
}
