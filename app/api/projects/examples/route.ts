import { getHub } from "@/lib/hub";
import { ensureRegistry, restoreExamples } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const before = new Set((await ensureRegistry()).map((project) => project.id));
  const projects = await restoreExamples();
  await getHub().sync();
  return Response.json({
    added: projects.filter((project) => !before.has(project.id)).map((project) => project.name),
  });
}
