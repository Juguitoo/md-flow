"use client";

import { AddProjectDialog } from "@/components/add-project-dialog";
import { useBitacora } from "@/components/bitacora-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function LiveStatus({ compact = false }: { compact?: boolean }) {
  const { live } = useBitacora();
  const label =
    live === "on" ? "Escuchando archivos" : live === "off" ? "Sin conexión en vivo" : "Conectando";
  return (
    <p className={cn("flex items-center gap-2 text-xs text-muted-foreground", compact && "text-[11px]")}>
      <span
        className={cn(
          "size-1.5 rounded-full",
          live === "on" && "bg-lane-doing animate-pulse",
          live === "off" && "bg-destructive",
          live === "connecting" && "bg-lane-backlog",
        )}
        aria-hidden
      />
      <span>{label}</span>
    </p>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { projects } = useBitacora();
  const pathname = usePathname();

  return (
    <div className="min-h-full md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-sidebar/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="font-heading text-2xl leading-none tracking-tight">
            Bitácora
          </Link>
          <div className="flex items-center gap-3">
            <LiveStatus compact />
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

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border/80 bg-sidebar px-4 py-6 md:flex">
        <Link href="/" className="px-2">
          <p className="font-heading text-3xl leading-none tracking-tight">Bitácora</p>
          <p className="mt-2 text-xs text-muted-foreground">Tus markdown, en vivo</p>
        </Link>
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
                "rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                pathname === `/projects/${project.id}` && "bg-muted font-medium",
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
        </div>
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
