import fs from "node:fs/promises";
import path from "node:path";
import { appendArchiveRow } from "@/lib/archive";
import { extractHashes } from "@/lib/commits";
import { fichaPath, parseFicha, setFichaEstado } from "@/lib/ficha";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { moveTask, parseMarkdown, removeTask } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";
import { loadVersions } from "@/lib/versions";
import type { Task, TaskStatus, VersionEntry } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MOVABLE: TaskStatus[] = ["backlog", "doing", "done"];

function sameVersion(left: string, right: string): boolean {
  return left.trim().replace(/^v/i, "") === right.trim().replace(/^v/i, "");
}

function versionFor(task: Task, versions: VersionEntry[]): VersionEntry | null {
  if (task.version) {
    return versions.find((entry) => sameVersion(entry.id, task.version ?? "")) ?? null;
  }
  const doing = versions.filter((entry) => entry.status === "doing");
  return doing.length === 1 ? doing[0] : null;
}

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
    status?: unknown;
    commit?: unknown;
  } | null;
  if (!body || typeof body.file !== "string" || typeof body.line !== "number") {
    return jsonError("The file and line are missing.");
  }
  if (typeof body.status !== "string" || !MOVABLE.includes(body.status as TaskStatus)) {
    return jsonError("Choose to do, in progress, or done.");
  }
  const status = body.status as TaskStatus;

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!absolute || !discovered.includes(body.file)) {
    return jsonError("That file is not part of the list.");
  }

  const content = await fs.readFile(absolute, "utf8");
  const task = parseMarkdown(content, body.file).find((entry) => entry.line === body.line);
  if (!task) return jsonError("I can't find that task.");

  if (status === "done") {
    if (!task.id) return jsonError("Give it an id before marking it done.");
    const timeline = await loadVersions(root);
    const doing = timeline.versions.filter((entry) => entry.status === "doing");
    if (!task.version && doing.length > 1) {
      return jsonError("Several versions are in progress. Set the version on the task.");
    }
    const version = versionFor(task, timeline.versions);
    if (!version) {
      return jsonError(
        task.version
          ? `${task.version} no está en VERSIONS.md.`
          : "This task has no version, and none is in progress.",
      );
    }
    if (!version.archive) return jsonError(`${version.id} has no archive in VERSIONS.md.`);
    const archiveAbsolute = safeProjectFile(root, version.archive);
    if (!archiveAbsolute) return jsonError("The archive path is not valid.");

    let note = "";
    const notePath = fichaPath(task);
    const noteAbsolute = notePath ? safeProjectFile(root, notePath) : null;
    if (noteAbsolute) {
      try {
        note = parseFicha(await fs.readFile(noteAbsolute, "utf8")).sections.resolucion;
      } catch {
        note = "";
      }
    }
    const commit = typeof body.commit === "string" ? body.commit.slice(0, 240) : "";
    let archive = "";
    try {
      archive = await fs.readFile(archiveAbsolute, "utf8");
    } catch {
      archive = `# Archive — ${version.id}\n\n## Features / tareas\n`;
    }
    const nextArchive = appendArchiveRow(archive, {
      id: task.id,
      title: task.title,
      taskType: task.taskType,
      commits: extractHashes(commit).join(" "),
      note,
    });
    const removed = removeTask(content, body.line);
    if (!removed.changed) return jsonError("Couldn't remove the task from the backlog.");

    await fs.mkdir(path.dirname(archiveAbsolute), { recursive: true });
    await fs.writeFile(archiveAbsolute, nextArchive);
    await fs.writeFile(absolute, removed.content);
    if (noteAbsolute) {
      try {
        const current = await fs.readFile(noteAbsolute, "utf8");
        const next = setFichaEstado(current, "done");
        if (next !== current) await fs.writeFile(noteAbsolute, next);
      } catch {
        // Sin ficha, el archive ya guarda la tarea.
      }
    }
  } else {
    const moved = moveTask(content, body.line, status);
    if (!moved.changed) return Response.json(await scanProject(project));
    await fs.writeFile(absolute, moved.content);
    const after = parseMarkdown(moved.content, body.file).find((entry) =>
      task.id ? entry.id === task.id : entry.title === task.title && entry.status === status,
    );
    const notePath = after ? fichaPath(after) : null;
    const noteAbsolute = notePath ? safeProjectFile(root, notePath) : null;
    if (noteAbsolute) {
      try {
        const note = await fs.readFile(noteAbsolute, "utf8");
        const next = setFichaEstado(note, status);
        if (next !== note) await fs.writeFile(noteAbsolute, next);
      } catch {
        // La ficha puede no existir todavía.
      }
    }
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  return Response.json(await scanProject(project));
}
