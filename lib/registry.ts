import fs from "node:fs/promises";
import path from "node:path";
import { isDirectory, isInside, resolveProjectPath } from "./paths";
import type { ProjectRecord } from "./types";

const dataDir = path.join(process.cwd(), "data");
const registryPath = path.join(dataDir, "projects.json");
const defaultsPath = path.join(dataDir, "default-projects.json");
const tokenPath = path.join(dataDir, "github-token");

let queue: Promise<unknown> = Promise.resolve();

function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function readJsonProjects(file: string): Promise<ProjectRecord[]> {
  const raw = await fs.readFile(file, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(isProjectRecord);
}

function isProjectRecord(value: unknown): value is ProjectRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as ProjectRecord;
  return (
    typeof record.id === "string" &&
    typeof record.name === "string" &&
    typeof record.path === "string" &&
    (record.github === null || typeof record.github === "string")
  );
}

export async function ensureRegistry(): Promise<ProjectRecord[]> {
  return locked(async () => {
    await fs.mkdir(dataDir, { recursive: true });
    try {
      await fs.access(registryPath);
    } catch {
      const defaults = await readJsonProjects(defaultsPath);
      await fs.writeFile(registryPath, `${JSON.stringify(defaults, null, 2)}\n`);
    }
    return readJsonProjects(registryPath);
  });
}

async function writeProjects(projects: ProjectRecord[]): Promise<void> {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(registryPath, `${JSON.stringify(projects, null, 2)}\n`);
}

export function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "proyecto";
}

function uniqueId(projects: ProjectRecord[], base: string): string {
  if (!projects.some((project) => project.id === base)) return base;
  let index = 2;
  while (projects.some((project) => project.id === `${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}

export async function addProject(input: {
  name?: string;
  path: string;
}): Promise<ProjectRecord> {
  const trimmed = input.path.trim();
  if (!trimmed) throw new Error("Write the folder path.");
  const absolute = resolveProjectPath(trimmed);
  if (!isDirectory(absolute)) {
    throw new Error("I can't find that folder. Check the path.");
  }

  return locked(async () => {
    const projects = await readExisting();
    const real = await fs.realpath(absolute);
    let duplicate: ProjectRecord | undefined;
    for (const project of projects) {
      try {
        const existing = await fs.realpath(resolveProjectPath(project.path));
        if (existing === real) {
          duplicate = project;
          break;
        }
      } catch {
        // La carpeta guardada ya no está.
      }
    }
    if (duplicate) {
      throw new Error(`${duplicate.name} is already on the board.`);
    }

    const name = input.name?.trim() || path.basename(real);
    const record: ProjectRecord = {
      id: uniqueId(projects, slugify(name)),
      name,
      path: real,
      github: null,
    };
    projects.push(record);
    await writeProjects(projects);
    return record;
  });
}

async function readExisting(): Promise<ProjectRecord[]> {
  try {
    await fs.access(registryPath);
  } catch {
    const defaults = await readJsonProjects(defaultsPath);
    await fs.writeFile(registryPath, `${JSON.stringify(defaults, null, 2)}\n`);
    return defaults;
  }
  return readJsonProjects(registryPath);
}

export async function removeProject(id: string): Promise<boolean> {
  return locked(async () => {
    const projects = await readExisting();
    const next = projects.filter((project) => project.id !== id);
    if (next.length === projects.length) return false;
    await writeProjects(next);
    return true;
  });
}

export async function updateGithub(
  id: string,
  github: string | null,
): Promise<ProjectRecord | null> {
  return locked(async () => {
    const projects = await readExisting();
    const project = projects.find((entry) => entry.id === id);
    if (!project) return null;
    project.github = github;
    await writeProjects(projects);
    return project;
  });
}

export async function getProject(id: string): Promise<ProjectRecord | null> {
  const projects = await ensureRegistry();
  return projects.find((project) => project.id === id) ?? null;
}

export async function restoreExamples(): Promise<ProjectRecord[]> {
  return locked(async () => {
    const projects = await readExisting();
    const defaults = await readJsonProjects(defaultsPath);
    for (const example of defaults) {
      if (!projects.some((project) => project.id === example.id)) {
        projects.push(example);
      }
    }
    await writeProjects(projects);
    return projects;
  });
}

export async function readGithubToken(): Promise<{
  token: string | null;
  source: "file" | "env" | null;
}> {
  try {
    const fileToken = (await fs.readFile(tokenPath, "utf8")).trim();
    if (fileToken) return { token: fileToken, source: "file" };
  } catch {
    // No hay token guardado desde la interfaz.
  }
  const envToken = process.env.GITHUB_TOKEN?.trim();
  if (envToken) return { token: envToken, source: "env" };
  return { token: null, source: null };
}

export async function writeGithubToken(token: string): Promise<void> {
  const trimmed = token.trim();
  await fs.mkdir(dataDir, { recursive: true });
  if (!trimmed) {
    await fs.rm(tokenPath, { force: true });
    return;
  }
  await fs.writeFile(tokenPath, `${trimmed}\n`, { mode: 0o600 });
  await fs.chmod(tokenPath, 0o600);
}

export function safeProjectFile(root: string, relativeFile: string): string | null {
  if (!relativeFile || relativeFile.includes("\0")) return null;
  const absolute = path.resolve(root, relativeFile);
  if (!isInside(root, absolute)) return null;
  return absolute;
}
