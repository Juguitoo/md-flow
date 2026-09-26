import fs from "node:fs/promises";
import path from "node:path";
import type { ArchiveTask, VersionEntry } from "./types";

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

type Column = "id" | "title" | "type" | "commits" | "legacy" | "note" | "severity";

export const ARCHIVE_HEADER = "| ID | Tarea | Tipo | Commits | Comentario / resolución |";
export const ARCHIVE_RULE = "|----|-------|------|---------|-------------------------|";

function columnRole(header: string): Column | null {
  const folded = fold(header).replace(/[.:]+$/g, "");
  if (folded === "id") return "id";
  if (folded === "tarea" || folded === "titulo") return "title";
  if (folded === "tipo") return "type";
  if (folded === "commits" || folded === "commit") return "commits";
  if (folded.startsWith("commit")) return "legacy";
  if (folded === "sev" || folded === "severidad") return "severity";
  if (folded === "comentario" || folded.includes("resolucion") || folded === "que se hizo") {
    return "note";
  }
  return null;
}

function cellsOf(row: string): string[] {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparator(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function parseArchiveTasks(content: string, version: VersionEntry): ArchiveTask[] {
  if (!version.archive) return [];
  const lines = content.split(/\r?\n/);
  const tasks: ArchiveTask[] = [];
  let index = 0;

  while (index < lines.length) {
    if (!(lines[index] ?? "").trim().startsWith("|")) {
      index += 1;
      continue;
    }
    const table: string[][] = [];
    while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
      const cells = cellsOf(lines[index] ?? "");
      if (!isSeparator(cells)) table.push(cells);
      index += 1;
    }
    const header = table[0];
    if (!header) continue;
    const roles = header.map(columnRole);
    if (!roles.includes("id") || !roles.includes("title")) continue;

    for (const row of table.slice(1)) {
      let id = "";
      let title = "";
      let taskType: string | null = null;
      let severity = "";
      const commitCells: string[] = [];
      const notes: string[] = [];
      roles.forEach((role, cell) => {
        const value = row[cell]?.trim() ?? "";
        if (!value) return;
        if ((value === "—" || value === "-") && role !== "id" && role !== "title") return;
        if (role === "id") id = value;
        else if (role === "title") title = value;
        else if (role === "type") taskType = value;
        else if (role === "severity") severity = value;
        else if (role === "commits" || role === "legacy") {
          commitCells.push(value);
          const prose = stripHashes(value);
          if (prose) notes.push(prose);
        } else if (role === "note") notes.push(value);
      });
      if (!id || !title) continue;
      const comment = [severity, ...notes].filter(Boolean).join(". ").replace(/\.\s*\./g, ".");
      tasks.push({
        key: `${version.archive}:${id}`,
        id,
        title,
        taskType,
        commits: extractCommitHashes(commitCells.join(" ")).join(" "),
        note: comment,
        version: version.id,
        versionTitle: version.title,
        file: version.archive,
      });
    }
  }

  return tasks;
}

function extractCommitHashes(value: string): string[] {
  const seen = new Set<string>();
  const hashes: string[] = [];
  for (const match of value.match(/\b[0-9a-f]{7,40}\b/gi) ?? []) {
    const hash = match.toLowerCase();
    if (seen.has(hash)) continue;
    seen.add(hash);
    hashes.push(hash);
  }
  return hashes;
}

function stripHashes(value: string): string {
  return value
    .replace(/`[0-9a-f]{7,40}`/gi, " ")
    .replace(/\b[0-9a-f]{7,40}\b/gi, " ")
    .replace(/\s*[,;]\s*(?=[,;])/g, " ")
    .replace(/^[\s,;.—–-]+|[\s,;.—–-]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatCommits(commits: string): string {
  return extractCommitHashes(commits)
    .map((hash) => `\`${hash}\``)
    .join(" ");
}

function plainCell(value: string): string {
  return value.replace(/\|/g, "/").replace(/\s*\n\s*/g, " ").trim();
}

export function standardizeArchive(content: string): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.split(/\r?\n/);
  const next: string[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!(lines[index] ?? "").trim().startsWith("|")) {
      next.push(lines[index] ?? "");
      index += 1;
      continue;
    }
    const table: string[][] = [];
    const raw: string[] = [];
    while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
      raw.push(lines[index] ?? "");
      const cells = cellsOf(lines[index] ?? "");
      if (!isSeparator(cells)) table.push(cells);
      index += 1;
    }
    const header = table[0];
    const roles = header?.map(columnRole) ?? [];
    if (!header || !roles.includes("id") || !roles.includes("title")) {
      next.push(...raw);
      continue;
    }
    next.push(ARCHIVE_HEADER, ARCHIVE_RULE);
    for (const row of table.slice(1)) {
      let id = "";
      let title = "";
      let taskType = "";
      let severity = "";
      const commitCells: string[] = [];
      const notes: string[] = [];
      roles.forEach((role, cell) => {
        const value = row[cell]?.trim() ?? "";
        if (!value) return;
        if ((value === "—" || value === "-") && role !== "id" && role !== "title") return;
        if (role === "id") id = value;
        else if (role === "title") title = value;
        else if (role === "type") taskType = value;
        else if (role === "severity") severity = value;
        else if (role === "commits" || role === "legacy") {
          commitCells.push(value);
          const prose = stripHashes(value);
          if (prose) notes.push(prose);
        } else if (role === "note") notes.push(value);
      });
      if (!id || !title) continue;
      const comment = [severity, ...notes].filter(Boolean).join(". ").replace(/\.\s*\./g, ".");
      const commits = extractCommitHashes(commitCells.join(" "))
        .map((hash) => `\`${hash}\``)
        .join(" ");
      next.push(
        `| ${[id, title, taskType, commits, comment].map((cell) => plainCell(cell)).join(" | ")} |`,
      );
    }
  }
  return next.join(newline);
}

