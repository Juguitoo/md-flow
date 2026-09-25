"use client";

import { useBitacora } from "@/components/bitacora-provider";
import { EMPTY_LANE, LANES } from "@/components/lanes";
import { TaskCard } from "@/components/task-card";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, formatTime } from "@/lib/client";
import { cn } from "@/lib/utils";
import type { Priority, ProjectDetail, Task, TaskStatus } from "@/lib/types";
import { Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const DAILY: TaskStatus[] = ["backlog", "doing", "done"];

export function ProjectBoard({ id }: { id: string }) {
  const { subscribe, refresh, markLocalEdit } = useBitacora();
  const router = useRouter();
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [lane, setLane] = useState("doing");
  const [removing, setRemoving] = useState(false);

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
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

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

  const columns = useMemo(() => {
    if (!detail) return [];
    const visible: {
      status: TaskStatus;
      title: string;
      hint: string;
      tone: string;
      key: string;
      tasks: Task[];
    }[] = LANES.filter(
      (entry) => DAILY.includes(entry.status) || detail.counts[entry.status] > 0,
    ).map((entry) => ({
      ...entry,
      key: entry.status,
      tasks: detail.tasks.filter((task) => task.status === entry.status),
    }));
    if (detail.github) {
      visible.push({
        status: "issue",
        title: "GitHub",
        hint: detail.github,
        tone: "bg-foreground",
        key: "github",
        tasks: detail.githubTasks,
      });
    }
    return visible;
  }, [detail]);

  async function toggle(task: Task) {
    if (!task.file || task.line === null) return;
    setPendingKey(task.key);
    markLocalEdit();
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/tasks/toggle`, {
        method: "POST",
        body: JSON.stringify({ file: task.file, line: task.line }),
      });
      setDetail(next);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pude actualizar la tarea.");
    } finally {
      setPendingKey(null);
    }
  }

  async function remove() {
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

  return (
    <div className="px-4 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-heading text-4xl tracking-tight md:text-5xl">{detail.name}</h1>
          <p className="mt-2 font-mono text-[11px] text-muted-foreground">{detail.path}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Si guardas un markdown de esta carpeta, el tablero se mueve solo.
            {detail.updatedAt ? ` Último archivo a las ${formatTime(detail.updatedAt)}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NewTaskDialog
            id={id}
            disabled={Boolean(detail.error)}
            onCreated={(next) => {
              setDetail(next);
              void refresh();
            }}
          />
          <GithubDialog
            id={id}
            repo={detail.github}
            onSaved={(next) => {
              setDetail(next);
              void refresh();
            }}
          />
          <Button variant="ghost" onClick={() => void remove()} disabled={removing}>
            Quitar
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

      <div className="mt-6 md:hidden">
        <Tabs value={lane} onValueChange={setLane}>
          <TabsList className="w-full overflow-x-auto">
            {columns.map((column) => (
              <TabsTrigger key={column.key} value={column.key}>
                {column.title}
                <span className="text-muted-foreground">{column.tasks.length}</span>
              </TabsTrigger>
            ))}
          </TabsList>
          {columns.map((column) => (
            <TabsContent key={column.key} value={column.key} className="mt-4 grid gap-2">
              <ColumnBody
                column={column}
                detail={detail}
                pendingKey={pendingKey}
                onToggle={toggle}
                onRefreshGithub={() => void load(true)}
              />
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="mt-6 hidden gap-4 md:grid md:auto-cols-[minmax(260px,1fr)] md:grid-flow-col md:overflow-x-auto md:pb-4">
        {columns.map((column) => (
          <section key={column.key} className="min-w-[260px]">
            <header className="mb-3 flex items-baseline justify-between gap-2 px-1">
              <div>
                <h2 className="flex items-center gap-2 font-heading text-2xl tracking-tight">
                  <span className={cn("size-2 rounded-full", column.tone)} aria-hidden />
                  {column.title}
                </h2>
                <p className="text-xs text-muted-foreground">{column.hint}</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{column.tasks.length}</span>
            </header>
            <div className="grid gap-2">
              <ColumnBody
                column={column}
                detail={detail}
                pendingKey={pendingKey}
                onToggle={toggle}
                onRefreshGithub={() => void load(true)}
              />
            </div>
          </section>
        ))}
      </div>
      {!hasBacklog && detail.files.length > 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Las tareas nuevas se escriben en BACKLOG.md. Este proyecto todavía no lo tiene: al crear
          una, Bitácora lo añade en la raíz.
        </p>
      ) : null}
    </div>
  );
}

function ColumnBody({
  column,
  detail,
  pendingKey,
  onToggle,
  onRefreshGithub,
}: {
  column: { key: string; status: TaskStatus; tasks: Task[] };
  detail: ProjectDetail;
  pendingKey: string | null;
  onToggle: (task: Task) => void;
  onRefreshGithub: () => void;
}) {
  if (column.key === "github" && detail.githubError) {
    return (
      <div className="rounded-xl bg-destructive/10 px-3 py-3 text-sm text-destructive">
        <p>{detail.githubError}</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={onRefreshGithub}>
          <RefreshCw />
          Reintentar
        </Button>
      </div>
    );
  }

  if (column.tasks.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-border px-3 py-6 text-sm text-muted-foreground">
        {column.key === "github"
          ? "No hay issues abiertas."
          : EMPTY_LANE[column.status]}
      </p>
    );
  }

  return (
    <>
      {column.tasks.map((task) => (
        <TaskCard
          key={task.key}
          task={task}
          pending={pendingKey === task.key}
          onToggle={() => onToggle(task)}
        />
      ))}
      {column.key === "github" && detail.githubTruncated ? (
        <p className="px-1 text-[11px] text-muted-foreground">
          Mostrando las 30 issues abiertas actualizadas más recientemente.
        </p>
      ) : null}
      {column.key === "github" ? (
        <Button variant="ghost" size="sm" onClick={onRefreshGithub}>
          <RefreshCw />
          Actualizar GitHub
        </Button>
      ) : null}
    </>
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
      toast("Creé BACKLOG.md en la raíz del proyecto.");
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
        Busco BACKLOG.md, ROADMAP.md, KNOWN_ISSUES.md, TASKS.md, TODO.md e ISSUES.md en la raíz y
        en docs/. Si usas otros nombres, puedes listarlos en un bitacora.json.
      </p>
      <Button className="mt-4" onClick={() => void create()} disabled={pending}>
        {pending ? "Creando…" : "Crear BACKLOG.md"}
      </Button>
    </div>
  );
}

function NewTaskDialog({
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
  const [title, setTitle] = useState("");
  const [ticketId, setTicketId] = useState("");
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [priority, setPriority] = useState<Priority | "">("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
          priority: priority || null,
        }),
      });
      onCreated(next);
      toast("Tarea escrita en BACKLOG.md.");
      setOpen(false);
      setTitle("");
      setTicketId("");
      setStatus("backlog");
      setPriority("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude crear la tarea.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
            Se añade como checkbox en BACKLOG.md. Si editas ese archivo a mano, el tablero también
            lo ve.
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
              <Label htmlFor="task-priority">Prioridad</Label>
              <select
                id="task-priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority | "")}
                className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Sin marcar</option>
                <option value="alta">Alta</option>
                <option value="media">Media</option>
                <option value="baja">Baja</option>
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="task-status">Columna</Label>
            <select
              id="task-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as TaskStatus)}
              className="h-8 rounded-lg border border-input bg-transparent px-2 text-sm"
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

function GithubDialog({
  id,
  repo,
  onSaved,
}: {
  id: string;
  repo: string | null;
  onSaved: (detail: ProjectDetail) => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(repo ?? "");
  const [token, setToken] = useState("");
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function openDialog(next: boolean) {
    setOpen(next);
    if (!next) return;
    setValue(repo ?? "");
    setError(null);
    void api<{ configured: boolean; source: "file" | "env" | null }>("/api/github/token")
      .then((result) => {
        setTokenState(
          result.source === "file"
            ? "Hay un token guardado en esta máquina."
            : result.source === "env"
              ? "Está usando GITHUB_TOKEN del entorno."
              : "Sin token: solo repositorios públicos, con límite de peticiones.",
        );
      })
      .catch(() => setTokenState(null));
  }

  async function saveRepo(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const next = await api<ProjectDetail>(`/api/projects/${id}/github`, {
        method: "PUT",
        body: JSON.stringify({ repo: value }),
      });
      onSaved(next);
      if (next.githubError) toast.error(next.githubError);
      else toast(next.github ? `Conectado a ${next.github}.` : "GitHub desconectado.");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude guardar el repositorio.");
    } finally {
      setPending(false);
    }
  }

  async function saveToken() {
    setPending(true);
    setError(null);
    try {
      const result = await api<{ configured: boolean; source: "file" | "env" | null }>(
        "/api/github/token",
        { method: "PUT", body: JSON.stringify({ token }) },
      );
      setToken("");
      setTokenState(
        result.source === "file"
          ? "Token guardado en data/github-token. No se sube a git."
          : result.source === "env"
            ? "Quité el token del archivo. Sigue el del entorno, si lo hay."
            : "Token borrado.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pude guardar el token.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openDialog}>
      <DialogTrigger asChild>
        <Button variant="outline">
          GitHub
          {repo ? <Badge variant="secondary">{repo.split("/")[1]}</Badge> : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">GitHub</DialogTitle>
          <DialogDescription>
            Las issues abiertas aparecen en su propia columna. El backlog en markdown no se sube
            solo: eso sigue siendo un commit tuyo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={saveRepo} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="github-repo">Repositorio</Label>
            <Input
              id="github-repo"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="tu-usuario/juguitoReader"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Conectando…" : value.trim() ? "Conectar" : "Quitar conexión"}
            </Button>
          </DialogFooter>
        </form>
        <div className="grid gap-2 border-t border-border pt-3">
          <Label htmlFor="github-token">Token opcional</Label>
          <Input
            id="github-token"
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="github_pat_…"
            autoComplete="off"
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Hace falta para repos privados y para no chocar con el límite de la API. Un fine-grained
            token con lectura de issues basta. Se guarda solo en esta máquina.
          </p>
          {tokenState ? <p className="text-xs text-muted-foreground">{tokenState}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void saveToken()}>
              Guardar token
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setToken("");
                void api("/api/github/token", {
                  method: "PUT",
                  body: JSON.stringify({ token: "" }),
                }).then(() => setTokenState("Token del archivo borrado."));
              }}
            >
              Borrar token
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
