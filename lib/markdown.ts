import type { NewTaskInput, Priority, Task, TaskStatus } from "./types";

export const TRACKED_BASENAMES = [
  "BACKLOG.md",
  "ROADMAP.md",
  "KNOWN_ISSUES.md",
  "TASKS.md",
  "TODO.md",
  "ISSUES.md",
] as const;

const FILE_DEFAULT: Record<string, TaskStatus> = {
  "backlog.md": "backlog",
  "tasks.md": "backlog",
  "todo.md": "backlog",
  "roadmap.md": "roadmap",
  "known_issues.md": "issue",
  "issues.md": "issue",
};

const STATUS_LABELS: Record<string, TaskStatus> = {
  backlog: "backlog",
  pendiente: "backlog",
  pendientes: "backlog",
  "por hacer": "backlog",
  todo: "backlog",
  ideas: "backlog",
  "sin empezar": "backlog",
  "en curso": "doing",
  "en progreso": "doing",
  haciendo: "doing",
  doing: "doing",
  "in progress": "doing",
  wip: "doing",
  ahora: "doing",
  hecho: "done",
  hecha: "done",
  hechos: "done",
  hechas: "done",
  done: "done",
  completado: "done",
  completados: "done",
  completadas: "done",
  cerrado: "done",
  cerrados: "done",
  cerradas: "done",
  roadmap: "roadmap",
  hitos: "roadmap",
  milestones: "roadmap",
  "mas adelante": "roadmap",
  issues: "issue",
  issue: "issue",
  bugs: "issue",
  problemas: "issue",
  "known issues": "issue",
  "problemas conocidos": "issue",
  errores: "issue",
};

export const SECTION_TITLES: Record<TaskStatus, string> = {
  backlog: "Pendiente",
  doing: "En curso",
  done: "Hecho",
  roadmap: "Roadmap",
  issue: "Problemas",
};

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function defaultStatusForFile(fileName: string): TaskStatus {
  const base = fileName.split(/[/\\]/).pop()?.toLowerCase() ?? "";
  return FILE_DEFAULT[base] ?? "backlog";
}

export function statusFromLabel(value: string): TaskStatus | null {
  const folded = fold(value)
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[:.]+$/, "")
    .trim();
  return STATUS_LABELS[folded] ?? null;
}

export function splitId(raw: string): { id: string | null; title: string } {
  const text = raw.trim();
  const hash = text.match(/^#(\d+)\s+(.+)$/);
  if (hash) return { id: `#${hash[1]}`, title: hash[2].trim() };

  const id = text.match(
    /^(?:\[|\*\*)?([A-Za-z][A-Za-z0-9]*-\d+)(?:\]|\*\*)?\s*[:—–-]?\s*(.*)$/,
  );
  if (id) {
    const ticket = id[1].toUpperCase();
    const title = id[2].trim();
    return { id: ticket, title: title || ticket };
  }
  return { id: null, title: text };
}

export function priorityFromText(text: string): Priority | null {
  const folded = fold(text);
  const labeled = folded.match(/prioridad\s*[:=]\s*(alta|media|baja)/);
  if (labeled) return labeled[1] as Priority;

  const english = folded.match(/priority\s*[:=]\s*(high|medium|low)/);
  if (english) {
    const map = { high: "alta", medium: "media", low: "baja" } as const;
    return map[english[1] as keyof typeof map];
  }

  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const value = fold(match[1]);
    if (value === "alta" || value === "media" || value === "baja") return value;
  }
  return null;
}

export function tagsFromText(text: string): string[] {
  const tags = new Set<string>();
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const value = match[1].trim();
    const folded = fold(value);
    if (["alta", "media", "baja", "high", "medium", "low"].includes(folded)) {
      continue;
    }
    if (value.length > 32) continue;
    tags.add(value);
  }
  const area = text.match(/(?:área|area)\s*[:=]\s*([^\n]+)/i);
  if (area) {
    const value = area[1].replace(/^[-*\s]+/, "").trim();
    if (value) tags.add(value);
  }
  return [...tags].slice(0, 4);
}

function statusFromBody(body: string): TaskStatus | null {
  for (const line of body.split("\n")) {
    const match = fold(line).match(/^(?:[-*]\s*)?estado\s*[:=]\s*(.+)$/);
    if (!match) continue;
    return statusFromLabel(match[1]);
  }
  return null;
}

function looksLikeTicketHeading(text: string): boolean {
  return splitId(text).id !== null && splitId(text).title !== text.trim();
}

