import fs from "node:fs/promises";
import { jsonError } from "@/lib/http";
import { resolveProjectPath } from "@/lib/paths";
import { getProject, safeProjectFile } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

const MAX_BYTES = 12_000_000;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const project = await getProject(id);
  if (!project) return jsonError("That project is not on the board.", 404);

  const relative = new URL(request.url).searchParams.get("path") ?? "";
  const normalized = relative.replace(/\\/g, "/").replace(/^\.\//, "");
  const extension = normalized.split(".").pop()?.toLowerCase() ?? "";
  const type = TYPES[extension];
  if (
    !normalized ||
    !type ||
    normalized.includes("\0") ||
    normalized.split("/").includes("..")
  ) {
    return jsonError("That image cannot be opened.");
  }

  const root = resolveProjectPath(project.path);
  const absolute = safeProjectFile(root, normalized);
  if (!absolute) return jsonError("That image cannot be opened.");

  try {
    const stat = await fs.stat(absolute);
    if (!stat.isFile()) return jsonError("I can't find that image.", 404);
    if (stat.size > MAX_BYTES) return jsonError("That image is too large.");
    const bytes = await fs.readFile(absolute);
    return new Response(bytes, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return jsonError("I can't find that image.", 404);
  }
}
