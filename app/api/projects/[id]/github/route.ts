import { clearGithubCache, fetchGithubIssues, parseRepo } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { getProject, updateGithub } from "@/lib/registry";
import { scanProject } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const existing = await getProject(id);
  if (!existing) return jsonError("That project is not on the board.", 404);

  const body = (await request.json().catch(() => null)) as { repo?: unknown } | null;
  const raw = typeof body?.repo === "string" ? body.repo.trim() : "";
  const repo = raw ? parseRepo(raw) : null;
  if (raw && !repo) {
    return jsonError("Use owner/repo or the GitHub URL.");
  }

  const updated = await updateGithub(id, repo);
  if (!updated) return jsonError("That project is not on the board.", 404);
  clearGithubCache();

  const detail = await scanProject(updated);
  if (detail.github) {
    const github = await fetchGithubIssues(detail.github, true);
    detail.githubTasks = github.tasks;
    detail.githubError = github.error;
    detail.githubTruncated = github.truncated;
  }
  return Response.json(detail);
}
