import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { parseMarkdown, removeTask } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  const body = (await request.json().catch(() => null)) as {
    file?: unknown;
    line?: unknown;
  } | null;
  if (!body || typeof body.file !== "string" || typeof body.line !== "number") {
    return jsonError("Faltan el archivo y la línea.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!absolute || !discovered.includes(body.file)) {
    return jsonError("Ese archivo no forma parte de la lista.");
  }

  const content = await fs.readFile(absolute, "utf8");
  const task = parseMarkdown(content, body.file).find((entry) => entry.line === body.line);
  if (!task) return jsonError("No encuentro esa tarea.");
  const removed = removeTask(content, body.line);
  if (!removed.changed) return jsonError("No pude quitar esa tarea.");
  await fs.writeFile(absolute, removed.content);

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  return Response.json(await scanProject(project));
}
