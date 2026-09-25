import { readGithubToken } from "./registry";
import type { Priority, Task } from "./types";

interface GithubLabel {
  name?: string;
}

interface GithubIssue {
  number: number;
  title: string;
  state: string;
  html_url: string;
  body: string | null;
  pull_request?: unknown;
  labels?: Array<string | GithubLabel>;
}

interface GithubResult {
  tasks: Task[];
  error: string | null;
  truncated: boolean;
}

const cache = new Map<string, GithubResult & { at: number }>();
const TTL_MS = 60_000;

export function parseRepo(input: string): string | null {
  const trimmed = input.trim().replace(/\.git$/, "").replace(/\/$/, "");
  if (!trimmed) return null;
  const fromUrl = trimmed.match(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)$/i);
  if (fromUrl) return fromUrl[1];
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trimmed)) return trimmed;
  return null;
}

export function clearGithubCache(repo?: string) {
  if (repo) cache.delete(repo);
  else cache.clear();
}

function labelNames(issue: GithubIssue): string[] {
  return (issue.labels ?? [])
    .map((label) => (typeof label === "string" ? label : label.name ?? ""))
    .filter(Boolean);
}

function priorityFromLabels(labels: string[]): Priority | null {
  const folded = labels.map((label) => label.toLowerCase());
  if (folded.some((label) => /alta|p0|priority:\s*high|priority\/high/.test(label))) {
    return "alta";
  }
  if (folded.some((label) => /media|p1|priority:\s*medium|priority\/medium/.test(label))) {
    return "media";
  }
  if (folded.some((label) => /baja|p2|priority:\s*low|priority\/low/.test(label))) {
    return "baja";
  }
  return null;
}

function mapIssue(issue: GithubIssue): Task {
  const labels = labelNames(issue);
  const doing = labels.some((label) => /in progress|en curso|doing|wip/i.test(label));
  return {
    key: `github:${issue.number}`,
    id: `#${issue.number}`,
    title: issue.title,
    status: doing ? "doing" : "backlog",
    priority: priorityFromLabels(labels),
    tags: labels.slice(0, 3),
    source: "github",
    file: null,
    line: null,
    checked: issue.state === "closed",
    toggleable: false,
    body: (issue.body ?? "").trim().slice(0, 280),
    url: issue.html_url,
  };
}

export async function fetchGithubIssues(
  repo: string,
  refresh = false,
): Promise<GithubResult> {
  const cached = cache.get(repo);
  if (!refresh && cached && Date.now() - cached.at < TTL_MS) {
    return {
      tasks: cached.tasks,
      error: cached.error,
      truncated: cached.truncated,
    };
  }

  const { token } = await readGithubToken();
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "bitacora-local",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/issues?state=open&per_page=30&sort=updated`,
      { headers, signal: AbortSignal.timeout(8000) },
    );

    if (response.status === 404) {
      const result = {
        tasks: [],
        error: "GitHub no encuentra ese repositorio, o es privado y falta un token.",
        truncated: false,
      };
      cache.set(repo, { ...result, at: Date.now() });
      return result;
    }

    if (response.status === 401 || response.status === 403) {
      const limited = response.headers.get("x-ratelimit-remaining") === "0";
      const result = {
        tasks: [],
        error: limited
          ? "GitHub ha limitado las peticiones. Añade un token o espera un poco."
          : "GitHub ha rechazado el acceso. Revisa el token o si el repositorio es privado.",
        truncated: false,
      };
      cache.set(repo, { ...result, at: Date.now() });
      return result;
    }

    if (!response.ok) {
      const result = {
        tasks: [],
        error: `GitHub respondió con un error ${response.status}.`,
        truncated: false,
      };
      cache.set(repo, { ...result, at: Date.now() });
      return result;
    }

    const payload = (await response.json()) as GithubIssue[];
    const tasks = payload.filter((issue) => !issue.pull_request).map(mapIssue);
    const result = {
      tasks,
      error: null,
      truncated: payload.length >= 30,
    };
    cache.set(repo, { ...result, at: Date.now() });
    return result;
  } catch {
    return {
      tasks: [],
      error: "No pude conectar con GitHub.",
      truncated: false,
    };
  }
}
