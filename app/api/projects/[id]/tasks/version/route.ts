import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { parseMarkdown, setTaskVersion } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions } from "@/lib/versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION_ID = /^v\d+(?:\.\d+)+$/;

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
    version?: unknown;
  } | null;
  if (!body || typeof body.file !== "string" || typeof body.line !== "number") {
    return jsonError("Faltan el archivo y la línea.");
  }
  const version = typeof body.version === "string" ? body.version.trim() : "";
  if (version && !VERSION_ID.test(version)) {
    return jsonError("La versión tiene que parecerse a v1.2.3.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!absolute || !discovered.includes(body.file)) {
    return jsonError("Ese archivo no forma parte de la lista.");
  }

  if (version) {
    const timeline = await loadVersions(root);
    const known = timeline.versions.find((entry) => entry.id === version);
    if (!known) return jsonError(`${version} no está en VERSIONS.md.`);
    if (known.status === "published") return jsonError(`${version} ya está publicada.`);
  }

  const content = await fs.readFile(absolute, "utf8");
  const task = parseMarkdown(content, body.file).find((entry) => entry.line === body.line);
  if (!task) return jsonError("No encuentro esa tarea.");
  const updated = setTaskVersion(content, body.line, version || null);
  if (updated.changed) await fs.writeFile(absolute, updated.content);

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  return Response.json(await scanProject(project));
}
