"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ProjectDetail, Task } from "@/lib/types";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function matchesQuery(task: Pick<Task, "id" | "title">, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return fold(task.id ?? "").includes(needle) || fold(task.title).includes(needle);
}

function orderGroup(task: Task): string {
  const file = task.file ?? "";
  if (task.status === "doing") return `${file}\0doing`;
  if (task.status === "backlog") return `${file}\0backlog\0${task.version ?? ""}`;
  return `${file}\0${task.status}`;
}

function arrayMove<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  if (item === undefined) return items;
  next.splice(to, 0, item);
  return next;
}

export function TaskList({
  detail,
  selectedKey,
  onSelect,
  onReorder,
}: {
  detail: ProjectDetail;
  selectedKey: string | null;
  onSelect: (task: Task) => void;
  onReorder: (file: string, fromLine: number, toLine: number) => void;
}) {
  const [query, setQuery] = useState("");
  const active = (detail.tasks ?? []).filter((task) => task.status !== "done");
  const ordered = [
    ...active.filter((task) => task.status === "doing"),
    ...active.filter((task) => task.status !== "doing"),
  ];
  const tasks = ordered.filter((task) => matchesQuery(task, query));

  return (
    <div className="mt-6">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por id o título"
          aria-label="Buscar por id o título"
          className="pl-8"
        />
      </div>
      <div className="mt-3">
        <TaskRows
          tasks={tasks}
          selectedKey={selectedKey}
          onSelect={onSelect}
          onReorder={query.trim() ? undefined : onReorder}
          empty={query.trim() ? "Ninguna tarea coincide." : "Nada abierto. Lo cerrado está en Versiones."}
        />
      </div>
    </div>
  );
}

