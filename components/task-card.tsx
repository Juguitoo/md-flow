import { PRIORITY_LABEL } from "@/components/lanes";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { ExternalLink } from "lucide-react";

export function TaskCard({
  task,
  pending,
  onToggle,
}: {
  task: Task;
  pending?: boolean;
  onToggle?: () => void;
}) {
  return (
    <article
      className={cn(
        "rounded-xl bg-card px-3 py-3 ring-1 ring-foreground/10",
        pending && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        {task.toggleable ? (
          <button
            type="button"
            onClick={onToggle}
            disabled={pending}
            aria-pressed={task.checked}
            aria-label={task.checked ? "Marcar como pendiente" : "Marcar como hecha"}
            className="mt-0.5 shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            {task.checked ? "[x]" : "[ ]"}
          </button>
        ) : (
          <span className="mt-0.5 shrink-0 font-mono text-[10px] tracking-wide text-muted-foreground">
            {task.source === "github" ? "GH" : "—"}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {task.id ? (
              <span className="font-mono text-[11px] tracking-wide text-primary">{task.id}</span>
            ) : null}
            {task.priority ? (
              <Badge variant="outline">{PRIORITY_LABEL[task.priority]}</Badge>
            ) : null}
            {task.status === "doing" && task.source === "github" ? (
              <Badge variant="secondary">en curso</Badge>
            ) : null}
          </div>
          <h3
            className={cn(
              "mt-1 text-sm leading-snug font-medium",
              task.checked && "text-muted-foreground line-through decoration-foreground/30",
            )}
          >
            {task.title}
          </h3>
          {task.tags.length > 0 ? (
            <p className="mt-2 text-[11px] tracking-wide text-muted-foreground uppercase">
              {task.tags.join(" · ")}
            </p>
          ) : null}
          {task.file ? (
            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              {task.file}:{task.line}
            </p>
          ) : null}
        </div>
        {task.url ? (
          <a
            href={task.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Abrir ${task.id} en GitHub`}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
