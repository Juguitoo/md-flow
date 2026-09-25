import fs from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { insertTask } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { getProject } from "@/lib/registry";
import { scanProject } from "@/lib/scan";
import type { Priority, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: TaskStatus[] = ["backlog", "doing", "done", "roadmap", "issue"];
const PRIORITIES: Priority[] = ["alta", "media", "baja"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    ticketId?: unknown;
    status?: unknown;
    priority?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return jsonError("Escribe un título.");
  if (title.length > 180) return jsonError("El título es demasiado largo.");

  const status = body?.status;
  if (typeof status !== "string" || !STATUSES.includes(status as TaskStatus)) {
    return jsonError("Elige un estado.");
  }

  const priority =
    body?.priority === null || body?.priority === undefined || body?.priority === ""
      ? null
      : body.priority;
  if (priority !== null && (typeof priority !== "string" || !PRIORITIES.includes(priority as Priority))) {
    return jsonError("La prioridad tiene que ser alta, media o baja.");
  }

  const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
  if (ticketId && !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(ticketId)) {
    return jsonError("El id tiene que parecerse a DATA-014.");
  }

  const root = resolveProjectPath(project.path);
  const backlogPath = path.join(root, "BACKLOG.md");
  let content = "";
  try {
    content = await fs.readFile(backlogPath, "utf8");
  } catch {
    content = "";
  }

  const next = insertTask(content, {
    title,
    ticketId: ticketId || null,
    status: status as TaskStatus,
    priority: priority as Priority | null,
  });
  await fs.writeFile(backlogPath, next);
  await getHub().sync();
  getHub().broadcast({ projectId: id, file: "BACKLOG.md" });
  return Response.json(await scanProject(project), { status: 201 });
}
