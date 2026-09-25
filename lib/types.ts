export type Priority = "alta" | "media" | "baja";

export type TaskStatus = "backlog" | "doing" | "done" | "roadmap" | "issue";

export type TaskSource = "markdown" | "github";

export interface Task {
  key: string;
  id: string | null;
  title: string;
  status: TaskStatus;
  priority: Priority | null;
  tags: string[];
  source: TaskSource;
  file: string | null;
  line: number | null;
  checked: boolean;
  toggleable: boolean;
  body: string;
  url: string | null;
}

export interface ProjectRecord {
  id: string;
  name: string;
  path: string;
  github: string | null;
}

export interface ProjectFile {
  path: string;
  mtime: string;
}

export interface TaskHighlight {
  id: string | null;
  title: string;
  status: TaskStatus;
}

export interface ProjectSummary {
  id: string;
  name: string;
  path: string;
  github: string | null;
  counts: Record<TaskStatus, number>;
  openCount: number;
  files: ProjectFile[];
  highlights: TaskHighlight[];
  error: string | null;
  updatedAt: string;
}

export interface ProjectDetail extends ProjectSummary {
  tasks: Task[];
  githubTasks: Task[];
  githubError: string | null;
  githubTruncated: boolean;
}

export interface NewTaskInput {
  title: string;
  ticketId?: string | null;
  status: TaskStatus;
  priority?: Priority | null;
}
