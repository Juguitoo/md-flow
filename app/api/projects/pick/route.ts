import { jsonError } from "@/lib/http";
import { pickFolder } from "@/lib/pick-folder";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  try {
    const path = await pickFolder();
    return Response.json({ path });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Couldn't open the folder picker.";
    return jsonError(message);
  }
}
