import fs from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { insertTask } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { backlogFile } from "@/lib/scaffold";
import { getProject } from "@/lib/registry";
import { scanProject } from "@/lib/scan";
import { loadVersions } from "@/lib/versions";
import type { TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: TaskStatus[] = ["backlog", "doing", "done", "roadmap", "issue"];
const VERSION_ID = /^v\d+(?:\.\d+)+$/;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("That project is not on the board.", 404);

  const body = (await request.json().catch(() => null)) as {
    title?: unknown;
    ticketId?: unknown;
    status?: unknown;
    version?: unknown;
  } | null;

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) return jsonError("Write a title.");
  if (title.length > 180) return jsonError("The title is too long.");

  const status = body?.status;
  if (typeof status !== "string" || !STATUSES.includes(status as TaskStatus)) {
    return jsonError("Choose a status.");
  }

  const version = typeof body?.version === "string" ? body.version.trim() : "";
  if (version && !VERSION_ID.test(version)) {
    return jsonError("The version should look like v1.2.3.");
  }

  const ticketId = typeof body?.ticketId === "string" ? body.ticketId.trim() : "";
  if (ticketId && !/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(ticketId)) {
    return jsonError("The id should look like DATA-014.");
  }

  const root = resolveProjectPath(project.path);
  if (version) {
    const timeline = await loadVersions(root);
    const known = timeline.versions.find((entry) => entry.id === version);
    if (!known) return jsonError(`${version} is not in VERSIONS.md. Create it first.`);
    if (known.status === "published") return jsonError(`${version} is already published.`);
  }
  const relative = await backlogFile(root);
  const backlogPath = path.join(root, relative);
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
    version: version || null,
  });
  await fs.mkdir(path.dirname(backlogPath), { recursive: true });
  await fs.writeFile(backlogPath, next);
  await getHub().sync();
  getHub().broadcast({ projectId: id, file: relative });
  return Response.json(await scanProject(project), { status: 201 });
}