export function parseMarkdown(content: string, file: string): Task[] {
  const lines = content.split(/\r?\n/);
  const fileStatus = defaultStatusForFile(file);
  let section: TaskStatus = fileStatus;
  const tasks: Task[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const text = heading[2].trim();
      const asStatus = statusFromLabel(text);
      if (asStatus) {
        section = asStatus;
        continue;
      }
      if (!looksLikeTicketHeading(text)) continue;

      const level = heading[1].length;
      const bodyLines: string[] = [];
      for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
        const nextHeading = (lines[cursor] ?? "").match(/^(#{1,6})\s+/);
        if (nextHeading && nextHeading[1].length <= level) break;
        bodyLines.push(lines[cursor] ?? "");
      }
      if (bodyLines.some((entry) => /^\s*[-*]\s+\[[ xX]\]/.test(entry))) {
        continue;
      }

      const body = bodyLines.join("\n").trim();
      const parsed = splitId(text);
      const blob = `${text}\n${body}`;
      tasks.push({
        key: `${file}:h:${index + 1}`,
        id: parsed.id,
        title: parsed.title,
        status: statusFromBody(body) ?? fileStatus,
        priority: priorityFromText(blob),
        tags: tagsFromText(blob),
        source: "markdown",
        file,
        line: index + 1,
        checked: false,
        toggleable: false,
        body,
        url: null,
      });
      continue;
    }

    const box = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*?)\s*$/);
    if (!box) continue;

    const indent = box[1].length;
    const checked = box[2].toLowerCase() === "x";
    const bodyLines: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor] ?? "";
      if (/^\s*[-*]\s+\[[ xX]\]/.test(next)) break;
      if (next.trim() === "") {
        const look = lines[cursor + 1];
        if (look === undefined || look.trim() === "") break;
        const lookIndent = look.match(/^ */)?.[0].length ?? 0;
        if (lookIndent <= indent) break;
        bodyLines.push(next);
        continue;
      }
      const nextIndent = next.match(/^ */)?.[0].length ?? 0;
      if (nextIndent <= indent) break;
      bodyLines.push(next);
    }

    const body = bodyLines.join("\n").trim();
    const parsed = splitId(box[3]);
    const blob = `${box[3]}\n${body}`;
    let status = statusFromBody(body) ?? section;
    if (checked) status = "done";

    tasks.push({
      key: `${file}:${index + 1}`,
      id: parsed.id,
      title: parsed.title,
      status,
      priority: priorityFromText(blob),
      tags: tagsFromText(blob),
      source: "markdown",
      file,
      line: index + 1,
      checked,
      toggleable: true,
      body,
      url: null,
    });
  }

  return tasks;
}

export function toggleCheckbox(
  content: string,
  line: number,
): { content: string; changed: boolean } {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const endsWithNewline = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (endsWithNewline && lines.at(-1) === "") lines.pop();

  const current = lines[line - 1];
  if (current === undefined) return { content, changed: false };
  const match = current.match(/^(\s*[-*]\s+\[)([ xX])(\].*)$/);
  if (!match) return { content, changed: false };

  const next = match[2].toLowerCase() === "x" ? " " : "x";
  lines[line - 1] = `${match[1]}${next}${match[3]}`;
  const joined = lines.join(newline);
  return {
    content: endsWithNewline ? `${joined}${newline}` : joined,
    changed: true,
  };
}

function taskBlock(input: NewTaskInput): string[] {
  const checked = input.status === "done" ? "x" : " ";
  const ticket = input.ticketId?.trim();
  const title = input.title.trim();
  const head = ticket ? `- [${checked}] ${ticket.toUpperCase()} ${title}` : `- [${checked}] ${title}`;
  const lines = [head];
  if (input.priority) lines.push(`  - prioridad: ${input.priority}`);
  return lines;
}

export function insertTask(content: string, input: NewTaskInput): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  let source = content;
  if (!source.trim()) {
    source = [
      "# Backlog",
      "",
      "## En curso",
      "",
      "## Pendiente",
      "",
      "## Hecho",
      "",
    ].join(newline);
  }

  const lines = source.split(/\r?\n/);
  const block = taskBlock(input);
  const headingIndex = lines.findIndex((line) => {
    const match = line.match(/^#{2,6}\s+(.+?)\s*#*\s*$/);
    if (!match) return false;
    return statusFromLabel(match[1].trim()) === input.status;
  });

  if (headingIndex === -1) {
    const addition = ["", `## ${SECTION_TITLES[input.status]}`, "", ...block, ""];
    const base = lines.join(newline).replace(new RegExp(`${newline}*$`), "");
    return `${base}${newline}${addition.join(newline)}${newline}`;
  }

  let insertAt = headingIndex + 1;
  if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  lines.splice(insertAt, 0, ...block);
  const hadTrailing = /\n$/.test(source) || source.endsWith("\r\n");
  const joined = lines.join(newline);
  if (hadTrailing && !joined.endsWith(newline)) return `${joined}${newline}`;
  return joined;
}

export const BACKLOG_TEMPLATE = `# Backlog

## En curso

## Pendiente

## Hecho
`;
