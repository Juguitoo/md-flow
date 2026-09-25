import { getHub } from "@/lib/hub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const hub = getHub();
  await hub.sync();
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let ping: NodeJS.Timeout | undefined;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };
      send("ready", { ok: true });
      unsubscribe = hub.subscribe((event) => {
        try {
          send("update", event);
        } catch {
          unsubscribe();
        }
      });
      ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          if (ping) clearInterval(ping);
        }
      }, 15000);
      ping.unref?.();
    },
    cancel() {
      unsubscribe();
      if (ping) clearInterval(ping);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
