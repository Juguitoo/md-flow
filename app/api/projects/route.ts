import { jsonError } from "@/lib/http";
import { getHub } from "@/lib/hub";
import { addProject, ensureRegistry } from "@/lib/registry";
import { scanProject, toSummary } from "@/lib/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  await getHub().sync();
  const projects = await ensureRegistry();
  const details = await Promise.all(projects.map((project) => scanProject(project)));
  return Response.json({ projects: details.map(toSummary) });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    path?: unknown;
  } | null;
  if (!body || typeof body.path !== "string") {
    return jsonError("Falta la ruta de la carpeta.");
  }

  try {
    const project = await addProject({
      path: body.path,
      name: typeof body.name === "string" ? body.name : undefined,
    });
    await getHub().sync();
    const detail = await scanProject(project);
    return Response.json(detail, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No pude añadir el proyecto.";
    return jsonError(message);
  }
}
