import type { Priority, TaskStatus } from "@/lib/types";

export const LANES: {
  status: TaskStatus;
  title: string;
  hint: string;
  tone: string;
}[] = [
  {
    status: "backlog",
    title: "To do",
    hint: "Not started yet",
    tone: "bg-lane-backlog",
  },
  {
    status: "doing",
    title: "In progress",
    hint: "What you're working on now",
    tone: "bg-lane-doing",
  },
  {
    status: "done",
    title: "Done",
    hint: "Closed in the markdown",
    tone: "bg-lane-done",
  },
  {
    status: "roadmap",
    title: "Roadmap",
    hint: "Milestones, not day-to-day work",
    tone: "bg-lane-roadmap",
  },
  {
    status: "issue",
    title: "Issues",
    hint: "What is still open",
    tone: "bg-lane-issue",
  },
];

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "High",
  media: "Medium",
  baja: "Low",
};

export const EMPTY_LANE: Record<TaskStatus, string> = {
  backlog: "Nothing to do. Add one here or write it in BACKLOG.md.",
  doing: "Nothing in progress.",
  done: "Nothing closed yet.",
  roadmap: "The roadmap is empty.",
  issue: "No open issues.",
};
