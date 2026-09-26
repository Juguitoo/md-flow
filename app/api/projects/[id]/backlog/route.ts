import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { scaffoldProject } from "@/lib/scaffold";
import { isDirectory, resolveProjectPath } from "@/lib/paths";
import { getProject } from "@/lib/registry";
import { scanProject } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  const root = resolveProjectPath(project.path);
  if (!isDirectory(root)) return jsonError("No encuentro la carpeta de este proyecto.");

  const created = await scaffoldProject(root);
  await getHub().sync();
  if (created.length > 0) {
    getHub().broadcast({ projectId: id, file: created[0] ?? "docs/BACKLOG.md" });
  }
  const detail = await scanProject(project);
  return Response.json({ created, ...detail }, { status: created.length ? 201 : 200 });
}
