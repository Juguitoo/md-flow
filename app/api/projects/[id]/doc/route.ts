import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 200_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("That project is not on the board.", 404);

  const relative = new URL(request.url).searchParams.get("path") ?? "";
  const normalized = relative.replace(/\\/g, "/").replace(/^\.\//, "");
  if (
    !normalized ||
    !normalized.toLowerCase().endsWith(".md") ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..")
  ) {
    return jsonError("That file cannot be opened.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, normalized);
  if (!absolute) return jsonError("That file cannot be opened.");

  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return jsonError("I can't find that note.", 404);
    if (stat.size > MAX_BYTES) return jsonError("That note is too large.");
    const content = await fs.readFile(absolute, "utf8");
    return Response.json({ path: normalized, content });
  } catch {
    return jsonError("I can't find that note.", 404);
  }
}
