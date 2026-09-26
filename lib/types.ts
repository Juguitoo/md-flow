export type Priority = "alta" | "media" | "baja";

export type TaskStatus = "backlog" | "doing" | "done" | "roadmap" | "issue";

export type TaskSource = "markdown" | "github";

export interface Task {
  key: string;
  id: string | null;
  title: string;
  status: TaskStatus;
  priority: Priority | null;
  version: string | null;
  taskType: string | null;
  ref: string | null;
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

export type VersionStatus = "doing" | "planned" | "published";

export interface VersionEntry {
  id: string;
  title: string;
  status: VersionStatus;
  archive: string | null;
}

export interface ArchiveTask {
  key: string;
  id: string;
  title: string;
  taskType: string | null;
  commits: string;
  note: string;
  version: string;
  versionTitle: string;
  file: string;
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
  versions: VersionEntry[];
  versionsFile: string | null;
  archiveTasks: ArchiveTask[];
  sourceRepo: string | null;
}

export interface NewTaskInput {
  title: string;
  ticketId?: string | null;
  status: TaskStatus;
  priority?: Priority | null;
  version?: string | null;
}
