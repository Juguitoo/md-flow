import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { toggleCheckbox } from "@/lib/markdown";
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
  if (!project) return jsonError("That project is not on the board.", 404);

  const body = (await request.json().catch(() => null)) as {
    file?: unknown;
    line?: unknown;
  } | null;
  if (!body || typeof body.file !== "string" || typeof body.line !== "number") {
    return jsonError("The file and line are missing.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!absolute || !discovered.includes(body.file)) {
    return jsonError("That file is not part of the board.");
  }

  const content = await fs.readFile(absolute, "utf8");
  const toggled = toggleCheckbox(content, body.line);
  if (!toggled.changed) {
    return jsonError("That line is no longer a checkbox task.", 409);
  }

  await fs.writeFile(absolute, toggled.content);
  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  return Response.json(await scanProject(project));
}
