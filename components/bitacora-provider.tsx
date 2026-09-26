"use client";

import { api } from "@/lib/client";
import type { ProjectSummary } from "@/lib/types";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export interface UpdateEvent {
  projectId: string;
  file: string;
  quiet: boolean;
}

type Live = "connecting" | "on" | "off";

interface BitacoraContextValue {
  projects: ProjectSummary[];
  loading: boolean;
  error: string | null;
  live: Live;
  refresh: () => Promise<void>;
  markLocalEdit: () => void;
  subscribe: (listener: (event: UpdateEvent) => void) => () => void;
}

const BitacoraContext = createContext<BitacoraContextValue | null>(null);

export function BitacoraProvider({
  children,
  initialProjects,
}: {
  children: React.ReactNode;
  initialProjects: ProjectSummary[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState<Live>("connecting");
  const muteUntil = useRef(0);
  const listeners = useRef(new Set<(event: UpdateEvent) => void>());

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ projects: ProjectSummary[] }>("/api/projects");
      setProjects(data.projects);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load the projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const source = new EventSource("/api/events");
    source.onopen = () => {
      setLive("on");
      void refresh();
    };
    source.onerror = () => setLive("off");
    const onUpdate = (event: Event) => {
      let payload: { projectId: string; file: string };
      try {
        payload = JSON.parse((event as MessageEvent).data) as {
          projectId: string;
          file: string;
        };
      } catch {
        return;
      }
      void refresh();
      const quiet = Date.now() < muteUntil.current;
      for (const listener of listeners.current) {
        listener({ ...payload, quiet });
      }
    };
    source.addEventListener("update", onUpdate);
    return () => {
      source.close();
    };
  }, [refresh]);

  const subscribe = useCallback((listener: (event: UpdateEvent) => void) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const markLocalEdit = useCallback(() => {
    muteUntil.current = Date.now() + 900;
  }, []);

  const value = useMemo(
    () => ({ projects, loading, error, live, refresh, markLocalEdit, subscribe }),
    [projects, loading, error, live, refresh, markLocalEdit, subscribe],
  );

  return <BitacoraContext.Provider value={value}>{children}</BitacoraContext.Provider>;
}

export function useBitacora() {
  const context = useContext(BitacoraContext);
  if (!context) {
    throw new Error("useBitacora tiene que usarse dentro de BitacoraProvider.");
  }
  return context;
}
