import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { TRACKED_BASENAMES, parseMarkdown } from "./markdown";
import { parseRepo } from "./github";
import { displayPath, isDirectory, isInside, resolveProjectPath } from "./paths";
import { loadArchiveTasks } from "./archive";
import { loadVersions } from "./versions";
import type {
  ProjectDetail,
  ProjectFile,
  ProjectRecord,
  ProjectSummary,
  Task,
  TaskStatus,
} from "./types";

const EMPTY_COUNTS: Record<TaskStatus, number> = {
  backlog: 0,
  doing: 0,
  done: 0,
  roadmap: 0,
  issue: 0,
};

const run = promisify(execFile);
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

async function originRepo(root: string): Promise<string | null> {
  try {
    const { stdout } = await run("git", ["-C", root, "remote", "get-url", "origin"], {
      timeout: 4000,
      windowsHide: true,
    });
    return parseRepo(String(stdout));
  } catch {
    return null;
  }
}

async function readConfig(root: string): Promise<{
  github: string | null;
  files: string[];
}> {
  try {
    const raw = await fs.readFile(path.join(root, "bitacora.json"), "utf8");
    const parsed = JSON.parse(raw) as { files?: unknown; github?: unknown };
    const files = Array.isArray(parsed.files)
      ? parsed.files.filter((entry): entry is string => typeof entry === "string")
      : [];
    const github = typeof parsed.github === "string" && REPO.test(parsed.github)
      ? parsed.github
      : null;
    return { github, files };
  } catch {
    return { github: null, files: [] };
  }
}

export async function discoverFiles(root: string): Promise<string[]> {
  const relativeFiles = new Set<string>();
  for (const name of TRACKED_BASENAMES) {
    relativeFiles.add(name);
    relativeFiles.add(`docs/${name}`);
  }

  const config = await readConfig(root);
  for (const entry of config.files) {
    const normalized = entry.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!normalized || normalized.includes("\0") || normalized.split("/").includes("..")) {
      continue;
    }
    relativeFiles.add(normalized);
  }

  const found: string[] = [];
  for (const relative of relativeFiles) {
    const absolute = path.resolve(root, relative);
    if (!isInside(root, absolute)) continue;
    try {
      const stat = await fs.stat(absolute);
      if (stat.isFile()) found.push(relative);
    } catch {
      // El archivo candidato no está en este proyecto.
    }
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function emptyDetail(project: ProjectRecord, error: string | null): ProjectDetail {
  return {
    id: project.id,
    name: project.name,
    path: displayPath(project.path),
    github: project.github,
    counts: { ...EMPTY_COUNTS },
    openCount: 0,
    files: [],
    highlights: [],
    error,
    updatedAt: new Date().toISOString(),
    tasks: [],
    githubTasks: [],
    githubError: null,
    githubTruncated: false,
    versions: [],
    versionsFile: null,
    archiveTasks: [],
    sourceRepo: project.github,
  };
}

export async function scanProject(project: ProjectRecord): Promise<ProjectDetail> {
  const root = resolveProjectPath(project.path);
  if (!isDirectory(root)) {
    return emptyDetail(project, "No encuentro la carpeta de este proyecto.");
  }

  try {
    const config = await readConfig(root);
    const relativeFiles = await discoverFiles(root);
    const tasks: Task[] = [];
    const files: ProjectFile[] = [];

    for (const relative of relativeFiles) {
      const absolute = path.resolve(root, relative);
      try {
        const stat = await fs.stat(absolute);
        const content = await fs.readFile(absolute, "utf8");
        files.push({ path: relative, mtime: stat.mtime.toISOString() });
        tasks.push(...parseMarkdown(content, relative));
      } catch {
        // Un archivo ilegible no tira el resto del proyecto.
      }
    }

    const counts = { ...EMPTY_COUNTS };
    for (const task of tasks) counts[task.status] += 1;
    const pool = tasks.some((task) => task.status === "doing")
      ? tasks.filter((task) => task.status === "doing")
      : tasks.filter((task) => task.status === "backlog");

    const latest = files.reduce<string>(
      (max, file) => (file.mtime > max ? file.mtime : max),
      "",
    );

    let timeline = { file: null as string | null, versions: [] as Awaited<ReturnType<typeof loadVersions>>["versions"] };
    try {
      timeline = await loadVersions(root);
    } catch {
      // Un VERSIONS.md ilegible no deja sin tareas al proyecto.
    }
    let archiveTasks: Awaited<ReturnType<typeof loadArchiveTasks>> = [];
    try {
      archiveTasks = await loadArchiveTasks(root, timeline.versions);
    } catch {
      // Un archive ilegible no deja sin tareas al proyecto.
    }

    const connected = project.github ?? config.github;
    const sourceRepo = connected ?? (await originRepo(root));

    return {
      ...emptyDetail(project, null),
      github: connected,
      counts,
      openCount: counts.backlog + counts.doing + counts.roadmap + counts.issue,
      files,
      highlights: pool.slice(0, 3).map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
      })),
      updatedAt: latest || new Date().toISOString(),
      tasks,
      versions: timeline.versions,
      versionsFile: timeline.file,
      archiveTasks,
      sourceRepo,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude leer el proyecto.";
    return emptyDetail(project, message);
  }
}

export function toSummary(detail: ProjectDetail): ProjectSummary {
  return {
    id: detail.id,
    name: detail.name,
    path: detail.path,
    github: detail.github,
    counts: detail.counts,
    openCount: detail.openCount,
    files: detail.files,
    highlights: detail.highlights,
    error: detail.error,
    updatedAt: detail.updatedAt,
  };
}
