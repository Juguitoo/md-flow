"use client";

import { useBitacora } from "@/components/bitacora-provider";
import { TaskDetail } from "@/components/task-detail";
import { TaskList } from "@/components/task-list";
import { ArchiveTaskDetail, ArchiveTaskList, RoadmapView } from "@/components/version-timeline";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, formatTime } from "@/lib/client";
import type { ArchiveTask, ProjectDetail, Task, TaskStatus, VersionEntry } from "@/lib/types";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function ProjectBoard({
  id,
  initial,
}: {
  id: string;
  initial: ProjectDetail | null;
}) {
  const { subscribe, refresh, markLocalEdit } = useBitacora();
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    initial ? null : "No encuentro ese proyecto.",
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [view, setView] = useState<"tasks" | "versions" | "roadmap">("tasks");
  const [archiveTask, setArchiveTask] = useState<ArchiveTask | null>(null);

  const load = useCallback(
    async (refreshGithub = false) => {
      try {
        const next = await api<ProjectDetail>(
          `/api/projects/${id}${refreshGithub ? "?refresh=1" : ""}`,
        );
        setDetail(next);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No pude abrir el proyecto.");
      } finally {
        setLoading(false);
      }
    },
    [id],
  );

  useEffect(() => {
    return subscribe((event) => {
      if (event.projectId !== id) return;
      void load();
      if (!event.quiet) {
        const name = event.file.split("/").pop() ?? event.file;
        toast(`${name} se ha actualizado.`);
      }
    });
  }, [subscribe, id, load]);

  const selected = useMemo(() => {
    if (!detail) return null;
    const pool = [...detail.tasks, ...detail.githubTasks];
    if (selectedKey) {
      const byKey = pool.find((task) => task.key === selectedKey);
      if (byKey) return byKey;
    }
    if (selectedId) return pool.find((task) => task.id === selectedId) ?? null;
    return null;
  }, [detail, selectedKey, selectedId]);

  function openTask(task: Task) {
    setSelectedKey(task.key);
    setSelectedId(task.id);
  }

  function closeTask() {
    setSelectedKey(null);
    setSelectedId(null);
  }

  async function setStatus(task: Task, status: TaskStatus, commit?: string) {
    if (!task.file || task.line === null || task.status === status) return;
    setPendingKey(task.key);
    markLocalEdit();
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/tasks/status`, {
        method: "POST",
        body: JSON.stringify({ file: task.file, line: task.line, status, commit }),
      });
      setDetail(next);
      const match = next.tasks.find((entry) =>
        task.id ? entry.id === task.id : entry.title === task.title,
      );
      if (match) openTask(match);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pude cambiar el estado.");
    } finally {
      setPendingKey(null);
    }
  }

  async function remove() {
    if (!window.confirm("¿Quitar este proyecto del tablero? La carpeta no se borra.")) return;
    setRemoving(true);
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      await refresh();
      toast("Proyecto quitado del tablero. La carpeta sigue en disco.");
      router.push("/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pude quitar el proyecto.");
      setRemoving(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="mt-8 hidden gap-4 md:grid md:grid-cols-3">
          <div className="h-80 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
          <div className="h-80 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
          <div className="h-80 animate-pulse rounded-2xl bg-card ring-1 ring-foreground/10" />
        </div>
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="px-4 py-10 md:px-8">
        <h1 className="font-heading text-4xl">No está el proyecto</h1>
        <p className="mt-3 max-w-lg text-sm text-muted-foreground">{error}</p>
        <Button className="mt-5" variant="outline" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!detail) return null;

  const hasBacklog = detail.files.some((file) => file.path.endsWith("BACKLOG.md"));

  if (selected) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <TaskDetail
          key={selected.id ?? selected.key}
          projectId={id}
          task={selected}
          versions={detail.versions}
          pending={pendingKey === selected.key}
          onClose={closeTask}
          onStatus={(status, commit) => void setStatus(selected, status, commit)}
          onSaved={(next) => {
            setDetail(next);
            const match = next.tasks.find((entry) =>
              selected.id ? entry.id === selected.id : entry.key === selected.key,
            );
            if (match) openTask(match);
            void refresh();
          }}
        />
      </div>
    );
  }

  if (archiveTask) {
    return (
      <div className="px-4 py-6 md:px-8 md:py-8">
        <ArchiveTaskDetail
          projectId={id}
          task={archiveTask}
          repo={detail.sourceRepo}
          onClose={() => setArchiveTask(null)}
        />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl tracking-tight md:text-5xl">{detail.name}</h1>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">{detail.path}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Si guardas un markdown de esta carpeta, la lista se actualiza sola.
            {detail.updatedAt ? ` Último archivo a las ${formatTime(detail.updatedAt)}.` : ""}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mt-2 text-muted-foreground"
            onClick={() => void remove()}
            disabled={removing}
          >
            <Trash2 />
            {removing ? "Quitando…" : "Quitar del tablero"}
          </Button>
        </div>
      </div>

      {detail.error ? (
        <p className="mt-6 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {detail.error}
        </p>
      ) : null}

      {!detail.error && detail.files.length === 0 ? (
        <EmptyFiles
          id={id}
          onCreated={(next) => {
            setDetail(next);
            void refresh();
          }}
        />
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full bg-muted/80 p-1">
        <Button
          variant={view === "tasks" ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          onClick={() => setView("tasks")}
        >
          Tareas
        </Button>
        <Button
          variant={view === "versions" ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          onClick={() => setView("versions")}
        >
          Versiones
        </Button>
        <Button
          variant={view === "roadmap" ? "default" : "ghost"}
          size="sm"
          className="rounded-full"
          onClick={() => setView("roadmap")}
        >
          Roadmap
        </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTaskDialog
            id={id}
            disabled={Boolean(detail.error)}
            versions={detail.versions}
            onCreated={(next) => {
              setDetail(next);
              void refresh();
            }}
          />
          <NewVersionDialog
            id={id}
            disabled={Boolean(detail.error)}
            onCreated={(next) => {
              setDetail(next);
              void refresh();
            }}
          />
        </div>
      </div>

      {view === "tasks" ? (
        <div className="mt-6">
          <TaskList
            detail={detail}
            selectedKey={selectedKey}
            onSelect={openTask}
            onReorder={(file, fromLine, toLine) => {
              markLocalEdit();
              void api<ProjectDetail>(`/api/projects/${id}/tasks/reorder`, {
                method: "POST",
                body: JSON.stringify({ file, fromLine, toLine }),
              })
                .then((next) => {
                  setDetail(next);
                  return refresh();
                })
                .catch((err: unknown) => {
                  toast.error(err instanceof Error ? err.message : "No pude cambiar el orden.");
                });
            }}
          />
        </div>
      ) : null}
      {view === "versions" ? (
        <ArchiveTaskList
          tasks={detail.archiveTasks ?? []}
          versions={detail.versions}
          repo={detail.sourceRepo}
          onOpen={setArchiveTask}
        />
      ) : null}
      {view === "roadmap" ? (
        <RoadmapView
          projectId={id}
          revision={detail.updatedAt}
          file={detail.files.find((file) => file.path.replace(/\\/g, "/").endsWith("ROADMAP.md"))?.path ?? null}
          onChanged={() => load()}
        />
      ) : null}
      {!hasBacklog && detail.files.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Las tareas nuevas se escriben en docs/BACKLOG.md. Este proyecto todavía no lo tiene: al
          crear una, Bitácora lo añade ahí.
        </p>
      ) : null}
    </div>
  );
}

function EmptyFiles({
  id,
  onCreated,
}: {
  id: string;
  onCreated: (detail: ProjectDetail) => void;
}) {
  const { markLocalEdit } = useBitacora();
  const [pending, setPending] = useState(false);

  async function create() {
    setPending(true);
    markLocalEdit();
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/backlog`, { method: "POST" });
      onCreated(next);
      toast("Creé la estructura en docs/, con el mantenimiento del formato.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pude crear el backlog.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl bg-card px-5 py-6 ring-1 ring-foreground/10">
      <h2 className="font-heading text-2xl">Esta carpeta no tiene tareas en markdown</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Puedo dejar en docs/ el backlog, el roadmap, el índice de versiones, el archive, las fichas
        y un MAINTENANCE.md con el formato que hay que respetar. No toco lo que ya exista.
      </p>
      <Button className="mt-4" onClick={() => void create()} disabled={pending}>
        {pending ? "Creando…" : "Crear estructura"}
      </Button>
    </div>
  );
}

