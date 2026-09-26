import fs from "node:fs/promises";
import path from "node:path";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { addRoadmapStop, setRoadmapStatus } from "@/lib/roadmap";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { emptyArchive } from "@/lib/scaffold";
import { discoverFiles, scanProject } from "@/lib/scan";
import { addVersion, loadVersions } from "@/lib/versions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const VERSION_ID = /^v\d+(?:\.\d+)+$/;
const EMPTY_VERSIONS = `# Versiones

## En curso

## Previstas

## Publicadas
`;

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
    status?: unknown;
  } | null;
  const versionId = typeof body?.versionId === "string" ? body.versionId.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const status = body?.status === "doing" ? "doing" : body?.status === "planned" ? "planned" : null;
  if (!VERSION_ID.test(versionId)) return jsonError("La versión tiene que parecerse a v1.2.3.");
  if (!title) return jsonError("Escribe un título.");
  if (title.length > 160) return jsonError("El título es demasiado largo.");
  if (!status) return jsonError("Elige si queda prevista o en curso.");
  if (title.includes("|") || title.includes("\n")) return jsonError("El título no puede llevar |.");

  const root = resolveProjectPath(project.path);
  const timeline = await loadVersions(root);
  const versionsFile = timeline.file ?? "docs/VERSIONS.md";
  const versionsAbsolute = safeProjectFile(root, versionsFile);
  if (!versionsAbsolute) return jsonError("La ruta de VERSIONS.md no es válida.");

  let current = "";
  try {
    current = await fs.readFile(versionsAbsolute, "utf8");
  } catch {
    current = EMPTY_VERSIONS;
  }
  const added = addVersion(current, {
    id: versionId,
    title,
    status,
    archive: `archive/${versionId}.md`,
  });
  if (!added.changed) return jsonError(`${versionId} ya está en VERSIONS.md.`);

  const archiveRelative = versionsFile.includes("/")
    ? `${versionsFile.slice(0, versionsFile.lastIndexOf("/") + 1)}archive/${versionId}.md`
    : `archive/${versionId}.md`;
  const archiveAbsolute = safeProjectFile(root, archiveRelative);
  if (!archiveAbsolute) return jsonError("La ruta del archive no es válida.");

  await fs.mkdir(path.dirname(versionsAbsolute), { recursive: true });
  await fs.writeFile(versionsAbsolute, added.content);
  await fs.mkdir(path.dirname(archiveAbsolute), { recursive: true });
  try {
    await fs.access(archiveAbsolute);
  } catch {
    await fs.writeFile(archiveAbsolute, emptyArchive(versionId));
  }

  const files = await discoverFiles(root);
  const roadmap = files.find((file) => file.replace(/\\/g, "/").toLowerCase().endsWith("roadmap.md"));
  const roadmapRelative = roadmap ?? "docs/ROADMAP.md";
  const roadmapAbsolute = safeProjectFile(root, roadmapRelative);
  if (roadmapAbsolute) {
    let raw = `# Roadmap\n\n**Visión:**\n`;
    try {
      raw = await fs.readFile(roadmapAbsolute, "utf8");
    } catch {
      await fs.mkdir(path.dirname(roadmapAbsolute), { recursive: true });
    }
    if (status === "doing") {
      for (const entry of timeline.versions) {
        if (entry.status === "doing") raw = setRoadmapStatus(raw, entry.id, "planned");
      }
    }
    await fs.writeFile(roadmapAbsolute, addRoadmapStop(raw, { id: versionId, title, status }));
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: versionsFile });
  return Response.json(await scanProject(project), { status: 201 });
}
