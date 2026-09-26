import type { VersionStatus } from "./types";

export interface RoadmapStop {
  id: string;
  title: string;
  status: VersionStatus;
  summary: string;
}

const VERSION_HEADING = /^##\s+(v\d+(?:\.\d+)+)\s+[—–-]\s+(.+?)\s*$/;

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

function statusFromLine(line: string): VersionStatus | null {
  const match = line.match(/^\s*(?:[-*]\s+)?estado\s*[:=]\s*(.+)$/i);
  if (!match) return null;
  const folded = fold(match[1]);
  if (folded === "en curso" || folded === "actual") return "doing";
  if (folded === "publicada" || folded === "publicado" || folded === "hecha" || folded === "hecho") {
    return "published";
  }
  if (folded === "prevista" || folded === "previsto" || folded === "planeada") return "planned";
  return null;
}

export function setRoadmapStatus(
  content: string,
  versionId: string,
  status: VersionStatus,
): string {
  const label = status === "doing" ? "en curso" : status === "published" ? "publicada" : "prevista";
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const heading = lines.findIndex((line) => {
    const match = line.match(/^##\s+(v\d+(?:\.\d+)+)\s+[—–-]/);
    return match?.[1] === versionId;
  });
  if (heading === -1) return content;

  let sectionEnd = lines.length;
  for (let cursor = heading + 1; cursor < lines.length; cursor += 1) {
    if (VERSION_HEADING.test(lines[cursor] ?? "")) {
      sectionEnd = cursor;
      break;
    }
  }
  for (let cursor = heading + 1; cursor < sectionEnd; cursor += 1) {
    if (statusFromLine(lines[cursor] ?? "")) {
      lines[cursor] = lines[cursor].replace(/estado\s*[:=]\s*.+$/i, `estado: ${label}`);
      const joined = lines.join(newline);
      return trailing ? `${joined}${newline}` : joined;
    }
  }
  lines.splice(heading + 1, 0, "", `- estado: ${label}`);
  const joined = lines.join(newline);
  return trailing ? `${joined}${newline}` : joined;
}

export function addRoadmapStop(
  content: string,
  input: { id: string; title: string; status: VersionStatus },
): string {
  if (parseRoadmap(content).stops.some((stop) => stop.id === input.id)) {
    return setRoadmapStatus(content, input.id, input.status);
  }
  const label = input.status === "doing" ? "en curso" : input.status === "published" ? "publicada" : "prevista";
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const base = content.replace(/\s*$/, "");
  const block = [
    "",
    `## ${input.id} — ${input.title}`,
    "",
    `- estado: ${label}`,
    "",
  ];
  return `${base}${newline}${block.join(newline)}`;
}

export function setRoadmapTitle(content: string, versionId: string, title: string): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const heading = versionHeading(lines, versionId);
  if (heading === -1) return content;
  lines[heading] = `## ${versionId} — ${title.trim()}`;
  const joined = lines.join(newline);
  return trailing ? `${joined}${newline}` : joined;
}

export function setRoadmapSummary(content: string, versionId: string, summary: string): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const heading = versionHeading(lines, versionId);
  if (heading === -1) return content;
  const sectionEnd = nextVersionHeading(lines, heading);
  let estado: string | null = null;
  for (let cursor = heading + 1; cursor < sectionEnd; cursor += 1) {
    if (statusFromLine(lines[cursor] ?? "")) estado = lines[cursor] ?? null;
  }
  const summaryLines = summary.trim() ? summary.replace(/\s*$/, "").split(/\r?\n/) : [];
  const insertion = ["", ...(estado ? [estado, ""] : []), ...summaryLines];
  if (summaryLines.length > 0) insertion.push("");
  lines.splice(heading + 1, sectionEnd - heading - 1, ...insertion);
  const joined = lines.join(newline);
  return trailing ? `${joined}${newline}` : joined;
}

export function removeRoadmapStop(content: string, versionId: string): string {
  const newline = content.includes("\r\n") ? "\r\n" : "\n";
  const trailing = content.endsWith("\n");
  const lines = content.split(/\r?\n/);
  if (trailing && lines.at(-1) === "") lines.pop();
  const heading = versionHeading(lines, versionId);
  if (heading === -1) return content;
  let start = heading;
  if (start > 0 && (lines[start - 1] ?? "").trim() === "") start -= 1;
  const sectionEnd = nextVersionHeading(lines, heading);
  lines.splice(start, sectionEnd - start);
  const joined = lines.join(newline).replace(/\n{3,}/g, "\n\n");
  return trailing ? `${joined.replace(/\n*$/, "")}${newline}` : joined.replace(/\n*$/, "");
}

function versionHeading(lines: string[], versionId: string): number {
  return lines.findIndex((line) => {
    const match = line.match(/^##\s+(v\d+(?:\.\d+)+)\s+[—–-]/);
    return match?.[1] === versionId;
  });
}

function nextVersionHeading(lines: string[], heading: number): number {
  for (let cursor = heading + 1; cursor < lines.length; cursor += 1) {
    if (VERSION_HEADING.test(lines[cursor] ?? "")) return cursor;
  }
  return lines.length;
}

export function parseRoadmap(content: string): { vision: string; stops: RoadmapStop[] } {
  const lines = content.split(/\r?\n/);
  const stops: RoadmapStop[] = [];
  let index = 0;

  while (index < lines.length && !VERSION_HEADING.test(lines[index] ?? "")) {
    index += 1;
  }

  while (index < lines.length) {
    const heading = (lines[index] ?? "").match(VERSION_HEADING);
    if (!heading) {
      index += 1;
      continue;
    }
    const id = heading[1];
    const title = heading[2].replace(/\*+/g, "").trim();
    index += 1;
    const body: string[] = [];
    let status: VersionStatus = "planned";
    while (index < lines.length && !VERSION_HEADING.test(lines[index] ?? "")) {
      const parsed = statusFromLine(lines[index] ?? "");
      if (parsed) status = parsed;
      else body.push(lines[index] ?? "");
      index += 1;
    }
    const summary = body
      .join("\n")
      .replace(/^---\s*$/gm, "")
      .trim();
    if (id && title) stops.push({ id, title, status, summary });
  }

  const visionMatch = content.match(/\*\*Visión:\*\*\s*(.+)/) ?? content.match(/^Visión:\s*(.+)$/m);
  const vision = (visionMatch?.[1] ?? "")
    .replace(/\*\*/g, "")
    .trim();

  return { vision, stops };
}
