import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { removeRoadmapStop } from "@/lib/roadmap";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions, removeVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameVersion(left: string, right: string): boolean {
  return left.trim().replace(/^v/i, "") === right.trim().replace(/^v/i, "");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  const body = (await request.json().catch(() => null)) as { versionId?: unknown } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  if (!versionId) return jsonError("Falta la versión.");

  const root = resolveProjectPath(project.path);
  const before = await scanProject(project);
  const open = before.tasks.filter(
    (task) => task.status !== "done" && task.version && sameVersion(task.version, versionId),
  );
  const archived = before.archiveTasks.filter((task) => sameVersion(task.version, versionId));
  if (open.length > 0 || archived.length > 0) {
    const names = [...open, ...archived].map((task) => task.id ?? task.title);
    return jsonError(
      `${versionId} todavía tiene tareas (${names.slice(0, 6).join(", ")}). Cámbiales la versión o ciérralas antes de borrarla.`,
    );
  }

  const timeline = await loadVersions(root);
  if (!timeline.file) return jsonError("No encuentro VERSIONS.md.");
  const entry = timeline.versions.find((item) => item.id === versionId);
  if (!entry) return jsonError("Esa versión no está en VERSIONS.md.");
  const absolute = safeProjectFile(root, timeline.file);
  if (!absolute) return jsonError("La ruta de VERSIONS.md no es válida.");

  const current = await fs.readFile(absolute, "utf8");
  const removed = removeVersion(current, versionId);
  if (removed.changed) await fs.writeFile(absolute, removed.content);

  const files = await discoverFiles(root);
  const roadmap = files.find((file) => file.replace(/\\/g, "/").toLowerCase().endsWith("roadmap.md"));
  const roadmapAbsolute = roadmap ? safeProjectFile(root, roadmap) : null;
  if (roadmapAbsolute) {
    const raw = await fs.readFile(roadmapAbsolute, "utf8");
    const next = removeRoadmapStop(raw, versionId);
    if (next !== raw) await fs.writeFile(roadmapAbsolute, next);
  }

  if (entry.archive) {
    const archiveAbsolute = safeProjectFile(root, entry.archive);
    if (archiveAbsolute) {
      await fs.rm(archiveAbsolute, { force: true }).catch(() => undefined);
    }
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: timeline.file });
  return Response.json(await scanProject(project));
}