function NewTaskDialog({
  id,
  disabled,
  versions,
  onCreated,
}: {
  id: string;
  disabled: boolean;
  versions: VersionEntry[];
  onCreated: (detail: ProjectDetail) => void;
}) {
  const { markLocalEdit } = useBitacora();
  const openVersions = versions.filter((entry) => entry.status !== "published");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [version, setVersion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openDialog(next: boolean) {
    setOpen(next);
    if (!next) return;
    setError(null);
    setVersion(openVersions.find((entry) => entry.status === "doing")?.id ?? "");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    markLocalEdit();
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          title,
          ticketId,
          status,
          version,
        }),
      });
      onCreated(next);
      toast("Tarea escrita en el backlog.");
      setOpen(false);
      setTitle("");
      setTicketId("");
      setStatus("backlog");
      setVersion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude crear la tarea.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button disabled={disabled}>
          <Plus />
          Nueva tarea
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Nueva tarea</DialogTitle>
          <DialogDescription>
            Se añade como checkbox en docs/BACKLOG.md. La versión decide a qué archive pasa cuando
            la marques hecha.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Reintentar la sync si se corta la red"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="task-id">Id</Label>
              <Input
                id="task-id"
                value={ticketId}
                onChange={(event) => setTicketId(event.target.value)}
                placeholder="DATA-020"
                className="font-mono"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="task-version">Versión</Label>
              <select
                id="task-version"
                value={version}
                onChange={(event) => setVersion(event.target.value)}
                className="select-field"
              >
                <option value="">Sin versión</option>
                {openVersions.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.id}
                    {entry.status === "doing" ? " · en curso" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-status">Lista</Label>
            <select
              id="task-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="select-field"
            >
              <option value="backlog">Pendiente</option>
              <option value="doing">En curso</option>
              <option value="done">Hecho</option>
            </select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Escribiendo…" : "Escribir en el backlog"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewVersionDialog({
  id,
  disabled,
  onCreated,
}: {
  id: string;
  disabled: boolean;
  onCreated: (detail: ProjectDetail) => void;
}) {
  const { markLocalEdit } = useBitacora();
  const [open, setOpen] = useState(false);
  const [versionId, setVersionId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"planned" | "doing">("planned");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    markLocalEdit();
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/versions`, {
        method: "POST",
        body: JSON.stringify({ versionId, title, status }),
      });
      onCreated(next);
      toast(status === "doing" ? `${versionId} queda en curso.` : `${versionId} queda prevista.`);
      setOpen(false);
      setVersionId("");
      setTitle("");
      setStatus("planned");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude crear la versión.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Nueva versión
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Nueva versión</DialogTitle>
          <DialogDescription>
            Añade la línea en VERSIONS.md, el punto del roadmap y un archive vacío. Si la dejas en
            curso, la que estaba en curso pasa a previstas. Publicarla es cerrarla en el roadmap.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="version-id">Versión</Label>
              <Input
                id="version-id"
                value={versionId}
                onChange={(event) => setVersionId(event.target.value.trim())}
                placeholder="v1.3.2"
                className="font-mono"
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="version-status">Estado</Label>
              <select
                id="version-status"
                value={status}
                onChange={(event) => setStatus(event.target.value as "planned" | "doing")}
                className="select-field"
              >
                <option value="planned">Prevista</option>
                <option value="doing">En curso</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="version-title">Título</Label>
            <Input
              id="version-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Biblioteca"
              required
            />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Creando…" : "Crear versión"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
