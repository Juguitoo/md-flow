import { commitUrl } from "@/lib/commits";
import type { ReactNode } from "react";

export function MarkdownView({
  content,
  repo = null,
}: {
  content: string;
  repo?: string | null;
}) {
  const blocks: ReactNode[] = [];
  const lines = content.split(/\r?\n/);
  let index = 0;
  let list: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-relaxed">
        {inline(paragraph.join(" "), repo)}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`l-${blocks.length}`} className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
        {list.map((item, itemIndex) => (
          <li key={`${itemIndex}-${item}`}>{inline(item, repo)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (line.trim().startsWith("|")) {
      flushParagraph();
      flushList();
      const table: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").trim().startsWith("|")) {
        const row = (lines[index] ?? "").trim();
        const cells = row
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());
        const separator = cells.every((cell) => /^:?-{3,}:?$/.test(cell));
        if (!separator) table.push(cells);
        index += 1;
      }
      if (table.length > 0) {
        const [head, ...body] = table;
        blocks.push(
          <div key={`t-${blocks.length}`} className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  {head.map((cell, cellIndex) => (
                    <th key={cellIndex} className="border-b border-border px-2 py-1.5 font-medium">
                      {inline(cell, repo)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, rowIndex) => (
                  <tr key={rowIndex} className="align-top">
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-b border-border/70 px-2 py-1.5">
                        {inline(cell, repo)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
      }
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const className =
        level === 1
          ? "font-heading text-3xl tracking-tight"
          : "pt-2 font-heading text-2xl tracking-tight";
      blocks.push(
        <h2 key={`h-${blocks.length}`} className={className}>
          {inline(heading[2], repo)}
        </h2>,
      );
      index += 1;
      continue;
    }

    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item && !line.trim().startsWith("|")) {
      flushParagraph();
      list.push(item[1]);
      index += 1;
      continue;
    }

    if (line.trim() === "") {
      flushParagraph();
      flushList();
      index += 1;
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      const images: { alt: string; src: string }[] = [{ alt: image[1], src: image[2] }];
      index += 1;
      while (index < lines.length) {
        const next = (lines[index] ?? "").match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
        if (!next) break;
        images.push({ alt: next[1], src: next[2] });
        index += 1;
      }
      blocks.push(
        <div key={`i-${blocks.length}`} className="flex flex-wrap items-start justify-center gap-3">
          {images.map((picture) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={picture.src}
              src={picture.src}
              alt={picture.alt}
              className="h-auto max-h-80 max-w-full rounded-lg"
            />
          ))}
        </div>,
      );
      continue;
    }

    flushList();
    paragraph.push(line.trim());
    index += 1;
  }
  flushParagraph();
  flushList();

  return <div className="grid gap-3">{blocks}</div>;
}

function inline(value: string, repo: string | null): ReactNode[] {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.filter(Boolean).flatMap((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      const code = part.slice(1, -1);
      if (repo && /^[0-9a-f]{7,40}$/i.test(code)) return [hashLink(code, repo, index)];
      return [
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {code}
        </code>,
      ];
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return [<strong key={index}>{part.slice(2, -2)}</strong>];
    }
    if (!repo) return [<span key={index}>{part}</span>];
    const bits = part.split(/(\b[0-9a-f]{7,40}\b)/gi);
    return bits.filter(Boolean).map((bit, bitIndex) =>
      /^[0-9a-f]{7,40}$/i.test(bit) ? (
        hashLink(bit, repo, `${index}-${bitIndex}`)
      ) : (
        <span key={`${index}-${bitIndex}`}>{bit}</span>
      ),
    );
  });
}

function hashLink(hash: string, repo: string, key: string | number) {
  return (
    <a
      key={key}
      href={commitUrl(repo, hash.toLowerCase())}
      target="_blank"
      rel="noreferrer"
      title={hash}
      className="font-mono text-[0.85em] text-primary underline underline-offset-2"
    >
      {hash.slice(0, 7)}
    </a>
  );
}
