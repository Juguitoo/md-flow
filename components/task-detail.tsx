"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client";
import {
  emptySections,
  FICHA_SECTIONS,
  fichaPath,
  parseFicha,
  type FichaSectionId,
  type FichaSections,
} from "@/lib/ficha";
import type { ProjectDetail, Task, TaskStatus, VersionEntry } from "@/lib/types";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

const STATUSES: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "To do" },
  { status: "doing", label: "In progress" },
  { status: "done", label: "Done" },
];

export function TaskDetail({
  projectId,
  task,
  versions,
  pending,
  onClose,
  onStatus,
  onSaved,
}: {
  projectId: string;
  task: Task;
  versions: VersionEntry[];
  pending: boolean;
  onClose: () => void;
  onStatus: (status: TaskStatus, commit?: string) => void;
  onSaved: (detail: ProjectDetail) => void;
}) {
  const path = fichaPath(task);
  const [sections, setSections] = useState<FichaSections>(emptySections());
  const [savedSections, setSavedSections] = useState<FichaSections>(emptySections());
  const [fichaError, setFichaError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<FichaSectionId | null>(null);
  const [version, setVersion] = useState(task.version ?? "");
  const [savingVersion, setSavingVersion] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [commit, setCommit] = useState("");
  const canEdit = Boolean(task.file && task.line !== null && task.toggleable && (path || task.id));
  const versionOptions = versions.filter(
    (entry) => entry.status !== "published" || entry.id === task.version,
  );

  useEffect(() => {
    setVersion(task.version ?? "");
  }, [task.key, task.version]);

  useEffect(() => {
    if (!path) {
      const blank = emptySections();
      setSections(blank);
      setSavedSections(blank);
      setFichaError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFichaError(null);
    void api<{ path: string; content: string }>(
      `/api/projects/${projectId}/doc?path=${encodeURIComponent(path)}`,
    )
      .then((result) => {
        if (cancelled) return;
        const parsed = parseFicha(result.content);
        setSections(parsed.sections);
        setSavedSections(parsed.sections);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFichaError(err instanceof Error ? err.message : "Couldn't read the note.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId, path]);

  async function save() {
    if (!task.file || task.line === null) return;
    setSaving(true);
    setFichaError(null);
    try {
      const result = await api<{ path: string; detail: ProjectDetail }>(
        `/api/projects/${projectId}/ficha`,
        {
          method: "POST",
          body: JSON.stringify({ file: task.file, line: task.line, sections }),
        },
      );
      setSavedSections(sections);
      setEditing(null);
      onSaved(result.detail);
      toast(path ? "Note saved." : "Note created.");
    } catch (err) {
      setFichaError(err instanceof Error ? err.message : "Couldn't save the note.");
    } finally {
      setSaving(false);
    }
  }

  async function saveVersion() {
    if (!task.file || task.line === null) return;
    setSavingVersion(true);
    try {
      const next = await api<ProjectDetail>(`/api/projects/${projectId}/tasks/version`, {
        method: "POST",
        body: JSON.stringify({ file: task.file, line: task.line, version }),
      });
      onSaved(next);
      toast(version ? `Version ${version}.` : "No version.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't change the version.");
    } finally {
      setSavingVersion(false);
    }
  }

  async function removeTask() {
    if (!task.file || task.line === null) return;
    const label = task.id ?? task.title;
    if (!window.confirm(`Remove ${label} from the backlog? The note file, if any, stays on disk.`)) {
      return;
    }
    setDeleting(true);
    try {
      const next = await api<ProjectDetail>(`/api/projects/${projectId}/tasks/delete`, {
        method: "POST",
        body: JSON.stringify({ file: task.file, line: task.line }),
      });
      onSaved(next);
      onClose();
      toast(`Removed ${label}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't remove the task.");
    } finally {
      setDeleting(false);
    }
  }

  const fileRef = path ? task.ref : null;

  return (
    <article className="mx-auto w-full max-w-3xl">
      <Button variant="ghost" size="sm" className="-ml-2" onClick={onClose}>
        <ArrowLeft />
        Back to the list
      </Button>
      <div className="mt-6">
        {task.id ? (
          <p className="font-mono text-xs tracking-wide text-primary">{task.id}</p>
        ) : null}
        <h1 className="mt-1 font-heading text-4xl leading-tight tracking-tight md:text-5xl">
          {task.title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {[task.version, task.taskType, fileRef].filter(Boolean).join(" · ") || "No version"}
        </p>
        {task.file ? (
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            {task.file}
            {task.line ? `:${task.line}` : ""}
          </p>
        ) : null}
      </div>

      {task.toggleable && task.file && task.line !== null ? (
        <div className="mt-6 flex flex-wrap items-center gap-2 rounded-2xl bg-card px-3 py-3 shadow-sm ring-1 ring-foreground/8">
          {STATUSES.map((entry) => (
            <Button
              key={entry.status}
              variant={task.status === entry.status ? "default" : "outline"}
              size="sm"
              disabled={pending || (task.status === entry.status && entry.status !== "done")}
              onClick={() => {
                if (entry.status === "done") {
                  setDoneOpen(true);
                  return;
                }
                onStatus(entry.status);
              }}
            >
              {entry.label}
            </Button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
          <label className="text-xs text-muted-foreground">
            <span className="sr-only">Version</span>
            <select
              value={version}
              onChange={(event) => setVersion(event.target.value)}
              className="select-field"
              aria-label="Version"
            >
              <option value="">No version</option>
              {versionOptions.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.id}
                  {entry.status === "doing" ? " · in progress" : ""}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={savingVersion || version === (task.version ?? "")}
            onClick={() => void saveVersion()}
          >
            {savingVersion ? "Saving…" : "Save"}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            className="ml-auto text-muted-foreground"
            disabled={deleting}
            aria-label="Delete task"
            title="Delete task"
            onClick={() => void removeTask()}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
      {doneOpen ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            onStatus("done", commit);
            setDoneOpen(false);
            setCommit("");
          }}
        >
          <label className="grid gap-1 text-xs text-muted-foreground">
            Commit hash
            <Input
              value={commit}
              onChange={(event) => setCommit(event.target.value)}
              placeholder="ca39572"
              className="w-56 font-mono"
              autoFocus
            />
          </label>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Closing…" : "Close task"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDoneOpen(false);
              setCommit("");
            }}
          >
            Cancel
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Separate several hashes with a space. They are stored in the archive and, if the
            remote is on GitHub, they open the commit.
          </p>
        </form>
      ) : null}

      {task.url ? (
        <a
          href={task.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
        >
          Open on GitHub
        </a>
      ) : null}

      <div className="mt-12 grid w-full gap-8">
        {loading ? <p className="text-sm text-muted-foreground">Reading the note…</p> : null}
        {fichaError ? <p className="text-sm text-destructive">{fichaError}</p> : null}
        {!loading && canEdit
          ? FICHA_SECTIONS.map((section) => {
              const value = sections[section.id];
              const open = editing === section.id;
              return (
                <section key={section.id} className="grid gap-2 border-t border-border/70 pt-6 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <h2 className="font-heading text-2xl tracking-tight">{section.label}</h2>
                    {canEdit && !open ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(section.id)}
                      >
                        Edit
                      </Button>
                    ) : null}
                  </div>
                  {open ? (
                    <>
                      <Textarea
                        value={value}
                        onChange={(event) =>
                          setSections((current) => ({
                            ...current,
                            [section.id]: event.target.value,
                          }))
                        }
                        rows={6}
                        autoFocus
                        placeholder="Nothing written yet."
                      />
                      <div className="flex gap-2">
                        <Button onClick={() => void save()} disabled={saving}>
                          {saving ? "Saving…" : path ? "Save" : "Create note"}
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={saving}
                          onClick={() => {
                            setSections((current) => ({
                              ...current,
                              [section.id]: savedSections[section.id],
                            }));
                            setEditing(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : value.trim() ? (
                    <SectionText text={value} />
                  ) : (
                    <p className="text-sm text-muted-foreground">Nothing written.</p>
                  )}
                </section>
              );
            })
          : null}
        {!loading && !canEdit && !task.url ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            This task has no id, so I can't open a note for it.
          </p>
        ) : null}
        {task.body && task.source === "github" ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.body}</p>
        ) : null}
      </div>
    </article>
  );
}

function SectionText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={`p-${blocks.length}`} className="text-sm leading-relaxed">
        {inline(paragraph.join(" "))}
      </p>,
    );
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push(
      <ul key={`l-${blocks.length}`} className="list-disc space-y-1 pl-4 text-sm leading-relaxed">
        {list.map((item, index) => (
          <li key={`${index}-${item}`}>{inline(item)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  for (const line of text.split(/\r?\n/)) {
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      flushParagraph();
      list.push(item[1]);
      continue;
    }
    if (line.trim() === "") {
      flushParagraph();
      flushList();
      continue;
    }
    flushList();
    paragraph.push(line.trim());
  }
  flushParagraph();
  flushList();

  return <div className="grid gap-3">{blocks}</div>;
}

function inline(value: string): ReactNode[] {
  const parts = value.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code key={index} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={index}>{part}</span>;
  });
}