export function appendArchiveRow(
  content: string,
  row: { id: string; title: string; taskType: string | null; commits: string; note: string },
): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const lines = content.replace(/\s*$/, "").split(/\r?\n/);
  const entryFor = (roles: Array<Column | null>) => {
    const cells = roles.map((role) => {
      if (role === "id") return plainCell(row.id);
      if (role === "title") return plainCell(row.title);
      if (role === "type") return plainCell(row.taskType ?? "");
      if (role === "commits") return formatCommits(row.commits);
      if (role === "note" || role === "legacy") return plainCell(row.note);
      return "";
    });
    return `| ${cells.join(" | ")} |`;
  };

  let headerIndex = -1;
  for (let cursor = 0; cursor < lines.length; cursor += 1) {
    if (!(lines[cursor] ?? "").trim().startsWith("|")) continue;
    const roles = cellsOf(lines[cursor] ?? "").map(columnRole);
    if (roles.includes("id") && roles.includes("title") && roles.includes("commits")) {
      headerIndex = cursor;
      break;
    }
  }

  if (headerIndex === -1) {
    const addition = ["", "## Features / tareas", "", ARCHIVE_HEADER, ARCHIVE_RULE, entryFor(["id", "title", "type", "commits", "note"]), ""];
    return `${lines.join(newline)}${newline}${addition.join(newline)}`;
  }

  const roles = cellsOf(lines[headerIndex] ?? "").map(columnRole);
  let lastRow = headerIndex;
  for (let cursor = headerIndex + 1; cursor < lines.length; cursor += 1) {
    if (!(lines[cursor] ?? "").trim().startsWith("|")) break;
    lastRow = cursor;
  }
  lines.splice(lastRow + 1, 0, entryFor(roles));
  return `${lines.join(newline)}\n`;
}

export async function loadArchiveTasks(
  root: string,
  versions: VersionEntry[],
): Promise<ArchiveTask[]> {
  const tasks: ArchiveTask[] = [];
  for (const version of versions) {
    if (!version.archive || version.archive.split("/").includes("..")) continue;
    try {
      const content = await fs.readFile(path.join(root, version.archive), "utf8");
      tasks.push(...parseArchiveTasks(content, version));
    } catch {
      // El archive indicado no está en disco.
    }
  }
  return tasks;
}
