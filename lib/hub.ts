import fs from "node:fs";
import path from "node:path";
import { TRACKED_BASENAMES } from "./markdown";
import { isDirectory, resolveProjectPath } from "./paths";
import { ensureRegistry } from "./registry";
import { discoverFiles } from "./scan";
import type { ProjectRecord } from "./types";

export interface FileEvent {
  projectId: string;
  file: string;
}

type Listener = (event: FileEvent) => void;

class Hub {
  private listeners = new Set<Listener>();
  private watchers = new Map<string, fs.FSWatcher>();
  private watchedPath = new Map<string, string>();
  private tracked = new Map<string, Set<string>>();
  private timers = new Map<string, NodeJS.Timeout>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  broadcast(event: FileEvent) {
    for (const listener of this.listeners) listener(event);
  }

  async sync() {
    const projects = await ensureRegistry();
    const alive = new Set(projects.map((project) => project.id));

    for (const [id, watcher] of this.watchers) {
      const project = projects.find((entry) => entry.id === id);
      const root = project ? resolveProjectPath(project.path) : "";
      if (!project || !alive.has(id) || this.watchedPath.get(id) !== root) {
        watcher.close();
        this.watchers.delete(id);
        this.watchedPath.delete(id);
        this.tracked.delete(id);
      }
    }

    await Promise.all(projects.map((project) => this.arm(project)));
  }

  private async arm(project: ProjectRecord) {
    const root = resolveProjectPath(project.path);
    if (!isDirectory(root)) return;

    try {
      const files = await discoverFiles(root);
      this.tracked.set(project.id, new Set(files));
    } catch {
      return;
    }

    if (this.watchers.has(project.id)) return;

    try {
      const watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
        if (!filename) return;
        const relative = filename.split(path.sep).join("/");
        if (relative.includes("node_modules/") || relative.startsWith(".git")) return;
        if (!this.isRelevant(project.id, relative)) return;

        const pending = this.timers.get(project.id);
        if (pending) clearTimeout(pending);
        const timer = setTimeout(() => {
          this.timers.delete(project.id);
          this.broadcast({ projectId: project.id, file: relative });
        }, 180);
        timer.unref?.();
        this.timers.set(project.id, timer);
      });
      watcher.on("error", () => {
        watcher.close();
        this.watchers.delete(project.id);
        this.watchedPath.delete(project.id);
      });
      this.watchers.set(project.id, watcher);
      this.watchedPath.set(project.id, root);
    } catch {
      // Sin permiso de vigilancia: el tablero sigue leyendo al recargar.
    }
  }

  private isRelevant(projectId: string, relative: string): boolean {
    if (this.tracked.get(projectId)?.has(relative)) return true;
    const base = path.posix.basename(relative).toLowerCase();
    if (base === "bitacora.json") return true;
    return TRACKED_BASENAMES.some((name) => name.toLowerCase() === base);
  }
}

const globalStore = globalThis as typeof globalThis & { __bitacoraHub?: Hub };

export function getHub(): Hub {
  if (!globalStore.__bitacoraHub) globalStore.__bitacoraHub = new Hub();
  return globalStore.__bitacoraHub;
}
