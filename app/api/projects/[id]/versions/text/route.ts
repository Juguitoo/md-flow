import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { setRoadmapSummary, setRoadmapTitle } from "@/lib/roadmap";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions, setVersionTitle } from "@/lib/versions";

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
    versionId?: unknown;
    title?: unknown;
    summary?: unknown;
  } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const summary = typeof body?.summary === "string" ? body.summary : "";
  if (!versionId) return jsonError("Falta la versión.");
  if (!title) return jsonError("Escribe un título.");
  if (title.length > 160 || title.includes("|") || title.includes("\n")) {
    return jsonError("El título no puede llevar | ni ser tan largo.");
  }
  if (summary.length > 4000) return jsonError("El texto es demasiado largo.");

  const root = resolveProjectPath(project.path);
  const timeline = await loadVersions(root);
  if (!timeline.file) return jsonError("No encuentro VERSIONS.md.");
  if (!timeline.versions.some((entry) => entry.id === versionId)) {
    return jsonError("Esa versión no está en VERSIONS.md.");
  }
  const absolute = safeProjectFile(root, timeline.file);
  if (!absolute) return jsonError("La ruta de VERSIONS.md no es válida.");

  const current = await fs.readFile(absolute, "utf8");
  const titled = setVersionTitle(current, versionId, title);
  if (titled.changed) await fs.writeFile(absolute, titled.content);

  const files = await discoverFiles(root);
  const roadmap = files.find((file) => file.replace(/\\/g, "/").toLowerCase().endsWith("roadmap.md"));
  const roadmapAbsolute = roadmap ? safeProjectFile(root, roadmap) : null;
  if (roadmapAbsolute) {
    const raw = await fs.readFile(roadmapAbsolute, "utf8");
    const next = setRoadmapSummary(setRoadmapTitle(raw, versionId, title), versionId, summary);
    if (next !== raw) await fs.writeFile(roadmapAbsolute, next);
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: timeline.file });
  return Response.json(await scanProject(project));
}
