import type { Priority, TaskStatus } from "@/lib/types";

export const LANES: {
  status: TaskStatus;
  title: string;
  hint: string;
  tone: string;
}[] = [
  {
    status: "backlog",
    title: "Pendiente",
    hint: "Todavía no empezadas",
    tone: "bg-lane-backlog",
  },
  {
    status: "doing",
    title: "En curso",
    hint: "Lo que estás tocando ahora",
    tone: "bg-lane-doing",
  },
  {
    status: "done",
    title: "Hecho",
    hint: "Cerradas en el markdown",
    tone: "bg-lane-done",
  },
  {
    status: "roadmap",
    title: "Roadmap",
    hint: "Hitos, no el día a día",
    tone: "bg-lane-roadmap",
  },
  {
    status: "issue",
    title: "Problemas",
    hint: "Lo que sigue abierto",
    tone: "bg-lane-issue",
  },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const EMPTY_LANE: Record<TaskStatus, string> = {
  backlog: "Nada pendiente. Añádela aquí o escríbela en BACKLOG.md.",
  doing: "Nada en curso.",
  done: "Todavía no hay nada cerrado.",
  roadmap: "El roadmap está vacío.",
  issue: "No hay problemas abiertos.",
};
