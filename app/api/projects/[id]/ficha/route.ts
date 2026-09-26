import fs from "node:fs/promises";
import path from "node:path";
import {
  defaultFichaFile,
  emptySections,
  fichaPath,
  fichaPreamble,
  parseFicha,
  refFromFiles,
  renderFicha,
  type FichaSectionId,
  type FichaSections,
} from "@/lib/ficha";
import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { ensureTaskRef, parseMarkdown } from "@/lib/markdown";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";
import { discoverFiles, scanProject } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SECTION_IDS: FichaSectionId[] = ["problema", "decision", "durante", "resolucion"];
const MAX_SECTION = 20_000;

function readSections(value: unknown): FichaSections | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const sections = emptySections();
  for (const id of SECTION_IDS) {
    const entry = record[id];
    if (typeof entry !== "string" || entry.length > MAX_SECTION) return null;
    sections[id] = entry;
  }
  return sections;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("No encuentro ese proyecto.", 404);

  const body = (await request.json().catch(() => null)) as {
    file?: unknown;
    line?: unknown;
    sections?: unknown;
  } | null;
  if (!body || typeof body.file !== "string" || typeof body.line !== "number") {
    return jsonError("Faltan el archivo y la línea.");
  }
  const sections = readSections(body.sections);
  if (!sections) return jsonError("Las secciones de la ficha no son válidas.");

  const root = resolveProjectPath(project.path);
  const backlogAbsolute = safeProjectFile(root, body.file);
  const discovered = await discoverFiles(root);
  if (!backlogAbsolute || !discovered.includes(body.file)) {
    return jsonError("Ese archivo no forma parte de la lista.");
  }

  const backlog = await fs.readFile(backlogAbsolute, "utf8");
  const task = parseMarkdown(backlog, body.file).find((entry) => entry.line === body.line);
  if (!task || !task.toggleable) return jsonError("Esa línea ya no es una tarea.", 409);

  let relative = fichaPath(task);
  let created = false;
  if (!relative) {
    if (!task.id) return jsonError("Esta tarea no tiene id, así que no puedo crear su ficha.");
    relative = defaultFichaFile(body.file, task.id);
    if (!relative) return jsonError("El id de la tarea no vale como nombre de archivo.");
    created = true;
  }

  const absolute = safeProjectFile(root, relative);
  if (!absolute) return jsonError("Esa ficha no se puede guardar.");

  let preamble = "";
  let extras: { title: string; body: string }[] = [];
  if (!created) {
    try {
      const current = await fs.readFile(absolute, "utf8");
      const parsed = parseFicha(current);
      preamble = parsed.preamble;
      extras = parsed.extras;
    } catch {
      created = true;
    }
  }
  if (!preamble) {
    preamble = fichaPreamble({
      id: task.id ?? "tarea",
      title: task.title,
      version: task.version,
      taskType: task.taskType,
      status: task.status,
    });
  }

  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, renderFicha(preamble, sections, extras));

  if (created || !task.ref) {
    const linked = ensureTaskRef(backlog, body.line, refFromFiles(body.file, relative));
    if (linked.changed) await fs.writeFile(backlogAbsolute, linked.content);
  }

  await getHub().sync();
  getHub().broadcast({ projectId: id, file: body.file });
  const detail = await scanProject(project);
  return Response.json({ path: relative, detail });
}
