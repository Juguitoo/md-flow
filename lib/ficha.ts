import type { Task, TaskStatus } from "./types";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export const FICHA_SECTIONS = [
  { id: "problema", title: "Problema", label: "Problem" },
  { id: "decision", title: "Decisión", label: "Decision" },
  { id: "durante", title: "Durante el desarrollo", label: "During development" },
  { id: "resolucion", title: "Resolución", label: "Resolution" },
] as const;

export type FichaSectionId = (typeof FICHA_SECTIONS)[number]["id"];

export type FichaSections = Record<FichaSectionId, string>;

export interface FichaExtra {
  title: string;
  body: string;
}

const ESTADO: Record<TaskStatus, string> = {
  backlog: "pendiente",
  doing: "en curso",
  done: "hecho",
  roadmap: "roadmap",
  issue: "problema",
};

export function emptySections(): FichaSections {
  return { problema: "", decision: "", durante: "", resolucion: "" };
}

export function fichaCandidates(archiveFile: string, id: string): string[] {
  if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(id)) return [];
  const normalized = archiveFile.replace(/\\/g, "/");
  const paths: string[] = [];
  const nested = normalized.match(/^(.*)\/archive\/[^/]+$/);
  if (nested) paths.push(`${nested[1]}/tasks/${id}.md`);
  else if (/^archive\/[^/]+$/.test(normalized)) paths.push(`tasks/${id}.md`);
  for (const extra of [`docs/tasks/${id}.md`, `tasks/${id}.md`]) {
    if (!paths.includes(extra)) paths.push(extra);
  }
  return paths;
}

export function fichaPath(task: Pick<Task, "file" | "ref">): string | null {
  const ref = task.ref?.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!ref || !ref.toLowerCase().endsWith(".md")) return null;
  if (ref.startsWith("/") || ref.split("/").includes("..")) return null;
  if (task.file?.includes("/")) {
    const dir = task.file.slice(0, task.file.lastIndexOf("/") + 1);
    return `${dir}${ref}`.replace(/\/{2,}/g, "/");
  }
  return ref;
}

export function defaultFichaFile(taskFile: string, id: string): string | null {
  if (!/^[A-Za-z][A-Za-z0-9]*-\d+$/.test(id)) return null;
  const dir = taskFile.includes("/") ? taskFile.slice(0, taskFile.lastIndexOf("/")) : "";
  return dir ? `${dir}/tasks/${id}.md` : `tasks/${id}.md`;
}

export function refFromFiles(taskFile: string, fichaFile: string): string {
  const dir = taskFile.includes("/") ? taskFile.slice(0, taskFile.lastIndexOf("/") + 1) : "";
  if (dir && fichaFile.startsWith(dir)) return fichaFile.slice(dir.length);
  return fichaFile;
}

function sectionId(title: string): FichaSectionId | null {
  const folded = fold(title);
  return FICHA_SECTIONS.find((section) => fold(section.title) === folded)?.id ?? null;
}

export function parseFicha(content: string): {
  preamble: string;
  sections: FichaSections;
  extras: FichaExtra[];
} {
  const sections = emptySections();
  const extras: FichaExtra[] = [];
  const preamble: string[] = [];
  let current: { id: FichaSectionId | null; title: string; lines: string[] } | null = null;

  function flush() {
    if (!current) return;
    const body = current.lines.join("\n").trim();
    if (current.id) sections[current.id] = body;
    else extras.push({ title: current.title, body });
  }

  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^##(?!#)\s+(.+?)\s*$/);
    if (heading) {
      flush();
      current = { id: sectionId(heading[1]), title: heading[1].trim(), lines: [] };
      continue;
    }
    if (!current) preamble.push(line);
    else current.lines.push(line);
  }
  flush();

  return { preamble: preamble.join("\n").trim(), sections, extras };
}

export function renderFicha(
  preamble: string,
  sections: FichaSections,
  extras: FichaExtra[] = [],
): string {
  const parts = [preamble.trimEnd()];
  for (const section of FICHA_SECTIONS) {
    parts.push("", `## ${section.title}`, "", sections[section.id].trimEnd());
  }
  for (const extra of extras) {
    parts.push("", `## ${extra.title}`, "", extra.body.trimEnd());
  }
  return `${parts.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function fichaPreamble(input: {
  id: string;
  title: string;
  version: string | null;
  taskType: string | null;
  status: TaskStatus;
}): string {
  const lines = [`# ${input.id} — ${input.title}`, "", `- estado: ${ESTADO[input.status]}`];
  if (input.version) lines.push(`- version: ${input.version}`);
  if (input.taskType) lines.push(`- tipo: ${input.taskType}`);
  return lines.join("\n");
}

export function setFichaEstado(content: string, status: TaskStatus): string {
  const label = ESTADO[status];
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();

  for (let index = 0; index < lines.length; index += 1) {
    if (/^##(?!#)\s+/.test(lines[index] ?? "")) break;
    const match = (lines[index] ?? "").match(/^(\s*(?:[-*]\s+)?)estado\s*[:=]\s*.+$/i);
    if (!match) continue;
    lines[index] = `${match[1]}estado: ${label}`;
    const joined = lines.join(newline);
    return trailing ? `${joined}${newline}` : joined;
  }
  return content;
}
