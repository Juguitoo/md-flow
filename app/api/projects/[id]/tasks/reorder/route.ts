import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { parseMarkdown, reorderTask } from "@/lib/markdown";
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
    fromLine?: unknown;
    toLine?: unknown;
  } | null;
  if (
    !body ||
    typeof body.file !== "string" ||
    typeof body.fromLine !== "number" ||
    typeof body.toLine !== "number"
  ) {
    return jsonError("Faltan el archivo y las dos líneas.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!absolute || !discovered.includes(body.file)) {
    return jsonError("Ese archivo no forma parte de la lista.");
  }

  const content = await fs.readFile(absolute, "utf8");
  const tasks = parseMarkdown(content, body.file);
  const from = tasks.find((entry) => entry.line === body.fromLine);
  const to = tasks.find((entry) => entry.line === body.toLine);
  if (!from || !to) return jsonError("No encuentro esas tareas.");
  if (from.status !== to.status) {
    return jsonError("El orden se cambia dentro de la misma sección.");
  }
  if (from.status === "backlog" && from.version !== to.version) {
    return jsonError("El orden se cambia dentro de la misma versión.");
  }

  const moved = reorderTask(content, body.fromLine, body.toLine);
  if (moved.changed) await fs.writeFile(absolute, moved.content);

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  return Response.json(await scanProject(project));
}
