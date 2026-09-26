import { clearGithubCache } from "@/lib/github";
import { jsonError } from "@/lib/http";
import { readGithubToken, writeGithubToken } from "@/lib/registry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const { source } = await readGithubToken();
  return Response.json({ configured: source !== null, source });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  if (!body || typeof body.token !== "string") {
    return jsonError("The token is missing.");
  }
  await writeGithubToken(body.token);
  clearGithubCache();
  const { source } = await readGithubToken();
  return Response.json({ configured: source !== null, source });
}
