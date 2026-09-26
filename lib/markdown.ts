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

export function metaFromBody(body: string): {
  version: string | null;
  taskType: string | null;
  ref: string | null;
} {
  let version: string | null = null;
  let taskType: string | null = null;
  let ref: string | null = null;
  for (const line of body.split("\n")) {
    const match = line.match(/^\s*(?:[-*]\s+)?(version|tipo|type|ref)\s*[:=]\s*(.+?)\s*$/i);
    if (!match) continue;
    const value = match[2].trim();
    if (!value || value.length > 160) continue;
    const key = match[1].toLowerCase();
    if (key === "version") version = value;
    else if (key === "tipo" || key === "type") taskType = value;
    else ref = value;
  }
  return { version, taskType, ref };
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
      const meta = metaFromBody(body);
      tasks.push({
        key: `${file}:h:${index + 1}`,
        id: parsed.id,
        title: parsed.title,
        status: statusFromBody(body) ?? fileStatus,
        priority: priorityFromText(blob),
        version: meta.version,
        taskType: meta.taskType,
        ref: meta.ref,
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
    const meta = metaFromBody(body);
    let status = statusFromBody(body) ?? section;
    if (checked) status = "done";

    tasks.push({
      key: `${file}:${index + 1}`,
      id: parsed.id,
      title: parsed.title,
      status,
      priority: priorityFromText(blob),
      version: meta.version,
      taskType: meta.taskType,
      ref: meta.ref,
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

const MOVABLE: TaskStatus[] = ["backlog", "doing", "done"];

function splitDocument(content: string): {
  newline: string;
  lines: string[];
  trailing: boolean;
} {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  return { newline, lines, trailing };
}

function joinDocument(lines: string[], newline: string, trailing: boolean): string {
  const joined = lines.join(newline);
  if (trailing && !joined.endsWith(newline)) return `${joined}${newline}`;
  return joined;
}

function isStatusHeading(line: string): boolean {
  return /^##(?!#)\s+/.test(line);
}

function taskBlockEnd(lines: string[], index: number): number {
  const current = lines[index] ?? "";
  const box = current.match(/^(\s*)[-*]\s+\[[ xX]\]/);
  if (!box) return index;
  const indent = box[1].length;
  let end = index + 1;
  while (end < lines.length) {
    const next = lines[end] ?? "";
    if (/^\s*[-*]\s+\[[ xX]\]/.test(next)) break;
    if (next.trim() === "") {
      const look = lines[end + 1];
      if (look === undefined || look.trim() === "") break;
      const lookIndent = look.match(/^ */)?.[0].length ?? 0;
      if (lookIndent <= indent) break;
      end += 1;
      continue;
    }
    const nextIndent = next.match(/^ */)?.[0].length ?? 0;
    if (nextIndent <= indent) break;
    end += 1;
  }
  return end;
}

function sectionAt(lines: string[], index: number): TaskStatus | null {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (!isStatusHeading(lines[cursor] ?? "")) continue;
    const match = (lines[cursor] ?? "").match(/^##\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    return statusFromLabel(match[1].trim());
  }
  return null;
}

function headingIndex(lines: string[], status: TaskStatus): number {
  return lines.findIndex((line) => {
    if (!isStatusHeading(line)) return false;
    const match = line.match(/^##\s+(.+?)\s*#*\s*$/);
    if (!match) return false;
    return statusFromLabel(match[1].trim()) === status;
  });
}

export function moveTask(
  content: string,
  line: number,
  status: TaskStatus,
): { content: string; changed: boolean } {
  if (!MOVABLE.includes(status)) return { content, changed: false };
  const { newline, lines, trailing } = splitDocument(content);
  const index = line - 1;
  const current = lines[index];
  if (current === undefined || !/^\s*[-*]\s+\[[ xX]\]/.test(current)) {
    return { content, changed: false };
  }

  const checked = /\[[xX]\]/.test(current);
  if (sectionAt(lines, index) === status && checked === (status === "done")) {
    return { content, changed: false };
  }

  const end = taskBlockEnd(lines, index);
  const block = lines.slice(index, end);
  block[0] = block[0].replace(
    /^(\s*[-*]\s+\[)[ xX](\])/,
    status === "done" ? "$1x$2" : "$1 $2",
  );
  lines.splice(index, end - index);

  let heading = headingIndex(lines, status);
  if (heading === -1) {
    const addition = ["", `## ${SECTION_TITLES[status]}`, "", ...block, ""];
    const base = joinDocument(lines, newline, false).replace(new RegExp(`${newline}*$`), "");
    return {
      content: `${base}${newline}${addition.join(newline)}${newline}`,
      changed: true,
    };
  }

  const version = metaFromBody(block.slice(1).join("\n")).version;
  let insertAt = heading + 1;
  if (status === "backlog" && version) {
    let sectionEnd = lines.length;
    for (let cursor = heading + 1; cursor < lines.length; cursor += 1) {
      if (isStatusHeading(lines[cursor] ?? "")) {
        sectionEnd = cursor;
        break;
      }
    }
    for (let cursor = heading + 1; cursor < sectionEnd; cursor += 1) {
      const match = (lines[cursor] ?? "").match(/^###\s+(.+)$/);
      if (match && match[1].includes(version)) {
        insertAt = cursor + 1;
        break;
      }
    }
  }
  if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  const needsBlank = (lines[insertAt] ?? "").trim() !== "";
  lines.splice(insertAt, 0, ...block, ...(needsBlank ? [""] : []));
  return { content: joinDocument(lines, newline, trailing), changed: true };
}

function isTaskLine(line: string | undefined): boolean {
  return /^\s*[-*]\s+\[[ xX]\]/.test(line ?? "");
}

function taskVersionAt(lines: string[], index: number): string | null {
  return metaFromBody(lines.slice(index + 1, taskBlockEnd(lines, index)).join("\n")).version;
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export function reorderTask(
  content: string,
  fromLine: number,
  toLine: number,
): { content: string; changed: boolean } {
  if (fromLine === toLine) return { content, changed: false };
  const { newline, lines, trailing } = splitDocument(content);
  const from = fromLine - 1;
  const to = toLine - 1;
  if (!isTaskLine(lines[from]) || !isTaskLine(lines[to])) {
    return { content, changed: false };
  }
  const status = sectionAt(lines, from);
  if (!status || status !== sectionAt(lines, to)) return { content, changed: false };
  if (status === "backlog" && taskVersionAt(lines, from) !== taskVersionAt(lines, to)) {
    return { content, changed: false };
  }

  const indexes: number[] = [];
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    if (!isTaskLine(lines[cursor])) continue;
    if (sectionAt(lines, cursor) !== status) continue;
    if (status === "backlog" && taskVersionAt(lines, cursor) !== taskVersionAt(lines, from)) continue;
    indexes.push(cursor);
  }
  const fromPos = indexes.indexOf(from);
  const toPos = indexes.indexOf(to);
  if (fromPos < 0 || toPos < 0 || fromPos === toPos) return { content, changed: false };

  const ranges = indexes.map((index) => ({ start: index, end: taskBlockEnd(lines, index) }));
  const blocks = ranges.map((range) => lines.slice(range.start, range.end));
  const moved = arrayMove(blocks, fromPos, toPos);
  const pairs = ranges
    .map((range, index) => ({ range, block: moved[index] ?? [] }))
    .sort((left, right) => right.range.start - left.range.start);
  for (const pair of pairs) {
    lines.splice(pair.range.start, pair.range.end - pair.range.start, ...pair.block);
  }
  const next = joinDocument(lines, newline, trailing);
  return { content: next, changed: next !== content };
}

export function removeTask(
  content: string,
  line: number,
): { content: string; changed: boolean } {
  const { newline, lines, trailing } = splitDocument(content);
  const index = line - 1;
  if (lines[index] === undefined || !/^\s*[-*]\s+\[[ xX]\]/.test(lines[index] ?? "")) {
    return { content, changed: false };
  }
  const end = taskBlockEnd(lines, index);
  lines.splice(index, end - index);
  return { content: joinDocument(lines, newline, trailing), changed: true };
}

export function setTaskVersion(
  content: string,
  line: number,
  version: string | null,
): { content: string; changed: boolean } {
  const nextVersion = version?.trim() || null;
  const { newline, lines, trailing } = splitDocument(content);
  const index = line - 1;
  if (lines[index] === undefined || !/^\s*[-*]\s+\[[ xX]\]/.test(lines[index] ?? "")) {
    return { content, changed: false };
  }
  const end = taskBlockEnd(lines, index);
  const block = withVersionLine(lines.slice(index, end), nextVersion);
  const status = sectionAt(lines, index);
  lines.splice(index, end - index);
  if (status === "backlog") {
    const heading = headingIndex(lines, "backlog");
    if (heading !== -1) pruneEmptyGroups(lines, heading);
    placeBacklogBlock(lines, block, nextVersion);
  } else {
    lines.splice(index, 0, ...block);
  }
  const next = joinDocument(lines, newline, trailing);
  return { content: next, changed: next !== content };
}

function withVersionLine(block: string[], version: string | null): string[] {
  const next = [...block];
  const found = next.findIndex((entry) => /^\s*(?:[-*]\s+)?version\s*[:=]/i.test(entry));
  if (!version) {
    if (found !== -1) next.splice(found, 1);
    return next;
  }
  if (found !== -1) {
    next[found] = next[found].replace(/version\s*[:=]\s*.+$/i, `version: ${version}`);
    return next;
  }
  next.splice(1, 0, `  - version: ${version}`);
  return next;
}

function pruneEmptyGroups(lines: string[], heading: number) {
  let sectionEnd = lines.length;
  for (let cursor = heading + 1; cursor < lines.length; cursor += 1) {
    if (isStatusHeading(lines[cursor] ?? "")) {
      sectionEnd = cursor;
      break;
    }
  }
  const ranges: Array<[number, number]> = [];
  for (let cursor = heading + 1; cursor < sectionEnd; cursor += 1) {
    if (!/^###\s+/.test(lines[cursor] ?? "")) continue;
    let end = cursor + 1;
    let hasTask = false;
    for (; end < sectionEnd; end += 1) {
      if (/^###\s+/.test(lines[end] ?? "") || isStatusHeading(lines[end] ?? "")) break;
      if (/^\s*[-*]\s+\[[ xX]\]/.test(lines[end] ?? "")) hasTask = true;
    }
    if (!hasTask) ranges.push([cursor, end]);
    cursor = end - 1;
  }
  for (const [start, end] of ranges.reverse()) lines.splice(start, end - start);
}

function placeBacklogBlock(lines: string[], block: string[], version: string | null) {
  let heading = headingIndex(lines, "backlog");
  if (heading === -1) {
    if (lines.length > 0 && lines.at(-1)?.trim() !== "") lines.push("");
    lines.push("## Pendiente", "");
    heading = lines.length - 2;
  }
  let sectionEnd = lines.length;
  for (let cursor = heading + 1; cursor < lines.length; cursor += 1) {
    if (isStatusHeading(lines[cursor] ?? "")) {
      sectionEnd = cursor;
      break;
    }
  }
  let insertAt = heading + 1;
  if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  if (version) {
    let versionHeading = -1;
    for (let cursor = heading + 1; cursor < sectionEnd; cursor += 1) {
      const match = (lines[cursor] ?? "").match(/^###\s+(.+)$/);
      if (match && match[1].includes(version)) {
        versionHeading = cursor;
        break;
      }
    }
    if (versionHeading === -1) {
      lines.splice(insertAt, 0, `### ${version}`, "");
      insertAt += 2;
    } else {
      insertAt = versionHeading + 1;
      if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
    }
  }
  lines.splice(insertAt, 0, ...block);
  if ((lines[insertAt + block.length] ?? "").trim() !== "") {
    lines.splice(insertAt + block.length, 0, "");
  }
}

export function ensureTaskRef(
  content: string,
  line: number,
  ref: string,
): { content: string; changed: boolean } {
  if (!ref || ref.includes("\n") || ref.includes("\r")) return { content, changed: false };
  const { newline, lines, trailing } = splitDocument(content);
  const index = line - 1;
  if (lines[index] === undefined || !/^\s*[-*]\s+\[[ xX]\]/.test(lines[index] ?? "")) {
    return { content, changed: false };
  }
  const end = taskBlockEnd(lines, index);
  for (let cursor = index + 1; cursor < end; cursor += 1) {
    const match = (lines[cursor] ?? "").match(/^(\s*[-*]\s+ref\s*[:=]\s*)(.+)$/i);
    if (!match) continue;
    if (match[2].trim() === ref) return { content, changed: false };
    lines[cursor] = `${match[1]}${ref}`;
    return { content: joinDocument(lines, newline, trailing), changed: true };
  }
  lines.splice(end, 0, `  - ref: ${ref}`);
  return { content: joinDocument(lines, newline, trailing), changed: true };
}

function taskBlock(input: NewTaskInput): string[] {
  const checked = input.status === "done" ? "x" : " ";
  const ticket = input.ticketId?.trim();
  const title = input.title.trim();
  const head = ticket ? `- [${checked}] ${ticket.toUpperCase()} ${title}` : `- [${checked}] ${title}`;
  const lines = [head];
  if (input.version?.trim()) lines.push(`  - version: ${input.version.trim()}`);
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
  const version = input.version?.trim();
  if (input.status === "backlog" && version) {
    let sectionEnd = lines.length;
    for (let cursor = headingIndex + 1; cursor < lines.length; cursor += 1) {
      if (isStatusHeading(lines[cursor] ?? "")) {
        sectionEnd = cursor;
        break;
      }
    }
    let versionHeading = -1;
    for (let cursor = headingIndex + 1; cursor < sectionEnd; cursor += 1) {
      const match = (lines[cursor] ?? "").match(/^###\s+(.+)$/);
      if (match && match[1].includes(version)) {
        versionHeading = cursor;
        break;
      }
    }
    if (versionHeading === -1) {
      lines.splice(insertAt, 0, `### ${version}`, "");
      insertAt += 2;
    } else {
      insertAt = versionHeading + 1;
      if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
    }
  }
  lines.splice(insertAt, 0, ...block);
  if ((lines[insertAt + block.length] ?? "").trim() !== "") {
    lines.splice(insertAt + block.length, 0, "");
  }
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