function TaskRows({
  tasks,
  selectedKey,
  onSelect,
  onReorder,
  empty = "Nada abierto. Lo cerrado está en Versiones.",
}: {
  tasks: Task[];
  selectedKey: string | null;
  onSelect: (task: Task) => void;
  onReorder?: (file: string, fromLine: number, toLine: number) => void;
  empty?: string;
}) {
  const [live, setLive] = useState<Task[] | null>(null);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const order = useRef<Task[]>(tasks);
  const drag = useRef<{
    key: string;
    pointerId: number;
    x: number;
    y: number;
    active: boolean;
    origin: Task[];
  } | null>(null);
  const hold = useRef<number | null>(null);
  const suppressClick = useRef(false);

  const shown = live ?? tasks;

  useEffect(() => {
    if (!draggingKey) return;
    const previousUserSelect = document.body.style.userSelect;
    const previousTouchAction = document.body.style.touchAction;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = "none";
    document.body.style.touchAction = "none";
    document.body.style.cursor = "grabbing";
    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.touchAction = previousTouchAction;
      document.body.style.cursor = previousCursor;
    };
  }, [draggingKey]);

  function clearHold() {
    if (hold.current !== null) window.clearTimeout(hold.current);
    hold.current = null;
  }

  function finishDrag(commit: boolean) {
    clearHold();
    const state = drag.current;
    drag.current = null;
    setDraggingKey(null);
    const finalOrder = order.current;
    setLive(null);
    if (state?.active) {
      suppressClick.current = true;
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    }
    if (!state?.active || !commit || !onReorder) return;
    const origin = state.origin;
    const fromIndex = origin.findIndex((task) => task.key === state.key);
    const toIndex = finalOrder.findIndex((task) => task.key === state.key);
    const moving = origin[fromIndex];
    const target = origin[toIndex];
    if (!moving || !target || fromIndex === toIndex) return;
    if (!moving.file || moving.line === null || target.line === null) return;
    onReorder(moving.file, moving.line, target.line);
  }

  function stepToward(clientY: number, key: string) {
    let current = order.current;
    for (let step = 0; step < current.length; step += 1) {
      const index = current.findIndex((task) => task.key === key);
      const moving = current[index];
      if (!moving || index < 0) return;
      const before = current[index - 1];
      const after = current[index + 1];
      let nextIndex = index;
      if (after && orderGroup(after) === orderGroup(moving)) {
        const rect = rows.current.get(after.key)?.getBoundingClientRect();
        if (rect && clientY > rect.top + rect.height / 2) nextIndex = index + 1;
      }
      if (nextIndex === index && before && orderGroup(before) === orderGroup(moving)) {
        const rect = rows.current.get(before.key)?.getBoundingClientRect();
        if (rect && clientY < rect.top + rect.height / 2) nextIndex = index - 1;
      }
      if (nextIndex === index) return;
      current = arrayMove(current, index, nextIndex);
      order.current = current;
      setLive(current);
    }
  }

  if (tasks.length === 0) {
    return <p className="px-1 py-6 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <ul className="flex flex-col gap-0.5">
      {shown.map((task) => {
        const selected = task.key === selectedKey;
        const doing = task.status === "doing";
        const dragging = task.key === draggingKey;
        const movable = Boolean(onReorder && task.file && task.line !== null && task.toggleable);
        return (
          <li
            key={task.key}
            ref={(node) => {
              if (node) rows.current.set(task.key, node);
              else rows.current.delete(task.key);
            }}
            className={cn(dragging && "relative z-10")}
            onPointerDown={(event) => {
              if (!movable || event.button !== 0) return;
              const pointerId = event.pointerId;
              drag.current = {
                key: task.key,
                pointerId,
                x: event.clientX,
                y: event.clientY,
                active: false,
                origin: tasks,
              };
              order.current = tasks;
              clearHold();
              hold.current = window.setTimeout(() => {
                const state = drag.current;
                if (!state || state.pointerId !== pointerId) return;
                try {
                  rows.current.get(state.key)?.setPointerCapture(pointerId);
                } catch {
                  // Si el puntero ya no está activo, el arrastre sigue con los eventos del elemento.
                }
                state.active = true;
                setDraggingKey(task.key);
                setLive(tasks);
              }, 280);
            }}
            onPointerMove={(event) => {
              const state = drag.current;
              if (!state || state.pointerId !== event.pointerId) return;
              if (!state.active) {
                if (Math.hypot(event.clientX - state.x, event.clientY - state.y) > 8) {
                  clearHold();
                  drag.current = null;
                }
                return;
              }
              stepToward(event.clientY, state.key);
            }}
            onPointerUp={() => finishDrag(true)}
            onPointerCancel={() => {
              order.current = drag.current?.origin ?? tasks;
              finishDrag(false);
            }}
          >
            <button
              type="button"
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onSelect(task);
              }}
              aria-pressed={selected}
              title={movable ? "Mantén pulsado para reordenar" : undefined}
              className={cn(
                "grid w-full grid-cols-[0.7rem_4.5rem_minmax(0,1fr)] items-center gap-x-3 rounded-xl px-3 py-2.5 text-left transition-colors sm:grid-cols-[0.7rem_5.25rem_minmax(0,1fr)_auto_4.5rem_minmax(0,8rem)]",
                selected ? "bg-card shadow-sm ring-1 ring-foreground/10" : "hover:bg-card/70",
                dragging && "scale-[1.01] cursor-grabbing bg-card shadow-md ring-1 ring-foreground/15",
                movable && !dragging && "cursor-grab",
              )}
            >
              <span
                className={cn(
                  "size-2 justify-self-center rounded-full ring-2 ring-offset-2 ring-offset-background",
                  doing
                    ? "bg-[oklch(0.78_0.15_95)] ring-[oklch(0.78_0.15_95)]/40"
                    : "bg-[oklch(0.62_0.13_145)] ring-[oklch(0.62_0.13_145)]/30",
                )}
                title={doing ? "En curso" : "Pendiente"}
                aria-hidden
              />
              <span className="truncate font-mono text-[11px] text-primary">
                {task.id ?? "—"}
              </span>
              <span className="truncate text-sm">{task.title}</span>
              {task.version || task.taskType || task.ref ? (
                <span className="col-span-2 col-start-2 flex min-w-0 items-center gap-2 truncate text-[11px] text-muted-foreground sm:hidden">
                  {task.version ? (
                    <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{task.version}</span>
                  ) : null}
                  {task.taskType ? <span>{task.taskType}</span> : null}
                  <span className="truncate">{task.ref}</span>
                </span>
              ) : null}
              <span className="hidden justify-self-end sm:block">
                {task.version ? (
                  <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {task.version}
                  </span>
                ) : null}
              </span>
              <span className="hidden truncate text-right text-[11px] text-muted-foreground sm:block">
                {task.taskType ?? ""}
              </span>
              <span className="hidden truncate text-right font-mono text-[11px] text-muted-foreground sm:block">
                {task.ref ?? ""}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
