import { fetchGithubIssues } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { getProject, removeProject } from "@/lib/registry";
import { scanProject } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  await getHub().sync();
  const detail = await scanProject(project);
  if (detail.github) {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const github = await fetchGithubIssues(detail.github, refresh);
    detail.githubTasks = github.tasks;
    detail.githubError = github.error;
    detail.githubTruncated = github.truncated;
  }
  return Response.json(detail);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const removed = await removeProject(id);
  if (!removed) return jsonError("No encuentro ese proyecto.", 404);
  await getHub().sync();
  return Response.json({ ok: true });
}
