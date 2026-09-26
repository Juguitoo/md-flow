"use client";

import { AddProjectDialog } from "@/components/add-project-dialog";
import { useBitacora } from "@/components/bitacora-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CircleHelp, Moon, PanelLeftClose, PanelLeftOpen, Plus, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";

  return (
    <Button
      variant="ghost"
      size={compact ? "icon-sm" : "sm"}
      className={compact ? "text-muted-foreground" : "w-full justify-start text-muted-foreground"}
      aria-label={dark ? "Modo claro" : "Modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun /> : <Moon />}
      {compact ? null : dark ? "Modo claro" : "Modo oscuro"}
    </Button>
  );
}

function LiveStatus({ compact = false, hideLabel = false }: { compact?: boolean; hideLabel?: boolean }) {
  const { live } = useBitacora();
  const label =
    live === "on" ? "Escuchando archivos" : live === "off" ? "Sin conexión en vivo" : "Conectando";
  return (
    <p
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", compact && "text-[11px]")}
      title={hideLabel ? label : undefined}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live === "on" && "bg-lane-doing animate-pulse",
          live === "off" && "bg-destructive",
          live === "connecting" && "bg-lane-backlog",
        )}
        aria-hidden
      />
      {hideLabel ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </p>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { projects } = useBitacora();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("bitacora-nav") === "collapsed");
  }, []);

  function toggleNav() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("bitacora-nav", next ? "collapsed" : "open");
      return next;
    });
  }

  return (
    <div
      className={cn(
        "min-h-full md:grid",
        collapsed ? "md:grid-cols-[68px_minmax(0,1fr)]" : "md:grid-cols-[248px_minmax(0,1fr)]",
      )}
    >
      <header className="sticky top-0 z-20 border-b border-border/80 bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-heading text-2xl leading-none tracking-tight">
            Bitácora
          </Link>
          <div className="flex items-center gap-3">
            <LiveStatus compact />
            <ThemeToggle compact />
            <AddProjectDialog
              trigger={
                <Button size="icon-sm" variant="outline" aria-label="Añadir proyecto">
                  <Plus />
                </Button>
              }
            />
          </div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <ShellLink href="/" active={pathname === "/"}>
            Proyectos
          </ShellLink>
          {projects.map((project) => (
            <ShellLink
              key={project.id}
              href={`/projects/${project.id}`}
              active={pathname === `/projects/${project.id}`}
            >
              {project.name}
            </ShellLink>
          ))}
          <ShellLink href="/como-funciona" active={pathname === "/como-funciona"}>
            Cómo funciona
          </ShellLink>
        </nav>
      </header>

      <aside
        className={cn(
          "sticky top-0 hidden h-dvh flex-col border-r border-border/80 bg-sidebar py-4 md:flex",
          collapsed ? "items-center px-1.5" : "px-4 py-6",
        )}
      >
        {collapsed ? (
          <div className="flex w-full justify-center">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={toggleNav}
              aria-expanded={false}
              aria-label="Abrir la navegación"
            >
              <PanelLeftOpen />
            </Button>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <Link href="/" className="min-w-0 px-2">
              <p className="font-heading text-3xl leading-none tracking-tight">Bitácora</p>
              <p className="mt-2 text-xs text-muted-foreground">Tus markdown, en vivo</p>
            </Link>
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={toggleNav}
              aria-expanded
              aria-label="Plegar la navegación"
            >
              <PanelLeftClose />
            </Button>
          </div>
        )}
        {collapsed ? (
          <>
            <Link href="/" className="mt-4" aria-label="Bitácora" title="Bitácora">
              <span className="font-heading text-xl leading-none">B</span>
            </Link>
            <div className="mt-4">
              <LiveStatus compact hideLabel />
            </div>
            <nav className="mt-6 flex min-h-0 w-full flex-1 flex-col items-center gap-1 overflow-y-auto">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  title={project.name}
                  aria-label={project.name}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-full text-sm transition-colors hover:bg-card",
                    pathname === `/projects/${project.id}` &&
                      "bg-card font-medium shadow-sm ring-1 ring-foreground/10",
                  )}
                >
                  {project.name.slice(0, 1).toUpperCase()}
                </Link>
              ))}
            </nav>
            <div className="mt-4 grid justify-items-center gap-2">
              <AddProjectDialog
                trigger={
                  <Button size="icon-sm" variant="outline" aria-label="Añadir proyecto">
                    <Plus />
                  </Button>
                }
              />
              <Link
                href="/como-funciona"
                title="Cómo funciona"
                aria-label="Cómo funciona"
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname === "/como-funciona" && "bg-muted text-foreground",
                )}
              >
                <CircleHelp className="size-4" />
              </Link>
              <ThemeToggle compact />
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 px-2">
              <LiveStatus />
            </div>
            <nav className="mt-8 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
              <p className="px-2 pb-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                Proyectos
              </p>
              {projects.map((project) => (
                <Link
                  key={project.id}
                  href={`/projects/${project.id}`}
                  className={cn(
                    "rounded-xl px-2.5 py-2 text-sm transition-colors hover:bg-card",
                    pathname === `/projects/${project.id}` &&
                      "bg-card font-medium shadow-sm ring-1 ring-foreground/10",
                  )}
                >
                  {project.name}
                </Link>
              ))}
              {projects.length === 0 ? (
                <p className="px-2 text-sm text-muted-foreground">Todavía no hay carpetas.</p>
              ) : null}
            </nav>
            <div className="mt-4 grid gap-2">
              <AddProjectDialog
                trigger={
                  <Button variant="outline" className="w-full justify-start">
                    <Plus />
                    Añadir proyecto
                  </Button>
                }
              />
              <Link
                href="/como-funciona"
                className={cn(
                  "rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  pathname === "/como-funciona" && "bg-muted text-foreground",
                )}
              >
                Cómo funciona
              </Link>
              <ThemeToggle />
            </div>
          </>
        )}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ShellLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "shrink-0 rounded-full px-3 py-1 text-sm ring-1 ring-border",
        active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
