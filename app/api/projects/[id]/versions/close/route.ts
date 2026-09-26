import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { setRoadmapStatus } from "@/lib/roadmap";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions, publishVersion } from "@/lib/versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("That project is not on the board.", 404);

  const body = (await request.json().catch(() => null)) as { versionId?: unknown } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  if (!versionId) return jsonError("The version is missing.");

  const root = resolveProjectPath(project.path);
  const timeline = await loadVersions(root);
  if (!timeline.file) return jsonError("VERSIONS.md is missing.");
  const absolute = safeProjectFile(root, timeline.file);
  if (!absolute) return jsonError("The VERSIONS.md path is not valid.");

  const current = await fs.readFile(absolute, "utf8");
  const published = publishVersion(current, versionId);
  if (!published.changed) {
    return jsonError("That version is not in VERSIONS.md, or it is already published.");
  }
  await fs.writeFile(absolute, published.content);

  const files = await discoverFiles(root);
  const roadmap = files.find((file) => file.replace(/\\/g, "/").toLowerCase().endsWith("roadmap.md"));
  const roadmapAbsolute = roadmap ? safeProjectFile(root, roadmap) : null;
  if (roadmapAbsolute) {
    const raw = await fs.readFile(roadmapAbsolute, "utf8");
    const next = setRoadmapStatus(raw, versionId, "published");
    if (next !== raw) await fs.writeFile(roadmapAbsolute, next);
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: timeline.file });
  const detail = await scanProject(project);
  const openTaskIds = detail.tasks
    .filter((task) => task.status !== "done" && task.version?.replace(/^v/i, "") === versionId.replace(/^v/i, ""))
    .map((task) => task.id ?? task.title);
  return Response.json({ ...detail, openTaskIds });
}
