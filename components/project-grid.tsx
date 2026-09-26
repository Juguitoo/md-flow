"use client";

import { AddProjectDialog } from "@/components/add-project-dialog";
import { useBitacora } from "@/components/bitacora-provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/client";
import { Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export function ProjectGrid() {
  const { projects, loading, error, refresh } = useBitacora();

  async function restore() {
    try {
      const result = await api<{ added: string[] }>("/api/projects/examples", { method: "POST" });
      await refresh();
      toast(result.added.length ? `Back: ${result.added.join(", ")}.` : "The examples were already there.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't restore the examples.");
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-xl">
          <h1 className="font-heading text-4xl tracking-tight md:text-5xl">Projects</h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Each folder stays yours. Bitácora reads the backlog you already write, and while it is
            running it notices when you save.
          </p>
        </div>
        <AddProjectDialog
          trigger={
            <Button>
              <Plus />
              Add project
            </Button>
          }
        />
      </div>

      {error ? (
        <div className="mt-8 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          <Button variant="outline" className="mt-3" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="h-52 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
          <div className="h-52 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
        </div>
      ) : null}

      {!loading && projects.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-card px-6 py-10 ring-1 ring-foreground/10">
          <h2 className="font-heading text-2xl">No folders yet</h2>
          <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
            Add the path of a project with BACKLOG.md, or load the two examples that come with
            Bitácora again.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <AddProjectDialog
              trigger={
                <Button>
                  <Plus />
                  Add project
                </Button>
              }
            />
            <Button variant="outline" onClick={() => void restore()}>
              Restore examples
            </Button>
          </div>
        </div>
      ) : null}

      {!loading && projects.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="group rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/8 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-heading text-3xl tracking-tight group-hover:text-primary">
                    {project.name}
                  </h2>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground">{project.path}</p>
                </div>
                <p className="text-right text-sm text-muted-foreground">
                  {project.openCount} open
                </p>
              </div>

              {project.error ? (
                <p className="mt-5 text-sm text-destructive">{project.error}</p>
              ) : (
                <>
                  <dl className="mt-6 grid grid-cols-3 gap-2">
                    <Count label="To do" value={project.counts.backlog} />
                    <Count label="In progress" value={project.counts.doing} />
                    <Count label="Done" value={project.counts.done} />
                  </dl>
                  {project.highlights.length > 0 ? (
                    <ul className="mt-5 space-y-1.5 border-t border-border/80 pt-4">
                      {project.highlights.map((task) => (
                        <li key={`${task.id}-${task.title}`} className="truncate text-sm">
                          {task.id ? (
                            <span className="mr-2 font-mono text-[11px] text-primary">{task.id}</span>
                          ) : null}
                          {task.title}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-5 border-t border-border/80 pt-4 text-sm text-muted-foreground">
                      {project.files.length
                        ? "Those markdown files have no checkbox tasks."
                        : "No BACKLOG.md in the root or in docs/."}
                    </p>
                  )}
                  <p className="mt-4 font-mono text-[10px] text-muted-foreground">
                    {project.files.length
                      ? project.files.map((file) => file.path).join(" · ")
                      : "no task files"}
                    {project.github ? ` · ${project.github}` : ""}
                  </p>
                </>
              )}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-background/70 px-2 py-3 text-center ring-1 ring-foreground/5">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="font-heading text-2xl leading-tight">{value}</dd>
    </div>
  );
}
