"use client";

import { MarkdownView } from "@/components/markdown-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import { fichaCandidates, FICHA_SECTIONS, parseFicha } from "@/lib/ficha";
import { commitUrl, extractHashes } from "@/lib/commits";
import { parseRoadmap, type RoadmapStop } from "@/lib/roadmap";
import type { ArchiveTask, VersionEntry, VersionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ArrowLeft, MoreVertical, Pencil, Search, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function ArchiveTaskList({
  tasks,
  versions = [],
  repo = null,
  onOpen,
}: {
  tasks: ArchiveTask[];
  versions?: VersionEntry[];
  repo?: string | null;
  onOpen: (task: ArchiveTask) => void;
}) {
  const [query, setQuery] = useState("");
  const needle = query
    .trim()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const visible = needle
    ? tasks.filter((task) => {
        const id = task.id.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
        const title = task.title.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
        return id.includes(needle) || title.includes(needle);
      })
    : tasks;

  if (tasks.length === 0) {
    return (
      <div className="mt-8 max-w-xl rounded-2xl bg-card px-5 py-6 shadow-sm ring-1 ring-foreground/8">
        <h2 className="font-heading text-2xl">Nothing closed yet</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          When you mark a task done, it leaves the backlog and shows up here, in that version's
          archive.
        </p>
      </div>
    );
  }

  const ordered = versions
    .map((entry) => entry.id)
    .filter((id) => visible.some((task) => task.version === id));
  for (const task of visible) {
    if (!ordered.includes(task.version)) ordered.push(task.version);
  }

  return (
    <div className="mt-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by id or title"
          aria-label="Search by id or title"
          className="pl-8"
        />
      </div>
      {visible.length === 0 ? (
        <p className="px-1 py-6 text-sm text-muted-foreground">No task matches.</p>
      ) : (
        <div className="mt-4 grid gap-4">
      {ordered.map((version) => {
        const group = visible.filter((task) => task.version === version);
        const meta = versions.find((entry) => entry.id === version);
        const title = meta?.title ?? group[0]?.versionTitle ?? "";
        return (
          <section key={version} className="rounded-2xl bg-card px-4 py-4 shadow-sm ring-1 ring-foreground/8">
            <header className="flex flex-wrap items-baseline justify-between gap-2 px-2">
              <h2 className="font-heading text-2xl tracking-tight">
                <span className="font-mono text-sm text-primary">{version}</span>
                {title ? <span className="ml-3 text-base font-normal text-muted-foreground">{title}</span> : null}
              </h2>
              <p className="text-xs text-muted-foreground">
                {group.length} closed
              </p>
            </header>
            <ul className="mt-2 flex flex-col gap-0.5">
              {group.map((task) => (
                <li key={task.key}>
                  <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-background">
                    <button
                      type="button"
                      onClick={() => onOpen(task)}
                      className="grid min-w-0 flex-1 grid-cols-[5.5rem_minmax(0,1fr)] items-baseline gap-x-3 text-left"
                    >
                      <span className="truncate font-mono text-[11px] text-primary">{task.id}</span>
                      <span className="truncate text-sm">{task.title}</span>
                    </button>
                    <span className="flex max-w-[40%] flex-wrap justify-end gap-2">
                      {extractHashes(task.commits).map((hash) =>
                        repo ? (
                          <a
                            key={hash}
                            href={commitUrl(repo, hash)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[11px] text-primary underline underline-offset-2"
                          >
                            {hash.slice(0, 7)}
                          </a>
                        ) : (
                          <span key={hash} className="font-mono text-[11px] text-muted-foreground">
                            {hash.slice(0, 7)}
                          </span>
                        ),
                      )}
                    </span>
                    <span className="hidden w-16 shrink-0 truncate text-right text-[11px] text-muted-foreground sm:block">
                      {task.taskType ?? ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
        </div>
      )}
    </div>
  );
}

export function ArchiveTaskDetail({
  projectId,
  task,
  repo = null,
  onClose,
}: {
  projectId: string;
  task: ArchiveTask;
  repo?: string | null;
  onClose: () => void;
}) {
  const [ficha, setFicha] = useState<{ path: string; content: string } | null>(null);
  const [loadingFicha, setLoadingFicha] = useState(true);

  useEffect(() => {
    const candidates = fichaCandidates(task.file, task.id);
    if (candidates.length === 0) {
      setFicha(null);
      setLoadingFicha(false);
      return;
    }
    let cancelled = false;
    setLoadingFicha(true);
    void (async () => {
      for (const path of candidates) {
        try {
          const result = await api<{ path: string; content: string }>(
            `/api/projects/${projectId}/doc?path=${encodeURIComponent(path)}`,
          );
          if (!cancelled) {
            setFicha(result);
            setLoadingFicha(false);
          }
          return;
        } catch {
          // El siguiente sitio posible.
        }
      }
      if (!cancelled) {
        setFicha(null);
        setLoadingFicha(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, task.file, task.id]);

  const parsed = ficha ? parseFicha(ficha.content) : null;

  return (
    <article className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onClose}>
        <ArrowLeft />
        Versions
      </Button>
      <div className="mt-6">
        <p className="font-mono text-xs tracking-wide text-primary">{task.id}</p>
        <h1 className="mt-1 font-heading text-4xl leading-tight tracking-tight md:text-5xl">
          {task.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {[task.version, task.versionTitle, task.taskType].filter(Boolean).join(" · ")}
        </p>
      </div>
      <section className="mt-10">
        <h2 className="font-heading text-2xl tracking-tight">In the archive</h2>
        <div className="mt-4 grid gap-3">
          {extractHashes(task.commits).length > 0 ? (
            <p className="flex flex-wrap gap-2">
              {extractHashes(task.commits).map((hash) =>
                repo ? (
                  <a
                    key={hash}
                    href={commitUrl(repo, hash)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-sm text-primary underline underline-offset-2"
                  >
                    {hash.slice(0, 7)}
                  </a>
                ) : (
                  <span key={hash} className="font-mono text-sm">
                    {hash.slice(0, 7)}
                  </span>
                ),
              )}
            </p>
          ) : null}
          {task.note.trim() ? (
            <MarkdownView content={task.note} repo={repo} />
          ) : extractHashes(task.commits).length === 0 ? (
            <p className="text-sm text-muted-foreground">The archive has no note about how this was closed.</p>
          ) : null}
        </div>
      </section>
      {loadingFicha ? <p className="mt-10 text-sm text-muted-foreground">Looking for the note…</p> : null}
      {parsed && ficha ? (
        <section className="mt-12 border-t border-border/70 pt-8">
          <h2 className="font-heading text-2xl tracking-tight">Note</h2>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{ficha.path}</p>
          <div className="mt-6 grid gap-8">
            {FICHA_SECTIONS.map((section) => {
              const body = parsed.sections[section.id];
              return (
                <div key={section.id}>
                  <h3 className="font-heading text-xl tracking-tight">{section.label}</h3>
                  <div className="mt-2">
                    {body.trim() ? (
                      <MarkdownView content={body} repo={repo} />
                    ) : (
                      <p className="text-sm text-muted-foreground">Nothing written.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function RoadmapView({
  projectId,
  file,
  revision,
  onChanged,
}: {
  projectId: string;
  file: string | null;
  revision: string;
  onChanged: () => Promise<void> | void;
}) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(file));
  const [closing, setClosing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");

  const versionStatus: { status: VersionStatus; label: string }[] = [
    { status: "planned", label: "Planned" },
    { status: "doing", label: "In progress" },
    { status: "published", label: "Published" },
  ];

  async function changeStatus(versionId: string, status: VersionStatus) {
    setClosing(true);
    try {
      const result = await api<{ openTaskIds: string[] }>(`/api/projects/${projectId}/versions/status`, {
        method: "POST",
        body: JSON.stringify({ versionId, status }),
      });
      if (status === "published" && result.openTaskIds.length > 0) {
        toast.warning(`Closed ${versionId}. Still open: ${result.openTaskIds.join(", ")}.`);
      } else if (status === "doing") {
        toast(`${versionId} is now in progress.`);
      } else if (status === "published") {
        toast(`Closed ${versionId}.`);
      } else {
        toast(`${versionId} is now planned.`);
      }
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the status.");
    } finally {
      setClosing(false);
    }
  }

  async function saveText(versionId: string) {
    setClosing(true);
    try {
      await api(`/api/projects/${projectId}/versions/text`, {
        method: "POST",
        body: JSON.stringify({ versionId, title, summary }),
      });
      setEditing(false);
      toast("Text saved.");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save the text.");
    } finally {
      setClosing(false);
    }
  }

  async function removeVersion(versionId: string) {
    if (!window.confirm(`Delete ${versionId} from the index and the roadmap?`)) return;
    setClosing(true);
    try {
      await api(`/api/projects/${projectId}/versions/delete`, {
        method: "POST",
        body: JSON.stringify({ versionId }),
      });
      setSelectedId(null);
      toast(`Deleted ${versionId}.`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't delete the version.");
    } finally {
      setClosing(false);
    }
  }

  useEffect(() => {
    if (!file) {
      setContent(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void api<{ content: string }>(`/api/projects/${projectId}/doc?path=${encodeURIComponent(file)}`)
      .then((result) => {
        if (cancelled) return;
        setContent(result.content);
        const current = parseRoadmap(result.content).stops.find((stop) => stop.status === "doing");
        setSelectedId(current?.id ?? null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't read the roadmap.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, file, revision]);

  if (!file) {
    return (
      <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
        ROADMAP.md is missing. That file holds the project goal and each version's summary.
      </p>
    );
  }

  const roadmap = (() => {
    if (!content) return null;
    try {
      return parseRoadmap(content);
    } catch {
      return null;
    }
  })();
  const selected = roadmap?.stops.find((stop) => stop.id === selectedId) ?? null;

  return (
    <div className="mt-8">
      {loading ? <p className="text-sm text-muted-foreground">Reading the roadmap…</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {selected ? (
        <div
          key={selected.id}
          className="relative mx-auto w-full max-w-2xl animate-in fade-in rounded-3xl bg-card px-6 py-8 text-center shadow-sm ring-1 ring-foreground/8 duration-300"
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="absolute top-3 right-3 text-muted-foreground"
                aria-label="Version actions"
                disabled={closing}
              >
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={closing}
                onSelect={() => {
                  setTitle(selected.title);
                  setSummary(selected.summary);
                  setEditing(true);
                }}
              >
                <Pencil />
                Edit text
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={closing}
                onSelect={() => void removeVersion(selected.id)}
              >
                <Trash2 />
                Delete version
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="font-mono text-xs tracking-wide text-primary">{selected.id}</p>
          {editing ? (
            <div className="mt-3 grid gap-2 text-left">
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
              <Textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={5}
                placeholder="What this version includes."
              />
              <div className="flex justify-center gap-2">
                <Button size="sm" disabled={closing} onClick={() => void saveText(selected.id)}>
                  {closing ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" disabled={closing} onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mt-1 font-heading text-3xl tracking-tight">{selected.title}</h2>
              {selected.summary.trim() ? (
                <div className="mx-auto mt-4 max-w-lg text-left">
                  <MarkdownView content={selected.summary} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No text yet.</p>
              )}
            </>
          )}
          <div className="mt-6 flex justify-center">
            <div className="inline-flex rounded-full bg-muted/80 p-1">
              {versionStatus.map((entry) => (
                <Button
                  key={entry.status}
                  variant={selected.status === entry.status ? "default" : "ghost"}
                  size="sm"
                  className="rounded-full"
                  disabled={closing || selected.status === entry.status}
                  onClick={() => void changeStatus(selected.id, entry.status)}
                >
                  {entry.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {roadmap ? (
        <Timeline
          stops={roadmap.stops}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setEditing(false);
          }}
        />
      ) : null}
      {!loading && content && !roadmap ? (
        <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Couldn't read the roadmap. The project's tasks are still in their list.
        </p>
      ) : null}
    </div>
  );
}

const STOP_WIDTH = 112;

const STOP_DOT: Record<VersionStatus, string> = {
  doing: "bg-[oklch(0.78_0.15_95)] ring-[oklch(0.78_0.15_95)]",
  planned: "bg-background ring-muted-foreground/50",
  published: "bg-[oklch(0.62_0.13_145)] ring-[oklch(0.62_0.13_145)]",
};

function Timeline({
  stops,
  selectedId,
  onSelect,
}: {
  stops: RoadmapStop[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const update = () => setViewportWidth(element.clientWidth);
    update();
    setReady(true);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (stops.length === 0) {
    return (
      <p className="mt-6 text-sm text-muted-foreground">
        The roadmap has no versions in the form <span className="font-mono">## v1.2.3 — Title</span>.
      </p>
    );
  }

  const selectedIndex = Math.max(
    0,
    stops.findIndex((stop) => stop.id === selectedId),
  );
  const offset = viewportWidth / 2 - (selectedIndex * STOP_WIDTH + STOP_WIDTH / 2);

  return (
    <div ref={viewportRef} className="relative mt-4 overflow-hidden pt-2 pb-2">
      <div className="pointer-events-none absolute top-2 left-1/2 z-10 -translate-x-1/2" aria-hidden>
        <span className="animate-[plumbob-bob_1.8s_ease-in-out_infinite]">
          <span
            className="block h-0 w-0 border-solid border-x-transparent border-t-[oklch(0.55_0.12_165)]"
            style={{ borderTopWidth: 12, borderLeftWidth: 8, borderRightWidth: 8 }}
          />
        </span>
      </div>
      <div
        className={cn(
          "flex items-start pt-8",
          ready && "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
        )}
        style={{
          width: stops.length * STOP_WIDTH,
          transform: `translateX(${offset}px)`,
        }}
      >
        {stops.map((stop, index) => {
          const selected = stop.id === selectedId;
          return (
            <div key={stop.id} className="flex flex-col items-center" style={{ width: STOP_WIDTH }}>
              <div className="flex h-10 w-full items-center">
                <span
                  className={cn(
                    "h-px flex-1 bg-border transition-opacity duration-500",
                    index === 0 && "opacity-0",
                  )}
                />
                <button
                  type="button"
                  onClick={() => onSelect(stop.id)}
                  aria-pressed={selected}
                  aria-label={`${stop.id}, ${stop.title}`}
                  className="group relative flex size-10 shrink-0 items-center justify-center"
                >
                  <span
                    className={cn(
                      "rounded-full ring-2 transition-all duration-500 ease-out",
                      STOP_DOT[stop.status],
                      selected
                        ? "size-5 scale-110 opacity-100"
                        : "size-3.5 opacity-40 group-hover:scale-110 group-hover:opacity-80",
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "h-px flex-1 bg-border",
                    index === stops.length - 1 && "opacity-0",
                  )}
                />
              </div>
              <span
                className={cn(
                  "mt-1 text-center font-mono transition-all duration-500",
                  selected
                    ? "text-sm text-foreground"
                    : "text-[10px] text-muted-foreground opacity-50",
                )}
              >
                {stop.id}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
