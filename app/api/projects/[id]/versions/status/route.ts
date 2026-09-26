import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { setRoadmapStatus } from "@/lib/roadmap";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions, moveVersion } from "@/lib/versions";
import type { VersionStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATUSES: VersionStatus[] = ["doing", "planned", "published"];

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("That project is not on the board.", 404);

  const body = (await request.json().catch(() => null)) as {
    versionId?: unknown;
    status?: unknown;
  } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  const status = typeof body?.status === "string" ? body.status : "";
  if (!versionId) return jsonError("The version is missing.");
  if (!STATUSES.includes(status as VersionStatus)) {
    return jsonError("Choose planned, in progress, or published.");
  }

  const root = resolveProjectPath(project.path);
  const timeline = await loadVersions(root);
  if (!timeline.file) return jsonError("VERSIONS.md is missing.");
  const absolute = safeProjectFile(root, timeline.file);
  if (!absolute) return jsonError("The VERSIONS.md path is not valid.");

  const current = await fs.readFile(absolute, "utf8");
  const demoted = timeline.versions
    .filter((entry) => entry.status === "doing" && entry.id !== versionId)
    .map((entry) => entry.id);
  const moved = moveVersion(current, versionId, status as VersionStatus);
  if (!moved.changed && !timeline.versions.some((entry) => entry.id === versionId)) {
    return jsonError("That version is not in VERSIONS.md.");
  }
  if (moved.changed) await fs.writeFile(absolute, moved.content);

  const files = await discoverFiles(root);
  const roadmap = files.find((file) => file.replace(/\\/g, "/").toLowerCase().endsWith("roadmap.md"));
  const roadmapAbsolute = roadmap ? safeProjectFile(root, roadmap) : null;
  if (roadmapAbsolute) {
    let raw = await fs.readFile(roadmapAbsolute, "utf8");
    if (status === "doing") {
      for (const entry of demoted) raw = setRoadmapStatus(raw, entry, "planned");
    }
    const next = setRoadmapStatus(raw, versionId, status as VersionStatus);
    if (next !== raw) await fs.writeFile(roadmapAbsolute, next);
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: timeline.file });
  const detail = await scanProject(project);
  const openTaskIds =
    status === "published"
      ? detail.tasks
          .filter(
            (task) =>
              task.status !== "done" &&
              task.version?.replace(/^v/i, "") === versionId.replace(/^v/i, ""),
          )
          .map((task) => task.id ?? task.title)
      : [];
  return Response.json({ ...detail, openTaskIds });
}
