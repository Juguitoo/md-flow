import fs from "node:fs/promises";
import path from "node:path";
import type { VersionEntry, VersionStatus } from "./types";

const CANDIDATES = ["docs/VERSIONS.md", "VERSIONS.md"];

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function statusFromHeading(text: string): VersionStatus | null {
  const folded = fold(text).replace(/[:.]+$/, "");
  if (["en curso", "ahora", "actual"].includes(folded)) return "doing";
  if (["previstas", "prevista", "despues", "mas adelante"].includes(folded)) return "planned";
  if (["publicadas", "publicada", "hechas", "cerradas"].includes(folded)) return "published";
  return null;
}

export function parseVersions(content: string, versionsFile: string): VersionEntry[] {
  const dir = versionsFile.includes("/")
    ? versionsFile.slice(0, versionsFile.lastIndexOf("/") + 1)
    : "";
  let status: VersionStatus = "planned";
  const versions: VersionEntry[] = [];

  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^##(?!#)\s+(.+?)\s*$/);
    if (heading) {
      status = statusFromHeading(heading[1]) ?? status;
      continue;
    }
    const item = line.match(/^-\s+([^|]+?)\s*\|\s*([^|]+?)\s*(?:\|\s*(.+?))?\s*$/);
    if (!item) continue;
    const id = item[1].trim();
    const title = item[2].trim();
    const archiveField = item[3]?.trim() ?? "";
    if (!id || !title || id.length > 40 || title.length > 160) continue;
    versions.push({
      id,
      title,
      status,
      archive: safeArchive(dir, archiveField),
    });
  }
  return versions;
}

function safeArchive(dir: string, archive: string): string | null {
  if (!archive) return null;
  const normalized = archive.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized.toLowerCase().endsWith(".md")) return null;
  if (normalized.startsWith("/") || normalized.split("/").includes("..")) return null;
  return `${dir}${normalized}`.replace(/\/{2,}/g, "/");
}

