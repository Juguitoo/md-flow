import fs from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { BACKLOG_TEMPLATE } from "@/lib/markdown";
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

  const backlogPath = path.join(root, "BACKLOG.md");
  try {
    await fs.access(backlogPath);
    return jsonError("BACKLOG.md ya existe.", 409);
  } catch {
    // Todavía no hay backlog: lo creamos.
  }

  await fs.writeFile(backlogPath, BACKLOG_TEMPLATE);
  await getHub().sync();
  getHub().broadcast({ projectId: id, file: "BACKLOG.md" });
  return Response.json(await scanProject(project), { status: 201 });
}