async function configuredFile(root: string): Promise<string | null> {
  try {
    const raw = await fs.readFile(path.join(root, "bitacora.json"), "utf8");
    const parsed = JSON.parse(raw) as { versions?: unknown };
    if (typeof parsed.versions !== "string") return null;
    const relative = parsed.versions.replace(/\\/g, "/").replace(/^\.\//, "");
    if (!relative.toLowerCase().endsWith(".md") || relative.split("/").includes("..")) return null;
    return relative;
  } catch {
    return null;
  }
}

export function addVersion(
  content: string,
  input: { id: string; title: string; status: "doing" | "planned"; archive: string },
): { content: string; changed: boolean } {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n") || content.length === 0;
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();

  const exists = lines.some((line) => itemId(line) === input.id);
  if (exists) return { content, changed: false };

  if (input.status === "doing") {
    const doing = lines
      .map((line, index) => ({ line, index, id: itemId(line) }))
      .filter((entry) => entry.id && sectionOf(lines, entry.index) === "doing");
    const moved = doing.map((entry) => entry.line);
    for (const entry of [...doing].reverse()) lines.splice(entry.index, 1);
    const planned = ensureSection(lines, "planned");
    let insertAt = planned + 1;
    if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
    if (moved.length > 0) {
      lines.splice(insertAt, 0, ...moved);
      if (/^##(?!#)\s+/.test(lines[insertAt + moved.length] ?? "")) {
        lines.splice(insertAt + moved.length, 0, "");
      }
    }
  }

  const target = ensureSection(lines, input.status);
  let insertAt = target + 1;
  if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  lines.splice(insertAt, 0, `- ${input.id} | ${input.title} | ${input.archive}`);
  if (/^##(?!#)\s+/.test(lines[insertAt + 1] ?? "")) lines.splice(insertAt + 1, 0, "");
  const joined = lines.join(newline);
  return { content: trailing ? `${joined}${newline}` : joined, changed: true };
}

function itemId(line: string): string | null {
  const item = line.match(/^-\s+([^|]+?)\s*\|/);
  return item?.[1].trim() ?? null;
}

function sectionOf(lines: string[], index: number): VersionStatus {
  let section: VersionStatus = "planned";
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    if (!/^##(?!#)\s+/.test(lines[cursor] ?? "")) continue;
    const match = (lines[cursor] ?? "").match(/^##\s+(.+)$/);
    return (match && statusFromHeading(match[1])) || section;
  }
  return section;
}

function ensureSection(lines: string[], status: VersionStatus): number {
  const found = lines.findIndex((line) => {
    if (!/^##(?!#)\s+/.test(line)) return false;
    const match = line.match(/^##\s+(.+)$/);
    return match ? statusFromHeading(match[1]) === status : false;
  });
  if (found !== -1) return found;
  const title = status === "doing" ? "En curso" : status === "planned" ? "Previstas" : "Publicadas";
  if (lines.length > 0 && lines.at(-1)?.trim() !== "") lines.push("");
  lines.push(`## ${title}`, "");
  return lines.length - 2;
}

export function moveVersion(
  content: string,
  versionId: string,
  status: VersionStatus,
): { content: string; changed: boolean } {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();

  const index = lines.findIndex((line) => itemId(line) === versionId);
  if (index === -1) return { content, changed: false };
  if (sectionOf(lines, index) === status) return { content, changed: false };

  if (status === "doing") {
    const doing = lines
      .map((line, cursor) => ({ line, cursor, id: itemId(line) }))
      .filter((entry) => entry.id && entry.id !== versionId && sectionOf(lines, entry.cursor) === "doing");
    const moved = doing.map((entry) => entry.line);
    for (const entry of [...doing].reverse()) lines.splice(entry.cursor, 1);
    if (moved.length > 0) {
      const planned = ensureSection(lines, "planned");
      let insertAt = planned + 1;
      if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
      lines.splice(insertAt, 0, ...moved);
      if (/^##(?!#)\s+/.test(lines[insertAt + moved.length] ?? "")) {
        lines.splice(insertAt + moved.length, 0, "");
      }
    }
  }

  const current = lines.findIndex((line) => itemId(line) === versionId);
  const entry = lines[current] ?? "";
  lines.splice(current, 1);
  const target = ensureSection(lines, status);
  let insertAt = target + 1;
  if ((lines[insertAt] ?? "").trim() === "") insertAt += 1;
  lines.splice(insertAt, 0, entry);
  if (/^##(?!#)\s+/.test(lines[insertAt + 1] ?? "")) lines.splice(insertAt + 1, 0, "");
  const joined = lines.join(newline);
  return { content: trailing ? `${joined}${newline}` : joined, changed: true };
}

export function removeVersion(
  content: string,
  versionId: string,
): { content: string; changed: boolean } {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const index = lines.findIndex((line) => itemId(line) === versionId);
  if (index === -1) return { content, changed: false };
  lines.splice(index, 1);
  const joined = lines.join(newline);
  return { content: trailing ? `${joined}${newline}` : joined, changed: true };
}

export function setVersionTitle(
  content: string,
  versionId: string,
  title: string,
): { content: string; changed: boolean } {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const index = lines.findIndex((line) => itemId(line) === versionId);
  if (index === -1) return { content, changed: false };
  const match = (lines[index] ?? "").match(/^(-[ \t]+[^|]+?)\s*\|\s*[^|]*?(?:\s*\|\s*(.*))?$/);
  if (!match) return { content, changed: false };
  const archive = match[2]?.trim();
  lines[index] = archive ? `${match[1]} | ${title} | ${archive}` : `${match[1]} | ${title}`;
  const joined = lines.join(newline);
  const next = trailing ? `${joined}${newline}` : joined;
  return { content: next, changed: next !== content };
}

export function publishVersion(
  content: string,
  versionId: string,
): { content: string; changed: boolean } {
  return moveVersion(content, versionId, "published");
}

export async function loadVersions(root: string): Promise<{
  file: string | null;
  versions: VersionEntry[];
}> {
  const configured = await configuredFile(root);
  const candidates = configured ? [configured, ...CANDIDATES] : CANDIDATES;
  for (const relative of candidates) {
    try {
      const content = await fs.readFile(path.join(root, relative), "utf8");
      return { file: relative, versions: parseVersions(content, relative) };
    } catch {
      // El siguiente candidato.
    }
  }
  return { file: null, versions: [] };
}
